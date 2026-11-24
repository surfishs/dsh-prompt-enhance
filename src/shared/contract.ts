/**
 * Deterministic post-generation checks: the promises the prompt makes, verified
 * against what the model actually returned. Pure string work — no model call,
 * no IO, no clock — so the host can run it on every successful result and the
 * cost stays invisible.
 *
 * Three checks ship, each defined by where the damage shows up:
 * - `no-rewrite`: the result says no more than the draft, so the body stays
 *   visible but the card warns that nothing was rewritten;
 * - `framework-leak`: the result copied scaffolding the user must never see;
 * - `placeholder-lost`: a `{{variable}}` slot from the draft did not survive.
 *
 * Model-authored gap markers (`TBD`, `待确认`, …) are deliberately not counted:
 * they are free-form prose, so any count would be a false precision.
 *
 * @module dsh-prompt-enhance/shared/contract
 */

import type { ContractCheck } from './protocol'
import { isDegenerateOutput } from './normalize'

/**
 * Markers that only exist in the scaffolding, never in a rewritten prompt.
 * `<raw_prompt>` may survive mid-text when the model pasted the whole framed
 * user message; `normalizeOutput` strips only the outer wrapper, so this list
 * catches the leftovers.
 */
const FRAMEWORK_MARKERS: readonly string[] = ['<raw_prompt>', '</raw_prompt>', '<conversation_context>', '</conversation_context>', '<attachments', 'Framing that applies', 'Operator additions']

/** One user-authored template slot, e.g. `{{topic}}` or `{{ name }}`. */
const PLACEHOLDER = /\{\{\s*([^{}\n]+?)\s*\}\}/g

/** How many non-overlapping, case-insensitive occurrences one literal has. */
function countOf(text: string, needle: string): number {
  if (needle === '') return 0
  const haystack = text.toLowerCase()
  const target = needle.toLowerCase()
  let count = 0
  let index = haystack.indexOf(target)
  while (index !== -1) {
    count++
    index = haystack.indexOf(target, index + target.length)
  }
  return count
}

/**
 * Unique placeholder names in first-seen order. `{{ topic }}` and `{{topic}}`
 * name the same slot; empty and multi-line braces are not placeholders.
 * @param text - the draft or the result.
 * @returns the trimmed, deduplicated names.
 */
export function placeholderNames(text: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const match of String(text ?? '').matchAll(PLACEHOLDER)) {
    const name = match[1]?.trim() ?? ''
    if (name === '' || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

/** Render up to three lost slots for the tooltip, keeping the wire detail short. */
function formatLost(names: readonly string[]): string {
  const shown = names.slice(0, 3).map((name) => `{{${name}}}`)
  const suffix = names.length > shown.length ? ', …' : ''
  return `${shown.join(', ')}${suffix}`.slice(0, 120)
}

/** Options of one {@link checkContract} call. */
export interface ContractCheckOptions {
  /**
   * Whether the active strategy still promises to preserve `{{...}}` slots.
   * False for a `replace-default` custom strategy: it may deliberately fill
   * them, and a warning would be wrong.
   */
  placeholders?: boolean
}

/**
 * Run every check against one successful call.
 *
 * Precision rules, all chosen to keep false positives near zero:
 * - a marker the draft itself contains is ignored entirely: the result may be
 *   quoting content the user asked for, not leaking our scaffolding;
 * - the placeholder check only runs when the draft has slots AND the strategy
 *   still promises to keep them.
 *
 * @param draft - the raw draft that was sent.
 * @param output - the normalized rewrite the user is about to see.
 * @param options - which checks apply to this call.
 * @returns no-rewrite first, then framework leaks, then lost slots; empty when
 *   all held.
 */
export function checkContract(draft: string, output: string, options: ContractCheckOptions = {}): ContractCheck[] {
  const draftText = typeof draft === 'string' ? draft : ''
  const outputText = typeof output === 'string' ? output : ''
  const checks: ContractCheck[] = []

  // Quality first: the most actionable message when the model handed the draft
  // back. The body is still returned; this only decides what the card says.
  if (isDegenerateOutput(outputText, draftText)) {
    checks.push({ code: 'no-rewrite', count: 1 })
  }

  const leaks = FRAMEWORK_MARKERS.map((marker) => ({ marker, inDraft: countOf(draftText, marker) > 0, count: countOf(outputText, marker) })).filter(({ inDraft, count }) => !inDraft && count > 0)
  if (leaks.length > 0) {
    checks.push({
      code: 'framework-leak',
      count: leaks.reduce((sum, { count }) => sum + count, 0),
      detail: leaks
        .map(({ marker }) => marker)
        .slice(0, 2)
        .join(', '),
    })
  }

  if (options.placeholders === true) {
    const names = placeholderNames(draftText)
    if (names.length > 0) {
      const kept = new Set(placeholderNames(outputText))
      const lost = names.filter((name) => !kept.has(name))
      if (lost.length > 0) {
        checks.push({ code: 'placeholder-lost', count: lost.length, detail: formatLost(lost) })
      }
    }
  }

  return checks
}
