/**
 * Exact-origin allowlists for the two non-loopback deployment shapes.
 *
 * This module only decides whether a request's `Host` / `Origin` match one of
 * the configured origins and whether its proxy headers are acceptable. It is
 * not an authentication layer: the caller must run the host connection gate
 * first, and a match never bypasses that gate.
 *
 * - `lanHosts`: direct LAN access. Exact Host + Origin, but
 *   `X-Forwarded-For` / `Forwarded` are still refused.
 * - `relayHosts`: access through a relay/proxy. Exact Host + Origin; proxy
 *   headers are allowed because the relay is the intended path. The relay
 *   origin is not a secret, so this mode is an explicit operator risk.
 * @module dsh-prompt-enhance/trusted-hosts
 */

import type { IncomingMessage } from 'node:http'

/** Which allowlist an entry came from. */
export type TrustMode = 'lan' | 'relay'

/** One normalized allowlist entry. */
export interface TrustedOrigin {
  readonly mode: TrustMode
  /** Normalized `Origin` value, e.g. `https://relay.example.com`. */
  readonly origin: string
  /** Normalized `Host` value, e.g. `relay.example.com` or `192.168.1.7:3080`. */
  readonly host: string
}

/** Parsed allowlists after LAN precedence and duplicate removal. */
export interface TrustAllowlist {
  readonly lan: readonly TrustedOrigin[]
  readonly relay: readonly TrustedOrigin[]
}

/** Methods whose browser form must carry an exact `Origin`. */
const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Proxy-forwarding headers; their presence is meaningful for LAN entries. */
const PROXY_HEADERS = ['x-forwarded-for', 'forwarded'] as const

/** One entry per line; blank lines and `#` comments are ignored. */
function linesOf(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

/**
 * Normalize a `Host` header value or a URL's host for comparison.
 *
 * Default ports are dropped so `https://host` and `Host: host:443` match, while
 * non-default ports stay significant. Invalid values return an empty string.
 * @param value - raw host value.
 * @returns the canonical host, or `''` when it cannot be used.
 */
export function canonicalHost(value: string): string {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === '') return ''
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end === -1) return ''
    const rest = trimmed.slice(end + 1)
    if (rest === '') return trimmed
    if (!rest.startsWith(':')) return ''
    const port = rest.slice(1)
    if (port === '' || !/^\d+$/.test(port)) return ''
    return port === '80' || port === '443' ? trimmed.slice(0, end + 1) : trimmed
  }
  const colon = trimmed.lastIndexOf(':')
  if (colon === -1) return trimmed
  const host = trimmed.slice(0, colon)
  const port = trimmed.slice(colon + 1)
  if (host === '' || port === '' || !/^\d+$/.test(port)) return ''
  return port === '80' || port === '443' ? host : trimmed
}

/** Parse one line as a full `http(s)://host[:port]` origin. */
function parseLine(line: string, mode: TrustMode): TrustedOrigin | undefined {
  let url: URL
  try {
    url = new URL(line)
  } catch {
    return undefined
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
  if (url.username !== '' || url.password !== '') return undefined
  if (url.search !== '' || url.hash !== '') return undefined
  // A trailing slash is the only accepted path; anything else would make the
  // configured value a URL rather than an origin.
  if (url.pathname !== '/' && url.pathname !== '') return undefined
  const host = canonicalHost(url.host)
  if (host === '') return undefined
  return { mode, origin: url.origin, host }
}

/** Parse and de-duplicate one allowlist. */
function parseList(raw: unknown, mode: TrustMode): TrustedOrigin[] {
  const seen = new Set<string>()
  const entries: TrustedOrigin[] = []
  for (const line of linesOf(raw)) {
    const entry = parseLine(line, mode)
    if (entry === undefined) continue
    const key = `${entry.origin}\u0000${entry.host}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(entry)
  }
  return entries
}

/**
 * Parse both textarea values.
 *
 * A host that appears in both lists is treated as LAN: the stricter no-proxy
 * rule wins, so an accidental duplicate cannot silently upgrade to relay mode.
 * @param lanRaw - newline-separated LAN origins.
 * @param relayRaw - newline-separated relay origins.
 * @returns the parsed allowlists.
 */
export function parseTrustAllowlist(lanRaw: unknown, relayRaw: unknown): TrustAllowlist {
  const lan = parseList(lanRaw, 'lan')
  const lanHosts = new Set(lan.map((entry) => entry.host))
  const relay = parseList(relayRaw, 'relay').filter((entry) => !lanHosts.has(entry.host))
  return { lan, relay }
}

/** Whether the request carries a proxy-forwarding header. */
function hasProxyHeaders(req: IncomingMessage): boolean {
  return PROXY_HEADERS.some((name) => req.headers[name] !== undefined)
}

/** Whether the request's Origin satisfies the entry; GET/HEAD may omit it. */
function originAllowed(entry: TrustedOrigin, req: IncomingMessage): boolean {
  const raw = req.headers.origin
  if (raw !== undefined && typeof raw !== 'string') return false
  if (typeof raw !== 'string' || raw.trim() === '') {
    return !MUTATING_METHODS.has((req.method ?? 'GET').toUpperCase())
  }
  if (raw.trim().toLowerCase() === 'null') return false
  try {
    return new URL(raw).origin === entry.origin
  } catch {
    return false
  }
}

/**
 * Match one request against both allowlists.
 *
 * The host gate must already have admitted the request. A match only says "this
 * Host/Origin is configured"; it does not authenticate the caller.
 * @param req - the incoming request.
 * @param allowlist - parsed allowlists.
 * @returns the matching entry, or undefined when neither list applies.
 */
export function matchTrustedRequest(req: IncomingMessage, allowlist: TrustAllowlist): TrustedOrigin | undefined {
  const rawHost = req.headers.host
  if (typeof rawHost !== 'string') return undefined
  const host = canonicalHost(rawHost)
  if (host === '') return undefined

  const lan = allowlist.lan.find((entry) => entry.host === host)
  if (lan !== undefined) {
    // A LAN entry means "direct": an unexpected proxy header is not a match.
    if (hasProxyHeaders(req)) return undefined
    return originAllowed(lan, req) ? lan : undefined
  }

  const relay = allowlist.relay.find((entry) => entry.host === host)
  if (relay !== undefined) return originAllowed(relay, req) ? relay : undefined
  return undefined
}
