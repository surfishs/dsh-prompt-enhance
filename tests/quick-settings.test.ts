/**
 * The quick-settings model: which tier list wins, how an unknown stored value
 * is still shown, and what the writes look like.
 * @module tests/quick-settings
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchReasoningCapabilities } from '../src/client/reasoning-options'
import { menuOptionsOf, resolveQuickSettings, writeQuickContext, writeQuickEffort } from '../src/client/quick-settings'
import { DEFAULT_CLIENT_SETTINGS } from '../src/client/settings'
import type { SettingsWriter } from '../src/client/settings-writer'

vi.mock('../src/client/reasoning-options', () => ({
  fetchReasoningCapabilities: vi.fn(),
}))

afterEach(() => {
  vi.mocked(fetchReasoningCapabilities).mockReset()
})

/** One session directory double with a fixed snapshot. */
function directoryOf(snapshot: unknown): unknown {
  return { store: { getSnapshot: () => snapshot } }
}

const baseSettings = { ...DEFAULT_CLIENT_SETTINGS, reasoningEffort: 'off', contextAware: true }

describe('resolveQuickSettings', () => {
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

  it('falls through to the session directory when the override has no tiers', async () => {
    vi.mocked(fetchReasoningCapabilities).mockResolvedValue({ efforts: [], source: 'unavailable' })
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
    expect(data).toMatchObject({ source: 'session' })
    expect(data.efforts.map((effort) => effort.id)).toEqual(['fast'])
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

describe('menuOptionsOf', () => {
  it('appends a stored tier the route does not advertise', () => {
    const options = menuOptionsOf({ efforts: [{ id: 'low', name: 'Low' }], effort: 'high', contextAware: true, source: 'session' })
    expect(options.map((option) => option.id)).toEqual(['low', 'high'])
  })

  it('does not duplicate a tier the route already lists', () => {
    const options = menuOptionsOf({ efforts: [{ id: 'low', name: 'Low' }], effort: 'low', contextAware: true, source: 'session' })
    expect(options.map((option) => option.id)).toEqual(['low'])
  })

  it('names a stored tier the route does not advertise with the shipped catalog name', () => {
    const options = menuOptionsOf({ efforts: [], effort: 'off', contextAware: true, source: 'session' })
    expect(options).toEqual([{ id: 'off', name: 'Off' }])
  })

  it('leaves inherit out of the radio list body', () => {
    const options = menuOptionsOf({ efforts: [], effort: 'inherit', contextAware: true, source: 'session' })
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
})
