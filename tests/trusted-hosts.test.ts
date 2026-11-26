/**
 * Exact-origin allowlists: parsing, normalization and the LAN/relay proxy
 * header split. The trust gate itself is covered in `trust.test.ts`.
 * @module tests/trusted-hosts
 */

import { describe, expect, it } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { canonicalHost, matchTrustedRequest, parseTrustAllowlist } from '../src/trusted-hosts'

/** Build the minimum request shape the matcher reads. */
function req(headers: Record<string, string>, method = 'POST'): IncomingMessage {
  return { headers, method } as unknown as IncomingMessage
}

const LAN = 'http://192.168.31.181:3080'
const RELAY = 'https://abc.dsh-market.com'

describe('canonicalHost', () => {
  it('drops default ports and keeps real ones', () => {
    expect(canonicalHost('Example.COM:443')).toBe('example.com')
    expect(canonicalHost('example.com:80')).toBe('example.com')
    expect(canonicalHost('example.com:8443')).toBe('example.com:8443')
    expect(canonicalHost('[::1]:443')).toBe('[::1]')
    expect(canonicalHost('[::1]:3080')).toBe('[::1]:3080')
  })

  it('rejects malformed hosts', () => {
    expect(canonicalHost('')).toBe('')
    expect(canonicalHost('host:')).toBe('')
    expect(canonicalHost('host:abc')).toBe('')
    expect(canonicalHost('[::1')).toBe('')
  })
})

describe('parseTrustAllowlist', () => {
  it('parses full origins and comments, and de-duplicates', () => {
    const allowlist = parseTrustAllowlist(`\n# LAN\n${LAN}\n${LAN}\n`, `# relay\n${RELAY}\nhttps://abc.dsh-market.com:443\n`)
    expect(allowlist.lan).toEqual([{ mode: 'lan', origin: 'http://192.168.31.181:3080', host: '192.168.31.181:3080' }])
    expect(allowlist.relay).toEqual([{ mode: 'relay', origin: 'https://abc.dsh-market.com', host: 'abc.dsh-market.com' }])
  })

  it('rejects non-origin, non-http, credentialed and malformed entries', () => {
    const allowlist = parseTrustAllowlist(
      ['https://example.com/path', 'https://example.com?x=1', 'https://example.com#hash', 'ftp://example.com', 'https://user:pass@example.com', 'not a url', 'http://example.com:99999'].join('\n'),
      '',
    )
    expect(allowlist.lan).toEqual([])
  })

  it('lets a LAN entry win when the same host appears in both lists', () => {
    const allowlist = parseTrustAllowlist(`http://host:3080`, `http://host:3080`)
    expect(allowlist.lan).toHaveLength(1)
    expect(allowlist.relay).toEqual([])
  })
})

describe('matchTrustedRequest', () => {
  const allowlist = parseTrustAllowlist(LAN, RELAY)

  it('matches a direct LAN request with an exact Origin', () => {
    expect(matchTrustedRequest(req({ host: '192.168.31.181:3080', origin: LAN }), allowlist)).toMatchObject({ mode: 'lan' })
  })

  it('allows a LAN GET without Origin, but not a mutating request without one', () => {
    expect(matchTrustedRequest(req({ host: '192.168.31.181:3080' }, 'GET'), allowlist)).toMatchObject({ mode: 'lan' })
    expect(matchTrustedRequest(req({ host: '192.168.31.181:3080' }), allowlist)).toBeUndefined()
  })

  it('refuses a LAN entry that carries a proxy header', () => {
    expect(matchTrustedRequest(req({ host: '192.168.31.181:3080', origin: LAN, 'x-forwarded-for': '10.0.0.2' }), allowlist)).toBeUndefined()
    expect(matchTrustedRequest(req({ host: '192.168.31.181:3080', origin: LAN, forwarded: 'for=10.0.0.2' }), allowlist)).toBeUndefined()
  })

  it('matches a relay request with proxy headers and an exact Origin', () => {
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', origin: RELAY, 'x-forwarded-for': '10.0.0.2' }), allowlist)).toMatchObject({ mode: 'relay' })
  })

  it('still requires the exact Origin on relay mutating requests', () => {
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', 'x-forwarded-for': '10.0.0.2' }), allowlist)).toBeUndefined()
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', origin: 'https://evil.example.com' }), allowlist)).toBeUndefined()
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', origin: 'null' }), allowlist)).toBeUndefined()
  })

  it('matches a relay GET without Origin even with forwarded headers', () => {
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', 'x-forwarded-for': '10.0.0.2' }, 'GET'), allowlist)).toMatchObject({ mode: 'relay' })
  })

  it('does not match a different host or origin', () => {
    expect(matchTrustedRequest(req({ host: '192.168.31.179:3080', origin: LAN }), allowlist)).toBeUndefined()
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com', origin: 'http://abc.dsh-market.com' }), allowlist)).toBeUndefined()
    expect(matchTrustedRequest(req({ host: 'abc.dsh-market.com:443', origin: RELAY }), allowlist)).toMatchObject({ mode: 'relay' })
  })
})
