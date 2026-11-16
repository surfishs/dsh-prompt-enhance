/**
 * The provider/model catalog reads behind the routing selects, and their
 * read-only routes. These are projections of the harness registry, so the
 * tests pin: registered-before-dormant ordering, deduplication, the empty
 * model catalog reasons, and the warning-only route check.
 * @module tests/catalog-route
 */

import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { checkRoute, listModelCatalog, listProviderCatalog } from '../src/provider-catalog'
import { serveCatalog } from '../src/catalog-route'
import { LLM_MODELS_ENDPOINT, LLM_PROVIDERS_ENDPOINT, LLM_ROUTE_CHECK_ENDPOINT } from '../src/shared/catalog'

/** Minimal context exposing the llm service by name. */
function ctxOf(llm: unknown): Context {
  return {
    get(name: string) {
      return name === 'llm' ? llm : undefined
    },
  } as unknown as Context
}

/** Fake response recording status and body. */
function fakeRes(): { status: number; body: string; writeHead: (status: number) => void; end: (body?: string) => void } {
  const res = {
    status: 0,
    body: '',
    writeHead(status: number): void {
      res.status = status
    },
    end(body?: string): void {
      res.body = body ?? ''
    },
  }
  return res
}

describe('listProviderCatalog', () => {
  it('lists registered providers first, then dormant ones, without duplicates', () => {
    const catalog = listProviderCatalog(
      ctxOf({
        listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
        listConfigurableProviders: () => [
          { provider: 'deepseek-official', displayName: 'DeepSeek', settingsNs: 'x', settingsPath: [] },
          { provider: 'qwen', displayName: 'Qwen', settingsNs: 'x', settingsPath: [] },
        ],
      }),
    )
    expect(catalog.providers).toEqual([
      { id: 'deepseek-official', name: 'DeepSeek', registered: true },
      { id: 'qwen', name: 'Qwen', registered: false },
    ])
  })

  it('returns an empty catalog without the llm service', () => {
    expect(listProviderCatalog(ctxOf(undefined))).toEqual({ providers: [] })
  })
})

describe('listModelCatalog', () => {
  it('maps the adapter’s model entries', async () => {
    const catalog = await listModelCatalog(
      ctxOf({
        listModels: async () => [{ provider: 'deepseek-official', id: 'deepseek-flash', name: 'DeepSeek Flash', description: 'fast' }],
      }),
      'deepseek-official',
    )
    expect(catalog.models).toEqual([{ id: 'deepseek-flash', name: 'DeepSeek Flash', description: 'fast' }])
  })

  it('reports an empty list with a reason when the lookup fails', async () => {
    const catalog = await listModelCatalog(
      ctxOf({
        listModels: async () => {
          throw new Error('boom')
        },
      }),
      'p',
    )
    expect(catalog.models).toEqual([])
    expect(catalog.reason).toBe('list-failed')
  })

  it('reports llm-unavailable without the service', async () => {
    const catalog = await listModelCatalog(ctxOf(undefined), 'p')
    expect(catalog).toEqual({ models: [], reason: 'llm-unavailable' })
  })
})

describe('checkRoute', () => {
  it('reports availability when the route resolves', async () => {
    const result = await checkRoute(ctxOf({ resolveModelInfo: async () => ({}) }), 'p', 'm')
    expect(result).toEqual({ available: true })
  })

  it('reports a resolved failure (warning-only, never a throw)', async () => {
    const result = await checkRoute(
      ctxOf({
        resolveModelInfo: async () => {
          throw new Error('no route')
        },
      }),
      'p',
      'm',
    )
    expect(result).toEqual({ available: false, reason: 'unresolved' })
  })
})

describe('serveCatalog', () => {
  const trusted = { method: 'GET', headers: {}, socket: { remoteAddress: '127.0.0.1' } }

  it('serves the provider catalog', async () => {
    const res = fakeRes()
    await serveCatalog(
      ctxOf({ listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }], listConfigurableProviders: () => [] }),
      { ...trusted, url: LLM_PROVIDERS_ENDPOINT } as never,
      res as never,
      LLM_PROVIDERS_ENDPOINT,
    )
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true, value: { providers: [{ id: 'deepseek-official', name: 'DeepSeek', registered: true }] } })
  })

  it('rejects a model request without a provider', async () => {
    const res = fakeRes()
    await serveCatalog(ctxOf({}), { ...trusted, url: LLM_MODELS_ENDPOINT } as never, res as never, LLM_MODELS_ENDPOINT)
    expect(res.status).toBe(422)
  })

  it('serves the route check for a complete pair', async () => {
    const res = fakeRes()
    await serveCatalog(ctxOf({ resolveModelInfo: async () => ({}) }), { ...trusted, url: `${LLM_ROUTE_CHECK_ENDPOINT}?provider=p&model=m` } as never, res as never, LLM_ROUTE_CHECK_ENDPOINT)
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true, value: { available: true } })
  })

  it('rejects a non-GET method', async () => {
    const res = fakeRes()
    await serveCatalog(ctxOf({}), { ...trusted, method: 'POST', url: LLM_PROVIDERS_ENDPOINT } as never, res as never, LLM_PROVIDERS_ENDPOINT)
    expect(res.status).toBe(405)
  })
})
