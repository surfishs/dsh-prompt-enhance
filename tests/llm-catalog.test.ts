/**
 * The provider/model catalog memo: one fetch per window, refresh bypasses it,
 * and failures (including empty model lists) are never remembered.
 * @module tests/llm-catalog
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_TTL_MS, clearCatalogCache, fetchModels, fetchProviders } from '../src/client/llm-catalog'

/** One JSON envelope the way the host route answers. */
const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

/** A fetch double that counts calls and answers by path. */
function stubCatalog(): { calls: () => number } {
  let count = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      count += 1
      const href = String(input)
      if (href.includes('llm-providers')) {
        return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
      }
      if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
      return new Response('{}', { status: 500 })
    }),
  )
  return { calls: () => count }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearCatalogCache()
})

describe('catalog memo', () => {
  it('serves the provider list from memory inside the window', async () => {
    const { calls } = stubCatalog()
    const first = await fetchProviders()
    const second = await fetchProviders()
    expect(first).toEqual(second)
    expect(calls()).toBe(1)
  })

  it('bypasses the memo when refresh is asked for', async () => {
    const { calls } = stubCatalog()
    await fetchProviders()
    await fetchProviders(undefined, { refresh: true })
    expect(calls()).toBe(2)
  })

  it('refetches once the window has passed', async () => {
    const { calls } = stubCatalog()
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1_000)
    await fetchProviders()
    now.mockReturnValue(1_000 + CATALOG_TTL_MS + 1)
    await fetchProviders()
    expect(calls()).toBe(2)
  })

  it('remembers each provider model list separately', async () => {
    const { calls } = stubCatalog()
    await fetchModels('zhipu')
    await fetchModels('qwen')
    await fetchModels('zhipu')
    // zhipu + qwen first reads, then zhipu from memory.
    expect(calls()).toBe(2)
  })

  it('does not cache a failed read', async () => {
    const failing = vi.fn(async () => new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', failing)
    await expect(fetchProviders()).resolves.toBeUndefined()
    await expect(fetchProviders()).resolves.toBeUndefined()
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('does not cache an empty model list', async () => {
    const empty = vi.fn(async () => json({ ok: true, value: { models: [] } }))
    vi.stubGlobal('fetch', empty)
    await expect(fetchModels('zhipu')).resolves.toEqual({ models: [] })
    await expect(fetchModels('zhipu')).resolves.toEqual({ models: [] })
    expect(empty).toHaveBeenCalledTimes(2)
  })
})
