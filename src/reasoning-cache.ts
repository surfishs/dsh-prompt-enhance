/**
 * Host-side persistent cache for reasoning-effort answers.
 *
 * The browser origin changes whenever the desktop app restarts on another port,
 * so a `localStorage` cache cannot be the durable tier memory the user asked
 * for. This cache lives in the DeepSeek Harness home directory instead, with one
 * file per provider/model pair.
 *
 * One file per pair, not one shared document: the old layout rewrote the whole
 * document on every write, so two processes writing DIFFERENT pairs raced on
 * that document and the later write silently dropped the earlier pair. Per-pair
 * files remove that cross-key race; the only contention left is two processes
 * writing the SAME pair, which carries the same answer.
 *
 * Entries expire after {@link CACHE_TTL_MS}: a model's declared tiers change
 * when the adapter does, and a stale negative answer ("declares no tiers") would
 * otherwise keep suppressing the user's configured effort forever, with no error
 * to point at it. The previous single-document file
 * (`reasoning-efforts.json`) is ignored rather than migrated — it is only a
 * cache, so the first enhancement after the upgrade pays one extra probe.
 * @module dsh-prompt-enhance/reasoning-cache
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ReasoningEffortInfo } from './shared/reasoning'

/** On-disk format version of one cache file; a mismatch is treated as absent. */
const CACHE_VERSION = 1

/**
 * How long one answer stays usable.
 *
 * Tier metadata is model capability data, so it changes only when the adapter
 * changes — slowly, hence a generous window. Without an expiry, the negative
 * answer ("this route declares no tiers") would keep overriding the user's
 * configured effort even after the model gained tiers.
 */
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** One cached answer as stored on disk. */
interface CacheEntry {
  version: number
  provider: string
  model: string
  efforts: ReasoningEffortInfo[]
  defaultEffort?: string
  /** True when the route declared no reasoning capability at all. */
  noEfforts?: boolean
  savedAt: number
}

/** One cached answer without the bookkeeping fields. */
export interface CachedReasoningEfforts {
  efforts: ReasoningEffortInfo[]
  defaultEffort?: string
  /** The route declares no reasoning at all; callers should omit the effort. */
  noEfforts?: boolean
}

/** The DeepSeek Harness home: `DSH_HOME` when set, else `~/.dsh`. */
function harnessHome(): string {
  const configured = (process.env.DSH_HOME ?? '').trim()
  return configured === '' ? join(homedir(), '.dsh') : configured
}

/** Directory holding one file per provider/model pair. */
export function cacheDirectory(): string {
  return join(harnessHome(), 'dsh-prompt-enhance', 'reasoning-efforts')
}

/**
 * Absolute path of one pair's cache file.
 *
 * Both halves are percent-encoded and kept as separate path segments: provider
 * and model ids routinely carry `/`, `:` and spaces (e.g. `anthropic/claude-3`),
 * which are illegal in a Windows file name.
 * @param provider - provider id.
 * @param model - model id.
 * @returns the file path.
 */
export function cacheFilePath(provider: string, model: string): string {
  return join(cacheDirectory(), encodeURIComponent(provider), `${encodeURIComponent(model)}.json`)
}

/** Stable key of one pair (memo key and log identity). */
function entryKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Narrow one stored effort; anything malformed invalidates the entry. */
function effortOf(value: unknown): ReasoningEffortInfo | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as { id?: unknown; name?: unknown; description?: unknown }
  if (typeof record.id !== 'string' || record.id === '' || typeof record.name !== 'string' || record.name === '') return undefined
  return {
    id: record.id,
    name: record.name,
    ...(typeof record.description === 'string' && record.description !== '' ? { description: record.description } : {}),
  }
}

/**
 * In-process memo of resolved answers, one per provider/model pair.
 *
 * `effectiveReasoningEffort` runs on every enhancement, on the critical path
 * before the model call, and used to read + parse a cache file each time. The
 * cache only changes through this module, so once a process has seen an answer it
 * can serve from memory; a write primes the memo and a manual refresh drops it.
 * A miss is deliberately NOT memoized: an entry written by another process would
 * otherwise stay invisible for this process's lifetime.
 */
const memo = new Map<string, CachedReasoningEfforts>()

/**
 * Harness home the memo's answers belong to. A different home means different
 * cache files, so the memo must start empty instead of answering for a
 * deployment it never read. (Tests point DSH_HOME at a fresh directory per case;
 * this is what keeps them from seeing each other's answers.)
 */
let memoHome: string | undefined

/**
 * The memo for the CURRENT cache directory, dropped when the home moves.
 * @returns the live memo map.
 */
function memoFor(): Map<string, CachedReasoningEfforts> {
  const home = harnessHome()
  if (memoHome !== home) {
    memo.clear()
    memoHome = home
  }
  return memo
}

/**
 * Drop one expired file without letting the cleanup decide the read's outcome.
 * @param path - the file to remove.
 */
async function dropExpired(path: string): Promise<void> {
  try {
    await rm(path, { force: true })
  } catch {
    // A cache directory we cannot write is not a reason to fail the read.
  }
}

/**
 * Read one pair's file, honouring the TTL and the on-disk version.
 * @param provider - provider id.
 * @param model - model id.
 * @returns the cached efforts, or undefined when absent/expired/malformed.
 */
async function readEntryFile(provider: string, model: string): Promise<CachedReasoningEfforts | undefined> {
  const path = cacheFilePath(provider, model)
  try {
    const entry = JSON.parse(await readFile(path, 'utf8')) as Partial<CacheEntry> | null
    if (entry === null || typeof entry !== 'object') return undefined
    if (entry.version !== CACHE_VERSION || entry.provider !== provider || entry.model !== model) return undefined
    if (typeof entry.savedAt !== 'number' || Date.now() - entry.savedAt > CACHE_TTL_MS) {
      // Expired (or undated): answer as absent and drop the file so the next
      // read does not pay for it again.
      await dropExpired(path)
      return undefined
    }
    // A negative answer is cached too: routes that declare no reasoning would
    // otherwise pay a capability lookup on every enhancement call.
    if (entry.noEfforts === true) return { efforts: [], noEfforts: true }
    if (!Array.isArray(entry.efforts) || entry.efforts.length === 0) return undefined
    const efforts = entry.efforts.map(effortOf).filter((effort): effort is ReasoningEffortInfo => effort !== undefined)
    if (efforts.length !== entry.efforts.length) return undefined
    return {
      efforts,
      ...(typeof entry.defaultEffort === 'string' && entry.defaultEffort !== '' ? { defaultEffort: entry.defaultEffort } : {}),
    }
  } catch {
    return undefined
  }
}

/**
 * Read one cached answer, from the in-process memo when this process already
 * resolved it, from its own file otherwise.
 * @param provider - provider id.
 * @param model - model id.
 * @returns the cached efforts, or undefined when absent/expired/malformed.
 */
export async function readCachedCapabilities(provider: string, model: string): Promise<CachedReasoningEfforts | undefined> {
  const known = memoFor().get(entryKey(provider, model))
  if (known !== undefined) return known
  const answer = await readEntryFile(provider, model)
  if (answer !== undefined) memoFor().set(entryKey(provider, model), answer)
  return answer
}

/**
 * Persist one resolved answer, one file per pair.
 * @param provider - provider id.
 * @param model - model id.
 * @param efforts - the adapter-declared efforts.
 * @param defaultEffort - the adapter's default, when declared.
 * @param noEfforts - true when the route declares no reasoning at all.
 */
export async function writeCachedCapabilities(provider: string, model: string, efforts: ReasoningEffortInfo[], defaultEffort?: string, noEfforts = false): Promise<void> {
  const path = cacheFilePath(provider, model)
  try {
    await mkdir(dirname(path), { recursive: true })
    const entry: CacheEntry = {
      version: CACHE_VERSION,
      provider,
      model,
      efforts,
      ...(defaultEffort === undefined ? {} : { defaultEffort }),
      ...(noEfforts ? { noEfforts: true } : {}),
      savedAt: Date.now(),
    }
    // Temp file in the same directory + rename: a reader never sees a partial
    // write, and two writers of the same pair cannot interleave their bytes.
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(entry), 'utf8')
    await rename(temporary, path)
  } catch {
    // The cache is an optimization; a read-only home must not fail the route.
  }
  // Prime the memo with exactly what a read would return, so the next
  // enhancement answers from memory instead of re-reading the file.
  memoFor().set(entryKey(provider, model), noEfforts ? { efforts: [], noEfforts: true } : { efforts, ...(defaultEffort === undefined ? {} : { defaultEffort }) })
}

/**
 * Drop one cached answer (manual refresh after a failed lookup).
 * @param provider - provider id.
 * @param model - model id.
 */
export async function clearCachedCapabilities(provider: string, model: string): Promise<void> {
  try {
    await rm(cacheFilePath(provider, model), { force: true })
  } catch {
    // Nothing to clear.
  }
  memoFor().delete(entryKey(provider, model))
}
