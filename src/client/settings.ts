/**
 * Browser-side mirror of the plugin settings. The client bundle never
 * imports the host config module (it pulls schemastery into the browser),
 * so this module narrows the four fields the UI reads to a local interface and
 * re-exports them as a subscribable store fed by the bound settings scope.
 *
 * The DEFAULTS, unlike the shape, are not re-declared: they come from
 * `shared/defaults`, the same module `DEFAULT_CONFIG` is built from. A `.ts`
 * file there is dependency-free, so it costs the browser bundle nothing and
 * keeps one shipped default from being spelled twice.
 * @module dsh-prompt-enhance/client/settings
 */

import { DEFAULT_VALUES } from '../shared/defaults'

/** The settings subset the browser UI consumes (mirror of the host defaults). */
export interface ClientSettings {
  enabled: boolean
  maxInputChars: number
  shortcut: string
  /** Show the model's output as it streams (host may still fall back). */
  streaming: boolean
  /** Play the result card's expand/collapse transition. */
  foldAnimation: boolean
  /** Fold the card after Apply and re-open it after Undo. */
  autoFold: boolean
}

// Compile-time guarantee: the mirror only tracks keys that exist in the host
// config — a host-side rename fails this file's typecheck instead of
// silently desyncing the two shapes.
type AssertMirror = keyof ClientSettings extends keyof import('../config').Config ? true : never
const _assertMirror: AssertMirror = true
void _assertMirror
/** Defaults taken from the host's own default table, so they cannot drift. */
export const DEFAULT_CLIENT_SETTINGS: ClientSettings = {
  enabled: DEFAULT_VALUES.enabled,
  maxInputChars: DEFAULT_VALUES.maxInputChars,
  shortcut: DEFAULT_VALUES.shortcut,
  streaming: DEFAULT_VALUES.streaming,
  foldAnimation: DEFAULT_VALUES.foldAnimation,
  autoFold: DEFAULT_VALUES.autoFold,
}

const listeners = new Set<() => void>()
let current: ClientSettings = DEFAULT_CLIENT_SETTINGS

/**
 * Replace the effective settings (called by the scope subscription).
 * @param next - the freshly read section.
 */
export function setClientSettings(next: ClientSettings): void {
  current = next
  for (const listener of listeners) listener()
}

/** The currently effective client settings. */
export function getClientSettings(): ClientSettings {
  return current
}

/**
 * Subscribe to settings replacements.
 * @param listener - notified after each replacement.
 * @returns the unsubscribe function.
 */
export function subscribeClientSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Decode one wire section into client settings, falling back field-by-field
 * to the defaults. Used as the bound scope's `decode`.
 * @param section - the schema-resolved namespace section (untrusted).
 * @returns the narrowed settings.
 */
export function decodeClientSettings(section: unknown): ClientSettings {
  const record = section as Partial<Record<keyof ClientSettings, unknown>> | null
  if (record === null || typeof record !== 'object') return DEFAULT_CLIENT_SETTINGS
  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_CLIENT_SETTINGS.enabled,
    maxInputChars:
      typeof record.maxInputChars === 'number' && Number.isFinite(record.maxInputChars) && record.maxInputChars > 0 ? Math.floor(record.maxInputChars) : DEFAULT_CLIENT_SETTINGS.maxInputChars,
    shortcut: typeof record.shortcut === 'string' ? record.shortcut : DEFAULT_CLIENT_SETTINGS.shortcut,
    streaming: typeof record.streaming === 'boolean' ? record.streaming : DEFAULT_CLIENT_SETTINGS.streaming,
    foldAnimation: typeof record.foldAnimation === 'boolean' ? record.foldAnimation : DEFAULT_CLIENT_SETTINGS.foldAnimation,
    autoFold: typeof record.autoFold === 'boolean' ? record.autoFold : DEFAULT_CLIENT_SETTINGS.autoFold,
  }
}
