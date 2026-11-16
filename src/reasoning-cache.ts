/**
 * Host-side persistent cache for reasoning-effort answers.
 *
 * The browser origin changes whenever the desktop app restarts on another port,
 * so a `localStorage` cache cannot be the durable tier memory the user asked
 * for. This cache lives in the DeepSeek Harness home directory instead, keyed
 * by provider/model, with no TTL: an entry is replaced only by a manual refresh
 * or by a different pair.
 * @module dsh-prompt-enhance/reasoning-cache
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ReasoningEffortInfo } from './shared/reasoning'

/** Cache document version; a mismatch is treated as an empty cache. */
const CACHE_VERSION = 1

/** One cached answer. */
interface CacheEntry {
  provider: string
  model: string
  efforts: ReasoningEffortInfo[]
  defaultEffort?: string
  /** True when the route declared no reasoning capability at all. */
  noEfforts?: boolean
  savedAt: number
}

/** The whole cache document. */
interface CacheDocument {
  version: number
  entries: Record<string, CacheEntry>
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

/** Absolute path of the cache document. */
export function cacheFilePath(): string {
  return join(harnessHome(), 'dsh-prompt-enhance', 'reasoning-efforts.json')
}

/** Stable key of one pair. */
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

/** Read the document, treating any unreadable/corrupt file as empty. */
async function readDocument(): Promise<CacheDocument> {
  try {
    const raw = await readFile(cacheFilePath(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { version: CACHE_VERSION, entries: {} }
    const record = parsed as { version?: unknown; entries?: unknown }
    if (record.version !== CACHE_VERSION || record.entries === null || typeof record.entries !== 'object') {
      return { version: CACHE_VERSION, entries: {} }
    }
    return { version: CACHE_VERSION, entries: record.entries as Record<string, CacheEntry> }
  } catch {
    return { version: CACHE_VERSION, entries: {} }
  }
}

/** Atomically replace the document (temp file in the same directory + rename). */
async function writeDocument(document: CacheDocument): Promise<void> {
  const path = cacheFilePath()
  try {
    await mkdir(dirname(path), { recursive: true })
    const temporary = `${path}.${process.pid}.tmp`
    await writeFile(temporary, JSON.stringify(document), 'utf8')
    await rename(temporary, path)
  } catch {
    // The cache is an optimization; a read-only home must not fail the route.
  }
}

/**
 * Read one cached answer.
 * @param provider - provider id.
 * @param model - model id.
 * @returns the cached efforts, or undefined when absent/malformed.
 */
export async function readCachedCapabilities(provider: string, model: string): Promise<CachedReasoningEfforts | undefined> {
  const document = await readDocument()
  const entry = document.entries[entryKey(provider, model)]
  if (entry === undefined || entry.provider !== provider || entry.model !== model) return undefined
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
}

/**
 * Persist one resolved answer.
 * @param provider - provider id.
 * @param model - model id.
 * @param efforts - the adapter-declared efforts.
 * @param defaultEffort - the adapter's default, when declared.
 */
export async function writeCachedCapabilities(provider: string, model: string, efforts: ReasoningEffortInfo[], defaultEffort?: string, noEfforts = false): Promise<void> {
  const document = await readDocument()
  document.entries[entryKey(provider, model)] = {
    provider,
    model,
    efforts,
    ...(defaultEffort === undefined ? {} : { defaultEffort }),
    ...(noEfforts ? { noEfforts: true } : {}),
    savedAt: Date.now(),
  }
  await writeDocument(document)
}

/**
 * Drop one cached answer (manual refresh after a failed lookup).
 * @param provider - provider id.
 * @param model - model id.
 */
export async function clearCachedCapabilities(provider: string, model: string): Promise<void> {
  const document = await readDocument()
  delete document.entries[entryKey(provider, model)]
  await writeDocument(document)
}
