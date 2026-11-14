// @vitest-environment jsdom
/**
 * The reasoning-capability client cache.
 *
 * The freshness policy is explicit: a pinned pair is cached with NO TTL and is
 * only replaced by a pair change or a manual refresh; the default-model path is
 * never cached because the settings page cannot observe that selection.
 * @module tests/reasoning-options
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadReasoningCapabilities, readCachedCapabilities } from '../src/client/reasoning-options'

/** Build one JSON response. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const RESOLVED = {
  efforts: [{ id: 'low', name: 'Low' }, { id: 'max', name: 'Max', description: 'hardest' }],
  defaultEffort: 'high',
  source: 'resolved' as const,
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('reasoning capability cache', () => {
  it('persists a resolved answer and serves it without another request', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, value: RESOLVED }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadReasoningCapabilities('zhipu', 'glm-4.6')).toEqual(RESOLVED)
    expect(await loadReasoningCapabilities('zhipu', 'glm-4.6')).toEqual(RESOLVED)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('bypasses and replaces the cache on an explicit refresh', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, value: RESOLVED }))
    vi.stubGlobal('fetch', fetchMock)
    await loadReasoningCapabilities('zhipu', 'glm-4.6')
    await loadReasoningCapabilities('zhipu', 'glm-4.6', { force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readCachedCapabilities('zhipu', 'glm-4.6')).toEqual(RESOLVED)
  })

  it('does not cache an unavailable answer', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } }))
    vi.stubGlobal('fetch', fetchMock)
    await loadReasoningCapabilities('p', 'm')
    expect(readCachedCapabilities('p', 'm')).toBeUndefined()
    await loadReasoningCapabilities('p', 'm')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never caches the default-model path and sends no pair', async () => {
    const fetchMock = vi.fn(async (_url: URL) => json({ ok: true, value: { efforts: [{ id: 'off', name: 'Off' }], source: 'default' } }))
    vi.stubGlobal('fetch', fetchMock)
    await loadReasoningCapabilities(undefined, undefined)
    await loadReasoningCapabilities(undefined, undefined)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const url = fetchMock.mock.calls[0]?.[0]
    expect(url?.searchParams.has('provider')).toBe(false)
  })

  it('maps a malformed payload to unavailable without caching it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, value: { efforts: 'nope', source: 'resolved' } })))
    const capabilities = await loadReasoningCapabilities('p', 'm')
    expect(capabilities.source).toBe('unavailable')
    expect(readCachedCapabilities('p', 'm')).toBeUndefined()
  })
})
