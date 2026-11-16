/**
 * Host-side LLM catalog reads: registered providers, their advertised models,
 * and whether one exact route resolves.
 *
 * These are thin, read-only projections of `ctx.llm` — the same service the
 * enhancement call uses — so the settings page can never offer a provider the
 * call cannot reach. No credential is read or returned.
 * @module dsh-prompt-enhance/provider-catalog
 */

import type { Context } from '@deepseek-ai/cordis'
import type { LlmConfigurableProvider, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import type { ModelCatalog, ModelCatalogEntry, ProviderCatalog, ProviderCatalogEntry, RouteCheck } from './shared/catalog'

/** How long one catalog/route lookup may take before it degrades. */
const LOOKUP_TIMEOUT_MS = 2000

/** The slice of `ctx.llm` this module needs. */
interface LlmCatalogFace {
  listProviders?: () => LlmProviderInfo[]
  listConfigurableProviders?: () => LlmConfigurableProvider[]
  listModels?: (provider: string) => Promise<readonly LlmModelInfo[]>
  resolveModelInfo?: (provider: string, model: string, signal?: AbortSignal) => Promise<LlmResolvedModelInfo>
  resolveModel?: (provider: string, model: string, signal?: AbortSignal) => Promise<LlmResolvedModelInfo>
}

/** Read the LLM service defensively. */
function llmOf(ctx: Context): LlmCatalogFace | undefined {
  try {
    return ctx.get('llm') as LlmCatalogFace | undefined
  } catch {
    return undefined
  }
}

/** Race one promise against the lookup deadline. */
async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error('catalog lookup timed out'), { name: 'TimeoutError' }))
    }, LOOKUP_TIMEOUT_MS)
  })
  try {
    return await Promise.race([promise, guard])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Map one provider entry. */
function providerOf(provider: LlmProviderInfo): ProviderCatalogEntry {
  return { id: provider.id, name: provider.name, registered: true }
}

/**
 * Registered providers first, then declared-but-unconfigured ones.
 * @param ctx - plugin context carrying `llm`.
 * @returns the provider catalog; never throws.
 */
export function listProviderCatalog(ctx: Context): ProviderCatalog {
  const llm = llmOf(ctx)
  if (llm === undefined) return { providers: [] }
  const registered: LlmProviderInfo[] = typeof llm.listProviders === 'function' ? llm.listProviders() : []
  const providers = registered.map(providerOf)
  const seen = new Set(providers.map((provider) => provider.id))
  if (typeof llm.listConfigurableProviders === 'function') {
    for (const entry of llm.listConfigurableProviders()) {
      if (seen.has(entry.provider)) continue
      seen.add(entry.provider)
      providers.push({ id: entry.provider, name: entry.displayName, registered: false })
    }
  }
  return { providers }
}

/** Map one model entry. */
function modelOf(model: LlmModelInfo): ModelCatalogEntry {
  return {
    id: model.id,
    name: model.name,
    ...(model.description === undefined ? {} : { description: model.description }),
  }
}

/**
 * Models advertised by one provider. An unknown provider yields an empty list
 * with a stable reason; the page then falls back to the "custom model" entry.
 * @param ctx - plugin context carrying `llm`.
 * @param provider - the provider id.
 * @returns the model catalog; never throws.
 */
export async function listModelCatalog(ctx: Context, provider: string): Promise<ModelCatalog> {
  const llm = llmOf(ctx)
  if (llm === undefined || typeof llm.listModels !== 'function') return { models: [], reason: 'llm-unavailable' }
  try {
    const models = await withTimeout(Promise.resolve(llm.listModels(provider)))
    return { models: models.map(modelOf) }
  } catch (error) {
    const reason: ModelCatalog['reason'] = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'list-failed'
    return { models: [], reason }
  }
}

/**
 * Whether one exact route resolves. Used only for the save-time warning — the
 * save itself is never blocked.
 * @param ctx - plugin context carrying `llm`.
 * @param provider - the provider id.
 * @param model - the model id.
 * @returns the availability answer; never throws.
 */
export async function checkRoute(ctx: Context, provider: string, model: string): Promise<RouteCheck> {
  const llm = llmOf(ctx)
  if (llm === undefined) return { available: false, reason: 'llm-unavailable' }
  const lookup = llm.resolveModelInfo ?? llm.resolveModel
  if (lookup === undefined) return { available: false, reason: 'llm-unavailable' }
  try {
    await withTimeout(Promise.resolve(lookup.call(llm, provider, model)))
    return { available: true }
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'unresolved',
    }
  }
}
