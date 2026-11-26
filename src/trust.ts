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
import { matchTrustedRequest, parseTrustAllowlist } from './trusted-hosts'

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

/** The config fields the trust gate reads for the two explicit allowlists. */
export interface TrustConfig {
  readonly lanHosts?: unknown
  readonly relayHosts?: unknown
}

/** Read the current config; absent means "no allowlist, loopback only". */
export type TrustConfigReader = () => TrustConfig

/** Warn about the fallback once per process, not once per request. */
let warnedFallback = false

/**
 * Whether the request matches an explicitly configured non-loopback origin.
 *
 * Only called after the host gate has admitted the request. A match is not
 * authentication: it just says "this Host/Origin was configured". LAN entries
 * still reject proxy headers, relay entries allow them.
 * @param req - the incoming request.
 * @param readConfig - current config reader, when the route has one.
 * @returns true when a configured entry applies.
 */
function allowlisted(req: IncomingMessage, readConfig: TrustConfigReader | undefined): boolean {
  if (readConfig === undefined) return false
  const config = readConfig()
  const allowlist = parseTrustAllowlist(config.lanHosts, config.relayHosts)
  return matchTrustedRequest(req, allowlist) !== undefined
}

/**
 * Decide whether one request may reach a host route.
 *
 * The host gate runs first. The explicit allowlists are consulted only after it
 * admits the request; they can never bypass a 401/403 from the host, and they
 * are ignored entirely on hosts without a Connection service.
 * @param ctx - registrant context; `connection` is read lazily, so a host that
 *   mounts the service later is picked up without a re-apply.
 * @param req - the incoming request.
 * @param readConfig - current config reader, when the route has one.
 * @returns a refusal with its stable code, or undefined to continue into the route.
 */
export function trustRejection(ctx: Context, req: IncomingMessage, readConfig?: TrustConfigReader): TrustRejection | undefined {
  const connection = ctx.get('connection' as never) as unknown as ConnectionFace | null | undefined
  if (connection !== undefined && connection !== null && typeof connection.requestRejection === 'function') {
    const rejection = connection.requestRejection({ headers: req.headers })
    if (rejection === 401) return { status: 401, code: 'unauthorized', message: 'unauthorized' }
    if (rejection === 403) return { status: 403, code: 'forbidden', message: 'forbidden: host rejected the request' }
    if (allowlisted(req, readConfig)) return undefined
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
