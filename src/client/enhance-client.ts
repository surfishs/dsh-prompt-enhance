/**
 * Browser-side client of the POST /dsh-prompt-enhance/enhance host route:
 * same-origin fetch with abort support and a typed error surface. Every
 * failure is a structured EnhanceError the panel renders verbatim.
 * @module dsh-prompt-enhance/client/enhance-client
 */

import {
  ENHANCE_ENDPOINT,
  ENHANCE_STREAM_ENDPOINT,
  type ContractCheck,
  type ContractCheckCode,
  type EnhanceError,
  type EnhanceErrorCode,
  type EnhanceRequestBody,
  type ContextUsage,
  type EnhanceResult,
  type EnhanceStreamEvent,
  type EnhanceUsage,
} from '../shared/protocol'

/** Typed fetch failure carrying the wire error. */
export class EnhanceClientError extends Error {
  constructor(public readonly detail: EnhanceError) {
    super(detail.message)
  }
}

/**
 * Encode one request body.
 *
 * UTF-8 bytes rather than a bare string: with `types: ["node"]` the `BodyInit`
 * union has no `string` member (the DOM-only `string` form relies on the
 * global fetch types), and the explicit encoder also makes the wire size of a
 * CJK-heavy draft statable instead of implicit.
 * @param body - the typed request envelope.
 * @returns the UTF-8 encoded JSON payload.
 */
function jsonBody(body: EnhanceRequestBody): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body))
}

/** The stable error codes the host may send; anything else normalizes to `internal`. */
const KNOWN_ERROR_CODES = new Set<EnhanceErrorCode>(['rejected', 'rate-limit', 'concurrency-limit', 'cooldown', 'timeout', 'upstream', 'unconfigured', 'internal', 'effort-unsupported'])

/** Narrow one wire error, normalizing unknown codes. `message`/`params` are optional. */
function parseError(value: unknown): EnhanceError {
  const record = value as Partial<EnhanceError> | null
  if (record !== null && typeof record === 'object') {
    const code: EnhanceErrorCode = typeof record.code === 'string' && KNOWN_ERROR_CODES.has(record.code as EnhanceErrorCode) ? (record.code as EnhanceErrorCode) : 'internal'
    const message = typeof record.message === 'string' && record.message !== '' ? record.message : undefined
    const params = record.params !== null && typeof record.params === 'object' ? (record.params as Record<string, string | number>) : undefined
    return { code, ...(message !== undefined ? { message } : {}), ...(params !== undefined ? { params } : {}) }
  }
  return { code: 'internal', params: { reason: 'malformed' } }
}

/** One finite, non-negative token count, or undefined when absent/malformed. */
function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * Narrow the optional usage block. A malformed block is dropped rather than
 * failing the whole result: the rewrite itself is still usable without it.
 * @param value - the `usage` field of a success value.
 * @returns the validated usage, or undefined.
 */
function parseUsage(value: unknown): EnhanceUsage | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const inputTokens = tokenCount(record.inputTokens)
  const outputTokens = tokenCount(record.outputTokens)
  if (inputTokens === undefined || outputTokens === undefined) return undefined
  const totalTokens = tokenCount(record.totalTokens)
  const cacheReadTokens = tokenCount(record.cacheReadTokens)
  const cacheWriteTokens = tokenCount(record.cacheWriteTokens)
  return {
    inputTokens,
    outputTokens,
    ...(totalTokens === undefined ? {} : { totalTokens }),
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  }
}

/** Strictly narrow one success value; anything malformed is a client-visible error. */
/**
 * Validate the optional context-usage block the host sends with a result.
 *
 * The panel relies on the numbers being integers (malformed fractions would
 * format oddly) and on `limitedBy` being one of the two caps; anything else
 * is treated as "no usage" rather than surfacing a broken tooltip.
 * @param value - the untrusted wire value.
 * @returns the usage, or undefined when absent/malformed.
 */
function parseContextUsage(value: unknown): ContextUsage | undefined {
  const record = value as Partial<ContextUsage> | null
  if (record === null || typeof record !== 'object') return undefined
  const integer = (field: unknown): field is number => typeof field === 'number' && Number.isInteger(field) && field >= 0
  if (
    !integer(record.usedTurns) ||
    !integer(record.maxTurns) ||
    !integer(record.usedChars) ||
    !integer(record.maxChars) ||
    !integer(record.droppedTurns) ||
    (record.limitedBy !== null && record.limitedBy !== 'turns' && record.limitedBy !== 'chars') ||
    typeof record.cutTurn !== 'boolean'
  ) {
    return undefined
  }
  return {
    usedTurns: record.usedTurns,
    maxTurns: record.maxTurns,
    usedChars: record.usedChars,
    maxChars: record.maxChars,
    droppedTurns: record.droppedTurns,
    limitedBy: record.limitedBy,
    cutTurn: record.cutTurn,
  }
}

/** The stable contract-check codes; an unknown code drops that entry. */
const CONTRACT_CHECK_CODES = new Set<ContractCheckCode>(['no-rewrite', 'framework-leak', 'placeholder-lost'])

/**
 * Narrow the optional contract-check block. Entries are validated one by one,
 * so a future host code the browser half does not know yet is dropped instead
 * of failing the whole result; an all-invalid block reads as "no checks".
 * @param value - the `checks` field of a success value.
 * @returns the validated checks, or undefined when absent/empty.
 */
function parseChecks(value: unknown): ContractCheck[] | undefined {
  if (!Array.isArray(value)) return undefined
  const checks: ContractCheck[] = []
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue
    const record = entry as Partial<ContractCheck>
    if (typeof record.code !== 'string' || !CONTRACT_CHECK_CODES.has(record.code as ContractCheckCode)) continue
    if (typeof record.count !== 'number' || !Number.isInteger(record.count) || record.count < 0) continue
    checks.push({
      code: record.code as ContractCheckCode,
      count: record.count,
      ...(typeof record.detail === 'string' && record.detail !== '' ? { detail: record.detail } : {}),
    })
  }
  return checks.length === 0 ? undefined : checks
}

function parseResult(value: unknown): EnhanceResult {
  const record = value as Partial<EnhanceResult> | null
  if (
    record !== null &&
    typeof record === 'object' &&
    typeof record.text === 'string' &&
    record.text !== '' &&
    typeof record.provider === 'string' &&
    record.provider !== '' &&
    typeof record.model === 'string' &&
    record.model !== '' &&
    typeof record.elapsedMs === 'number' &&
    Number.isFinite(record.elapsedMs)
  ) {
    const usage = parseUsage((record as { usage?: unknown }).usage)
    const context = parseContextUsage((record as { context?: unknown }).context)
    const checks = parseChecks((record as { checks?: unknown }).checks)
    return {
      text: record.text,
      provider: record.provider,
      model: record.model,
      elapsedMs: record.elapsedMs,
      ...(usage === undefined ? {} : { usage }),
      // Carried explicitly, not optional-by-accident: the panel's "output hit
      // the token cap" warning is driven by this flag alone, so rebuilding the
      // object without it left the host setting it, the wire carrying it, and
      // the UI never seeing it. Only `true` is ever normalized in, matching the
      // host, which sets the field solely on a capped finish.
      ...(record.truncated === true ? { truncated: true } : {}),
      // Same trap as 	runcated above: rebuilding the object field by field
      // drops anything not listed here, so a new result field has to be added
      // in this exact place or the UI silently never sees it.
      ...(typeof record.reasoningEffort === 'string' ? { reasoningEffort: record.reasoningEffort } : {}),
      ...(context === undefined ? {} : { context }),
      ...(checks === undefined ? {} : { checks }),
    }
  }
  throw new EnhanceClientError({ code: 'internal', params: { reason: 'malformed' } })
}

/** Read and validate the response envelope. */
async function readEnvelope(response: Response): Promise<EnhanceResult> {
  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new EnhanceClientError({ code: 'internal', params: { reason: 'malformed' } })
  }
  const envelope = parsed as { ok?: unknown; value?: EnhanceResult; error?: EnhanceError } | null
  if (envelope !== null && typeof envelope === 'object' && envelope.ok === true) {
    return parseResult(envelope.value)
  }
  if (envelope !== null && typeof envelope === 'object' && envelope.error !== undefined) {
    throw new EnhanceClientError(parseError(envelope.error))
  }
  throw new EnhanceClientError({ code: 'internal', params: { reason: 'malformed', status: response.status } })
}

/**
 * Turn a non-2xx reply into the error the host actually meant.
 *
 * A refused request is not a missing stream. The route answers 429 for the
 * rate/concurrency/cooldown cases, 409 for an unconfigured model, 422 for a
 * rejected draft and 5xx for upstream failures — and every one of those
 * carries a structured envelope naming the reason. Retrying it as if the
 * transport were at fault spends the user's quota a second time and replaces
 * the real reason with whatever the retry happens to fail with.
 * @param response - the refused response (its body is consumed here).
 * @returns the displayable error, falling back to the status code.
 */
async function rejectionOf(response: Response): Promise<EnhanceClientError> {
  try {
    const parsed = (await response.json()) as { error?: unknown } | null
    if (parsed !== null && typeof parsed === 'object' && parsed.error !== undefined) {
      return new EnhanceClientError(parseError(parsed.error))
    }
  } catch {
    // Not the JSON envelope (proxy error page, empty body): fall through.
  }
  return new EnhanceClientError({ code: 'internal', params: { reason: 'refused', status: response.status } })
}

/** One SSE frame: the event name line and the `data:` payload line. */
interface StreamFrame {
  event: string
  data: string
}
/** Split one buffer into complete SSE frames; the remainder stays buffered. */
function takeFrames(buffer: string): { frames: StreamFrame[]; rest: string } {
  const frames: StreamFrame[] = []
  let rest = buffer
  for (let index = rest.indexOf('\n\n'); index !== -1; index = rest.indexOf('\n\n')) {
    const raw = rest.slice(0, index)
    rest = rest.slice(index + 2)
    let event = 'message'
    const data: string[] = []
    for (const line of raw.split('\n')) {
      if (line.startsWith(':')) continue
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length > 0) frames.push({ event, data: data.join('\n') })
  }
  return { frames, rest }
}

/** Narrow one stream frame into a typed event; unparseable frames are skipped. */
function parseFrame(frame: StreamFrame): EnhanceStreamEvent | undefined {
  if (frame.event !== 'delta' && frame.event !== 'done' && frame.event !== 'error') return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(frame.data)
  } catch {
    return undefined
  }
  const record = parsed as { type?: unknown } | null
  if (record === null || typeof record !== 'object' || record.type !== frame.event) return undefined
  return record as EnhanceStreamEvent
}

/** Incremental enhancement options. */
export interface EnhanceStreamOptions {
  /** Caller cancellation (panel cancel button / unmount). */
  signal?: AbortSignal
  /** Receives each newly displayable piece of text. */
  onDelta: (text: string) => void
}

/**
 * Request one enhancement and show it while it is written.
 *
 * Degrades to {@link requestEnhance} whenever the incremental path is not
 * actually available: an older host without the stream route, a proxy that
 * buffered the response into one blob, or a browser without a readable fetch
 * body. The result is the same normalized body either way — only the display
 * is progressive.
 * @param body - the session id and the raw draft text.
 * @param options - cancellation and the delta sink.
 * @returns the enhancement result.
 * @throws EnhanceClientError with a displayable message on every failure.
 */
export async function requestEnhanceStream(body: EnhanceRequestBody, options: EnhanceStreamOptions): Promise<EnhanceResult> {
  let response: Response
  try {
    response = await fetch(ENHANCE_STREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: jsonBody(body),
      signal: options.signal,
    } as RequestInit)
  } catch (error) {
    if (options.signal?.aborted) {
      throw new EnhanceClientError({ code: 'internal', params: { reason: 'cancelled' } })
    }
    void error
    throw new EnhanceClientError({ code: 'internal', params: { reason: 'unreachable' } })
  }
  const contentType = String(response.headers.get('content-type') ?? '').toLowerCase()
  // A refusal is the server answering, not a missing stream: report it as-is
  // instead of discarding the envelope and re-sending the same request.
  if (!response.ok) throw await rejectionOf(response)
  const stream = response.body
  if (stream === null || stream === undefined || !contentType.includes('event-stream')) {
    // Not a stream (old host, buffered proxy): release the body and take the
    // one-shot path instead.
    // `cancel()` may return a promise in some runtimes and undefined in
    // others, so wrap before catching rather than assuming a promise.
    void Promise.resolve()
      .then(() => stream?.cancel())
      .catch(() => {})
    return requestEnhance(body, options.signal)
  }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const { frames, rest } = takeFrames(buffer)
      buffer = rest
      for (const frame of frames) {
        const event = parseFrame(frame)
        if (event === undefined) continue
        if (event.type === 'delta') options.onDelta(event.text)
        else if (event.type === 'done') return parseResult(event.value)
        else throw new EnhanceClientError(parseError(event.error))
      }
    }
  } finally {
    void Promise.resolve()
      .then(() => reader.cancel())
      .catch(() => {})
  }
  throw new EnhanceClientError({ code: 'internal', params: { reason: 'stream-closed' } })
}

/**
 * Request one enhancement from the host route.
 * @param body - the session id and the raw draft text.
 * @param signal - caller cancellation (panel cancel button / unmount).
 * @returns the enhancement result.
 * @throws EnhanceClientError with a displayable message on every failure.
 */
export async function requestEnhance(body: EnhanceRequestBody, signal?: AbortSignal): Promise<EnhanceResult> {
  let response: Response
  try {
    response = await fetch(ENHANCE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: jsonBody(body),
      signal,
    } as RequestInit)
  } catch (error) {
    if (signal?.aborted) {
      throw new EnhanceClientError({ code: 'internal', params: { reason: 'cancelled' } })
    }
    void error
    throw new EnhanceClientError({ code: 'internal', params: { reason: 'unreachable' } })
  }
  return readEnvelope(response)
}
