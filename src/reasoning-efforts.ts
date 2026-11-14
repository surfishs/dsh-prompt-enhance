/**
 * Host-side reasoning-effort resolution: ask the adapter what one provider/model
 * route declares, once per settings render that misses the browser cache.
 *
 * The default-model path answers from the static DeepSeek catalog instead of a
 * capability call, because the plugin follows the harness default only when the
 * user has not pinned a pair — and that default is DeepSeek in the supported
 * composition. A default that is not DeepSeek yields `unavailable`, which the
 * panel renders as "follow provider default" alone rather than guessing.
 * @module dsh-prompt-enhance/reasoning-efforts
 */

import type { Context } from '@deepseek-ai/cordis'
import type { LlmModelReasoningInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm'
import { DEEPSEEK_EFFORTS, isDeepSeekProvider, type ReasoningCapabilities, type ReasoningReason } from './shared/reasoning'
import { defaultRouteOf } from './orchestrate'
import { readCachedCapabilities, writeCachedCapabilities } from './reasoning-cache'

/** The slice of `ctx.llm` this module needs. */
interface ReasoningResolver {
  /** Runtime surface (dsh-llm `LlmRuntime.resolveModelInfo`). */
  resolveModelInfo?: (provider: string, model: string, signal?: AbortSignal) => Promise<LlmResolvedModelInfo>
  /** Adapter-shaped alias some hosts expose instead. */
  resolveModel?: (provider: string, model: string, signal?: AbortSignal) => Promise<LlmResolvedModelInfo>
}

/** How long one capability lookup may take before the panel falls back. */
const RESOLVE_TIMEOUT_MS = 2000

/** Read the LLM service defensively: a composition without it simply has no answer. */
function resolverOf(ctx: Context): ReasoningResolver | undefined {
  try {
    const service = ctx.get('llm') as ReasoningResolver | undefined
    if (service === undefined) return undefined
    const lookup = service.resolveModelInfo ?? service.resolveModel
    return typeof lookup === 'function' ? service : undefined
  } catch {
    return undefined
  }
}

/** One `unavailable` answer. */
function unavailable(reason: ReasoningReason): ReasoningCapabilities {
  return { efforts: [], source: 'unavailable', reason }
}

/** Map a thrown lookup failure onto the stable reasons the panel knows. */
function failureReason(error: unknown): ReasoningReason {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout'
  return 'resolve-failed'
}

/** Narrow one adapter effort into the wire shape. */
function effortOf(effort: LlmModelReasoningInfo['efforts'][number]): { id: string; name: string; description?: string } {
  return {
    id: effort.id,
    name: effort.name,
    ...effort.description === undefined ? {} : { description: effort.description },
  }
}

/**
 * Resolve the efforts a route declares.
 *
 * `provider`/`model` are optional in the wire contract: absent means "the
 * configured pair is empty, the plugin follows the default model". A partial
 * pair is a caller bug and is rejected by the route before this runs.
 *
 * A pinned pair is answered from the persistent host cache unless `refresh` is
 * set; the cache lives under the Harness home, so it survives restarts and
 * port changes.
 * @param ctx - plugin context carrying `llm` and, ideally, `agentDefaultModel`.
 * @param provider - configured provider id, or undefined.
 * @param model - configured model id, or undefined.
 * @param options - `refresh` bypasses and replaces the cached answer.
 * @returns the capability answer; never throws.
 */
export async function resolveReasoningCapabilities(
  ctx: Context,
  provider: string | undefined,
  model: string | undefined,
  options: { refresh?: boolean } = {},
): Promise<ReasoningCapabilities> {
  if (provider === undefined || model === undefined) {
    const fallback = defaultRouteOf(ctx)
    if (fallback === undefined) return unavailable('no-default-model')
    if (!isDeepSeekProvider(fallback.provider)) return unavailable('default-not-deepseek')
    return { efforts: [...DEEPSEEK_EFFORTS], source: 'default' }
  }
  if (options.refresh !== true) {
    const cached = await readCachedCapabilities(provider, model)
    if (cached !== undefined) {
      return {
        efforts: cached.efforts,
        ...cached.defaultEffort === undefined ? {} : { defaultEffort: cached.defaultEffort },
        source: 'resolved',
      }
    }
  }
  const llm = resolverOf(ctx)
  if (llm === undefined) return unavailable('llm-unavailable')
  const lookup = llm.resolveModelInfo ?? llm.resolveModel
  if (lookup === undefined) return unavailable('llm-unavailable')
  try {
    const resolved = await lookup.call(llm, provider, model, AbortSignal.timeout(RESOLVE_TIMEOUT_MS))
    const reasoning: LlmModelReasoningInfo | undefined = resolved.reasoning
    if (reasoning === undefined || reasoning.efforts.length === 0) return unavailable('no-efforts')
    const efforts = reasoning.efforts.map(effortOf)
    await writeCachedCapabilities(provider, model, efforts, reasoning.defaultEffort)
    return {
      efforts,
      ...reasoning.defaultEffort === undefined ? {} : { defaultEffort: reasoning.defaultEffort },
      source: 'resolved',
    }
  } catch (error) {
    return unavailable(failureReason(error))
  }
}
