/**
 * The per-call effort decision: a route that declares no reasoning receives no
 * field at all (the settings page presents that as follow-provider-default),
 * while a route with declared tiers keeps the configured value so unsupported
 * explicit tiers still surface as errors.
 * @module tests/effective-effort
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectiveReasoningEffort } from '../src/orchestrate'
import { readCachedCapabilities, writeCachedCapabilities } from '../src/reasoning-cache'

let home = ''
const previousHome = process.env.DSH_HOME

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'dpe-effort-'))
  process.env.DSH_HOME = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

describe('effectiveReasoningEffort', () => {
  it('omits the effort when the route declares no reasoning', async () => {
    const resolveModelInfo = vi.fn(async () => ({ reasoning: undefined }))
    expect(await effectiveReasoningEffort({ resolveModelInfo }, 'qwen', 'qwen3.8-flash', 'off')).toBe('inherit')
    // The negative answer is cached; a second call must not resolve again.
    await expect(readCachedCapabilities('qwen', 'qwen3.8-flash')).resolves.toEqual({ efforts: [], noEfforts: true })
    await effectiveReasoningEffort({ resolveModelInfo }, 'qwen', 'qwen3.8-flash', 'off')
    expect(resolveModelInfo).toHaveBeenCalledTimes(1)
  })

  it('uses the cached negative answer without a lookup', async () => {
    await writeCachedCapabilities('qwen', 'qwen3.8-flash', [], undefined, true)
    const resolveModelInfo = vi.fn(async () => ({ reasoning: undefined }))
    expect(await effectiveReasoningEffort({ resolveModelInfo }, 'qwen', 'qwen3.8-flash', 'max')).toBe('inherit')
    expect(resolveModelInfo).not.toHaveBeenCalled()
  })

  it('keeps an explicit tier when the route declares tiers', async () => {
    const resolveModelInfo = vi.fn(async () => ({
      reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }], defaultEffort: 'high' },
    }))
    expect(await effectiveReasoningEffort({ resolveModelInfo }, 'deepseek-official', 'deepseek-flash', 'high')).toBe('high')
    const cached = await readCachedCapabilities('deepseek-official', 'deepseek-flash')
    expect(cached?.noEfforts).toBeUndefined()
    expect(cached?.efforts.map((effort) => effort.id)).toEqual(['off', 'high'])
  })

  it('leaves the configured effort alone when resolution fails', async () => {
    const resolveModelInfo = vi.fn(async () => { throw new Error('boom') })
    expect(await effectiveReasoningEffort({ resolveModelInfo }, 'p', 'm', 'low')).toBe('low')
  })

  it('leaves the configured effort alone without a resolver', async () => {
    expect(await effectiveReasoningEffort({}, 'p', 'm', 'low')).toBe('low')
  })
})
