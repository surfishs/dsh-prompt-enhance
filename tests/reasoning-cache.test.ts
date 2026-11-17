/**
 * The reasoning cache: per-pair files, a 30-day TTL, and the in-process memo
 * that keeps the pre-call path off disk once a pair has been resolved.
 *
 * Each test points DSH_HOME at a fresh temp directory, so the shipped
 * `~/.dsh` cache is never touched.
 * @module tests/reasoning-cache
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { cacheFilePath, clearCachedCapabilities, readCachedCapabilities, writeCachedCapabilities } from '../src/reasoning-cache'

/** One day in milliseconds; the TTL boundary tests use literal day counts. */
const DAY_MS = 24 * 60 * 60 * 1000

const EFFORTS = [
  { id: 'off', name: 'Off' },
  { id: 'high', name: 'High' },
]

let home: string
let previousHome: string | undefined

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'dsh-pe-cache-'))
  previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

/** Remove the cache directory, leaving the memo as the only possible source. */
const dropCacheFile = (): Promise<void> => rm(join(home, 'dsh-prompt-enhance'), { recursive: true, force: true })

describe('reasoning cache memo', () => {
  it('answers from memory after the cache file is gone', async () => {
    const provider = 'memo-probe-a'
    const model = 'm1'
    await writeCachedCapabilities(provider, model, EFFORTS, 'high')
    await expect(readCachedCapabilities(provider, model)).resolves.toEqual({ efforts: EFFORTS, defaultEffort: 'high' })

    await dropCacheFile()
    // Disk is empty; only the memo can answer.
    await expect(readCachedCapabilities(provider, model)).resolves.toEqual({ efforts: EFFORTS, defaultEffort: 'high' })
  })

  it('memoizes the negative answer too', async () => {
    const provider = 'memo-probe-b'
    const model = 'm2'
    await writeCachedCapabilities(provider, model, [], undefined, true)
    await dropCacheFile()
    await expect(readCachedCapabilities(provider, model)).resolves.toEqual({ efforts: [], noEfforts: true })
  })

  it('drops the memo entry on a manual refresh', async () => {
    const provider = 'memo-probe-c'
    const model = 'm3'
    await writeCachedCapabilities(provider, model, EFFORTS)
    await clearCachedCapabilities(provider, model)
    await expect(readCachedCapabilities(provider, model)).resolves.toBeUndefined()
  })

  /** Write one raw entry file, bypassing the memo, to exercise the read path. */
  async function seedFile(provider: string, model: string, savedAt: number, extra: Record<string, unknown> = {}): Promise<string> {
    const path = cacheFilePath(provider, model)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify({ version: 1, provider, model, efforts: EFFORTS, savedAt, ...extra }), 'utf8')
    return path
  }

  it('reads a fresh per-pair file back from disk', async () => {
    const provider = 'memo-probe-d'
    const model = 'm4'
    await seedFile(provider, model, Date.now(), { defaultEffort: 'high' })
    await expect(readCachedCapabilities(provider, model)).resolves.toEqual({ efforts: EFFORTS, defaultEffort: 'high' })
  })

  it('treats an entry older than the TTL as absent and drops the file', async () => {
    // The stale-negative case this TTL exists for: the answer is gone, so the
    // next enhancement probes again instead of honouring an old verdict.
    //
    // The ages are literal day counts, deliberately NOT derived from
    // CACHE_TTL_MS: a test computed from the constant it verifies stays green
    // when someone changes the constant, which is the bug it must catch.
    const provider = 'memo-probe-e'
    const model = 'm5'
    const path = await seedFile(provider, model, Date.now() - 31 * DAY_MS)
    await expect(readCachedCapabilities(provider, model)).resolves.toBeUndefined()
    // Expired files are removed, so the next read does not pay for them again.
    await expect(readFile(path, 'utf8')).rejects.toThrow()
  })

  it('keeps an entry that is still inside the TTL', async () => {
    // The other side of the boundary: 29 days is usable, so the documented
    // 30-day promise cannot silently shrink.
    const provider = 'memo-probe-g'
    const model = 'm7'
    await seedFile(provider, model, Date.now() - 29 * DAY_MS, { defaultEffort: 'high' })
    await expect(readCachedCapabilities(provider, model)).resolves.toEqual({ efforts: EFFORTS, defaultEffort: 'high' })
  })

  it('ignores the legacy single-document cache instead of migrating it', async () => {
    // Per-pair files replaced one shared document. The old file is left alone:
    // it is only a cache, so the first enhancement pays one extra probe.
    const provider = 'memo-probe-f'
    const model = 'm6'
    const legacy = join(home, 'dsh-prompt-enhance', 'reasoning-efforts.json')
    await mkdir(dirname(legacy), { recursive: true })
    await writeFile(legacy, JSON.stringify({ version: 1, entries: { [`${provider}/${model}`]: { provider, model, efforts: EFFORTS, savedAt: Date.now() } } }), 'utf8')
    await expect(readCachedCapabilities(provider, model)).resolves.toBeUndefined()
  })
})
