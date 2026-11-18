/**
 * The quick-settings model behind the composer button's menu: which reasoning
 * tiers to offer, which one the config holds, and how to write either setting.
 *
 * Everything here is defensive. The tier list has three sources of decreasing
 * confidence (an explicit provider/model override, the session's own model
 * directory, the static DeepSeek catalog) and any of them may be missing on a
 * given host — a failure must degrade the list, never break the button.
 * @module dsh-prompt-enhance/client/quick-settings
 */

import { DEEPSEEK_EFFORTS, isDeepSeekProvider, type ReasoningReason } from '../shared/reasoning'
import { fetchModels, fetchProviders } from './llm-catalog'
import { fetchReasoningCapabilities } from './reasoning-options'
import type { ClientSettings } from './settings'
import type { SettingsWriter } from './settings-writer'

/** One selectable tier. */
export interface QuickEffort {
  readonly id: string
  readonly name: string
}

/** The host services this menu reads (structural, so tests can pass stubs). */
export interface QuickContext {
  modelDirectories?: {
    directoryFor?: (sessionId: string | undefined) => unknown
  }
}

/** One snapshot of what the menu should show. */
export interface QuickSettingsData {
  /** Tiers offered by the resolved route (empty when nothing is known). */
  readonly efforts: readonly QuickEffort[]
  /** The effort the plugin config currently holds (may be `inherit`). */
  readonly effort: string
  /** The context switch the plugin config currently holds. */
  readonly contextAware: boolean
  /** The pinned provider override (empty follows the session). */
  readonly provider: string
  /** The pinned model override (empty follows the session). */
  readonly model: string
  /** Display name of the pinned provider (the raw id when the catalog is unavailable). */
  readonly providerLabel: string
  /** Display name of the pinned model (the raw id when the catalog is unavailable). */
  readonly modelLabel: string
  /** Where `efforts` came from — diagnostics only. */
  readonly source: 'override' | 'session' | 'static'
  /** Why the list is empty, when a source answered negatively. */
  readonly effortReason?: ReasoningReason
}

/** Input of one menu open. */
export interface QuickSettingsInput {
  readonly ctx?: QuickContext
  readonly sessionId?: string
  readonly settings: ClientSettings
}

/** The sentinel config value meaning "omit the field, let the provider decide". */
export const INHERIT_EFFORT = 'inherit'

/** Narrow one untrusted effort list. */
function effortsOf(value: unknown): QuickEffort[] {
  if (!Array.isArray(value)) return []
  const out: QuickEffort[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const record = item as { id?: unknown; name?: unknown }
    if (typeof record.id !== 'string' || record.id === '') continue
    out.push({ id: record.id, name: typeof record.name === 'string' && record.name !== '' ? record.name : record.id })
  }
  return out
}

/** The static catalog as menu options. */
function staticEfforts(): QuickEffort[] {
  return DEEPSEEK_EFFORTS.map((effort) => ({ id: effort.id, name: effort.name }))
}

/** The options a menu should draw: the tiers plus the stored value when it is unknown to them. */
export function menuOptionsOf(data: QuickSettingsData): QuickEffort[] {
  const options = [...data.efforts]
  if (data.effort !== '' && data.effort !== INHERIT_EFFORT && !options.some((option) => option.id === data.effort)) {
    // The route gave no name for the stored tier; the shipped catalog still
    // knows the display name of the standard ids (Off/Low/High/Max), so the
    // folded cell never falls back to the raw lowercase id it stores.
    const known = DEEPSEEK_EFFORTS.find((effort) => effort.id === data.effort)
    options.push({ id: data.effort, name: known?.name ?? data.effort })
  }
  return options
}

/** The model directory bound to one session, when the host exposes it. */
export function modelDirectoryOf(ctx: QuickContext | undefined, sessionId: string | undefined): unknown {
  try {
    return ctx?.modelDirectories?.directoryFor?.(sessionId)
  } catch {
    return undefined
  }
}

/** The store/load face the directory exposes, when it has one. */
export interface ModelDirectoryFace {
  readonly store?: {
    getSnapshot?: () => unknown
    subscribe?: (listener: () => void) => () => void
  }
  load?: () => unknown
}

/** Narrow a directory object onto the face the menu can watch. */
export function directoryFaceOf(directory: unknown): ModelDirectoryFace | undefined {
  if (directory === null || typeof directory !== 'object') return undefined
  return directory as ModelDirectoryFace
}

/** Read one directory snapshot without trusting any of its fields. */
function readDirectory(directory: unknown): { efforts: QuickEffort[]; provider?: string; model?: string } | undefined {
  const store = (directory as { store?: { getSnapshot?: () => unknown } } | undefined)?.store
  let snapshot: unknown
  try {
    snapshot = store?.getSnapshot?.()
  } catch {
    return undefined
  }
  if (snapshot === null || typeof snapshot !== 'object') return undefined
  const state = snapshot as { current?: { provider?: unknown; model?: unknown }; groups?: unknown }
  const provider = typeof state.current?.provider === 'string' ? state.current.provider : undefined
  const model = typeof state.current?.model === 'string' ? state.current.model : undefined
  let efforts: QuickEffort[] = []
  if (Array.isArray(state.groups) && provider !== undefined && model !== undefined) {
    for (const group of state.groups) {
      if (group === null || typeof group !== 'object') continue
      const entry = group as { id?: unknown; models?: unknown }
      if (entry.id !== provider || !Array.isArray(entry.models)) continue
      for (const candidate of entry.models) {
        if (candidate === null || typeof candidate !== 'object') continue
        const record = candidate as { id?: unknown; reasoning?: { efforts?: unknown } }
        if (record.id !== model) continue
        efforts = effortsOf(record.reasoning?.efforts)
      }
    }
  }
  return { efforts, provider, model }
}

/** Ask the directory to load, without letting a slow or throwing host block the menu. */
async function kickLoad(directory: unknown): Promise<void> {
  const load = (directory as { load?: () => unknown } | undefined)?.load
  if (typeof load !== 'function') return
  try {
    await Promise.resolve(load.call(directory))
  } catch {
    // A directory that cannot load keeps whatever the static fallback offers.
  }
}

/** Labels for a pinned route; both empty when the plugin follows the session. */
interface RouteLabels {
  readonly providerLabel: string
  readonly modelLabel: string
}

const FOLLOW_LABELS: RouteLabels = { providerLabel: '', modelLabel: '' }

/**
 * Resolve the display names of a pinned provider/model from the host catalogs.
 *
 * The card names the route the enhancement will actually call, so an id the
 * registry stopped advertising still shows as its id: a failed read must never
 * leave the row blank.
 * @param provider - pinned provider id.
 * @param model - pinned model id ('' when only the provider is pinned).
 * @returns the two labels, falling back to the ids.
 */
async function routeLabelsOf(provider: string, model: string): Promise<RouteLabels> {
  if (provider === '') return FOLLOW_LABELS
  const [providers, models] = await Promise.all([fetchProviders(), model === '' ? Promise.resolve(undefined) : fetchModels(provider)])
  return {
    providerLabel: providers?.find((entry) => entry.id === provider)?.name ?? provider,
    modelLabel: model === '' ? '' : (models?.models.find((entry) => entry.id === model)?.name ?? model),
  }
}

/**
 * Resolve what the menu shows for one composer.
 *
 * Priority: an explicit provider/model override (the enhance call will use it)
 * → the session's own directory → the static DeepSeek catalog. Any tier list
 * that comes back empty falls through to the next source.
 * @param input - the services, the session, and the current config.
 * @returns the menu data.
 */
export async function resolveQuickSettings(input: QuickSettingsInput): Promise<QuickSettingsData> {
  const stored = typeof input.settings.reasoningEffort === 'string' ? input.settings.reasoningEffort.trim() : ''
  const effort = stored === '' ? 'off' : stored
  const contextAware = input.settings.contextAware === true
  const provider = input.settings.provider?.trim() ?? ''
  const model = input.settings.model?.trim() ?? ''
  // Start the catalog read with the capability read so the card opens once, not
  // twice in a row.
  const labelsPromise = routeLabelsOf(provider, model)

  if (provider !== '' && model !== '') {
    const capabilities = await fetchReasoningCapabilities(provider, model)
    const efforts = effortsOf(capabilities.efforts)
    // A pinned route owns the list: when it declares no tiers (or the lookup
    // fails) the menu must say so instead of borrowing the session's tiers or
    // the shipped DeepSeek catalog, which would offer tiers this model rejects.
    if (efforts.length > 0) return { efforts, effort, contextAware, provider, model, ...(await labelsPromise), source: 'override' }
    return { efforts: [], effort, contextAware, provider, model, ...(await labelsPromise), source: 'override', effortReason: capabilities.reason ?? 'resolve-failed' }
  }

  const directory = modelDirectoryOf(input.ctx, input.sessionId)
  if (directory !== undefined) {
    const first = readDirectory(directory)
    if (first !== undefined && first.efforts.length > 0) return { efforts: first.efforts, effort, contextAware, provider, model, ...(await labelsPromise), source: 'session' }
    // A snapshot that has not loaded yet is normal on a cold composer; nudge it
    // and read once more before settling for the static catalog.
    await kickLoad(directory)
    const second = readDirectory(directory)
    if (second !== undefined && second.efforts.length > 0) return { efforts: second.efforts, effort, contextAware, provider, model, ...(await labelsPromise), source: 'session' }
    if (second?.provider !== undefined && !isDeepSeekProvider(second.provider)) {
      // A non-DeepSeek route declares its own tiers; guessing them would offer
      // options the model rejects, so the menu shows the stored value only.
      return { efforts: [], effort, contextAware, provider, model, ...(await labelsPromise), source: 'session', effortReason: 'no-efforts' }
    }
  }

  return { efforts: staticEfforts(), effort, contextAware, provider, model, ...(await labelsPromise), source: 'static' }
}

/**
 * Write the reasoning effort. The caller reports the failure in the menu.
 * @param writer - the installed settings writer.
 * @param id - tier id, or {@link INHERIT_EFFORT}.
 * @returns true when the host accepted the write.
 */
export async function writeQuickEffort(writer: SettingsWriter, id: string): Promise<boolean> {
  try {
    return await writer.set('reasoningEffort', id)
  } catch {
    return false
  }
}

/**
 * Write the context switch.
 * @param writer - the installed settings writer.
 * @param next - the desired value.
 * @returns true when the host accepted the write.
 */
export async function writeQuickContext(writer: SettingsWriter, next: boolean): Promise<boolean> {
  try {
    return await writer.set('contextAware', next)
  } catch {
    return false
  }
}
