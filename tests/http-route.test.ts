/**
 * End-to-end tests of the POST /dsh-prompt-enhance/enhance route over a real
 * node:http server: loopback fence, method guard, body validation, the
 * structured error envelope, and the full happy path through a stubbed
 * ctx.llm (real BlockAssembler/createUserMessage).
 * @module tests/http-route
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { apply } from '../src/index'
import { DEFAULT_CONFIG } from '../src/config'

/** A passing config with the pairing invariants satisfied. */
const CONFIG = { ...DEFAULT_CONFIG }

/** Registered route captured from the stub webServer. */
interface CapturedRoute {
  kind: string
  path: string
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>
}

/** Build a stub llm whose stream is replaced per test. */
function makeLlm(stream: (options: GenerateOptions) => AsyncIterable<StreamChunk>): { stream(options: GenerateOptions): AsyncIterable<StreamChunk> } {
  return { stream }
}

/** Text stream helper: one text block, usage, terminal finish. */
function streamOf(parts: string[], finish: StreamChunk[]): AsyncIterable<StreamChunk> {
  const chunks: StreamChunk[] = [
    { type: 'block-start', index: 0, blockType: 'text' },
    ...parts.map((text): StreamChunk => ({ type: 'text-delta', index: 0, text })),
    { type: 'block-end', index: 0, block: { type: 'text', text: parts.join('') } },
    { type: 'usage', usage: { inputTokens: 3, outputTokens: 2 } },
    ...finish,
  ]
  return (async function* (): AsyncGenerator<StreamChunk> {
    for (const chunk of chunks) yield chunk
  })()
}

/** A stub context plus the routes captured from its stub webServer. */
interface StubContext {
  ctx: unknown
  captured: CapturedRoute[]
  /** Run every `ctx.effect` cleanup, as a plugin unload would. */
  disposeAll: () => void
  /** How many times a registered route handed its disposer back. */
  routeDisposals: () => number
}

/**
 * Stand-in for the host Connection gate: admits requests with no Origin (the
 * desktop bridge shape) and loopback Origins addressed to the same port, and
 * refuses everything else — the two refusals the real gate applies.
 */
function hostGateStub(): unknown {
  return {
    requestRejection({ headers }: { headers: Record<string, string | string[] | undefined> }): 401 | 403 | undefined {
      const origin = headers.origin
      if (typeof origin !== 'string' || origin.trim() === '') return undefined
      let url: URL
      try {
        url = new URL(origin)
      } catch {
        return 403
      }
      const host = String(headers.host ?? '')
      const port = host.includes(':') ? host.slice(host.lastIndexOf(':') + 1) : ''
      const hostname = (host.startsWith('[') ? host.slice(1, host.indexOf(']')) : (host.split(':')[0] ?? '')).toLowerCase()
      const originHostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
      if (!['127.0.0.1', 'localhost', '::1'].includes(originHostname)) return 403
      if (port !== '' && url.port !== port) return 403
      if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) return 403
      return undefined
    },
  }
}

/** Build a stub context exposing the services the plugin half reads. */
function stubContext(
  llm: ReturnType<typeof makeLlm>,
  selection: { provider: string; model: string } | null = { provider: 'zhipu', model: 'glm-5.3' },
  connection: unknown = hostGateStub(),
): StubContext {
  const captured: CapturedRoute[] = []
  const cleanups: (() => void)[] = []
  let routeDisposals = 0
  // One stable service object per context, exactly like cordis: the plugin
  // compares service identity to decide whether a re-apply must re-mount.
  const webserver = {
    register(route: CapturedRoute): () => void {
      captured.push(route)
      return () => {
        routeDisposals += 1
      }
    },
  }
  const ctx: Record<string, unknown> = {
    effect(fn: () => unknown): () => void {
      const dispose = fn()
      if (typeof dispose === 'function') cleanups.push(dispose as () => void)
      return () => {}
    },
    get(key: string): unknown {
      if (key === 'webServer') return webserver
      if (key === 'llm') return llm
      if (key === 'sessions') return { get: (): undefined => undefined }
      if (key === 'settings') return { get: (): unknown => selection ?? {} }
      if (key === 'connection') return connection
      return undefined
    },
    // cordis runs the callback in a child fiber once the deps resolve; the
    // stub resolves them immediately against the same context.
    inject(_deps: string[], callback: (child: unknown) => void): void {
      callback(ctx)
    },
    emit(): void {},
    on(): () => void {
      return () => {}
    },
  }
  return {
    ctx,
    captured,
    disposeAll: (): void => {
      for (const cleanup of cleanups.splice(0)) cleanup()
    },
    routeDisposals: (): number => routeDisposals,
  }
}

/** Mount apply() against a stub context and expose the route over real HTTP. */
function mount(
  llm: ReturnType<typeof makeLlm>,
  config = CONFIG,
  selection: { provider: string; model: string } | null = { provider: 'zhipu', model: 'glm-5.3' },
  connection: unknown = hostGateStub(),
): Server {
  const { ctx, captured } = stubContext(llm, selection, connection)
  apply(ctx as never, config)
  const route = captured[0]
  if (route === undefined) throw new Error('route was not registered')
  const server = createServer((req, res) => {
    void route.handler(req, res)
  })
  return server
}

/** One request against the test server. */
async function call(
  server: Server,
  method: string,
  body?: string,
  path = '/dsh-prompt-enhance/enhance',
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; json: unknown; headers: Headers }> {
  const { port } = server.address() as AddressInfo
  const origin = `http://127.0.0.1:${port}`
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json', origin, ...extraHeaders }, body } : { headers: { origin, ...extraHeaders } }),
  })
  return { status: response.status, json: (await response.json()) as unknown, headers: response.headers }
}

describe('POST /dsh-prompt-enhance/enhance (real http)', () => {
  let server: Server
  beforeAll(() => {
    server = mount(makeLlm(() => streamOf(['角色：Python 工程师。\n目标：写一个爬虫。'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    return new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('returns the enhanced text with the resolved route', async () => {
    const { status, json, headers } = await call(server, 'POST', JSON.stringify({ text: '帮我写个爬虫' }))
    expect(status).toBe(200)
    expect(headers.get('cache-control')).toBe('no-store')
    expect(json).toMatchObject({
      ok: true,
      value: { text: '角色：Python 工程师。\n目标：写一个爬虫。', provider: 'zhipu', model: 'glm-5.3' },
    })
  })

  it('trims spaced provider/model from settings before the adapter call', async () => {
    const captured: GenerateOptions[] = []
    const capturingLlm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        captured.push(options)
        return streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
      },
    } as never
    const server = mount(capturingLlm, { ...CONFIG, provider: ' zhipu ', model: ' glm ' })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status } = await call(server, 'POST', JSON.stringify({ text: '写' }))
      expect(status).toBe(200)
      expect(captured[0]?.provider).toBe('zhipu')
      expect(captured[0]?.model).toBe('glm')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('routes to the follow-session fallback when only the provider half is saved', async () => {
    // The settings page writes `provider` the moment the select changes, and
    // `model` a moment later, so this half-filled section is a state every user
    // passes through. It must resolve to NO override — the follow-session
    // fallback the READMEs promise — instead of failing config resolution and
    // answering 500 for the whole route.
    const captured: GenerateOptions[] = []
    const capturingLlm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        captured.push(options)
        return streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
      },
    } as never
    const halfServer = mount(capturingLlm, { ...CONFIG, provider: 'pinned-without-model' })
    await new Promise<void>((resolve) => halfServer.listen(0, '127.0.0.1', resolve))
    try {
      const { status, json } = await call(halfServer, 'POST', JSON.stringify({ text: '写' }))
      expect(status).toBe(200)
      // The lone provider must never reach the adapter: the call rides the
      // default route the settings stub reports.
      expect(captured[0]?.provider).toBe('zhipu')
      expect(captured[0]?.model).toBe('glm-5.3')
      expect(json).toMatchObject({ ok: true, value: { provider: 'zhipu', model: 'glm-5.3' } })
    } finally {
      await new Promise<void>((resolve) => halfServer.close(() => resolve()))
    }
  })

  it('answers 415 for a non-JSON content type', async () => {
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ text: '写' }),
    })
    expect(response.status).toBe(415)
  })

  it('answers 415 when the body carries no Content-Type at all', async () => {
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
      method: 'POST',
      headers: { origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ text: '写' }),
    })
    expect(response.status).toBe(415)
  })

  it('admits a host-approved POST that carries no Origin (desktop bridge)', async () => {
    // The desktop shell's bridged fetch sends neither Origin nor Sec-Fetch-*:
    // the host gate already admitted it, so the plugin must not re-judge the
    // browser-shaped headers it never received.
    const server = mount(makeLlm(() => streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '写' }),
      })
      expect(response.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('refuses an Origin-less POST when no Connection service exists', async () => {
    // Without the host gate the fence is the only check, so the browser-shaped
    // default-deny rule applies.
    const server = mount(
      makeLlm(() => streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])),
      CONFIG,
      { provider: 'zhipu', model: 'glm-5.3' },
      null,
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: '写' }),
      })
      expect(response.status).toBe(403)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('answers with the Host gate status before the body is read', async () => {
    for (const status of [401, 403] as const) {
      const guarded = mount(
        makeLlm(() => streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])),
        CONFIG,
        { provider: 'zhipu', model: 'glm-5.3' },
        { requestRejection: () => status },
      )
      await new Promise<void>((resolve) => guarded.listen(0, '127.0.0.1', resolve))
      try {
        const { port } = guarded.address() as AddressInfo
        const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
          body: JSON.stringify({ text: '写' }),
        })
        expect(response.status).toBe(status)
      } finally {
        await new Promise<void>((resolve) => guarded.close(() => resolve()))
      }
    }
  })

  it('fast-rejects an oversized Content-Length with 413 before reading', async () => {
    const http = await import('node:http')
    const { port } = server.address() as AddressInfo
    const status = await new Promise<number>((resolve) => {
      const request = http.request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/dsh-prompt-enhance/enhance',
          headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}`, 'content-length': '99999999' },
        },
        (response) => {
          response.resume()
          resolve(response.statusCode ?? 0)
        },
      )
      request.on('error', () => resolve(0))
      request.end('x')
    })
    expect(status).toBe(413)
  })

  it('answers 413 for an oversized chunked body, where no Content-Length can be checked', async () => {
    // The streamed cap inside readBoundedJson is the only line of defense when
    // the body is chunked: the fast reject needs a Content-Length to fire.
    //
    // This used to be an *unverified* suspicion — that throwing out of the
    // `for await` would close the async iterator, destroy the request and take
    // the response socket with it, so the 413 would never arrive. Measured on
    // Node v24.21.0 it does arrive: `req.destroy()` ends the request stream and
    // marks it aborted, but the socket survives long enough for the response.
    // The test therefore guards the behavior that is actually true, and would
    // fail the day a reader change really does lose the 413.
    const net = await import('node:net')
    const maxInputChars = 200 // the configured floor: cap = 200 * 6 + 4096 bytes
    const capped = mount(
      makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])),
      { ...CONFIG, maxInputChars },
    )
    await new Promise<void>((resolve) => capped.listen(0, '127.0.0.1', resolve))
    const { port } = capped.address() as AddressInfo
    try {
      const answer = await new Promise<string>((resolve) => {
        let received = ''
        let settled = false
        const finish = (): void => {
          if (settled) return
          settled = true
          socket.destroy()
          resolve(received)
        }
        const socket = net.connect({ port, host: '127.0.0.1' }, () => {
          socket.write('POST /dsh-prompt-enhance/enhance HTTP/1.1\r\nhost: 127.0.0.1\r\norigin: http://127.0.0.1\r\ncontent-type: application/json\r\ntransfer-encoding: chunked\r\n\r\n')
          const piece = 'x'.repeat(1024)
          for (let sent = 0; sent <= maxInputChars * 6 + 8192; sent += piece.length) {
            socket.write(`${piece.length.toString(16)}\r\n${piece}\r\n`)
          }
        })
        socket.setEncoding('utf8')
        socket.on('data', (chunk: string) => {
          received += chunk
          // The status and the envelope are what matters; the server may keep
          // the half-consumed request's connection open, so waiting for a close
          // here would hang on a correct answer.
          if (received.includes('"code":"rejected"')) finish()
        })
        socket.on('error', finish)
        socket.on('close', finish)
        setTimeout(finish, 2000)
      })
      expect(answer).toContain('HTTP/1.1 413')
      expect(answer).toContain('"code":"rejected"')
    } finally {
      // The half-consumed request leaves the connection open by design (the
      // session is the caller's, not the route's); close it so this suite does
      // not wait on a keep-alive socket it never receives a FIN for.
      capped.closeAllConnections()
      await new Promise<void>((resolve) => capped.close(() => resolve()))
    }
  })

  it('answers 404 for unknown subpaths under the prefix', async () => {
    const { status } = await call(server, 'POST', JSON.stringify({ text: '写个脚本' }), '/dsh-prompt-enhance/anything')
    expect(status).toBe(404)
  })

  it('rejects an empty draft with 422', async () => {
    const { status, json } = await call(server, 'POST', JSON.stringify({ text: '   ' }))
    expect(status).toBe(422)
    expect(json).toMatchObject({ ok: false, error: { code: 'rejected' } })
  })

  it('rejects malformed JSON with 422', async () => {
    const { status, json } = await call(server, 'POST', '{nope')
    expect(status).toBe(422)
    expect(json).toMatchObject({ ok: false, error: { code: 'rejected' } })
  })

  it('announces the attachment count in the prompt without sending contents', async () => {
    const captured: GenerateOptions[] = []
    const capturingLlm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        captured.push(options)
        return streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
      },
    } as never
    const announced = mount(capturingLlm)
    await new Promise<void>((resolve) => announced.listen(0, '127.0.0.1', resolve))
    try {
      const { status } = await call(announced, 'POST', JSON.stringify({ text: '把这张图整理成提示词', attachments: { count: 2 } }))
      expect(status).toBe(200)
      expect(captured[0]?.system).toContain('Attachment block')
      expect(captured[0]?.system).toContain('Framing that applies to every response')
      // The framing contract is appended last, so "these instructions" covers
      // the attachment block that came before it.
      expect((captured[0]?.system ?? '').indexOf('Framing that applies to every response')).toBeGreaterThan((captured[0]?.system ?? '').indexOf('Attachment block'))
      const blocks = captured[0]?.messages[0]?.content ?? []
      // Metadata only: the call still carries exactly one text block, never
      // image or file parts.
      expect(blocks).toHaveLength(1)
      const block = blocks[0]
      const text = block?.type === 'text' ? block.text : ''
      expect(text).toContain('<attachments count="2" content="not-included" />')
      expect(text.indexOf('<attachments')).toBeLessThan(text.indexOf('<raw_prompt>\n'))
    } finally {
      await new Promise<void>((resolve) => announced.close(() => resolve()))
    }
  })

  it('appends the framing contract to an attachment-free system prompt', async () => {
    const captured: GenerateOptions[] = []
    const capturingLlm = {
      stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        captured.push(options)
        return streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
      },
    } as never
    const plain = mount(capturingLlm)
    await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve))
    try {
      const { status } = await call(plain, 'POST', JSON.stringify({ text: '写个脚本' }))
      expect(status).toBe(200)
      expect(captured[0]?.system).toContain('Framing that applies to every response')
      expect(captured[0]?.system).not.toContain('Attachment block')
    } finally {
      await new Promise<void>((resolve) => plain.close(() => resolve()))
    }
  })

  it('rejects a malformed attachment count with 422', async () => {
    for (const attachments of [{ count: -1 }, { count: 1.5 }, { count: 101 }, { count: '1' }, { count: null }, '1', [], null]) {
      const { status, json } = await call(server, 'POST', JSON.stringify({ text: '写', attachments }))
      expect(status).toBe(422)
      expect(json).toMatchObject({ ok: false, error: { code: 'rejected' } })
    }
  })

  it('rejects a GET with 405', async () => {
    const { status, json } = await call(server, 'GET')
    expect(status).toBe(405)
    expect(json).toMatchObject({ ok: false, error: { code: 'internal' } })
  })

  it('fences non-loopback peers at the socket-address level', async () => {
    const { isLoopbackRequest } = await import('../src/loopback')
    expect(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } } as never)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } } as never)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '192.168.1.7' } } as never)).toBe(false)
    expect(isLoopbackRequest({ socket: { remoteAddress: '' } } as never)).toBe(false)
  })
})

describe('POST /dsh-prompt-enhance/enhance failure mapping (real http)', () => {
  it('maps an AUTH error finish to 502 with a fix hint', async () => {
    const server = mount(makeLlm(() => streamOf([], [{ type: 'finish', reason: { kind: 'error', failure: { message: '401 unauthorized', code: 'AUTH' } } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status, json } = await call(server, 'POST', JSON.stringify({ text: '写个脚本' }))
      expect(status).toBe(502)
      expect(json).toMatchObject({
        ok: false,
        error: { code: 'upstream', params: { reason: 'auth' }, message: '401 unauthorized' },
      })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('maps a timeout to 504', { timeout: 12000 }, async () => {
    const stall = (): AsyncIterable<StreamChunk> => ({
      [Symbol.asyncIterator]: () => ({ next: (): Promise<never> => new Promise(() => {}) }),
    })
    const server = mount(makeLlm(stall), { ...CONFIG, timeoutMs: 5000 })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status, json } = await call(server, 'POST', JSON.stringify({ text: '写个脚本' }))
      expect(status).toBe(504)
      expect(json).toMatchObject({ ok: false, error: { code: 'timeout' } })
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('refuses calls while disabled with 403', async () => {
    const server = mount(
      makeLlm(() => streamOf([], [{ type: 'finish', reason: { kind: 'stop' } }])),
      { ...CONFIG, enabled: false },
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status } = await call(server, 'POST', JSON.stringify({ text: '写个脚本' }))
      expect(status).toBe(403)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})

describe('POST /dsh-prompt-enhance/enhance disconnect handling (real sockets)', () => {
  it('aborts the model call when the client disconnects mid-flight', async () => {
    const seen: boolean[] = []
    let capturedSignal: AbortSignal | undefined
    const server = mount(
      {
        stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
          capturedSignal = options.signal
          return {
            [Symbol.asyncIterator]: () => ({
              async next(): Promise<IteratorResult<StreamChunk>> {
                await new Promise((resolve) => setTimeout(resolve, 120))
                seen.push(capturedSignal?.aborted ?? false)
                if (capturedSignal?.aborted) {
                  const error = new Error('aborted')
                  error.name = 'AbortError'
                  throw error
                }
                return { done: false, value: { type: 'text-delta', index: 0, text: 'x' } }
              },
            }),
          }
        },
      } as never,
      { ...CONFIG },
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const net = await import('node:net')
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      const body = JSON.stringify({ text: '写个脚本' })
      socket.write(
        `POST /dsh-prompt-enhance/enhance HTTP/1.1\r\nHost: 127.0.0.1\r\norigin: http://127.0.0.1\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
      )
      setTimeout(() => socket.destroy(), 80)
    })
    socket.on('error', () => {})
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      expect(seen.length).toBeGreaterThan(0)
      expect(seen[seen.length - 1]).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('gives the concurrency slot back after a mid-flight disconnect', async () => {
    // The first call stalls forever; the second answers immediately. If the
    // disconnect failed to release the slot, the second call would 429 and
    // every later enhancement would be locked out for the process lifetime.
    const stall = (): AsyncIterable<StreamChunk> => ({
      [Symbol.asyncIterator]: () => ({ next: (): Promise<never> => new Promise(() => {}) }),
    })
    let calls = 0
    const server = mount(
      {
        stream: (): AsyncIterable<StreamChunk> => {
          calls += 1
          return calls === 1 ? stall() : streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
        },
      } as never,
      { ...CONFIG, maxConcurrent: 1 },
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    const net = await import('node:net')
    const body = JSON.stringify({ text: '占用者' })
    await new Promise<void>((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' }, () => {
        socket.write(
          `POST /dsh-prompt-enhance/enhance HTTP/1.1\r\nHost: 127.0.0.1\r\norigin: http://127.0.0.1\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(body)}\r\n\r\n${body}`,
        )
        setTimeout(() => {
          socket.destroy()
          resolve()
        }, 120)
      })
      socket.on('error', () => {})
    })
    await new Promise((resolve) => setTimeout(resolve, 200))
    try {
      const later = await call(server, 'POST', JSON.stringify({ text: '后来者' }))
      expect(later.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})

describe('admission gate: Origin / rate / concurrency', () => {
  it('refuses cross-site Origins with 403', async () => {
    const server = mount(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.com' },
        body: JSON.stringify({ text: '写个脚本' }),
      })
      expect(response.status).toBe(403)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('accepts same-app local Origins', async () => {
    const server = mount(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:' + port },
        body: JSON.stringify({ text: '写个脚本' }),
      })
      expect(response.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('refuses an Origin from a different local port with 403', async () => {
    const server = mount(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      // Same loopback hostname, wrong port: a page served by any other local
      // tool would otherwise be a same-app page and could spend model quota.
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port + 1}` },
        body: JSON.stringify({ text: '写个脚本' }),
      })
      expect(response.status).toBe(403)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('answers 429 when the per-minute rate cap is hit', async () => {
    const server = mount(
      makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])),
      { ...CONFIG, rateLimitPerMinute: 1 },
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const first = await call(server, 'POST', JSON.stringify({ text: '第一个' }))
      expect(first.status).toBe(200)
      const second = await call(server, 'POST', JSON.stringify({ text: '第二个' }))
      expect(second.status).toBe(429)
      expect(second.json).toMatchObject({ ok: false, error: { code: 'rate-limit', params: { limit: 1, retryAfterSeconds: expect.any(Number) } } })
      // The window is bounded, so the route can name the wait exactly.
      const retryAfter = Number(second.headers.get('retry-after'))
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
      expect((second.json as { error: { params: { retryAfterSeconds: number } } }).error.params.retryAfterSeconds).toBe(retryAfter)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('does not burn the rate window on failed calls', async () => {
    // The window counts successes only: a failed call must not consume the
    // only slot, or a run of upstream errors would rate-limit the user right
    // when the model recovers.
    let calls = 0
    const server = mount(
      {
        stream: (): AsyncIterable<StreamChunk> => {
          calls += 1
          return calls === 1
            ? streamOf([], [{ type: 'finish', reason: { kind: 'error', failure: { message: 'boom', code: 'INTERNAL' } } }])
            : streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
        },
      } as never,
      { ...CONFIG, rateLimitPerMinute: 1 },
    )
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const first = await call(server, 'POST', JSON.stringify({ text: '失败' }))
      expect(first.status).toBe(502)
      const second = await call(server, 'POST', JSON.stringify({ text: '成功' }))
      expect(second.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('does not count an unconfigured route toward the cool-down', async () => {
    // B6: a missing model configuration fails locally in milliseconds, and the
    // useful answer is "configure a model" (409). Counting it would turn the
    // third attempt into a cooldown that blames the model instead.
    const server = mount({} as never, { ...CONFIG, rateLimitPerMinute: 100 }, null)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { status } = await call(server, 'POST', JSON.stringify({ text: `改写${attempt}` }))
        expect(status).toBe(409)
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('trips a cool-down after three consecutive failures', async () => {
    // The success-only window leaves fast, deterministic failures unbounded;
    // the breaker closes that hole without touching the window's semantics.
    let calls = 0
    const failing = {
      stream: (): AsyncIterable<StreamChunk> => {
        calls += 1
        return streamOf([], [{ type: 'finish', reason: { kind: 'error', failure: { message: 'bad key', code: 'AUTH' } } }])
      },
    } as never
    const server = mount(failing, { ...CONFIG, rateLimitPerMinute: 100 })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { status } = await call(server, 'POST', JSON.stringify({ text: `失败${attempt}` }))
        expect(status).toBe(502)
      }
      const blocked = await call(server, 'POST', JSON.stringify({ text: '再来一次' }))
      expect(blocked.status).toBe(429)
      expect(blocked.json).toMatchObject({ ok: false, error: { code: 'cooldown', params: { failures: 3 } } })
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0)
      // The breaker refuses before any model traffic: a stuck route must not
      // keep paying for upstream calls while it cools down.
      expect(calls).toBe(3)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('clears the failure streak on a success', async () => {
    let calls = 0
    const flaky = {
      stream: (): AsyncIterable<StreamChunk> => {
        calls += 1
        // fail, fail, succeed, fail, fail, succeed, …
        return calls % 3 === 0
          ? streamOf(['结果'], [{ type: 'finish', reason: { kind: 'stop' } }])
          : streamOf([], [{ type: 'finish', reason: { kind: 'error', failure: { message: 'boom', code: 'INTERNAL' } } }])
      },
    } as never
    const server = mount(flaky, { ...CONFIG, rateLimitPerMinute: 100 })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const statuses: number[] = []
      for (let attempt = 0; attempt < 6; attempt++) {
        statuses.push((await call(server, 'POST', JSON.stringify({ text: `第${attempt}次` }))).status)
      }
      // Two failures then a success never reaches the streak limit, so no call
      // in this sequence may be refused by the breaker.
      expect(statuses).toEqual([502, 502, 200, 502, 502, 200])
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('answers 429 when the concurrency cap is full', async () => {
    let release!: () => void
    const gated = new Promise<void>((resolve) => {
      release = resolve
    })
    const gatedStream = (): AsyncIterable<StreamChunk> =>
      (async function* (): AsyncGenerator<StreamChunk> {
        await gated
        yield { type: 'text-delta', index: 0, text: 'x' }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    const server = mount({ stream: () => gatedStream() } as never, { ...CONFIG, maxConcurrent: 1 })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const first = call(server, 'POST', JSON.stringify({ text: '占用者' }))
      await new Promise((resolve) => setTimeout(resolve, 120))
      const second = await call(server, 'POST', JSON.stringify({ text: '后来者' }))
      expect(second.status).toBe(429)
      expect(second.json).toMatchObject({ ok: false, error: { code: 'concurrency-limit' } })
      // A busy slot frees unpredictably, so no Retry-After is advertised.
      expect(second.headers.get('retry-after')).toBeNull()
      release()
      const firstResult = await first
      expect(firstResult.status).toBe(200)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})

describe('POST /dsh-prompt-enhance/enhance-stream (real http, SSE)', () => {
  /**
   * POST one draft and read the SSE body INCREMENTALLY.
   *
   * Incremental reading is mandatory, not stylistic: the route applies real
   * socket backpressure, so a server frame that fills the buffer parks until
   * the reader drains it. `response.text()` would therefore wait for a body the
   * server is waiting for the reader to consume — the hang this helper exists
   * to avoid. A real browser client streams the same way.
   *
   * This helper is also the regression lock for response termination: it only
   * resolves once the stream ENDS. The route must call `res.end()` after the
   * done frame — without it the chunked body lacks its `0\r\n\r\n` terminator
   * and the read never completes (the browser client hides that by returning on
   * the done frame and cancelling its reader), so these tests time out.
   */
  async function callStream(server: Server, text: string, extraHeaders: Record<string, string> = {}): Promise<{ status: number; contentType: string; body: string }> {
    const { port } = server.address() as AddressInfo
    const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance-stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', origin: `http://127.0.0.1:${port}`, ...extraHeaders },
      body: JSON.stringify({ text }),
      // Fail fast instead of eating vitest's whole 5 s budget if the stream
      // ever stops progressing: a hang here is a route bug, not a slow test.
      signal: AbortSignal.timeout(2000),
    })
    const reader = response.body?.getReader()
    if (reader === undefined) return { status: response.status, contentType: response.headers.get('content-type') ?? '', body: '' }
    const decoder = new TextDecoder()
    let body = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        body += decoder.decode(value, { stream: true })
      }
    } finally {
      void Promise.resolve()
        .then(() => reader.cancel())
        .catch(() => {})
    }
    return { status: response.status, contentType: response.headers.get('content-type') ?? '', body }
  }

  /** The `data:` payloads of every SSE frame, in arrival order. */
  function framesOf(body: string): { event: string; data: unknown }[] {
    return body
      .split('\n\n')
      .map((raw) => raw.trim())
      .filter((raw) => raw !== '' && !raw.startsWith(':'))
      .map((raw) => {
        let event = 'message'
        const data: string[] = []
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data.push(line.slice(5).trim())
        }
        return { event, data: JSON.parse(data.join('\n')) as unknown }
      })
  }

  it('answers with SSE frames whose done body equals the one-shot result', async () => {
    const server = mount(makeLlm(() => streamOf(['角色：', 'Python 工程师。'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status, contentType, body } = await callStream(server, '写个爬虫')
      expect(status).toBe(200)
      expect(contentType).toContain('text/event-stream')
      // The header-flushing comment frame is mandatory: without it the client's
      // reader would not resume until the first model token arrived.
      expect(body.startsWith(': open\n\n')).toBe(true)

      const frames = framesOf(body)
      const done = frames.filter((frame) => frame.event === 'done')
      expect(done).toHaveLength(1)
      expect(done[0]!.data).toMatchObject({
        type: 'done',
        value: { text: '角色：Python 工程师。', provider: 'zhipu', model: 'glm-5.3' },
      })
      // Deltas are display-only; the authoritative body rides the done frame.
      expect(frames.some((frame) => frame.event === 'delta')).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('never shows a fence the normalized body will not have', async () => {
    // The model wraps its answer in a code fence. The displayed deltas must not
    // flash that fence, and the done body must carry the unwrapped text — the
    // streaming path is display-only and cannot change what the user applies.
    const server = mount(makeLlm(() => streamOf(['```\n角色：翻译。\n```'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status, body } = await callStream(server, '帮我翻译')
      expect(status).toBe(200)
      const done = framesOf(body).find((frame) => frame.event === 'done')
      expect(done?.data).toMatchObject({ value: { text: '角色：翻译。' } })
      expect(body).not.toContain('```')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('closes the stream when the model fails mid-flight', async () => {
    // Regression guard for an unterminated failure stream. The success path
    // ended the response from the start; the failure path only wrote the
    // `error` frame and left the chunked body open, which a browser masks (it
    // acts on the frame and cancels) but a whole-body reader never survives.
    // If the close goes missing again, reading this body never finishes and
    // the 2 s abort in `callStream` turns the gap into a failure here.
    const failing = makeLlm(() =>
      (async function* (): AsyncGenerator<StreamChunk> {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: '半句' }
        throw new Error('upstream reset')
      })(),
    )
    const server = mount(failing)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { status, contentType, body } = await callStream(server, '写个爬虫')
      expect(status).toBe(200)
      expect(contentType).toContain('text/event-stream')
      const frames = framesOf(body)
      expect(frames.filter((frame) => frame.event === 'error')).toHaveLength(1)
      expect(frames.filter((frame) => frame.event === 'done')).toHaveLength(0)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('runs the same loopback fence as the one-shot route', async () => {
    const server = mount(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const response = await fetch(`http://127.0.0.1:${port}/dsh-prompt-enhance/enhance-stream`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', forwarded: 'for=1.2.3.4' },
        body: JSON.stringify({ text: '写' }),
      })
      expect(response.status).toBe(403)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })
})

describe('route registration', () => {
  it('registers one route — and one admission gate — per context', () => {
    // A second apply on the same context must not stack a second gate: two
    // gates would silently double the effective rate and concurrency limits.
    const { ctx, captured } = stubContext(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    apply(ctx as never, CONFIG)
    apply(ctx as never, CONFIG)
    expect(captured).toHaveLength(1)
  })

  it('registers a fresh route for a different context', () => {
    const first = stubContext(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    const second = stubContext(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    apply(first.ctx as never, CONFIG)
    apply(second.ctx as never, CONFIG)
    expect(first.captured).toHaveLength(1)
    expect(second.captured).toHaveLength(1)
  })

  it('re-mounts when the host replaces the webserver service', () => {
    // A "already mounted" flag keyed on the context alone would leave the
    // plugin alive with no route on the live service: the button renders and
    // every click 404s. The registration follows the service identity instead.
    const captured: CapturedRoute[] = []
    let active = {
      register: (route: CapturedRoute): (() => void) => {
        captured.push(route)
        return () => {}
      },
    }
    const ctx: Record<string, unknown> = {
      effect(fn: () => unknown): () => void {
        fn()
        return () => {}
      },
      get: (key: string): unknown => {
        if (key === 'webServer') return active
        if (key === 'llm') return makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }]))
        return undefined
      },
      inject(_deps: string[], callback: (child: unknown) => void): void {
        callback(ctx)
      },
      on: (): (() => void) => () => {},
    }
    apply(ctx as never, CONFIG)
    expect(captured).toHaveLength(1)

    const stale = active
    active = {
      register: (route: CapturedRoute): (() => void) => {
        captured.push(route)
        return () => {}
      },
    }
    apply(ctx as never, CONFIG)
    expect(captured).toHaveLength(2)
    expect(active).not.toBe(stale)
  })

  it('releases the route when the fiber is disposed, so a reload re-mounts cleanly', () => {
    // The disposer used to be parked in a module-level map that nothing ever
    // called: an unloaded plugin kept answering with a stale config reader and
    // a stale admission gate, and a reload hit `duplicate prefix route`.
    const { ctx, captured, disposeAll, routeDisposals } = stubContext(makeLlm(() => streamOf(['x'], [{ type: 'finish', reason: { kind: 'stop' } }])))
    apply(ctx as never, CONFIG)
    expect(captured).toHaveLength(1)
    expect(routeDisposals()).toBe(0)

    disposeAll()
    expect(routeDisposals()).toBe(1)

    // After the teardown the mount record is gone, so the next apply registers
    // again instead of believing a route it no longer owns is still live.
    apply(ctx as never, CONFIG)
    expect(captured).toHaveLength(2)
  })
})
