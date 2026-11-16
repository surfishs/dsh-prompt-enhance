/**
 * Numeric bounds of every bounded configuration field.
 *
 * One source for the two readers that must never disagree: the schemastery
 * schema the settings page renders (`.min()` / `.max()`) and the runtime
 * re-check inside `resolveConfig`. Duplicating the numbers meant a bound change
 * could land in one layer and miss the other, and the two failure modes are
 * both bad — a schema that accepts what the request path rejects, or a request
 * path that accepts what the page refuses to render.
 *
 * `temperature` is the only non-integer member, so it carries its own step.
 * @module dsh-prompt-enhance/shared/limits
 */

/** One inclusive numeric range. */
export interface NumericRange {
  readonly min: number
  readonly max: number
}

/** An inclusive range plus the slider granularity of a fractional field. */
export interface StepRange extends NumericRange {
  readonly step: number
}

/** Sampling temperature: continuous enough to need a step, not an integer. */
export const TEMPERATURE: StepRange = { min: 0, max: 1, step: 0.05 }

/** Inclusive integer bounds, keyed by configuration field. */
export const FIELD_LIMITS = {
  maxOutputTokens: { min: 256, max: 32768 },
  maxInputChars: { min: 200, max: 200000 },
  timeoutMs: { min: 5000, max: 600000 },
  maxConcurrent: { min: 1, max: 16 },
  rateLimitPerMinute: { min: 1, max: 600 },
  contextMaxMessages: { min: 0, max: 50 },
  contextMaxChars: { min: 0, max: 100000 },
} as const satisfies Record<string, NumericRange>
