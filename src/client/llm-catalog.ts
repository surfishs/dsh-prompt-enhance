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

/** Fetch one JSON envelope, returning undefined on transport/protocol failure. */
async function getJson<T>(url: URL, signal?: AbortSignal): Promise<T | undefined> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    const envelope = body as { ok?: unknown; value?: unknown } | null
    if (envelope === null || envelope === undefined || envelope.ok !== true) return undefined
    return envelope.value as T
  } catch {
    return undefined
  }
}

/** Resolve one endpoint against the current page origin. */
function endpoint(path: string, params: Record<string, string> = {}): URL {
  const url = new URL(path, globalThis.location?.origin ?? 'http://127.0.0.1')
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
  return url
}

/** Registered + dormant providers, or undefined when the read failed. */
export async function fetchProviders(signal?: AbortSignal): Promise<ProviderCatalogEntry[] | undefined> {
  const value = await getJson<ProviderCatalog>(endpoint(LLM_PROVIDERS_ENDPOINT), signal)
  if (value === undefined || !Array.isArray(value.providers)) return undefined
  return value.providers.filter((entry): entry is ProviderCatalogEntry => (
    entry !== null && typeof entry === 'object'
    && typeof entry.id === 'string' && entry.id !== ''
    && typeof entry.name === 'string' && entry.name !== ''
    && typeof entry.registered === 'boolean'
  ))
}

/** Models of one provider, or undefined when the read failed. */
export async function fetchModels(provider: string, signal?: AbortSignal): Promise<ModelCatalog | undefined> {
  const value = await getJson<ModelCatalog>(endpoint(LLM_MODELS_ENDPOINT, { provider }), signal)
  if (value === undefined || !Array.isArray(value.models)) return undefined
  const models = value.models.filter((entry): entry is ModelCatalogEntry => (
    entry !== null && typeof entry === 'object'
    && typeof entry.id === 'string' && entry.id !== ''
    && typeof entry.name === 'string' && entry.name !== ''
  )).map((entry) => ({
    id: entry.id,
    name: entry.name,
    ...typeof entry.description === 'string' && entry.description !== '' ? { description: entry.description } : {},
  }))
  return { models, ...typeof value.reason === 'string' ? { reason: value.reason as ModelCatalog['reason'] } : {} }
}

/** Whether one exact route resolves; undefined when the check itself failed. */
export async function fetchRouteCheck(provider: string, model: string, signal?: AbortSignal): Promise<RouteCheck | undefined> {
  const value = await getJson<RouteCheck>(endpoint(LLM_ROUTE_CHECK_ENDPOINT, { provider, model }), signal)
  if (value === undefined || typeof value.available !== 'boolean') return undefined
  return value
}

/** State of the three catalog reads the provider/model rows render. */
export interface LlmRoutingState {
  providers: { loading: boolean; failed: boolean; entries: ProviderCatalogEntry[]; reload: () => void }
  models: { loading: boolean; failed: boolean; entries: ModelCatalogEntry[]; reload: () => void }
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
  const [providersFailed, setProvidersFailed] = useState(false)
  const [providersToken, setProvidersToken] = useState(0)

  const [models, setModels] = useState<ModelCatalogEntry[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsFailed, setModelsFailed] = useState(false)
  const [modelsToken, setModelsToken] = useState(0)

  const [routeChecking, setRouteChecking] = useState(false)
  const [routeAvailable, setRouteAvailable] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    setProvidersLoading(true)
    setProvidersFailed(false)
    void fetchProviders(controller.signal).then((entries) => {
      if (controller.signal.aborted) return
      setProvidersLoading(false)
      if (entries === undefined) {
        setProvidersFailed(true)
        setProviders([])
        return
      }
      setProviders(entries)
    })
    return () => controller.abort()
  }, [providersToken])

  useEffect(() => {
    if (provider === '') {
      setModels([])
      setModelsLoading(false)
      setModelsFailed(false)
      return
    }
    const controller = new AbortController()
    setModels([])
    setModelsLoading(true)
    setModelsFailed(false)
    void fetchModels(provider, controller.signal).then((answer) => {
      if (controller.signal.aborted) return
      setModelsLoading(false)
      if (answer === undefined) {
        setModelsFailed(true)
        return
      }
      setModels(answer.models)
      // An empty catalog is not usable in a select; flag it so the row can
      // fall back to the "custom model" entry.
      setModelsFailed(answer.models.length === 0)
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
      failed: providersFailed,
      entries: providers,
      reload: () => setProvidersToken((token) => token + 1),
    },
    models: {
      loading: modelsLoading,
      failed: modelsFailed,
      entries: models,
      reload: () => setModelsToken((token) => token + 1),
    },
    route: { checking: routeChecking, available: routeAvailable },
  }
}
