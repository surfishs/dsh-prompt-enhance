/**
 * Admission-gate breaker classification (B6).
 *
 * A failure the route cannot fix — no model configured, an effort the route
 * refuses — must release the slot and count for nothing, or three of them would
 * replace the actionable error with a cool-down that blames the model. Both
 * entries (composer route and /enhance command) classify through the same
 * helper, so these assertions pin the single rule they share.
 * @module tests/admission
 */

import { describe, expect, it } from 'vitest'
import { AdmissionGate, FAILURE_STREAK_LIMIT, breakerOutcome } from '../src/admission'
import type { EnhanceErrorCode } from '../src/shared/protocol'

/** Limits wide enough that the breaker is the only thing that can refuse. */
const LIMITS = { rateLimitPerMinute: 60, maxConcurrent: 4 }

describe('breakerOutcome', () => {
  it('keeps a cancellation out of the breaker', () => {
    expect(breakerOutcome(true, 'upstream')).toBe('aborted')
  })

  it('classifies a missing configuration as neutral', () => {
    expect(breakerOutcome(false, 'unconfigured')).toBe('neutral')
  })

  it('classifies a refused effort as neutral', () => {
    expect(breakerOutcome(false, 'effort-unsupported')).toBe('neutral')
  })

  it('still counts failures on the way to the model', () => {
    const counted: EnhanceErrorCode[] = ['timeout', 'upstream', 'internal']
    for (const code of counted) expect(breakerOutcome(false, code)).toBe('failure')
  })
})

describe('AdmissionGate breaker', () => {
  /**
   * Admit one call and settle it immediately.
   * @param gate - the gate under test.
   * @param outcome - how the call ended.
   * @param now - epoch millis for this call.
   */
  function settleOnce(gate: AdmissionGate, outcome: 'failure' | 'neutral', now: number): void {
    expect(gate.admit(now, LIMITS).ok).toBe(true)
    gate.settle(outcome, now)
  }

  it('does not pause after neutral settlements', () => {
    const gate = new AdmissionGate()
    const start = 1_000
    for (let index = 0; index < FAILURE_STREAK_LIMIT + 2; index += 1) settleOnce(gate, 'neutral', start + index)
    // A cool-down here would mean the breaker counted the neutral settlements.
    expect(gate.admit(start + FAILURE_STREAK_LIMIT + 3, LIMITS).ok).toBe(true)
  })

  it('pauses for the cool-down after consecutive failures', () => {
    const gate = new AdmissionGate()
    const start = 1_000
    for (let index = 0; index < FAILURE_STREAK_LIMIT; index += 1) settleOnce(gate, 'failure', start + index)
    const decision = gate.admit(start + FAILURE_STREAK_LIMIT, LIMITS)
    expect(decision.ok).toBe(false)
    if (!decision.ok) expect(decision.error.code).toBe('cooldown')
  })

  it('lets a success between failures reset the streak', () => {
    const gate = new AdmissionGate()
    settleOnce(gate, 'failure', 1_000)
    settleOnce(gate, 'failure', 1_001)
    settleOnce(gate, 'neutral', 1_002)
    expect(gate.admit(1_003, LIMITS).ok).toBe(true)
    gate.settle('success', 1_003)
    settleOnce(gate, 'failure', 1_004)
    settleOnce(gate, 'failure', 1_005)
    // The success reset the counter, so two fresh failures are not enough.
    expect(gate.admit(1_006, LIMITS).ok).toBe(true)
  })
})
