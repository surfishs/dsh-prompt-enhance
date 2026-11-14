/**
 * The host-side reasoning-capability answer and its read-only route.
 *
 * Two behaviours matter here: a pinned pair is answered from the adapter's own
 * declaration (never a guess), and the default-model path only claims the
 * static DeepSeek catalog when the followed default really is DeepSeek.
 * @module tests/reasoning-route
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { resolveReasoningCapabilities } from '../src/reasoning-efforts'
import { serveReasoningEfforts } from '../src/reasoning-route'

/** Minimal context exposing the llm and default-model services by name. */
function ctxOf(llm: unknown, selection?: { provider: string; model: string }): Context {
  return {
    get(name: string) {
      if (name === 'llm') return llm
      if (name === 'agentDefaultModel') return selection === undefined ? undefined : { currentSelection: () => selection }
      return undefined
    },
  } as unknown as Context
}

/** Fake response recording the written status and body. */
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

/** Isolate the persistent cache from the developer's real Harness home. */
let home = ''
const previousHome = process.env.DSH_HOME

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'dpe-reasoning-'))
  process.env.DSH_HOME = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

describe('resolveReasoningCapabilities', () => {
  it('maps the route’s declared efforts and default', async () => {
    const resolveModelInfo = vi.fn(async () => ({
      reasoning: {
        efforts: [{ id: 'off', name: 'Off' }, { id: 'max', name: 'Max', description: 'hardest' }],
        defaultEffort: 'max',
      },
    }))
    const capabilities = await resolveReasoningCapabilities(ctxOf({ resolveModelInfo }), 'zhipu', 'glm-4.6')
    expect(capabilities).toEqual({
      efforts: [{ id: 'off', name: 'Off' }, { id: 'max', name: 'Max', description: 'hardest' }],
      defaultEffort: 'max',
      source: 'resolved',
    })
    expect(resolveModelInfo).toHaveBeenCalledWith('zhipu', 'glm-4.6', expect.any(AbortSignal))
  })

  it('answers a pinned pair from the host cache until a refresh is requested', async () => {
    const resolveModelInfo = vi.fn(async () => ({ reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }))
    const ctx = ctxOf({ resolveModelInfo })
    const first = await resolveReasoningCapabilities(ctx, 'zhipu', 'glm-4.6')
    expect(first).toEqual({ efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low', source: 'resolved' })
    // A second mount reads the disk cache instead of resolving again.
    expect(await resolveReasoningCapabilities(ctx, 'zhipu', 'glm-4.6')).toEqual(first)
    expect(resolveModelInfo).toHaveBeenCalledTimes(1)
    await resolveReasoningCapabilities(ctx, 'zhipu', 'glm-4.6', { refresh: true })
    expect(resolveModelInfo).toHaveBeenCalledTimes(2)
  })

  it('persists the cache under the Harness home', async () => {
    const resolveModelInfo = async () => ({ reasoning: { efforts: [{ id: 'off', name: 'Off' }] } })
    await resolveReasoningCapabilities(ctxOf({ resolveModelInfo }), 'zhipu', 'glm-4.6')
    const raw = await readFile(join(home, 'dsh-prompt-enhance', 'reasoning-efforts.json'), 'utf8')
    const parsed = JSON.parse(raw) as { entries: Record<string, { efforts: Array<{ id: string }> }> }
    expect(parsed.entries['zhipu/glm-4.6']?.efforts[0]?.id).toBe('off')
  })

  it('answers from the static DeepSeek catalog when following a DeepSeek default', async () => {
    const capabilities = await resolveReasoningCapabilities(ctxOf({}, { provider: 'deepseek-official', model: 'deepseek-flash' }), undefined, undefined)
    expect(capabilities.source).toBe('default')
    expect(capabilities.efforts.map((effort) => effort.id)).toEqual(['off', 'low', 'high', 'max'])
  })

  it('refuses to guess when the followed default is not DeepSeek', async () => {
    const capabilities = await resolveReasoningCapabilities(ctxOf({}, { provider: 'zhipu', model: 'glm-4.6' }), undefined, undefined)
    expect(capabilities).toEqual({ efforts: [], source: 'unavailable', reason: 'default-not-deepseek' })
  })

  it('reports a missing default selection', async () => {
    const capabilities = await resolveReasoningCapabilities(ctxOf({}), undefined, undefined)
    expect(capabilities.reason).toBe('no-default-model')
  })

  it('reports no-efforts when the adapter declares none', async () => {
    const capabilities = await resolveReasoningCapabilities(ctxOf({ resolveModelInfo: async () => ({ reasoning: undefined }) }), 'p', 'm')
    expect(capabilities).toEqual({ efforts: [], source: 'unavailable', reason: 'no-efforts' })
  })

  it('maps a lookup timeout to the timeout reason', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    const capabilities = await resolveReasoningCapabilities(ctxOf({ resolveModelInfo: async () => { throw timeout } }), 'p', 'm')
    expect(capabilities).toEqual({ efforts: [], source: 'unavailable', reason: 'timeout' })
  })
})

describe('serveReasoningEfforts', () => {
  const trusted = { headers: {}, socket: { remoteAddress: '127.0.0.1' } }

  it('rejects a partial pair instead of describing a route that cannot be called', async () => {
    const res = fakeRes()
    await serveReasoningEfforts(
      ctxOf({}),
      { ...trusted, method: 'GET', url: '/dsh-prompt-enhance/reasoning-efforts?provider=zhipu' } as never,
      res as never,
    )
    expect(res.status).toBe(422)
  })

  it('rejects a non-GET method', async () => {
    const res = fakeRes()
    await serveReasoningEfforts(
      ctxOf({}),
      { ...trusted, method: 'POST', url: '/dsh-prompt-enhance/reasoning-efforts' } as never,
      res as never,
    )
    expect(res.status).toBe(405)
  })

  it('returns the capability envelope for a pinned pair', async () => {
    const res = fakeRes()
    const llm = { resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'low', name: 'Low' }] } }) }
    await serveReasoningEfforts(
      ctxOf(llm),
      { ...trusted, method: 'GET', url: '/dsh-prompt-enhance/reasoning-efforts?provider=zhipu&model=glm-4.6' } as never,
      res as never,
    )
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true, value: { efforts: [{ id: 'low', name: 'Low' }], source: 'resolved' } })
  })
})
