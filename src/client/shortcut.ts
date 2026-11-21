/**
 * Configurable keyboard shortcut: parse the settings string (e.g.
 * "ctrl+alt+e") into a normalized combo and match keyboard events. Pure —
 * no listeners, fully unit-tested.
 *
 * Matching is layout-independent: the combo carries the DOM `event.code`
 * (`KeyA` / `Digit1` / `F9`), so shifted combinations (`ctrl+shift+1`,
 * where the browser reports `event.key === '!'`) keep working, and the
 * `event.key` comparison remains as a fallback.
 * @module dsh-prompt-enhance/client/shortcut
 */

/** One parsed shortcut combo. */
export interface ShortcutCombo {
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean
  /** Final key: a single letter a-z, digit 0-9, or f1-f24. */
  readonly key: string
  /** Layout-independent DOM code for the key (`KeyA`, `Digit1`, `F9`). */
  readonly code: string
}

/** Modifier token aliases recognized before the final key token. */
const MODIFIER_ALIASES: ReadonlyMap<string, keyof Omit<ShortcutCombo, 'key' | 'code'>> = new Map([
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['shift', 'shift'],
  ['meta', 'meta'],
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['win', 'meta'],
  ['super', 'meta'],
])

/** Function keys f1-f24; everything else must be one alphanumeric character. */
const FUNCTION_KEY_TOKEN = /^f([1-9]|1[0-9]|2[0-4])$/
const isKeyToken = (token: string): boolean => /^[a-z0-9]$/.test(token) || FUNCTION_KEY_TOKEN.test(token)

/**
 * Function keys that may be bound without ctrl/alt/meta: f13-f24.
 *
 * A bare letter or digit would swallow ordinary typing, and f1-f12 carry
 * browser/OS defaults (refresh, fullscreen, devtools), so both still require a
 * modifier. f13-f24 have no default action and no physical key on an ordinary
 * keyboard — they reach the page from macro pads and remappers — so requiring a
 * modifier there would only make the natural binding impossible.
 */
const isBareFunctionKey = (token: string): boolean => /^f(1[3-9]|2[0-4])$/.test(token)

/** The DOM `event.code` for a key token (physical, layout-independent). */
function codeFor(token: string): string {
  if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`
  if (/^[0-9]$/.test(token)) return `Digit${token}`
  return `F${token.slice(1)}`
}

/** Modifier flags of a combo. */
type ModifierFlags = Record<'ctrl' | 'alt' | 'shift' | 'meta', boolean>

/**
 * Parse a user-configured shortcut spec. Whitespace and case are free; the
 * key token must come last. At least one of ctrl / alt / meta is REQUIRED —
 * a shift-only combo fires while the user is simply typing a capital
 * letter, and a bare key would swallow that character everywhere. f13-f24
 * are the exception: they may stand alone (see {@link isBareFunctionKey}).
 * Empty spec parses to null (shortcut disabled).
 * @param spec - the raw settings string.
 * @returns the normalized combo, or null when the spec is unusable.
 */
export function parseShortcut(spec: string | undefined): ShortcutCombo | null {
  if (spec === undefined) return null
  const tokens = spec
    .trim()
    .toLowerCase()
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0 || tokens.length > 5) return null
  const modifiers: ModifierFlags = { ctrl: false, alt: false, shift: false, meta: false }
  const last = tokens[tokens.length - 1] ?? ''
  if (!isKeyToken(last)) return null
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(token)
    if (modifier === undefined) return null
    modifiers[modifier] = true
  }
  if (!modifiers.ctrl && !modifiers.alt && !modifiers.meta && !isBareFunctionKey(last)) return null
  return { ...modifiers, key: last, code: codeFor(last) }
}

/**
 * Whether one keyboard event matches a parsed combo. Modifiers must match
 * exactly; the key matches via the layout-independent `event.code` first
 * (this is what keeps `ctrl+shift+1` alive while the browser reports
 * `event.key === '!'`), with `event.key` as the fallback.
 * @param event - the DOM keyboard event.
 * @param combo - the parsed combo (null matches nothing).
 * @returns true only on an exact modifier+key match.
 */
export function matchesShortcut(event: KeyboardEvent, combo: ShortcutCombo | null): boolean {
  if (combo === null) return false
  return (
    event.ctrlKey === combo.ctrl && event.altKey === combo.alt && event.shiftKey === combo.shift && event.metaKey === combo.meta && (event.code === combo.code || event.key.toLowerCase() === combo.key)
  )
}

/** The slice of a keyboard event the recorder reads; structural so tests can pass plain objects. */
export interface ShortcutKeyEvent {
  readonly code: string
  readonly key: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
}

/** The settings spec for one recorded press, or null when it cannot be a shortcut. */
function keyTokenOf(event: ShortcutKeyEvent): string | null {
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1]
  if (letter !== undefined) return letter.toLowerCase()
  const digit = /^Digit([0-9])$/.exec(event.code)?.[1]
  if (digit !== undefined) return digit
  const fn = /^F([1-9]|1[0-9]|2[0-4])$/.exec(event.code)?.[1]
  if (fn !== undefined) return `f${fn}`
  const byKey = event.key.toLowerCase()
  return isKeyToken(byKey) ? byKey : null
}

/**
 * Render one recorded key press as a settings spec (`ctrl+alt+e`).
 *
 * Returns null — meaning "this press cannot be a shortcut" — when neither
 * ctrl / alt / meta is held (a bare key or shift+letter would swallow ordinary
 * typing; f13-f24 are the exception, see {@link isBareFunctionKey}), or when
 * the key falls outside the a-z / 0-9 / f1-f24 whitelist the parser accepts
 * (Space, Tab, arrows …).
 * @param event - the recorded key press.
 * @returns the spec string, or null.
 */
export function shortcutSpecOf(event: ShortcutKeyEvent): string | null {
  const token = keyTokenOf(event)
  if (token === null) return null
  // A bare f13-f24 is allowed; every other key needs ctrl / alt / meta so
  // ordinary typing and the browser's own function-key actions stay untouched.
  if (!event.ctrlKey && !event.altKey && !event.metaKey && !isBareFunctionKey(token)) return null
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  if (event.metaKey) parts.push('meta')
  parts.push(token)
  return parts.join('+')
}
