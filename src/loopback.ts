/**
 * Loopback fence for the plugin's host routes: the enhance route forwards
 * the draft to a configured model provider, so untrusted callers must be
 * turned away regardless of method or content-type (same fence policy as
 * the describe-image route family).
 * @module dsh-prompt-enhance/loopback
 */

import type { IncomingMessage } from 'node:http'

/** Hostnames a browser (or local process) may use to reach the loopback server. */
const TRUSTED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

/** Whether the request arrived on a loopback socket address. */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Strip the port (and IPv6 brackets) from a Host header value. */
function hostnameOf(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    return end === -1 ? trimmed : trimmed.slice(1, end)
  }
  const colon = trimmed.lastIndexOf(':')
  return colon === -1 ? trimmed : trimmed.slice(0, colon)
}

/**
 * Port named by a Host header value, or `null` when it carries none (which
 * means the request arrived on the scheme's default port).
 */
function portOf(hostHeader: string): string | null {
  const trimmed = hostHeader.trim().toLowerCase()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end === -1) return null
    const rest = trimmed.slice(end + 1)
    return rest.startsWith(':') ? rest.slice(1) || null : null
  }
  const colon = trimmed.lastIndexOf(':')
  return colon === -1 ? null : trimmed.slice(colon + 1) || null
}

/** `URL.hostname` keeps the brackets on IPv6 literals; the allowlist does not. */
function bareHostname(url: URL): string {
  const host = url.hostname.toLowerCase()
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
}

/** Port an Origin implies, filling in the scheme default when it omits one. */
function effectivePort(url: URL): string {
  if (url.port !== '') return url.port
  return url.protocol === 'https:' ? '443' : '80'
}

/**
 * Origins a web page may come from to call the loopback server (same-app
 * pages). The port must match the one the request was addressed to when the
 * Host header names a port: without that, every other local server — any dev
 * tool, any playground page on `localhost:4000` — becomes a same-app page and
 * may spend the user's model quota through this route. A Host header with no
 * port (default-port server, or HTTP/1.0 without Host) leaves only the
 * hostname check, since there is no port to pin against.
 */
function isTrustedOrigin(origin: string, expectedPort: string | null): boolean {
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!TRUSTED_HOSTNAMES.has(bareHostname(url))) return false
    return expectedPort === null || effectivePort(url) === expectedPort
  } catch {
    return false
  }
}

/** Methods whose browser form must carry an `Origin`. */
const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Structural half of the fence: the socket must be loopback, the Host header
 * must name a loopback host, and no proxy-forwarding headers may be present.
 *
 * This is the half that applies even when the host's own Connection gate has
 * already approved the request: it costs nothing and it keeps the route off a
 * non-loopback interface. The browser-shaped checks live in
 * {@link isTrustedRequest}, because a desktop shell's bridged fetch carries no
 * Origin and no `Sec-Fetch-*` at all.
 */
export function isTrustedTransport(req: IncomingMessage): boolean {
  if (req.headers['x-forwarded-for'] !== undefined || req.headers.forwarded !== undefined) return false
  if (!isLoopbackRequest(req)) return false
  const host = req.headers.host
  if (typeof host !== 'string' || host.trim() === '') return false
  return TRUSTED_HOSTNAMES.has(hostnameOf(host))
}

/**
 * Full fence for hosts without a Connection service: the structural checks
 * plus the browser-shaped default-deny rules.
 *
 * A request that declares `Sec-Fetch-Site: cross-site` is refused, and a
 * non-GET request without an `Origin` is refused (browsers send one for every
 * non-GET request, so its absence marks a non-browser caller that skipped the
 * header). GET/HEAD may omit `Origin`: a browser image/script load does, and
 * those routes are read-only.
 */
export function isTrustedRequest(req: IncomingMessage): boolean {
  if (!isTrustedTransport(req)) return false
  // Declared cross-site is refused even when a Host/Origin pair would pass:
  // `Sec-Fetch-Site` is the browser's own statement about the initiator.
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site.trim().toLowerCase() === 'cross-site') return false
  const host = req.headers.host as string
  const origin = req.headers.origin
  const method = (req.method ?? 'GET').toUpperCase()
  if (typeof origin !== 'string' || origin.trim() === '') return !MUTATING_METHODS.has(method)
  return isTrustedOrigin(origin, portOf(host))
}
