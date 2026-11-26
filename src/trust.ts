/**
 * Host trust gate shared by every route this plugin mounts.
 *
 * Two layers, in order:
 *
 * 1. `ctx.connection.requestRejection` — the host's own Host/Origin policy plus
 *    browser-session authentication, wherever the composition provides a
 *    Connection service. It is the gate the host applies to its own routes, so
 *    a plugin route that skips it is the odd one out.
 * 2. The plugin's own loopback fence ({@link isTrustedTransport} /
 *    {@link isTrustedRequest}) — kept as the structural second gate, and as the
 *    full gate on hosts without a Connection service.
 *
 * Which half of the fence runs depends on whether the host gate answered:
 *
 * - **Host gate present and allowing** — the browser-shaped checks belong to it.
 *   A desktop shell's bridged fetch carries no `Origin` and no `Sec-Fetch-*` at
 *   all, so re-judging those headers here would reject a request the host just
 *   admitted. Only the structural half (loopback socket, loopback Host, no
 *   proxy headers) still runs.
 * - **No Connection service** — the full fence runs, including the
 *   browser-shaped default-deny rules, because nothing else checks them.
 * @module dsh-prompt-enhance/trust
 */

import type { IncomingMessage } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { isTrustedRequest, isTrustedTransport } from './loopback'

/** Statuses the host gate may answer with. */
export type HostRejection = 401 | 403

/**
 * Why a route was refused, in terms the browser can localize:
 *
 * - `unauthorized` — the host gate has no usable browser session.
 * - `forbidden` — the host gate refused the request (Host/Origin/session policy).
 * - `loopback-only` — the plugin's structural fence refused a request that the
 *   host admitted but that did not arrive over a trusted loopback transport.
 */
export type TrustRejectionCode = 'unauthorized' | 'forbidden' | 'loopback-only'

/** One refusal: the HTTP status plus the stable code the client renders. */
export interface TrustRejection {
  readonly status: HostRejection
  readonly code: TrustRejectionCode
  readonly message: string
}

/** The plugin's own transport refusal, kept as one shared frozen value. */
const LOOPBACK_ONLY: TrustRejection = Object.freeze({
  status: 403,
  code: 'loopback-only',
  message: 'forbidden: loopback-only',
})

/** The slice of `ctx.connection` this plugin consumes. */
interface ConnectionFace {
  readonly requestRejection?: (request: { readonly headers: IncomingMessage['headers'] }) => HostRejection | undefined
}

/** Warn about the fallback once per process, not once per request. */
let warnedFallback = false

/**
 * Decide whether one request may reach a host route.
 * @param ctx - registrant context; `connection` is read lazily, so a host that
 *   mounts the service later is picked up without a re-apply.
 * @param req - the incoming request.
 * @returns a refusal with its stable code, or undefined to continue into the route.
 */
export function trustRejection(ctx: Context, req: IncomingMessage): TrustRejection | undefined {
  const connection = ctx.get('connection' as never) as unknown as ConnectionFace | null | undefined
  if (connection !== undefined && connection !== null && typeof connection.requestRejection === 'function') {
    const rejection = connection.requestRejection({ headers: req.headers })
    if (rejection === 401) return { status: 401, code: 'unauthorized', message: 'unauthorized' }
    if (rejection === 403) return { status: 403, code: 'forbidden', message: 'forbidden: host rejected the request' }
    return isTrustedTransport(req) ? undefined : LOOPBACK_ONLY
  }
  if (!warnedFallback) {
    warnedFallback = true
    // Not console-silent: a host without Connection is a configuration the
    // operator should be able to see in the host log, and one line is enough.
    console.warn('[dsh-prompt-enhance] ctx.connection is unavailable; route trust falls back to the loopback fence')
  }
  if (!isTrustedTransport(req)) return LOOPBACK_ONLY
  return isTrustedRequest(req) ? undefined : { status: 403, code: 'forbidden', message: 'forbidden: untrusted request' }
}
