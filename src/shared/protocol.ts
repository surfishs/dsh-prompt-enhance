/**
 * Wire contract shared by the host route and the browser half: one enhance
 * POST and its typed responses. Pure types and constants only, safe to
 * bundle into both halves.
 * @module dsh-prompt-enhance/shared/protocol
 */

/** Host route path the browser half POSTs the draft to. */
export const ENHANCE_ENDPOINT = '/dsh-prompt-enhance/enhance'

/**
 * Mount prefix of the plugin's host routes. The webserver registration uses it
 * verbatim; it used to be derived from {@link ENHANCE_ENDPOINT} with a
 * `replace(/\/enhance$/, '')`, which would silently mount the WRONG path the
 * day the endpoint constant is renamed.
 */
export const ENHANCE_PREFIX = '/dsh-prompt-enhance'

/**
 * Host route path of the incremental variant: same request body, but the
 * response is an SSE stream of {@link EnhanceStreamEvent} frames so the panel
 * can show the rewrite while it is being written.
 */
export const ENHANCE_STREAM_ENDPOINT = '/dsh-prompt-enhance/enhance-stream'

/**
 * Profile entry ids the plugin's settings section may be served under.
 *
 * The bundle patch declares the row as `dsh-prompt-enhance`, which is also the
 * settings namespace; an aggregate bundle that renames child rows prefixes it
 * (`web-ui-dsh-prompt-enhance`). The unprefixed forms stay as fallbacks for a
 * profile still running an older build of this plugin. Both halves probe the
 * same list in the same order, so the host section and the browser mirror can
 * never resolve to two different documents.
 */
export const PROMPT_ENHANCE_ROW_IDS: readonly string[] = ['dsh-prompt-enhance', 'prompt-enhance', 'web-ui-dsh-prompt-enhance', 'web-ui-prompt-enhance']

/** Request body of one enhance call. */
export interface EnhanceRequestBody {
  /** Session whose model route should serve the call; absent forces settings/defaults. */
  sessionId?: string
  /** The raw draft text to rewrite. */
  text: string
}

/**
 * Token accounting of one enhancement call, copied from the harness's
 * `TokenUsage` so the browser half needs no dependency on it.
 *
 * Counts are disjoint: `inputTokens` is uncached input only, cached input sits
 * in the cache fields, and `totalTokens` is the provider's own total when it
 * reports one.
 */
export interface EnhanceUsage {
  /** Uncached input tokens. */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Provider-reported full-call total, when available. */
  totalTokens?: number
  /** Input tokens served from the prompt cache. */
  cacheReadTokens?: number
  /** Input tokens written to the prompt cache. */
  cacheWriteTokens?: number
}

/** One successful enhancement. */
/** How much conversation history one enhancement actually sent. */
export interface ContextUsage {
  /** Turns admitted into the snippet. */
  usedTurns: number
  /** Configured turn cap (`contextMaxMessages`). */
  maxTurns: number
  /** Unicode code points admitted (turn text only, matching the context budget). */
  usedChars: number
  /** Configured character cap (`contextMaxChars`). */
  maxChars: number
  /** Qualifying turns that did not fit. */
  droppedTurns: number
  /** Which cap stopped the selection; null when everything qualified fit. */
  limitedBy: 'turns' | 'chars' | null
  /** True when the newest turn was cut to its head and marked as truncated. */
  cutTurn: boolean
}

export interface EnhanceResult {
  /** The rewritten prompt body (already normalized: no fences, trimmed). */
  text: string
  /** Provider route that served the call. */
  provider: string
  /** Model id that served the call. */
  model: string
  /** Wall-clock duration of the model call in milliseconds. */
  elapsedMs: number
  /** Token accounting, when the route reported any. */
  usage?: EnhanceUsage
  /** True when the model stopped at the output token cap (the body may be incomplete). */
  truncated?: boolean
  /**
   * The reasoning effort this call actually sent, or inherit when the field was
   * omitted and the provider default applied. Absent from hosts that predate the
   * field, so the UI must treat it as optional.
   */
  reasoningEffort?: string
  /** Conversation-history usage of this call; absent when no context was sent. */
  context?: ContextUsage
}

/**
 * Stable error codes the browser half maps to localized copy. The two
 * admission rejections are separate codes because their recovery conditions
 * differ: the per-minute rate cap clears on a known schedule (the route sends
 * a `Retry-After` in seconds with it), while the concurrency cap clears as
 * soon as an in-flight call finishes — no predictable delay to advertise.
 */
export type EnhanceErrorCode = 'rejected' | 'rate-limit' | 'concurrency-limit' | 'cooldown' | 'timeout' | 'upstream' | 'unconfigured' | 'internal' | 'effort-unsupported'

/**
 * Why the BROWSER half could not turn a response into a result.
 *
 * These never cross the wire: they are produced and consumed in the same
 * process, but they travel on the same `EnhanceError` shape so the panel has one
 * rendering path. They exist because a transport failure used to be a hardcoded
 * Chinese string, which an English UI then showed verbatim under its localized
 * primary line. A stable reason lets the panel localize it like any other error.
 */
export type ClientFailureReason =
  /** The fetch itself failed: no host, wrong port, dsh web not running. */
  | 'unreachable'
  /** The body or envelope could not be parsed into anything usable. */
  | 'malformed'
  /** The host answered, but not with the plugin's JSON envelope. */
  | 'refused'
  /** The stream ended without a `done` frame. */
  | 'stream-closed'
  /** The caller aborted the request. */
  | 'cancelled'

/** Structured failure carried on every non-2xx / ok:false response. */
export interface EnhanceError {
  code: EnhanceErrorCode
  /**
   * Optional diagnostic detail, passed through verbatim: the provider's raw
   * failure message, a config error, or an unknown-error description. The
   * client renders its localized primary line from `code`/`params` and shows
   * this beneath it when present — host-side text is a detail, never the
   * primary line (which used to leak Chinese copy into non-Chinese UIs).
   */
  message?: string
  /**
   * Structured parameters the localized primary line interpolates:
   * - rate-limit: { limit, retryAfterSeconds }
   * - concurrency-limit: { max }
   * - cooldown: { retryAfterSeconds, failures } — the failure breaker tripped
   * - timeout: { seconds }
   * - rejected with { count, max }: the over-length input message
   * - upstream: optional { reason } selecting a fix hint (auth, quota, …)
   * - internal, browser half only: { reason } — a {@link ClientFailureReason},
   *   plus { status } on the two reasons that carry an HTTP status
   */
  params?: Record<string, string | number>
  /**
   * Optional pre-localized message the client already rendered in the user's
   * language (set by client-side guards). When present the client shows it
   * alone; otherwise it localizes by `code`/`params` and shows `message` as
   * detail.
   */
  localized?: string
}

/** Response envelope of the enhance route. */
export type EnhanceResponse = { ok: true; value: EnhanceResult } | { ok: false; error: EnhanceError }

/**
 * One SSE frame of the incremental route. `delta` carries newly displayable
 * text (already safe to show: leading/trailing fences are withheld), `done`
 * carries the authoritative result — the SAME normalized body the one-shot
 * route returns — and `error` carries the structured failure.
 */
export type EnhanceStreamEvent = { type: 'delta'; text: string } | { type: 'done'; value: EnhanceResult } | { type: 'error'; error: EnhanceError }
