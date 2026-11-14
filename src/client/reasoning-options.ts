/**
 * Browser-side reasoning-effort lookup.
 *
 * The durable cache belongs to the host (a JSON file under the Harness home),
 * because the browser origin — and therefore `localStorage` — changes whenever
 * the desktop app restarts on another port. The client therefore asks the
 * read-only route every time the settings page mounts; a cache hit is a fast
 * disk read on the host and is never re-resolved. `refresh` bypasses that cache.
 * @module dsh-prompt-enhance/client/reasoning-options
 */

import { REASONING_EFFORTS_ENDPOINT, type ReasoningCapabilities, type ReasoningEffortInfo } from '../shared/reasoning'

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
 * @param options - `refresh` bypasses the host cache; `signal` cancels.
 * @returns the validated answer; transport failures surface as `unavailable`.
 */
export async function fetchReasoningCapabilities(
  provider: string | undefined,
  model: string | undefined,
  options: { refresh?: boolean; signal?: AbortSignal } = {},
): Promise<ReasoningCapabilities> {
  const url = new URL(REASONING_EFFORTS_ENDPOINT, globalThis.location?.origin ?? 'http://127.0.0.1')
  if (provider !== undefined && model !== undefined) {
    url.searchParams.set('provider', provider)
    url.searchParams.set('model', model)
  }
  if (options.refresh === true) url.searchParams.set('refresh', '1')
  try {
    const response = await fetch(url, { signal: options.signal, headers: { accept: 'application/json' } })
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
