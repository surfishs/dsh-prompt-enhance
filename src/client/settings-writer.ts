/**
 * The plugin's own settings, written from the composer half.
 *
 * The settings page writes through props the host hands to that page; the
 * composer slot gets no such props. This module is the one shared seam: the
 * settings source installs a writer when the host exposes one, and any
 * composer-side control asks for it here. When no writer is installed the
 * quick-settings entry stays hidden — a menu that cannot save is worse than no
 * menu at all.
 * @module dsh-prompt-enhance/client/settings-writer
 */

/** One write surface of the plugin's config section. */
export interface SettingsWriter {
  /** Stage a value; resolves true once the host accepted it. */
  set(field: string, value: unknown): Promise<boolean>
  /** Clear a value back to its default. */
  unset(field: string): Promise<boolean>
}

let current: SettingsWriter | undefined
const listeners = new Set<() => void>()

/**
 * Install (or clear) the writer. Called by the settings source as it binds a
 * form; tests call it directly.
 * @param next - the writer, or undefined when the host offers none.
 */
export function setSettingsWriter(next: SettingsWriter | undefined): void {
  if (current === next) return
  current = next
  for (const listener of listeners) listener()
}

/** The installed writer, when the host can write settings from here. */
export function getSettingsWriter(): SettingsWriter | undefined {
  return current
}

/**
 * Subscribe to writer replacement, so a control can appear as soon as the host
 * binding settles (it resolves asynchronously after apply).
 * @param listener - notified after each replacement.
 * @returns the unsubscribe function.
 */
export function subscribeSettingsWriter(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
