import { describe, expect, it, vi } from 'vitest'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { enhanceText, formatEnhanceError, resolveRoute, toEnhanceError, type LlmStreamFace, type RoutePair } from '../src/enhancer'

/** Terminal-finish flavor the helper should emit. */
interface FinishFlavor {
  reason: 'stop' | 'error' | 'max-tokens'
  code?: string
  message?: string
}

/** Build a text stream: one text block from parts, then usage, then finish. */
function textStream(parts: string[], flavor: FinishFlavor): AsyncIterable<StreamChunk> {
  const chunks: StreamChunk[] = [
    { type: 'block-start', index: 0, blockType: 'text' },
    ...parts.map((text): StreamChunk => ({ type: 'text-delta', index: 0, text })),
    { type: 'block-end', index: 0, block: { type: 'text', text: parts.join('') } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } },
  ]
  if (flavor.reason === 'stop') chunks.push({ type: 'finish', reason: { kind: 'stop' } })
  else if (flavor.reason === 'max-tokens') chunks.push({ type: 'finish', reason: { kind: 'max-tokens' } })
  else chunks.push({ type: 'finish', reason: { kind: 'error', failure: { message: flavor.message ?? 'boom', code: flavor.code ?? 'INTERNAL' } } })
  return (async function* (): AsyncGenerator<StreamChunk> {
    for (const chunk of chunks) yield chunk
  })()
}

/** Stub llm face recording the options and replaying the given stream. */
function stubLlm(stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>): LlmStreamFace & { calls: GenerateOptions[] } {
  const calls: GenerateOptions[] = []
  return {
    calls,
    stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
      calls.push(options)
      return stream(options)
    },
  }
}

/**
 * Mimic how a real host reports the harness refusing an explicit reasoning
 * effort for a model whose capability declares no reasoning at all.
 *
 * Shape copied from the harness source, not invented: an adapter throw is turned
 * into a terminal `error` finish CHUNK rather than propagating
 * (`dsh-llm/lib/types/index.js`: "Adapter selection, dispatch, and iteration
 * failures become terminal `error` or `aborted` finish chunks"), and
 * `normalizeLlmFailure` keeps the code verbatim because `harnessErrorCode` reads
 * `error.code` off any `HarnessError` and `LlmError` is one. So the stable string
 * `UNSUPPORTED_REASONING_EFFORT` arrives as `failure.code`, and the message is the
 * localized prose the retry must NOT be matching on.
 * @param effort - the effort the call asked for.
 * @returns the terminal finish chunk a live host emits for that call.
 */
function noReasoningSupport(effort: string): StreamChunk {
  return {
    type: 'finish',
    reason: {
      kind: 'error',
      failure: {
        message: `provider "agnes" model "agnes-2.5-flash" does not support reasoning effort "${effort}"`,
        code: 'UNSUPPORTED_REASONING_EFFORT',
      },
    },
  }
}

/** A stream whose only content is the harness's unsupported-effort refusal. */
function refusalStream(effort: string): AsyncIterable<StreamChunk> {
  const chunk = noReasoningSupport(effort)
  return (async function* (): AsyncGenerator<StreamChunk> {
    yield chunk
  })()
}

const baseOptions = {
  route: { provider: 'zhipu', model: 'glm-5.3' } satisfies RoutePair,
  system: 'SYS',
  text: '帮我写个爬虫',
  temperature: 0.3,
  reasoningEffort: 'inherit' as const,
  maxTokens: 512,
  timeoutMs: 5000,
}

describe('enhanceText', () => {
  it('assembles, normalizes, and reports the route', async () => {
    const llm = stubLlm(() => textStream(['角色：Python', ' 工程师…'], { reason: 'stop' }))
    const result = await enhanceText(llm, baseOptions)
    expect(result.text).toBe('角色：Python 工程师…')
    // Reported so the card can show what actually ran, not what was configured.
    expect(result.reasoningEffort).toBe('inherit')
    expect(result.provider).toBe('zhipu')
    // The usage chunk is copied verbatim so the panel can show the call cost.
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
    expect(result.model).toBe('glm-5.3')
    expect(llm.calls[0]?.system).toBe('SYS')
    expect(llm.calls[0]?.temperature).toBe(0.3)
    expect(llm.calls[0]?.messages[0]?.content[0]).toMatchObject({ type: 'text' })
  })

  it('announces the attachment count in the framed user message', async () => {
    const llm = stubLlm(() => textStream(['ok'], { reason: 'stop' }))
    await enhanceText(llm, { ...baseOptions, attachmentCount: 3 })
    const block = llm.calls[0]?.messages[0]?.content[0]
    const text = block?.type === 'text' ? block.text : ''
    expect(text).toContain('<attachments count="3" content="not-included" />')
    expect(text.indexOf('<attachments')).toBeLessThan(text.indexOf('<raw_prompt>\n'))
  })

  // An explicit tier must reach the call: the shipped default omits the field,
  // so a configured tier that got swallowed would silently run the provider
  // default instead (on deepseek-flash that is `high`, ~11x the output tokens
  // of `off` for the same draft).
  it('forwards the configured reasoning effort to the model call', async () => {
    const llm = stubLlm(() => textStream(['ok'], { reason: 'stop' }))
    await enhanceText(llm, { ...baseOptions, reasoningEffort: 'low' })
    expect(llm.calls[0]?.reasoningEffort).toBe('low')
  })

  it('omits the reasoning effort entirely when set to inherit', async () => {
    const llm = stubLlm(() => textStream(['ok'], { reason: 'stop' }))
    await enhanceText(llm, { ...baseOptions, reasoningEffort: 'inherit' })
    expect(llm.calls[0]).not.toHaveProperty('reasoningEffort')
  })

  // The harness rejects an explicit effort outright when the model declares no
  // reasoning capability, before any provider I/O, with this exact code. The
  // shipped default now sends no effort, so such a route works out of the box;
  // an explicit tier is the user's choice and must not be swapped for another
  // tier behind their back.
  //
  // This test asserts on the finish-chunk shape on purpose. An earlier version
  // of it stubbed the refusal as a THROW and passed while the real host kept
  // failing: the harness converts an adapter failure into a terminal finish
  // chunk.
  it('surfaces a refused explicit tier instead of silently dropping it', async () => {
    const llm = stubLlm((options) => {
      if (options.reasoningEffort !== undefined) return refusalStream(options.reasoningEffort)
      return textStream(['ok'], { reason: 'stop' })
    })
    // `off` used to be the shipped default and was silently dropped here; it is
    // an explicit choice now, like any other tier.
    await expect(enhanceText(llm, { ...baseOptions, reasoningEffort: 'off' })).rejects.toMatchObject({
      detail: { code: 'effort-unsupported', params: { effort: 'off' } },
    })
    expect(llm.calls).toHaveLength(1)
    expect(llm.calls[0]?.reasoningEffort).toBe('off')
  })

  it('surfaces the refusal without retrying when the effort was already inherit', async () => {
    let calls = 0
    const llm = stubLlm(() => {
      calls += 1
      return refusalStream('off')
    })
    await expect(enhanceText(llm, { ...baseOptions, reasoningEffort: 'inherit' })).rejects.toMatchObject({ detail: { code: 'upstream' } })
    // No effort was sent, so the refusal cannot belong to this call: retrying
    // would send the identical request and fail the same way.
    expect(calls).toBe(1)
  })

  it('surfaces a rejected explicit effort instead of silently replacing it', async () => {
    const llm = stubLlm(() => refusalStream('low'))
    await expect(enhanceText(llm, { ...baseOptions, reasoningEffort: 'low' })).rejects.toMatchObject({ detail: { code: 'effort-unsupported', params: { effort: 'low' } } })
    // The chosen tier never ran; replacing it with the provider default would
    // hide that from the user, so the call is not retried at all.
    expect(llm.calls).toHaveLength(1)
  })

  // Defence in depth for a host that rejects the effort outside the harness's
  // terminal conversion. Nothing ships that relies on this `catch` — a live host
  // takes the finish-chunk path above — but an explicit tier must still surface
  // `effort-unsupported` instead of being retried with another tier.
  it('surfaces a thrown tier refusal without retrying', async () => {
    const llm = stubLlm((options) => {
      if (options.reasoningEffort !== undefined) {
        // Deliberately a generator that throws before its first `yield`: it
        // models an adapter that refuses the effort while opening the stream,
        // which is exactly the shape `isEffortRejectionThrow` must recognise.
        // eslint-disable-next-line require-yield
        return (async function* (): AsyncGenerator<StreamChunk> {
          throw Object.assign(new Error(`provider "agnes" model "agnes-2.5-flash" does not support reasoning effort "${options.reasoningEffort}"`), { code: 'UNSUPPORTED_REASONING_EFFORT' })
        })()
      }
      return textStream(['ok'], { reason: 'stop' })
    })
    await expect(enhanceText(llm, { ...baseOptions, reasoningEffort: 'max' })).rejects.toMatchObject({ detail: { code: 'effort-unsupported', params: { effort: 'max' } } })
    expect(llm.calls).toHaveLength(1)
  })

  it('strips a wrapping fence from the model output', async () => {
    const llm = stubLlm(() => textStream(['```\n角色：翻译\n```'], { reason: 'stop' }))
    const result = await enhanceText(llm, baseOptions)
    expect(result.text).toBe('角色：翻译')
  })

  it('returns an unchanged body instead of failing, leaving the verdict to checks', async () => {
    const llm = stubLlm(() => textStream(['帮我写个爬虫'], { reason: 'stop' }))
    const result = await enhanceText(llm, baseOptions)
    expect(result.text).toBe('帮我写个爬虫')
  })

  it('returns a wrapper echo as the body, tags included', async () => {
    const llm = stubLlm(() => textStream(['<raw_prompt>\n帮我写个爬虫\n</raw_prompt>'], { reason: 'stop' }))
    const result = await enhanceText(llm, baseOptions)
    expect(result.text).toBe('<raw_prompt>\n帮我写个爬虫\n</raw_prompt>')
  })

  it('maps an AUTH error finish to a fix hint and keeps the draft untouched', async () => {
    const llm = stubLlm(() => textStream([], { reason: 'error', code: 'AUTH', message: '401' }))
    await expect(enhanceText(llm, baseOptions)).rejects.toMatchObject({
      detail: { code: 'upstream', params: { reason: 'auth' }, message: '401' },
    })
  })

  it('maps NO_ADAPTER to the unconfigured code', async () => {
    const llm = stubLlm(() => textStream([], { reason: 'error', code: 'NO_ADAPTER', message: 'no route' }))
    await expect(enhanceText(llm, baseOptions)).rejects.toMatchObject({ detail: { code: 'unconfigured' } })
  })

  it('keeps a max-tokens finish as a truncated result', async () => {
    const llm = stubLlm(() => textStream(['部分'], { reason: 'max-tokens' }))
    await expect(enhanceText(llm, baseOptions)).resolves.toMatchObject({
      text: '部分',
      truncated: true,
    })
  })

  it('rejects an empty output', async () => {
    const llm = stubLlm(() => textStream(['  '], { reason: 'stop' }))
    await expect(enhanceText(llm, baseOptions)).rejects.toMatchObject({
      detail: { code: 'upstream', params: { reason: 'empty' } },
    })
  })

  it('times out a stalled stream', async () => {
    const stall = (): AsyncIterable<StreamChunk> => ({
      [Symbol.asyncIterator]: () => ({ next: (): Promise<never> => new Promise(() => {}) }),
    })
    const llm = stubLlm(() => stall())
    await expect(enhanceText(llm, { ...baseOptions, timeoutMs: 40 })).rejects.toMatchObject({
      detail: { code: 'timeout', params: { seconds: 1 } },
    })
  })

  it('honors a pre-aborted caller signal as a cancel', async () => {
    const llm = stubLlm(() => textStream(['文本'], { reason: 'stop' }))
    const controller = new AbortController()
    controller.abort()
    await expect(enhanceText(llm, { ...baseOptions, signal: controller.signal })).rejects.toMatchObject({
      detail: { code: 'internal' },
    })
  })
})

describe('resolveRoute', () => {
  const session: RoutePair = { provider: 'session-p', model: 'session-m' }
  const fallback: RoutePair = { provider: 'default-p', model: 'default-m' }

  it('prefers the explicit settings pair', () => {
    expect(resolveRoute({ provider: 'zhipu', model: 'glm-5.3' }, session, fallback)).toEqual({ provider: 'zhipu', model: 'glm-5.3' })
  })

  it('falls back to the session route, then the harness default', () => {
    expect(resolveRoute(undefined, session, fallback)).toBe(session)
    expect(resolveRoute(undefined, undefined, fallback)).toBe(fallback)
    expect(resolveRoute({ provider: 'zhipu' }, session, fallback)).toBe(session)
  })

  it('yields undefined when nothing names a route', () => {
    expect(resolveRoute(undefined, undefined, undefined)).toBeUndefined()
  })
})

describe('toEnhanceError', () => {
  it('wraps foreign errors as internal', () => {
    const wire = toEnhanceError(new Error('unexpected'))
    expect(wire.code).toBe('internal')
    expect(wire.message).toContain('unexpected')
  })

  it('passes through structured details', async () => {
    try {
      await enhanceText(
        stubLlm(() => textStream([], { reason: 'error', code: 'RATE_LIMIT', message: '429' })),
        baseOptions,
      )
      expect.unreachable()
    } catch (error) {
      expect(toEnhanceError(error).code).toBe('upstream')
      expect(toEnhanceError(error).params).toEqual({ reason: 'rate-limit' })
    }
  })
})

describe('formatEnhanceError', () => {
  it('renders structured errors into displayable Chinese text', () => {
    expect(formatEnhanceError({ code: 'rate-limit', params: { limit: 10, retryAfterSeconds: 7 } })).toContain('7 秒')
    expect(formatEnhanceError({ code: 'concurrency-limit', params: { max: 2 } })).toContain('2')
    expect(formatEnhanceError({ code: 'timeout', params: { seconds: 60 } })).toContain('60 秒')
    expect(formatEnhanceError({ code: 'unconfigured' })).toContain('provider/model')
  })

  it('picks a specific hint for known upstream reasons and appends the raw detail', () => {
    expect(formatEnhanceError({ code: 'upstream', params: { reason: 'auth' } })).toContain('API Key')
    expect(formatEnhanceError({ code: 'upstream', params: { reason: 'quota' } })).toContain('配额')
    // Unknown reason falls back to the generic upstream line.
    expect(formatEnhanceError({ code: 'upstream' })).toContain('模型服务返回错误')
    // The provider's raw message rides along as the detail line.
    const withDetail = formatEnhanceError({ code: 'upstream', params: { reason: 'auth' }, message: '401 unauthorized' })
    expect(withDetail).toContain('401 unauthorized')
  })

  it('keeps a rejected error short without a detail', () => {
    expect(formatEnhanceError({ code: 'rejected' })).toBe('增强请求被拒绝。')
  })
})

describe('enhanceText delta backpressure', () => {
  /**
   * A stream that records when each chunk is PRODUCED. The marker before a
   * `yield` runs only when the consumer asks for that value, so the array is an
   * exact record of how far the loop advanced.
   */
  function tracedStream(order: string[]): AsyncIterable<StreamChunk> {
    return (async function* (): AsyncGenerator<StreamChunk> {
      order.push('pull-1')
      yield { type: 'block-start', index: 0, blockType: 'text' }
      order.push('pull-2')
      yield { type: 'text-delta', index: 0, text: 'A' }
      order.push('pull-3')
      yield { type: 'text-delta', index: 0, text: 'B' }
      order.push('pull-4')
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'AB' } }
      order.push('pull-5')
      yield { type: 'usage', usage: { inputTokens: 1, outputTokens: 2 } }
      order.push('pull-6')
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()
  }

  it('parks the model stream while the delta sink is still draining', async () => {
    // The SSE sink resolves only once the frame has drain room, so the loop has
    // to wait for it: otherwise a slow reader lets the model keep producing into
    // the socket buffer with no bound, which is exactly what the "backpressure"
    // claim in sse.ts promises and what fire-and-forget failed to deliver.
    const order: string[] = []
    const llm = stubLlm(() => tracedStream(order))
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const seen: string[] = []
    const run = enhanceText(llm, {
      ...baseOptions,
      onDelta: (delta: string): Promise<void> => {
        seen.push(delta)
        // The sink for the first delta is the "slow reader": it stays pending
        // until this test releases it.
        return delta === 'A' ? gate : Promise.resolve()
      },
    })
    try {
      await vi.waitFor(() => {
        expect(seen).toContain('A')
      })
      // The loop must be parked on the pending sink: chunk 3 cannot have been
      // produced yet.
      expect(order).not.toContain('pull-3')
    } finally {
      release()
      await run.catch(() => {})
    }
    // Once the reader drains, the loop resumes and every delta reaches the sink.
    expect(order).toContain('pull-3')
    expect(seen).toEqual(['A', 'B'])
  })
})

describe('host LLM module availability', () => {
  it('fails the call, not the plugin load, when the host supplies no dsh-llm', async () => {
    // `@deepseek-ai/dsh-llm` is an OPTIONAL peer: npm never installs it into the
    // profile, the host supplies it. A top-level value import made a host
    // without the module unable to LOAD this plugin at all — the opposite of
    // what an optional peer promises. Loaded lazily, the absence has to surface
    // as one failed call with a readable detail.
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-llm', () => {
      throw new Error('Cannot find package @deepseek-ai/dsh-llm')
    })
    try {
      const fresh = await import('../src/enhancer')
      const failure = await fresh
        .enhanceText(
          stubLlm(() => textStream(['x'], { reason: 'stop' })),
          baseOptions,
        )
        .catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(fresh.EnhanceFailure)
      expect((failure as { detail: { code: string } }).detail.code).toBe('internal')
      expect((failure as { detail: { message?: string } }).detail.message).toContain('harness LLM module unavailable')
    } finally {
      vi.doUnmock('@deepseek-ai/dsh-llm')
      vi.resetModules()
    }
  })
})
