/**
 * Browser-side LLM catalog reads behind the provider/model selects, plus the
 * warning-only route check.
 *
 * These endpoints return only registry metadata (provider/model ids and names),
 * never credentials. The route check is advisory: the save is not blocked when
 * it fails, because the page may describe a provider being configured in
 * another window.
 * @module dsh-prompt-enhance/client/llm-catalog
 */

import { useEffect, useState } from 'react'
import {
  LLM_MODELS_ENDPOINT,
  LLM_PROVIDERS_ENDPOINT,
  LLM_ROUTE_CHECK_ENDPOINT,
  type ModelCatalog,
  type ModelCatalogEntry,
  type ProviderCatalog,
  type ProviderCatalogEntry,
  type RouteCheck,
} from '../shared/catalog'

/** Why a catalog read failed, with the trust refusals kept distinct. */
export type CatalogFailure = 'loopback-only' | 'unauthorized' | 'forbidden' | 'offline' | 'other'

/** One catalog read: the value, or the reason the settings page should show. */
type CatalogResult<T> = { ok: true; value: T } | { ok: false; failure: CatalogFailure }

/** Stable error code from a plugin error envelope, when the body carries one. */
async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json()
    if (body === null || typeof body !== 'object') return undefined
    const error = (body as { error?: unknown }).error
    if (error === null || typeof error !== 'object') return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  } catch {
    return undefined
  }
}

/** Classify one failed read; the body code wins when it names a trust refusal. */
function failureOf(status: number, code: string | undefined): CatalogFailure {
  if (code === 'loopback-only' || code === 'unauthorized' || code === 'forbidden') return code
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  return 'other'
}

/** Fetch one JSON envelope, keeping status and error code instead of collapsing them. */
async function getJson<T>(url: URL, signal?: AbortSignal): Promise<CatalogResult<T>> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return { ok: false, failure: failureOf(response.status, await errorCodeOf(response)) }
    const body: unknown = await response.json()
    const envelope = body as { ok?: unknown; value?: unknown } | null
    if (envelope === null || envelope === undefined || envelope.ok !== true) return { ok: false, failure: 'other' }
    return { ok: true, value: envelope.value as T }
  } catch {
    return { ok: false, failure: 'offline' }
  }
}

/**
 * How long one catalog answer stays usable. Provider/model names change only
 * when the host registry does, so a short window is enough to make repeated
 * card opens and page mounts free without showing stale names for long.
 */
export const CATALOG_TTL_MS = 60_000

/** One memoized answer. */
interface Memo<T> {
  value: T
  at: number
}

let providersMemo: Memo<ProviderCatalogEntry[]> | undefined
const modelsMemo = new Map<string, Memo<ModelCatalog>>()

/**
 * Drop every memoized catalog answer. The settings reload controls bypass the
 * cache per call; tests and deployments that swap the registry call this.
 */
export function clearCatalogCache(): void {
  providersMemo = undefined
  modelsMemo.clear()
}

/** Resolve one endpoint against the current page origin. */
function endpoint(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(path, globalThis.location?.origin ?? 'http://127.0.0.1')
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  return url
}

/**
 * Registered + dormant providers, with the failure reason preserved for the
 * settings page. The wrapper below keeps the quick card's value|undefined
 * contract; only the settings row needs the cause.
 * @param signal - cancels the request.
 * @param options - `refresh` bypasses the short-lived memo.
 * @returns the entries or a {@link CatalogFailure}.
 */
async function readProviders(signal?: AbortSignal, options: { refresh?: boolean } = {}): Promise<CatalogResult<ProviderCatalogEntry[]>> {
  const cached = providersMemo
  if (options.refresh !== true && cached !== undefined && Date.now() - cached.at <= CATALOG_TTL_MS) return { ok: true, value: cached.value }
  const answer = await getJson<ProviderCatalog>(endpoint(LLM_PROVIDERS_ENDPOINT), signal)
  if (!answer.ok) return answer
  if (!Array.isArray(answer.value.providers)) return { ok: false, failure: 'other' }
  const providers = answer.value.providers.filter(
    (entry): entry is ProviderCatalogEntry =>
      entry !== null && typeof entry === 'object' && typeof entry.id === 'string' && entry.id !== '' && typeof entry.name === 'string' && entry.name !== '' && typeof entry.registered === 'boolean',
  )
  providersMemo = { value: providers, at: Date.now() }
  return { ok: true, value: providers }
}

/**
 * Registered + dormant providers, or undefined when the read failed.
 * @param signal - cancels the request.
 * @param options - `refresh` bypasses the short-lived memo.
 * @returns the provider entries, or undefined on failure (failures are not cached).
 */
export async function fetchProviders(signal?: AbortSignal, options: { refresh?: boolean } = {}): Promise<ProviderCatalogEntry[] | undefined> {
  const answer = await readProviders(signal, options)
  return answer.ok ? answer.value : undefined
}

async function readModels(provider: string, signal?: AbortSignal, options: { refresh?: boolean } = {}): Promise<CatalogResult<ModelCatalog>> {
  const cached = modelsMemo.get(provider)
  if (options.refresh !== true && cached !== undefined && Date.now() - cached.at <= CATALOG_TTL_MS) return { ok: true, value: cached.value }
  const answer = await getJson<ModelCatalog>(endpoint(LLM_MODELS_ENDPOINT, { provider }), signal)
  if (!answer.ok) return answer
  if (!Array.isArray(answer.value.models)) return { ok: false, failure: 'other' }
  const models = answer.value.models
    .filter(
      (entry): entry is ModelCatalogEntry => entry !== null && typeof entry === 'object' && typeof entry.id === 'string' && entry.id !== '' && typeof entry.name === 'string' && entry.name !== '',
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      ...(typeof entry.description === 'string' && entry.description !== '' ? { description: entry.description } : {}),
    }))
  const value: ModelCatalog = { models, ...(typeof answer.value.reason === 'string' ? { reason: answer.value.reason as ModelCatalog['reason'] } : {}) }
  if (models.length > 0) modelsMemo.set(provider, { value, at: Date.now() })
  return { ok: true, value }
}

/**
 * Models of one provider, or undefined when the read failed.
 *
 * An empty list is not memoized: it is what a transient adapter failure looks
 * like, and caching it would keep the select empty for the whole window.
 * @param provider - provider id.
 * @param signal - cancels the request.
 * @param options - `refresh` bypasses the short-lived memo.
 * @returns the catalog, or undefined on failure.
 */
export async function fetchModels(provider: string, signal?: AbortSignal, options: { refresh?: boolean } = {}): Promise<ModelCatalog | undefined> {
  const answer = await readModels(provider, signal, options)
  return answer.ok ? answer.value : undefined
}

/** Whether one exact route resolves; undefined when the check itself failed. */
export async function fetchRouteCheck(provider: string, model: string, signal?: AbortSignal): Promise<RouteCheck | undefined> {
  const answer = await getJson<RouteCheck>(endpoint(LLM_ROUTE_CHECK_ENDPOINT, { provider, model }), signal)
  if (!answer.ok || typeof answer.value.available !== 'boolean') return undefined
  return answer.value
}

/** State of the three catalog reads the provider/model rows render. */
export interface LlmRoutingState {
  providers: { loading: boolean; failure: CatalogFailure | null; entries: ProviderCatalogEntry[]; reload: () => void }
  models: { loading: boolean; failure: CatalogFailure | null; empty: boolean; entries: ModelCatalogEntry[]; reload: () => void }
  route: { checking: boolean; available: boolean | undefined }
}

/**
 * Load the catalog and check the selected route.
 *
 * `provider`/`model` are the staged values, so the selects follow edits before
 * they are saved. A missing provider clears the model list; an empty pair keeps
 * the route check idle.
 * @param provider - staged provider id ('' = follow session).
 * @param model - staged model id ('' = follow session / not chosen).
 * @returns the three read states.
 */
export function useLlmRouting(provider: string, model: string): LlmRoutingState {
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [providersFailure, setProvidersFailure] = useState<CatalogFailure | null>(null)
  const [providersToken, setProvidersToken] = useState(0)

  const [models, setModels] = useState<ModelCatalogEntry[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsFailure, setModelsFailure] = useState<CatalogFailure | null>(null)
  const [modelsEmpty, setModelsEmpty] = useState(false)
  const [modelsToken, setModelsToken] = useState(0)

  const [routeChecking, setRouteChecking] = useState(false)
  const [routeAvailable, setRouteAvailable] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    setProvidersLoading(true)
    setProvidersFailure(null)
    void readProviders(controller.signal, { refresh: providersToken > 0 }).then((answer) => {
      if (controller.signal.aborted) return
      setProvidersLoading(false)
      if (!answer.ok) {
        setProvidersFailure(answer.failure)
        setProviders([])
        return
      }
      setProviders(answer.value)
    })
    return () => controller.abort()
  }, [providersToken])

  useEffect(() => {
    if (provider === '') {
      setModels([])
      setModelsLoading(false)
      setModelsFailure(null)
      setModelsEmpty(false)
      return
    }
    const controller = new AbortController()
    setModels([])
    setModelsLoading(true)
    setModelsFailure(null)
    setModelsEmpty(false)
    void readModels(provider, controller.signal, { refresh: modelsToken > 0 }).then((answer) => {
      if (controller.signal.aborted) return
      setModelsLoading(false)
      if (!answer.ok) {
        setModelsFailure(answer.failure)
        return
      }
      setModels(answer.value.models)
      // An empty catalog is not usable in a select; flag it so the row can
      // fall back to the "custom model" entry.
      setModelsEmpty(answer.value.models.length === 0)
    })
    return () => controller.abort()
  }, [provider, modelsToken])

  useEffect(() => {
    if (provider === '' || model === '') {
      setRouteChecking(false)
      setRouteAvailable(undefined)
      return
    }
    const controller = new AbortController()
    setRouteChecking(true)
    setRouteAvailable(undefined)
    const timer = setTimeout(() => {
      void fetchRouteCheck(provider, model, controller.signal).then((answer) => {
        if (controller.signal.aborted) return
        setRouteChecking(false)
        setRouteAvailable(answer === undefined ? false : answer.available)
      })
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [provider, model])

  return {
    providers: {
      loading: providersLoading,
      failure: providersFailure,
      entries: providers,
      reload: () => setProvidersToken((token) => token + 1),
    },
    models: {
      loading: modelsLoading,
      failure: modelsFailure,
      empty: modelsEmpty,
      entries: models,
      reload: () => setModelsToken((token) => token + 1),
    },
    route: { checking: routeChecking, available: routeAvailable },
  }
}
