/**
 * The streaming client's failure classification.
 *
 * A refused request (429 / 409 / 422 / 5xx) is the server answering, not a
 * transport that cannot stream. Treating both the same way discarded the
 * structured envelope and re-sent the identical request — spending quota twice
 * and hiding the real reason behind whatever the retry failed with. These
 * cases pin the split: a refusal surfaces its own error and never retries; a
 * 200 that is not a stream still falls back to the one-shot route.
 * @module tests/client-enhance-client
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENHANCE_ENDPOINT, ENHANCE_STREAM_ENDPOINT } from '../src/shared/protocol'
import { requestEnhance, requestEnhanceStream } from '../src/client/enhance-client'

/** One recorded fetch call, in order. */
interface Call {
  url: string
  body: string
}

/** Install a fetch that answers each url with the given factory. */
function stubFetch(answer: (url: string) => Response): Call[] {
  const calls: Call[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) })
    return Promise.resolve(answer(url))
  })
  return calls
}

/** A successful one-shot envelope, used by the fallback case. */
const ONESHOT_OK = {
  ok: true,
  value: {
    text: '增强后',
    provider: 'zhipu',
    model: 'glm-5.3',
    elapsedMs: 12,
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 42, cacheReadTokens: 27 },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestEnhanceStream: refusal handling', () => {
  it('surfaces a 429 envelope instead of resending the request', async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ ok: false, error: { code: 'rate-limit', params: { limit: 60 } } }), { status: 429, headers: { 'content-type': 'application/json' } }))

    await expect(requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })).rejects.toMatchObject({ detail: { code: 'rate-limit', params: { limit: 60 } } })
    // One call, and to the stream endpoint: the refusal is not retried.
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(ENHANCE_STREAM_ENDPOINT)
  })

  it('keeps the cool-down reason a second attempt would have overwritten', async () => {
    stubFetch(
      () => new Response(JSON.stringify({ ok: false, error: { code: 'cooldown', params: { retryAfterSeconds: 30, failures: 3 } } }), { status: 429, headers: { 'content-type': 'application/json' } }),
    )

    await expect(requestEnhanceStream({ text: '写' }, { onDelta: (): void => {} })).rejects.toMatchObject({ detail: { code: 'cooldown' } })
  })

  it('still falls back to the one-shot route when a 200 is not a stream', async () => {
    // An older host without the stream route, or a proxy that buffered the
    // body: the transport is the problem, so the fallback is correct here.
    const calls = stubFetch((url) =>
      url === ENHANCE_STREAM_ENDPOINT
        ? new Response(JSON.stringify(ONESHOT_OK), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(JSON.stringify(ONESHOT_OK), { status: 200, headers: { 'content-type': 'application/json' } }),
    )

    const result = await requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })
    expect(result.text).toBe('增强后')
    // The client keeps the usage block instead of narrowing the result down to
    // text/provider/model/elapsedMs; the panel reads it for the token count.
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 42, cacheReadTokens: 27 })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.url).toBe(ENHANCE_ENDPOINT)
  })
})

describe('result narrowing keeps the truncation flag', () => {
  /** The one-shot success value the host sends when the model hit its cap. */
  const TRUNCATED_VALUE = { ...ONESHOT_OK.value, truncated: true }

  /** One JSON envelope response, as the host writes it. */
  const jsonResponse = (envelope: unknown): Response => new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } })

  it('carries the host flag onto the one-shot result', async () => {
    // The panel's "output hit the token cap" warning is driven by this field
    // alone. Narrowing the envelope used to rebuild the result without it, so
    // the host set the flag, the wire carried it, and the UI never saw it —
    // a half-written rewrite read as a complete one.
    stubFetch(() => jsonResponse({ ok: true, value: TRUNCATED_VALUE }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.truncated).toBe(true)
  })

  it('carries it through the streamed `done` frame too, since that is the default path', async () => {
    const frame = `event: done\ndata: ${JSON.stringify({ type: 'done', value: TRUNCATED_VALUE })}\n\n`
    stubFetch(() => new Response(frame, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    const result = await requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })
    expect(result.truncated).toBe(true)
  })

  it('leaves the flag absent when the host reported no cap', async () => {
    stubFetch(() => jsonResponse(ONESHOT_OK))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.truncated).toBeUndefined()
  })
})

describe('result narrowing keeps the reported reasoning effort', () => {
  const EFFORT_VALUE = { ...ONESHOT_OK.value, reasoningEffort: 'low' }
  const jsonResponse = (envelope: unknown): Response => new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } })

  it('carries the effort onto the one-shot result', async () => {
    // Same trap as the truncation flag: `parseResult` rebuilds the object field
    // by field, so anything missing from that list never reaches the UI.
    stubFetch(() => jsonResponse({ ok: true, value: EFFORT_VALUE }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.reasoningEffort).toBe('low')
  })

  it('carries it through the streamed done frame too', async () => {
    const frame = `event: done\ndata: ${JSON.stringify({ type: 'done', value: EFFORT_VALUE })}\n\n`
    stubFetch(() => new Response(frame, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    const result = await requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })
    expect(result.reasoningEffort).toBe('low')
  })

  it('leaves the field absent when an older host does not send it', async () => {
    stubFetch(() => jsonResponse(ONESHOT_OK))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.reasoningEffort).toBeUndefined()
  })
})

describe('result narrowing keeps the context usage', () => {
  const CONTEXT_USAGE = { usedTurns: 3, maxTurns: 8, usedChars: 3140, maxChars: 4000, droppedTurns: 5, limitedBy: 'chars' as const, cutTurn: false }
  const CONTEXT_VALUE = { ...ONESHOT_OK.value, context: CONTEXT_USAGE }
  const jsonResponse = (envelope: unknown): Response => new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } })

  it('carries the usage onto the one-shot result', async () => {
    stubFetch(() => jsonResponse({ ok: true, value: CONTEXT_VALUE }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.context).toEqual(CONTEXT_USAGE)
  })

  it('carries it through the streamed done frame too', async () => {
    const frame = `event: done\ndata: ${JSON.stringify({ type: 'done', value: CONTEXT_VALUE })}\n\n`
    stubFetch(() => new Response(frame, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    const result = await requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })
    expect(result.context).toEqual(CONTEXT_USAGE)
  })

  it('drops a malformed usage block instead of showing a broken tooltip', async () => {
    const malformed = { ...CONTEXT_VALUE, context: { ...CONTEXT_USAGE, usedChars: 'many' } }
    stubFetch(() => jsonResponse({ ok: true, value: malformed }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.context).toBeUndefined()
  })
})

describe('result narrowing keeps the contract checks', () => {
  const CHECKS = [
    { code: 'no-rewrite', count: 1 },
    { code: 'placeholder-lost', count: 1, detail: '{{topic}}' },
    { code: 'framework-leak', count: 2, detail: '<conversation_context>, </conversation_context>' },
  ] as const
  const CHECK_VALUE = { ...ONESHOT_OK.value, checks: CHECKS }
  const jsonResponse = (envelope: unknown): Response => new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } })

  it('carries checks onto the one-shot result', async () => {
    // Same trap as truncated/reasoningEffort/context: parseResult rebuilds the
    // object field by field, so a field missing from that list never reaches
    // the card.
    stubFetch(() => jsonResponse({ ok: true, value: CHECK_VALUE }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.checks).toEqual(CHECKS)
  })

  it('carries them through the streamed done frame too', async () => {
    const frame = `event: done\ndata: ${JSON.stringify({ type: 'done', value: CHECK_VALUE })}\n\n`
    stubFetch(() => new Response(frame, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    const result = await requestEnhanceStream({ text: '写个爬虫' }, { onDelta: (): void => {} })
    expect(result.checks).toEqual(CHECKS)
  })

  it('drops malformed entries but keeps the valid ones', async () => {
    const mixed = {
      ...ONESHOT_OK.value,
      checks: [
        { code: 'framework-leak', count: 1 },
        { code: 'future-code', count: 1 },
        { code: 'placeholder-lost', count: -1 },
      ],
    }
    stubFetch(() => jsonResponse({ ok: true, value: mixed }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.checks).toEqual([{ code: 'framework-leak', count: 1 }])
  })

  it('reads an all-invalid block as absent', async () => {
    const malformed = { ...ONESHOT_OK.value, checks: [{ code: 'future-code', count: 1 }] }
    stubFetch(() => jsonResponse({ ok: true, value: malformed }))
    const result = await requestEnhance({ text: '写个爬虫' })
    expect(result.checks).toBeUndefined()
  })
})
