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
  const trusted = { method: 'GET', headers: { host: '127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } }
  const mutating = { method: 'POST', headers: { host: '127.0.0.1', origin: 'http://127.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } }

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
    await serveCatalog(ctxOf({}), { ...mutating, url: LLM_PROVIDERS_ENDPOINT } as never, res as never, LLM_PROVIDERS_ENDPOINT)
    expect(res.status).toBe(405)
  })

  it('answers with the Host gate status before any route logic', async () => {
    const rejected = (status: 401 | 403): Context =>
      ({
        get(name: string) {
          return name === 'connection' ? { requestRejection: () => status } : undefined
        },
      }) as unknown as Context
    for (const status of [401, 403] as const) {
      const res = fakeRes()
      await serveCatalog(rejected(status), { ...trusted, url: LLM_PROVIDERS_ENDPOINT } as never, res as never, LLM_PROVIDERS_ENDPOINT)
      expect(res.status).toBe(status)
      expect(JSON.parse(res.body)).toMatchObject({
        ok: false,
        error: { code: status === 401 ? 'unauthorized' : 'forbidden' },
      })
    }
  })

  it('names the plugin loopback refusal instead of the host gate status', async () => {
    const connectionAllows = {
      get(name: string) {
        return name === 'connection' ? { requestRejection: () => undefined } : undefined
      },
    } as unknown as Context
    const res = fakeRes()
    await serveCatalog(
      connectionAllows,
      {
        method: 'GET',
        headers: { host: '192.168.1.7:3080' },
        socket: { remoteAddress: '192.168.1.7' },
        url: LLM_PROVIDERS_ENDPOINT,
      } as never,
      res as never,
      LLM_PROVIDERS_ENDPOINT,
    )
    expect(res.status).toBe(403)
    expect(JSON.parse(res.body)).toMatchObject({ ok: false, error: { code: 'loopback-only' } })
  })

  it('admits a configured relay origin through the allowlist', async () => {
    const ctx = {
      get(name: string) {
        if (name === 'llm') {
          return { listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }], listConfigurableProviders: () => [] }
        }
        if (name === 'connection') return { requestRejection: () => undefined }
        return undefined
      },
    } as unknown as Context
    const res = fakeRes()
    await serveCatalog(
      ctx,
      {
        method: 'GET',
        headers: { host: 'abc.dsh-market.com', origin: 'https://abc.dsh-market.com', 'x-forwarded-for': '10.0.0.2' },
        socket: { remoteAddress: '203.0.113.9' },
        url: LLM_PROVIDERS_ENDPOINT,
      } as never,
      res as never,
      LLM_PROVIDERS_ENDPOINT,
      () => ({ lanHosts: '', relayHosts: 'https://abc.dsh-market.com' }),
    )
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({ ok: true })
  })
})
