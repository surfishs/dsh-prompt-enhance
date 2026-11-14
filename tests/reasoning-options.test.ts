// @vitest-environment jsdom
/**
 * The browser-side reasoning lookup. The durable cache lives on the host, so
 * these tests only pin the request shape: the pinned pair, the refresh flag,
 * and the tolerant decoding of the answer.
 * @module tests/reasoning-options
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReasoningCapabilities } from '../src/client/reasoning-options'

/** Build one JSON response. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchReasoningCapabilities', () => {
  it('sends the pinned pair and no refresh flag by default', async () => {
    const fetchMock = vi.fn(async (_url: URL) => json({
      ok: true,
      value: { efforts: [{ id: 'max', name: 'Max' }], defaultEffort: 'high', source: 'resolved' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const capabilities = await fetchReasoningCapabilities('zhipu', 'glm-4.6')
    expect(capabilities).toEqual({ efforts: [{ id: 'max', name: 'Max' }], defaultEffort: 'high', source: 'resolved' })
    const url = fetchMock.mock.calls[0]?.[0]
    expect(url?.searchParams.get('provider')).toBe('zhipu')
    expect(url?.searchParams.get('model')).toBe('glm-4.6')
    expect(url?.searchParams.has('refresh')).toBe(false)
  })

  it('asks the host to bypass its cache on refresh', async () => {
    const fetchMock = vi.fn(async (_url: URL) => json({ ok: true, value: { efforts: [{ id: 'low', name: 'Low' }], source: 'resolved' } }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchReasoningCapabilities('zhipu', 'glm-4.6', { refresh: true })
    expect(fetchMock.mock.calls[0]?.[0]?.searchParams.get('refresh')).toBe('1')
  })

  it('omits the pair when following the default model', async () => {
    const fetchMock = vi.fn(async (_url: URL) => json({ ok: true, value: { efforts: [{ id: 'off', name: 'Off' }], source: 'default' } }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchReasoningCapabilities(undefined, undefined)
    const url = fetchMock.mock.calls[0]?.[0]
    expect(url?.searchParams.has('provider')).toBe(false)
    expect(url?.searchParams.has('refresh')).toBe(false)
  })

  it('maps a malformed payload to unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, value: { efforts: 'nope', source: 'resolved' } })))
    const capabilities = await fetchReasoningCapabilities('p', 'm')
    expect(capabilities.source).toBe('unavailable')
  })
})
