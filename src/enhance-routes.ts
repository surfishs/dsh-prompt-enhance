/**
 * The POST /dsh-prompt-enhance/enhance host route: the browser half's single
 * seam. Loopback-fenced, body-capped, per-request config re-read (settings
 * changes land on the very next call), route resolved by precedence
 * (settings pair → session request header → harness default model).
 * @module dsh-prompt-enhance/enhance-routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AdmissionGate, AdmissionOutcome } from './admission'
import { ENHANCE_ENDPOINT, ENHANCE_PREFIX, ENHANCE_STREAM_ENDPOINT } from './shared/protocol'
import { createStreamNormalizer } from './shared/stream-text'
import { createSseWriter } from './sse'
import { checkInputText } from './shared/validate'
import { type Config } from './config'
import { toEnhanceError } from './enhancer'
import { runEnhance, sessionRouteOf } from './orchestrate'
import { isTrustedRequest } from './loopback'
import { readBoundedJson, writeJson, endResponse } from './http'
import { REASONING_EFFORTS_ENDPOINT } from './shared/reasoning'
import { serveReasoningEfforts } from './reasoning-route'
import { LLM_MODELS_ENDPOINT, LLM_PROVIDERS_ENDPOINT, LLM_ROUTE_CHECK_ENDPOINT } from './shared/catalog'
import { serveCatalog } from './catalog-route'

/** Envelope slack over the UTF-8 text cap: JSON quoting can inflate ~2-6x in the worst case. */
const bodyCapOf = (maxInputChars: number): number => maxInputChars * 6 + 4096

/**
 * Serve one enhance POST against the request envelope.
 * @param ctx - registrant context (llm, optional sessions/settings).
 * @param readConfig - per-request config reader.
 * @param gate - the shared admission gate (window, concurrency, breaker).
 * @param pathname - the request path, already parsed by the prefix handler.
 * @param req - the incoming request.
 * @param res - the outgoing response.
 * @param stream - whether to answer with an SSE stream of incremental frames
 *   instead of one JSON envelope. Both modes share the whole admission path;
 *   only the response shape differs.
 */
async function serveEnhance(ctx: Context, readConfig: () => Config, gate: AdmissionGate, pathname: string, req: IncomingMessage, res: ServerResponse, stream: boolean): Promise<void> {
  if (!isTrustedRequest(req)) {
    writeJson(res, 403, { ok: false, error: { code: 'internal', message: 'forbidden: loopback-only' } })
    return
  }
  // One route, two exact endpoints (one-shot JSON / incremental SSE):
  // anything else under the prefix is unknown.
  if (pathname !== ENHANCE_ENDPOINT && pathname !== ENHANCE_STREAM_ENDPOINT) {
    writeJson(res, 404, { ok: false, error: { code: 'internal', message: 'not found' } })
    return
  }
  if (req.method !== 'POST') {
    writeJson(res, 405, { ok: false, error: { code: 'internal', message: 'only POST is allowed' } })
    return
  }
  const contentType = req.headers['content-type']
  if (contentType !== undefined && !String(contentType).toLowerCase().startsWith('application/json')) {
    writeJson(res, 415, { ok: false, error: { code: 'rejected', message: '仅支持 application/json 请求体。' } })
    return
  }
  let config: Config
  try {
    config = readConfig()
  } catch (error) {
    // resolveConfig fails loud on an invalid section — surface it instead of
    // letting the rejection escape the handler.
    writeJson(res, 500, { ok: false, error: { code: 'internal', message: `dsh-prompt-enhance 配置无效：${error instanceof Error ? error.message : String(error)}` } })
    return
  }
  // Fail before reading the body when the plugin is switched off.
  if (!config.enabled) {
    writeJson(res, 403, { ok: false, error: { code: 'rejected', message: '提示词增强已在设置中关闭。' } })
    return
  }
  // Fast reject on a declared body that already exceeds the cap: refuse before
  // reading a single byte. The streamed cap inside readBoundedJson stays as the
  // backstop for chunked bodies, which carry no Content-Length at all. A caller
  // that declares megabytes and dribbles them (or never sends them) must not
  // hold the connection open, so the connection is closed once the 413 lands.
  const cap = bodyCapOf(config.maxInputChars)
  const declaredLength = Number(req.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > cap) {
    // `connection: close` instead of destroying the socket: the 413 still has
    // to reach the caller, and a blunt destroy also kills whatever else rides
    // this keep-alive connection. Declaring the connection non-reusable is
    // enough: Node flushes the 413, ends the socket right behind it, and never
    // accepts the unread remainder — the caller's later body bytes fail with
    // EPIPE — so nothing here has to be torn down by hand.
    res.setHeader('connection', 'close')
    writeJson(res, 413, { ok: false, error: { code: 'rejected', message: '请求体超过大小上限。' } })
    return
  }
  let body: unknown
  try {
    body = await readBoundedJson(req, cap)
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'body too large'
    // The overflow case left the body unread, so this connection can never carry
    // another request — and measured on node v24.21.0, Node keeps it open with
    // no FIN unless the response says otherwise. Declare it non-reusable exactly
    // like the declared-length fast reject above: the 413 still has to travel,
    // but the socket must not linger after it.
    // Only the 413 closes: the 422 path consumed the body, so it stays reusable.
    if (tooLarge) res.setHeader('connection', 'close')
    writeJson(res, tooLarge ? 413 : 422, {
      ok: false,
      error: { code: 'rejected', message: tooLarge ? '请求体超过大小上限。' : '请求体不是有效的 JSON。' },
    })
    return
  }
  const record = body as { sessionId?: unknown; text?: unknown } | null
  if (record === null || typeof record !== 'object' || typeof record.text !== 'string') {
    writeJson(res, 422, { ok: false, error: { code: 'rejected', message: '请求体必须是 { sessionId?, text } JSON。' } })
    return
  }
  const sessionId = typeof record.sessionId === 'string' && record.sessionId !== '' ? record.sessionId : undefined
  const check = checkInputText(record.text, config.maxInputChars)
  if (!check.ok) {
    // The over-length case carries structured counts so the client renders
    // its localized too-long message (matching the client-side guard);
    // empty text (server-side only — the client guards it first) stays generic.
    writeJson(res, 422, {
      ok: false,
      error: check.code === 'too-long' ? { code: 'rejected', params: { count: check.count, max: check.max } } : { code: 'rejected' },
    })
    return
  }
  // Admission gate (after validation, so only real calls consume budget). The
  // gate instance is shared with the /enhance command plane — see ./admission.
  const decision = gate.admit(Date.now(), { rateLimitPerMinute: config.rateLimitPerMinute, maxConcurrent: config.maxConcurrent })
  if (!decision.ok) {
    // Advertise the wait only when the gate can predict one (cool-down or rate
    // window); a busy concurrency slot frees whenever some call settles.
    if (decision.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(decision.retryAfterSeconds))
    writeJson(res, 429, { ok: false, error: decision.error })
    return
  }
  // Cancel the model call when the browser goes away mid-flight. `res.close`
  // also fires after a normal response completes, so guard with
  // `writableEnded` — only a premature close aborts the call.
  const callerAbort = new AbortController()
  const onConnectionClosed = (): void => {
    if (!res.writableEnded) callerAbort.abort()
  }
  res.on('close', onConnectionClosed)
  /** How the admitted call ended; the gate is settled from `finally`. */
  let outcome: AdmissionOutcome = 'aborted'
  try {
    const runOptions = {
      text: record.text,
      sessionRoute: sessionRouteOf(ctx, sessionId),
      signal: callerAbort.signal,
      ...(sessionId !== undefined ? { sessionId } : {}),
    }
    if (stream) {
      // The stream already opens before the model call, so the client sees
      // the first token instead of waiting for the whole rewrite. Frames go
      // through the backpressure-aware writer: a slow reader pauses the delta
      // path instead of letting the socket buffer grow without bound.
      const sse = createSseWriter(res)
      try {
        sse.open()
        // Display-only normalization: withhold a fence the final body will not
        // have. The authoritative text still comes from `normalizeOutput` at
        // the end, so this cannot change what the user applies.
        const display = createStreamNormalizer()
        const value = await runEnhance(ctx, config, {
          ...runOptions,
          onDelta: async (delta: string): Promise<void> => {
            const safe = display.push(delta)
            if (safe === '') return
            await sse.write(`event: delta\ndata: ${JSON.stringify({ type: 'delta', text: safe })}\n\n`)
          },
        })
        // End the display stream: release whatever the fence heuristic was
        // still withholding, so the incremental view shows the same text the
        // done frame is about to carry (the model may end inside a fence).
        const tail = display.finish()
        if (tail !== '') {
          await sse.write(`event: delta\ndata: ${JSON.stringify({ type: 'delta', text: tail })}\n\n`)
        }
        await sse.write(`event: done\ndata: ${JSON.stringify({ type: 'done', value })}\n\n`)
        // Terminate the response. Without this the chunked body never receives
        // its closing `0\r\n\r\n`, so the connection stays half-open: a browser
        // client survives only because it returns on the `done` frame and
        // cancels the reader, but any whole-body reader (`response.text()`, a
        // curl, a proxy) waits forever, and the socket can never be reused.
        endResponse(res)
      } finally {
        // Always release the transport listener, success or failure.
        sse.dispose()
      }
    } else {
      const value = await runEnhance(ctx, config, runOptions)
      writeJson(res, 200, { ok: true, value })
    }
    // Count only on success: failed calls must not consume the sliding window
    // (see the gate note above). `Date.now()` at completion, not admission,
    // keeps the window honest — a slow success still counts as one call.
    outcome = 'success'
  } catch (error) {
    // A caller that walked away is not a failing route: aborting mid-flight
    // must never move the breaker toward its cool-down.
    outcome = callerAbort.signal.aborted ? 'aborted' : 'failure'
    const wire = toEnhanceError(error)
    if (stream && res.headersSent) {
      // Headers are already out: the failure has to ride the same stream, and
      // the stream has to be closed the same way the success path closes it.
      // Writing the `error` frame alone leaves the chunked body unterminated —
      // the frame reaches a browser (which acts on it), while a whole-body
      // reader keeps waiting for the closing chunk that never comes.
      if (!res.writableEnded) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: wire })}\n\n`)
        } catch {
          // Socket already gone: the write is moot, the end below still applies.
        }
      }
      endResponse(res)
    } else {
      writeJson(res, wire.code === 'timeout' ? 504 : wire.code === 'unconfigured' ? 409 : 502, { ok: false, error: wire })
    }
  } finally {
    res.off('close', onConnectionClosed)
    // Release the slot and record how the call ended: a success lands a window
    // stamp, a failure feeds the breaker, a cancellation does neither.
    gate.settle(outcome, Date.now())
  }
}

/**
 * Contexts that already own the route. A second registration on one context
 * would answer the same path twice, and it would spend the shared admission
 * gate twice per request — exactly the drift a re-applied plugin (reload,
 * re-link) must not introduce.
 *
 * The recorded mount carries the webserver it was registered on: if the host
 * ever rebuilds that service while reusing the same context, a bare "already
 * mounted" flag would leave the plugin alive with no route at all (button
 * present, every click 404). Comparing identities lets the registration heal
 * itself instead of staying silently absent.
 */
interface RouteMount {
  webserver: unknown
  dispose: () => void
}

const mounts = new WeakMap<Context, RouteMount>()

/**
 * Register the /dsh-prompt-enhance prefix route on the shared webserver.
 *
 * Two lifetime rules, both learned the hard way:
 *
 * 1. The webserver is a *dependency*, not something to snapshot. Reading it
 *    once at apply time would leave the plugin routeless in any composition
 *    that loads the webserver later, and would keep serving from a dead
 *    service after the host rebuilds it. `ctx.inject` scopes a child fiber to
 *    the service, so this block re-runs on replacement and is torn down when
 *    the service goes away.
 * 2. The registration must live exactly as long as that fiber.
 *    `webServer.register` only hands back a "drop from the table" function; the
 *    service does not reclaim it on unload. Left to a module-level map, an
 *    unloaded plugin keeps answering requests with a stale config reader and a
 *    stale admission gate, and a reload throws `duplicate prefix route`.
 *    `ctx.effect` is what actually reclaims it.
 *
 * @param ctx - registrant context.
 * @param readConfig - per-request config reader so settings changes apply immediately.
 * @param gate - the admission gate shared with the /enhance command plane, so
 *   both entries are capped by the same window, concurrency cap and breaker.
 */
export function registerEnhanceRoute(ctx: Context, readConfig: () => Config, gate: AdmissionGate): void {
  ctx.inject(['webServer'], (routeCtx: Context) => {
    const webserver = routeCtx.get('webServer') as unknown as
      | {
          register(route: unknown): unknown
        }
      | undefined
    if (webserver === undefined) return
    const existing = mounts.get(ctx)
    // Already mounted on this very service (a second apply on a live fiber, or
    // a re-link): a second registration would also double the effective rate
    // and concurrency limits, which is exactly the drift a reload must not add.
    if (existing !== undefined && existing.webserver === webserver) return
    if (existing !== undefined) {
      // The service was rebuilt: drop the stale registration (it belongs to a
      // webserver that no longer serves) and mount on the live one.
      try {
        existing.dispose()
      } catch {
        // Already torn down with the old service.
      }
      mounts.delete(ctx)
    }
    routeCtx.effect(() => {
      const dispose = webserver.register({
        kind: 'prefix',
        path: ENHANCE_PREFIX,
        handler: (req: IncomingMessage, res: ServerResponse): Promise<void> => {
          const pathname = new URL(req.url ?? '/', 'http://x').pathname
          // One read-only sibling under the same prefix: the settings page asks
          // what tiers the configured route declares. It shares the fence and
          // the per-mount lifetime, and never touches the admission gate.
          if (pathname === REASONING_EFFORTS_ENDPOINT) return serveReasoningEfforts(ctx, req, res)
          if (pathname === LLM_PROVIDERS_ENDPOINT || pathname === LLM_MODELS_ENDPOINT || pathname === LLM_ROUTE_CHECK_ENDPOINT) {
            return serveCatalog(ctx, req, res, pathname)
          }
          return serveEnhance(ctx, readConfig, gate, pathname, req, res, pathname === ENHANCE_STREAM_ENDPOINT)
        },
      })
      const disposed = typeof dispose === 'function' ? (dispose as () => void) : (): void => {}
      mounts.set(ctx, { webserver, dispose: disposed })
      return (): void => {
        // Only the owner clears the record: after a service swap a newer mount
        // may already own it, and deleting that would make the next apply
        // register a duplicate on a live table.
        if (mounts.get(ctx)?.dispose === disposed) mounts.delete(ctx)
        try {
          disposed()
        } catch {
          // Already torn down with the old service.
        }
      }
    }, 'dsh-prompt-enhance: enhance route')
  })
}
