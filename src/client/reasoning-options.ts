/**
 * Browser-side reasoning-effort capabilities: fetch once per provider/model,
 * then persist the answer in `localStorage` so reopening the settings page does
 * not ask again.
 *
 * The freshness policy is deliberately NOT time based: the user asked for the
 * options to change only when the pinned pair changes or the user presses
 * refresh. A pair keyed cache therefore has no TTL; a cache entry is replaced
 * only by an explicit refresh or by a different pair.
 * @module dsh-prompt-enhance/client/reasoning-options
 */

import { REASONING_EFFORTS_ENDPOINT, type ReasoningCapabilities, type ReasoningEffortInfo } from '../shared/reasoning'

/** Cache namespace; bumping the suffix invalidates every stored answer. */
const CACHE_KEY = 'dsh-prompt-enhance:reasoning-efforts:v1'

/** One cached capability answer for one provider/model pair. */
interface CacheEntry {
  provider: string
  model: string
  capabilities: ReasoningCapabilities
  savedAt: number
}

/** The whole cache document (pair → answer). */
type CacheDocument = Record<string, CacheEntry>

/** Stable key of one pair. */
function pairKey(provider: string, model: string): string {
  return `${provider}/${model}`
}

/** Read the cache document, tolerating absent/corrupt storage. */
function readDocument(): CacheDocument {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY)
    if (typeof raw !== 'string' || raw === '') return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? parsed as CacheDocument : {}
  } catch {
    return {}
  }
}

/** Write the cache document, ignoring quota/disabled-storage failures. */
function writeDocument(document: CacheDocument): void {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(document))
  } catch {
    // Storage is a convenience, never a requirement.
  }
}

/** Read the cached answer for one pair. */
export function readCachedCapabilities(provider: string, model: string): ReasoningCapabilities | undefined {
  const entry = readDocument()[pairKey(provider, model)]
  return entry !== undefined && entry.capabilities !== undefined ? entry.capabilities : undefined
}

/** Persist one resolved answer; only resolved lists are cached. */
export function writeCachedCapabilities(provider: string, model: string, capabilities: ReasoningCapabilities): void {
  if (capabilities.source !== 'resolved') return
  const document = readDocument()
  document[pairKey(provider, model)] = { provider, model, capabilities, savedAt: Date.now() }
  writeDocument(document)
}

/** Drop the cached answer for one pair (manual refresh). */
export function clearCachedCapabilities(provider: string, model: string): void {
  const document = readDocument()
  delete document[pairKey(provider, model)]
  writeDocument(document)
}

/** Narrow one effort from the wire. */
function effortOf(value: unknown): ReasoningEffortInfo | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const record = value as { id?: unknown; name?: unknown; description?: unknown }
  if (typeof record.id !== 'string' || record.id === '' || typeof record.name !== 'string' || record.name === '') return undefined
  return {
    id: record.id,
    name: record.name,
    ...typeof record.description === 'string' && record.description !== '' ? { description: record.description } : {},
  }
}

/** Narrow one wire answer; malformed payloads become `unavailable`. */
function capabilitiesOf(value: unknown): ReasoningCapabilities {
  if (value === null || typeof value !== 'object') return { efforts: [], source: 'unavailable', reason: 'resolve-failed' }
  const record = value as { efforts?: unknown; defaultEffort?: unknown; source?: unknown; reason?: unknown }
  const source = record.source === 'resolved' || record.source === 'default' || record.source === 'unavailable'
    ? record.source
    : 'unavailable'
  const efforts = Array.isArray(record.efforts)
    ? record.efforts.map(effortOf).filter((effort): effort is ReasoningEffortInfo => effort !== undefined)
    : []
  const reason = typeof record.reason === 'string' ? record.reason as ReasoningCapabilities['reason'] : undefined
  if (source !== 'unavailable' && efforts.length === 0) return { efforts: [], source: 'unavailable', reason: 'no-efforts' }
  return {
    efforts,
    source,
    ...typeof record.defaultEffort === 'string' && record.defaultEffort !== '' ? { defaultEffort: record.defaultEffort } : {},
    ...reason === undefined ? {} : { reason },
  }
}

/**
 * Ask the host for one route's declared efforts.
 * @param provider - pinned provider, or undefined to follow the default model.
 * @param model - pinned model, or undefined to follow the default model.
 * @param signal - aborts an in-flight lookup when the pair changes.
 * @returns the validated answer; transport failures surface as `unavailable`.
 */
export async function fetchReasoningCapabilities(provider: string | undefined, model: string | undefined, signal?: AbortSignal): Promise<ReasoningCapabilities> {
  const url = new URL(REASONING_EFFORTS_ENDPOINT, globalThis.location?.origin ?? 'http://127.0.0.1')
  if (provider !== undefined && model !== undefined) {
    url.searchParams.set('provider', provider)
    url.searchParams.set('model', model)
  }
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return { efforts: [], source: 'unavailable', reason: 'resolve-failed' }
    const body: unknown = await response.json()
    const envelope = body as { ok?: unknown; value?: unknown } | null
    if (envelope === null || envelope === undefined || envelope.ok !== true) {
      return { efforts: [], source: 'unavailable', reason: 'resolve-failed' }
    }
    return capabilitiesOf(envelope.value)
  } catch {
    return { efforts: [], source: 'unavailable', reason: 'resolve-failed' }
  }
}

/**
 * Load one pair's capabilities, using the persistent cache unless forced.
 *
 * A pinned pair is cached; the default-model path is never cached because its
 * answer depends on a selection the settings page cannot observe.
 * @param provider - pinned provider, or undefined.
 * @param model - pinned model, or undefined.
 * @param options - `force` bypasses and replaces the cache; `signal` cancels.
 * @returns the capability answer.
 */
export async function loadReasoningCapabilities(
  provider: string | undefined,
  model: string | undefined,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<ReasoningCapabilities> {
  const pinned = provider !== undefined && model !== undefined
  if (pinned && options.force !== true) {
    const cached = readCachedCapabilities(provider, model)
    if (cached !== undefined) return cached
  }
  const answer = await fetchReasoningCapabilities(provider, model, options.signal)
  if (pinned) {
    if (answer.source === 'resolved') writeCachedCapabilities(provider, model, answer)
    else clearCachedCapabilities(provider, model)
  }
  return answer
}
