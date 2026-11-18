/**
 * Shipped defaults of the plugin's configurable fields.
 *
 * One source for two readers:
 * - the host builds `DEFAULT_CONFIG` from it, so the schema defaults and the
 *   request path cannot disagree;
 * - the settings page compares a row's staged text against it, because the
 *   host form's `overridden` flag means "explicitly written", not "differs
 *   from the default" — and the badge must disappear the moment a value is
 *   edited back to its default.
 * @module dsh-prompt-enhance/shared/defaults
 */

/** Defaults of every row the settings surfaces edit (provider/model default to empty). */
export const DEFAULT_VALUES = {
  enabled: true,
  temperature: 0.3,
  // A rewrite does not need deep reasoning, and the route default is expensive
  // (measured: 2897 output tokens at `high` vs 252 at `off` for the same draft).
  // Sent explicitly, because omitting the field inherits that route default.
  reasoningEffort: 'off',
  maxOutputTokens: 8192,
  maxInputChars: 12000,
  timeoutMs: 60000,
  systemPrompt: '',
  strategyMode: 'replace-default',
  shortcut: '',
  maxConcurrent: 2,
  rateLimitPerMinute: 10,
  streaming: true,
  contextAware: true,
  contextMaxMessages: 8,
  contextMaxChars: 4000,
  /** Play the card's expand/collapse transition. */
  foldAnimation: true,
  /** Fold the card after Apply, and re-open it after Undo. */
  autoFold: true,
} as const
