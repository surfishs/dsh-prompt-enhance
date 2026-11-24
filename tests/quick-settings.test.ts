/**
 * The quick-settings model: which tier list wins, how an unknown stored value
 * is still shown, and what the writes look like.
 * @module tests/quick-settings
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCatalogCache } from '../src/client/llm-catalog'
import { fetchReasoningCapabilities } from '../src/client/reasoning-options'
import {
  clearQuickModelCache,
  loadQuickModelGroups,
  menuOptionsOf,
  rankModelGroups,
  resolveQuickSettings,
  writeQuickContext,
  writeQuickEffort,
  writeQuickMode,
  writeQuickRoute,
} from '../src/client/quick-settings'
import { DEFAULT_CLIENT_SETTINGS } from '../src/client/settings'
import type { SettingsWriter } from '../src/client/settings-writer'

vi.mock('../src/client/reasoning-options', () => ({
  fetchReasoningCapabilities: vi.fn(),
}))

beforeEach(() => {
  // Label lookups read the host catalog; keep them off the network so a slow or
  // filtered connection cannot stretch one case past its timeout.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 })),
  )
})

afterEach(() => {
  vi.mocked(fetchReasoningCapabilities).mockReset()
  vi.unstubAllGlobals()
  clearCatalogCache()
  clearQuickModelCache()
})

/** One session directory double with a fixed snapshot. */
function directoryOf(snapshot: unknown): unknown {
  return { store: { getSnapshot: () => snapshot } }
}

const baseSettings = { ...DEFAULT_CLIENT_SETTINGS, reasoningEffort: 'off', contextAware: true }

describe('resolveQuickSettings', () => {
  it('resolves the output shape, defaulting to prose', async () => {
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [{ id: 'low', name: 'Low' }], source: 'resolved' })
    const prose = await resolveQuickSettings({ settings: baseSettings })
    expect(prose.mode).toBe('prose')
    const structured = await resolveQuickSettings({ settings: { ...baseSettings, mode: 'structured' } })
    expect(structured.mode).toBe('structured')
  })

  it('prefers the explicit provider/model override', async () => {
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({
      efforts: [{ id: 'low', name: 'Low' }],
      source: 'resolved',
    })
    const data = await resolveQuickSettings({
      settings: { ...baseSettings, provider: 'zhipu', model: 'glm-5.3' },
    })
    expect(fetchReasoningCapabilities).toHaveBeenCalledWith('zhipu', 'glm-5.3')
    expect(data).toMatchObject({ source: 'override', effort: 'off', contextAware: true })
    expect(data.efforts.map((effort) => effort.id)).toEqual(['low'])
  })

  it('keeps a pinned route without tiers empty instead of borrowing the session tiers', async () => {
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [], source: 'unavailable', reason: 'no-efforts' })
    const ctx = {
      modelDirectories: {
        directoryFor: () =>
          directoryOf({
            current: { provider: 'qwen', model: 'qwen-3' },
            groups: [{ id: 'qwen', models: [{ id: 'qwen-3', reasoning: { efforts: [{ id: 'fast', name: 'Fast' }] } }] }],
          }),
      },
    }
    const data = await resolveQuickSettings({
      ctx,
      sessionId: 's1',
      settings: { ...baseSettings, provider: 'zhipu', model: 'glm-5.3' },
    })
    // The pinned route owns the list: no fallback to the session or DeepSeek tiers.
    expect(data).toMatchObject({ source: 'override', efforts: [], effortReason: 'no-efforts' })
  })

  it('marks a failed pinned lookup with its reason instead of the DeepSeek catalog', async () => {
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [], source: 'unavailable', reason: 'resolve-failed' })
    const data = await resolveQuickSettings({ settings: { ...baseSettings, provider: 'zhipu', model: 'glm-5.3' } })
    expect(data.efforts).toEqual([])
    expect(data.effortReason).toBe('resolve-failed')
  })

  it('keeps a non-DeepSeek route with no declared tiers empty instead of guessing', async () => {
    const ctx = {
      modelDirectories: {
        directoryFor: () => directoryOf({ current: { provider: 'qwen', model: 'qwen-3' }, groups: [] }),
      },
    }
    const data = await resolveQuickSettings({ ctx, sessionId: 's1', settings: baseSettings })
    expect(data.source).toBe('session')
    expect(data.efforts).toEqual([])
    expect(data.effortReason).toBe('no-efforts')
  })

  it('falls back to the static DeepSeek catalog when nothing else answers', async () => {
    const data = await resolveQuickSettings({ settings: baseSettings })
    expect(data.source).toBe('static')
    expect(data.efforts.map((effort) => effort.id)).toContain('off')
  })

  it('survives a directory that throws', async () => {
    const ctx = {
      modelDirectories: {
        directoryFor: () => {
          throw new Error('service gone')
        },
      },
    }
    const data = await resolveQuickSettings({ ctx, sessionId: 's1', settings: baseSettings })
    expect(data.source).toBe('static')
  })

  it('treats a blank stored effort as the shipped default', async () => {
    const data = await resolveQuickSettings({ settings: { ...baseSettings, reasoningEffort: '' } })
    expect(data.effort).toBe('off')
  })
})

describe('route labels', () => {
  const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

  it('uses the host catalog names for a pinned route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input)
        if (href.includes('llm-providers')) return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        return json({ ok: false })
      }),
    )
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [], source: 'unavailable' })
    const data = await resolveQuickSettings({ settings: { ...baseSettings, provider: 'zhipu', model: 'glm-4.6' } })
    expect(data.providerLabel).toBe('Zhipu')
    expect(data.modelLabel).toBe('GLM-4.6')
  })

  it('falls back to the raw ids when the catalog read fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [], source: 'unavailable' })
    const data = await resolveQuickSettings({ settings: { ...baseSettings, provider: 'zhipu', model: 'glm-4.6' } })
    expect(data.providerLabel).toBe('zhipu')
    expect(data.modelLabel).toBe('glm-4.6')
  })

  it('keeps the labels empty when the plugin follows the session', async () => {
    const data = await resolveQuickSettings({ settings: baseSettings })
    expect({ provider: data.providerLabel, model: data.modelLabel }).toEqual({ provider: '', model: '' })
  })
})

describe('menuOptionsOf', () => {
  it('appends a stored tier the route does not advertise', () => {
    const options = menuOptionsOf({
      efforts: [{ id: 'low', name: 'Low' }],
      effort: 'high',
      contextAware: true,
      mode: 'prose',
      modelGroups: [],
      modelGroupsState: 'idle',
      provider: '',
      model: '',
      providerLabel: '',
      modelLabel: '',
      source: 'session',
    })
    expect(options.map((option) => option.id)).toEqual(['low', 'high'])
  })

  it('does not duplicate a tier the route already lists', () => {
    const options = menuOptionsOf({
      efforts: [{ id: 'low', name: 'Low' }],
      effort: 'low',
      contextAware: true,
      mode: 'prose',
      modelGroups: [],
      modelGroupsState: 'idle',
      provider: '',
      model: '',
      providerLabel: '',
      modelLabel: '',
      source: 'session',
    })
    expect(options.map((option) => option.id)).toEqual(['low'])
  })

  it('names a stored tier the route does not advertise with the shipped catalog name', () => {
    const options = menuOptionsOf({
      efforts: [],
      effort: 'off',
      contextAware: true,
      mode: 'prose',
      modelGroups: [],
      modelGroupsState: 'idle',
      provider: '',
      model: '',
      providerLabel: '',
      modelLabel: '',
      source: 'session',
    })
    expect(options).toEqual([{ id: 'off', name: 'Off' }])
  })

  it('leaves inherit out of the radio list body', () => {
    const options = menuOptionsOf({
      efforts: [],
      effort: 'inherit',
      contextAware: true,
      mode: 'prose',
      modelGroups: [],
      modelGroupsState: 'idle',
      provider: '',
      model: '',
      providerLabel: '',
      modelLabel: '',
      source: 'session',
    })
    expect(options).toEqual([])
  })
})

describe('writes', () => {
  const writerOf = (result: boolean): SettingsWriter => ({ set: vi.fn(async () => result), unset: vi.fn(async () => result) })

  it('writes the effort and the context switch through the writer', async () => {
    const writer = writerOf(true)
    await expect(writeQuickEffort(writer, 'low')).resolves.toBe(true)
    await expect(writeQuickContext(writer, false)).resolves.toBe(true)
    expect(writer.set).toHaveBeenNthCalledWith(1, 'reasoningEffort', 'low')
    expect(writer.set).toHaveBeenNthCalledWith(2, 'contextAware', false)
  })

  it('writes the output shape through the writer', async () => {
    const writer = writerOf(true)
    await expect(writeQuickMode(writer, 'structured')).resolves.toBe(true)
    expect(writer.set).toHaveBeenCalledWith('mode', 'structured')
  })

  it('reports a refused write as false', async () => {
    const writer = writerOf(false)
    await expect(writeQuickEffort(writer, 'low')).resolves.toBe(false)
  })

  it('reports a throwing writer as false instead of propagating', async () => {
    const writer: SettingsWriter = {
      set: vi.fn(async () => {
        throw new Error('host refused')
      }),
      unset: vi.fn(async () => true),
    }
    await expect(writeQuickContext(writer, true)).resolves.toBe(false)
  })

  it('writes a route by clearing the model first, then provider and model', async () => {
    const calls: string[] = []
    const writer: SettingsWriter = {
      set: vi.fn(async (field: string, value: unknown) => {
        calls.push(`set:${field}=${String(value)}`)
        return true
      }),
      unset: vi.fn(async (field: string) => {
        calls.push(`unset:${field}`)
        return true
      }),
    }
    await expect(writeQuickRoute(writer, { provider: 'zhipu', model: 'glm-4.6' })).resolves.toBe(true)
    // The model is cleared first so a mismatched pair is never observable.
    expect(calls).toEqual(['unset:model', 'set:provider=zhipu', 'set:model=glm-4.6'])
  })

  it('clears both fields back to follow-session', async () => {
    const calls: string[] = []
    const writer: SettingsWriter = {
      set: vi.fn(async () => true),
      unset: vi.fn(async (field: string) => {
        calls.push(`unset:${field}`)
        return true
      }),
    }
    await expect(writeQuickRoute(writer, null)).resolves.toBe(true)
    expect(calls).toEqual(['unset:model', 'unset:provider'])
  })
})

describe('model groups', () => {
  const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

  it('lists only registered providers, account first, and never queries a dormant one', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input)
      if (href.includes('/llm-providers')) {
        return json({
          ok: true,
          value: {
            providers: [
              { id: 'zhipu', name: 'Zhipu', registered: true },
              { id: 'deepseek-account', name: 'DeepSeek', registered: true },
              { id: 'dormant', name: 'Dormant', registered: false },
            ],
          },
        })
      }
      if (href.includes('provider=zhipu')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
      if (href.includes('provider=deepseek-account')) return json({ ok: true, value: { models: [{ id: 'deepseek-v4', name: 'DeepSeek-V4' }] } })
      return json({ ok: false })
    })
    vi.stubGlobal('fetch', fetchMock)
    const groups = await loadQuickModelGroups()
    expect(groups?.map((group) => group.id)).toEqual(['deepseek-account', 'zhipu'])
    expect(groups?.[0]?.models).toEqual([{ id: 'deepseek-v4', name: 'DeepSeek-V4' }])
    const requested = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(requested.some((url) => url.includes('provider=dormant'))).toBe(false)
  })

  it('ranks prefix matches first and keeps a subsequence match', () => {
    const groups = [
      {
        id: 'p',
        name: 'P',
        models: [
          { id: '1', name: 'DeepSeek-V4-Pro' },
          { id: '2', name: 'DeepSeek-V4.1-Flash' },
          { id: '3', name: 'Qwen3.8' },
        ],
      },
    ]
    expect(rankModelGroups(groups, 'flash')[0]?.models.map((model) => model.id)).toEqual(['2'])
    expect(rankModelGroups(groups, 'deep')[0]?.models.map((model) => model.id)).toEqual(['1', '2'])
    // An order-preserving subsequence still matches; an out-of-order one does not.
    expect(rankModelGroups(groups, 'dv4')[0]?.models.map((model) => model.id)).toEqual(['1', '2'])
    expect(rankModelGroups(groups, 'v4d')).toEqual([])
    expect(rankModelGroups(groups, 'zzz')).toEqual([])
  })
})
