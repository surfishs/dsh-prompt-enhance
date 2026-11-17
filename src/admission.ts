/**
 * Admission control for every entry that can spend a model call: a
 * sliding-window rate cap, a concurrency cap, and a consecutive-failure breaker.
 *
 * The composer route and the `/enhance` command reach the model through the same
 * host process, so they must share ONE gate. Separate gates would let the
 * command plane sidestep the caps the settings page advertises.
 * @module dsh-prompt-enhance/admission
 */

import type { EnhanceError } from './shared/protocol'

/**
 * Consecutive failed calls that trip the cool-down, and how long it lasts.
 *
 * The sliding window counts successful calls only, so a run of timeouts never
 * burns the user's quota. That leaves one hole: a deterministic upstream
 * failure — a wrong API key, a mistyped provider, a model the account cannot
 * reach — fails in milliseconds, and a retry loop against such a failure is
 * bounded only by the concurrency cap, i.e. barely at all. Three consecutive
 * failures are enough to tell "the model is flaky" from "this route cannot
 * work", so the gate pauses instead of hammering the provider.
 */
export const FAILURE_STREAK_LIMIT = 3
export const FAILURE_COOLDOWN_MS = 30_000

/** Caps of one admission decision, read from the live configuration. */
export interface AdmissionLimits {
  rateLimitPerMinute: number
  maxConcurrent: number
}

/** How one admitted call ended, as the gate counts it. */
export type AdmissionOutcome = 'success' | 'failure' | 'aborted'

/** One admission answer. */
export type AdmissionDecision = { ok: true } | { ok: false; error: EnhanceError; retryAfterSeconds?: number }

/**
 * One process-wide admission gate.
 *
 * The rate window counts SUCCESSFUL calls only: counting attempts would burn
 * the user's window on a run of timeouts or upstream errors and lock them out
 * right when the model recovers. The concurrency cap still bounds in-flight
 * calls regardless of outcome, and a cancellation is neither a success nor a
 * failure.
 */
export class AdmissionGate {
  private stamps: number[] = []
  private active = 0
  private failures = 0
  private cooldownUntil = 0

  /**
   * Ask for a slot.
   * @param now - epoch millis of the admission attempt.
   * @param limits - the live caps.
   * @returns the decision; a refusal carries the wire error, plus the
   *   advertised wait when the gate can predict one.
   */
  admit(now: number, limits: AdmissionLimits): AdmissionDecision {
    // Failure breaker first: a host stuck on a broken route must refuse before
    // spending a window slot, and the wait is advertised so the caller can say
    // when to try again.
    if (now < this.cooldownUntil) {
      const retryAfterSeconds = Math.max(1, Math.ceil((this.cooldownUntil - now) / 1000))
      return { ok: false, error: { code: 'cooldown', params: { retryAfterSeconds, failures: FAILURE_STREAK_LIMIT } }, retryAfterSeconds }
    }
    // Trim the window in one splice instead of a `while (shift)` loop: with the
    // configured cap at 600 the worst case drops from O(N²) array shifts to a
    // single O(N) relocation.
    const cut = now - 60_000
    let validFrom = 0
    while (validFrom < this.stamps.length && (this.stamps[validFrom] ?? cut) < cut) validFrom++
    if (validFrom > 0) this.stamps.splice(0, validFrom)
    if (this.stamps.length >= limits.rateLimitPerMinute) {
      // The window is bounded, so the oldest surviving stamp tells exactly when
      // a slot frees up — advertise it instead of making the caller guess.
      const oldest = this.stamps[0] ?? now
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - oldest)) / 1000))
      return { ok: false, error: { code: 'rate-limit', params: { limit: limits.rateLimitPerMinute, retryAfterSeconds } }, retryAfterSeconds }
    }
    // No retry-after here: a busy slot frees whenever some in-flight call
    // settles, which is not a delay this gate can predict.
    if (this.active >= limits.maxConcurrent) {
      return { ok: false, error: { code: 'concurrency-limit', params: { max: limits.maxConcurrent } } }
    }
    this.active += 1
    return { ok: true }
  }

  /**
   * Release the slot one admitted call held and record how it ended.
   * @param outcome - success, failure, or a cancellation (counted as neither).
   * @param now - epoch millis when the call settled.
   */
  settle(outcome: AdmissionOutcome, now: number): void {
    if (this.active > 0) this.active -= 1
    if (outcome === 'success') {
      // Stamped at completion, not admission: a slow success still counts as
      // one call, and failures never consume the window.
      this.stamps.push(now)
      this.failures = 0
      return
    }
    if (outcome === 'failure') {
      this.failures += 1
      if (this.failures >= FAILURE_STREAK_LIMIT) {
        this.cooldownUntil = now + FAILURE_COOLDOWN_MS
        this.failures = 0
      }
    }
  }
}
