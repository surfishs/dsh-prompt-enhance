/**
 * Wire vocabulary of the read-only reasoning-effort discovery route, plus the
 * static DeepSeek catalog used when the plugin follows the default model.
 *
 * The host resolves a provider/model's declared efforts (`LlmModelReasoningInfo`)
 * and answers this shape; the browser renders it and caches it locally. Keeping
 * the shape here means both halves agree without the client importing the
 * harness's LLM types.
 * @module dsh-prompt-enhance/shared/reasoning
 */

/** Discovery endpoint under the plugin's route prefix. */
export const REASONING_EFFORTS_ENDPOINT = '/dsh-prompt-enhance/reasoning-efforts'

/** Provider id of the official DeepSeek route. */
export const DEEPSEEK_PROVIDER = 'deepseek-official'

/**
 * Whether a provider id belongs to the DeepSeek family whose tiers are known
 * statically. Hosts may register the official route under a variant id, so the
 * prefix form is accepted too.
 * @param provider - the provider id.
 * @returns true when {@link DEEPSEEK_EFFORTS} describes it.
 */
export function isDeepSeekProvider(provider: string): boolean {
  return provider === DEEPSEEK_PROVIDER || provider.startsWith('deepseek')
}

/** One adapter-declared reasoning effort. */
export interface ReasoningEffortInfo {
  /** Opaque id accepted by the harness call. */
  id: string
  /** Human-readable name, kept in the provider's own words. */
  name: string
  /** Optional distinction shown as the control's tooltip. */
  description?: string
}

/** Stable reason for an `unavailable` answer. */
export type ReasoningReason = 'no-default-model' | 'default-not-deepseek' | 'llm-unavailable' | 'no-efforts' | 'timeout' | 'resolve-failed'

/**
 * One capability answer.
 *
 * `source` tells the reader where the list came from:
 * - `resolved`: the provider/model declared these efforts;
 * - `default`: the followed default model is DeepSeek, so the static catalog applies;
 * - `unavailable`: nothing is known; the panel offers only "follow provider default".
 */
export interface ReasoningCapabilities {
  efforts: ReasoningEffortInfo[]
  /** The provider's default effort, when it declares one. */
  defaultEffort?: string
  source: 'resolved' | 'default' | 'unavailable'
  /** Stable reason for an `unavailable` answer. */
  reason?: ReasoningReason
}

/**
 * The official DeepSeek tiers, copied from the adapter's catalog so the
 * default-model path needs no capability round trip. Names stay in the
 * provider's wording (Off/Low/High/Max).
 */
export const DEEPSEEK_EFFORTS: readonly ReasoningEffortInfo[] = [
  { id: 'off', name: 'Off', description: 'Use for simple tasks that do not need reasoning.' },
  { id: 'low', name: 'Low', description: 'Prefer for routine or latency-sensitive tasks.' },
  { id: 'high', name: 'High', description: 'The default balance for most tasks.' },
  { id: 'max', name: 'Max', description: 'Reserve for the hardest quality-first tasks.' },
]
