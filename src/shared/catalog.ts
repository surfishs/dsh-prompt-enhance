/**
 * Wire vocabulary and shapes for the read-only LLM catalog endpoints the
 * settings page uses to turn `provider`/`model` from free text into selects.
 *
 * Every answer comes from the harness's LLM registry — the same registry the
 * enhancement call goes through — so an option that appears here is a route the
 * plugin can actually call. Dormant providers are listed separately and the
 * page renders them disabled.
 * @module dsh-prompt-enhance/shared/catalog
 */

/** Registered providers plus models, one call per surface. */
export const LLM_PROVIDERS_ENDPOINT = '/dsh-prompt-enhance/llm-providers'
/** Models advertised by one registered provider. */
export const LLM_MODELS_ENDPOINT = '/dsh-prompt-enhance/llm-models'
/** Whether one provider/model route resolves at all (warning-only check). */
export const LLM_ROUTE_CHECK_ENDPOINT = '/dsh-prompt-enhance/llm-route-check'

/** One selectable provider entry. */
export interface ProviderCatalogEntry {
  /** Provider route id passed to the LLM call. */
  id: string
  /** Human-readable name, kept in the provider's own words. */
  name: string
  /** False for a declared-but-unconfigured provider (rendered disabled). */
  registered: boolean
}

/** One advertised model of a provider. */
export interface ModelCatalogEntry {
  /** Model id passed to the LLM call. */
  id: string
  /** Human-readable name. */
  name: string
  /** Optional distinction from otherwise similar models. */
  description?: string
}

/** The provider list answer. */
export interface ProviderCatalog {
  providers: ProviderCatalogEntry[]
}

/** The model list answer; `reason` explains an empty list. */
export interface ModelCatalog {
  models: ModelCatalogEntry[]
  reason?: 'llm-unavailable' | 'list-failed' | 'timeout' | 'unknown-provider'
}

/** The route availability answer used for the save-time warning. */
export interface RouteCheck {
  available: boolean
  reason?: 'llm-unavailable' | 'timeout' | 'unresolved'
}
