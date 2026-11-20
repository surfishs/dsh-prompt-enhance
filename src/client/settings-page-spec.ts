/**
 * The settings model both configuration surfaces share: the row table, its
 * schemastery descriptors, the staged form, and the projection types the
 * renderer reads.
 *
 * Split out of `settings-page` so the row table can be edited without opening
 * the rendering code, and so the copy and styles tables can be edited without
 * opening this one.
 * @module dsh-prompt-enhance/client/settings-page-spec
 */

import { SettingsFormModel, settingsNumberField, settingsTextField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsFieldDescriptor } from '@deepseek-ai/dsh-client-ui-primitives'
import { DEFAULT_VALUES } from '../shared/defaults'
import { FIELD_LIMITS, TEMPERATURE, type NumericRange } from '../shared/limits'
import { parseShortcut } from './shortcut'
import type { PromptEnhanceKey } from './locales'
import type { RowCopy, Translate } from './settings-page-copy'

/** The settings dialog's navigation slot. */
export const SETTINGS_SECTION_SLOT = 'settings.section'

/** Cell id of the settings-dialog page, and the locale namespace its label uses. */
export const SETTINGS_SECTION_ID = 'dsh-prompt-enhance'

/** Where the page sits among the dialog's sections. */
export const SETTINGS_SECTION_ORDER = 70

/** The settings-dialog row's title, used when no locale service is mounted. */
export const SETTINGS_SECTION_LABEL = '提示词增强'

/** The plugin manager's keyed slot for one row's configuration page. */
export const SETTINGS_ROW_CONFIG_SLOT = 'plugins.row.config'

/**
 * Settings namespace the host half registers. Spelled here rather than
 * imported from `../config`: a client package must not depend on a host
 * package, whose module would drag the schema runtime into the browser
 * bundle.
 */
export const SETTINGS_NAMESPACE = 'dsh-prompt-enhance'

/** The bundle whose patch declares the row, and that row's id. */
/**
 * Package name of this bundle, injected by the client build from
 * `package.json.name` (see `scripts/build.mjs`), exactly like the version.
 * It must not be a literal: the plugin manager keys a row's config page as
 * `<package name>#<row id>`, so a fork that renames the package would silently
 * lose that page. The fallback is the shipped name, for environments that
 * execute the source without the build (unit tests).
 */
export const SETTINGS_BUNDLE = typeof __PLUGIN_NAME__ === 'string' ? __PLUGIN_NAME__ : '@surfishs/dsh-prompt-enhance'
export const SETTINGS_ROW_ID = 'dsh-prompt-enhance'

/**
 * Key of the Plugins-page entry: the plugin manager keys a row as
 * `<bundle package name>#<row id>`, so this must stay in step with
 * `cordis.patch.yml`'s `id` for the row.
 */
export const SETTINGS_ROW_CONFIG_KEY = `${SETTINGS_BUNDLE}#${SETTINGS_ROW_ID}`

/**
 * A boolean descriptor: `true`/`false` in text form, and a real boolean back
 * out of `parse`, so a switch writes the JSON type the schema declares.
 * Blank text means "clear", matching the bundled helpers' convention.
 * @param key - the config key the row edits.
 * @returns the descriptor for that key.
 */
export function settingsBooleanField(key: string): SettingsFieldDescriptor {
  return {
    field: key,
    format: (value) => (typeof value === 'boolean' ? String(value) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      if (trimmed === 'true') return { kind: 'set', value: true }
      if (trimmed === 'false') return { kind: 'set', value: false }
      return undefined
    },
  }
}

/**
 * An enum descriptor over a fixed set of strings. Text outside the set is
 * staged as invalid instead of being written, so a stale stored value cannot
 * be saved back by an accidental edit.
 * @param key - the config key the row edits.
 * @param options - the accepted values, in display order.
 * @returns the descriptor for that key.
 */
export function settingsEnumField(key: string, options: readonly string[]): SettingsFieldDescriptor {
  return {
    field: key,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      return options.includes(trimmed) ? { kind: 'set', value: trimmed } : undefined
    },
  }
}

/** Choices of `strategyMode`, by dictionary key. */
export const STRATEGY_OPTIONS: readonly { value: string; label: PromptEnhanceKey }[] = [
  { value: 'replace-default', label: 'settings.strategy.replace' },
  { value: 'extend-default', label: 'settings.strategy.extend' },
]

/** How one row is edited, which picks both its control and its descriptor. */
export type RowKind = 'text' | 'number' | 'boolean' | 'strategy' | 'reasoning' | 'provider' | 'model'

/** One row of both pages, in display order. */
export interface Row {
  /** The config key; the form reads and writes it by this name. */
  readonly key: string
  /** Which control renders it. */
  readonly kind: RowKind
  /** Dictionary key of the row's name. */
  readonly label: PromptEnhanceKey
  /** Dictionary key of the hint under the row. */
  readonly hint: PromptEnhanceKey
  /**
   * Dictionary key of an example shown greyed out while the input is empty.
   * It teaches the expected format without writing any value into the config.
   */
  readonly placeholder?: PromptEnhanceKey
  /**
   * Whether a staged value may be written. The schema accepts the field as a
   * plain string, so a field whose format only the client understands (the
   * shortcut) has to refuse the write here instead of storing a dead value.
   * Absent means "anything the descriptor stages is writable".
   */
  readonly validate?: (text: string) => boolean
  /** Inclusive bounds a number row enforces; `integer` defaults to true. */
  readonly range?: NumericRange & { readonly integer?: boolean }
  /** Offer the press-a-combination recorder next to the input (the shortcut row). */
  readonly recordable?: boolean
}

/** Whether one staged numeric text is writable: empty clears, otherwise an in-range number. */
function validateNumber(text: string, range: NumericRange, integer: boolean): boolean {
  const trimmed = text.trim()
  // Empty means "clear" in the form model, so it is valid for every row.
  if (trimmed === '') return true
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return false
  if (integer && !Number.isInteger(value)) return false
  return value >= range.min && value <= range.max
}

/** One numeric row: its real bounds plus the staged-text validation the red-box path reads. */
function numberRow(key: string, label: PromptEnhanceKey, hint: PromptEnhanceKey, range: NumericRange, integer = true): Row {
  return {
    key,
    kind: 'number',
    label,
    hint,
    range: { ...range, integer },
    validate: (text: string) => validateNumber(text, range, integer),
  }
}

/**
 * Every row both pages edit, in display order: the master switch and the two
 * display/context switches first, then routing and generation, then the
 * context window, then the host-side resource caps, and the shortcut last.
 */
export const BASIC_ROWS: readonly Row[] = [
  { key: 'enabled', kind: 'boolean', label: 'settings.row.enabled.label', hint: 'settings.row.enabled.hint' },
  { key: 'provider', kind: 'provider', label: 'settings.row.provider.label', hint: 'settings.row.provider.hint' },
  { key: 'model', kind: 'model', label: 'settings.row.model.label', hint: 'settings.row.model.hint' },
  { key: 'reasoningEffort', kind: 'reasoning', label: 'settings.row.reasoningEffort.label', hint: 'settings.row.reasoningEffort.hint' },
  numberRow('temperature', 'settings.row.temperature.label', 'settings.row.temperature.hint', TEMPERATURE, false),
  { key: 'contextAware', kind: 'boolean', label: 'settings.row.contextAware.label', hint: 'settings.row.contextAware.hint' },
  { key: 'streaming', kind: 'boolean', label: 'settings.row.streaming.label', hint: 'settings.row.streaming.hint' },
  { key: 'systemPrompt', kind: 'text', label: 'settings.row.systemPrompt.label', hint: 'settings.row.systemPrompt.hint', placeholder: 'settings.row.systemPrompt.placeholder' },
  {
    key: 'shortcut',
    kind: 'text',
    label: 'settings.row.shortcut.label',
    hint: 'settings.row.shortcut.hint',
    placeholder: 'settings.row.shortcut.placeholder',
    // Empty disables the shortcut, so it is valid; anything else must parse.
    validate: (text: string) => text.trim() === '' || parseShortcut(text) !== null,
    recordable: true,
  },
]

/** Tuning and deployment limits, hidden behind the Advanced disclosure by default. */
export const ADVANCED_ROWS: readonly Row[] = [
  { key: 'foldAnimation', kind: 'boolean', label: 'settings.row.foldAnimation.label', hint: 'settings.row.foldAnimation.hint' },
  { key: 'autoFold', kind: 'boolean', label: 'settings.row.autoFold.label', hint: 'settings.row.autoFold.hint' },
  { key: 'strategyMode', kind: 'strategy', label: 'settings.row.strategyMode.label', hint: 'settings.row.strategyMode.hint' },
  numberRow('maxInputChars', 'settings.row.maxInputChars.label', 'settings.row.maxInputChars.hint', FIELD_LIMITS.maxInputChars),
  numberRow('maxOutputTokens', 'settings.row.maxOutputTokens.label', 'settings.row.maxOutputTokens.hint', FIELD_LIMITS.maxOutputTokens),
  numberRow('timeoutMs', 'settings.row.timeoutMs.label', 'settings.row.timeoutMs.hint', FIELD_LIMITS.timeoutMs),
  numberRow('contextMaxMessages', 'settings.row.contextMaxMessages.label', 'settings.row.contextMaxMessages.hint', FIELD_LIMITS.contextMaxMessages),
  numberRow('contextMaxChars', 'settings.row.contextMaxChars.label', 'settings.row.contextMaxChars.hint', FIELD_LIMITS.contextMaxChars),
  numberRow('maxConcurrent', 'settings.row.maxConcurrent.label', 'settings.row.maxConcurrent.hint', FIELD_LIMITS.maxConcurrent),
  numberRow('rateLimitPerMinute', 'settings.row.rateLimitPerMinute.label', 'settings.row.rateLimitPerMinute.hint', FIELD_LIMITS.rateLimitPerMinute),
]

/** Every row both pages edit; the renderer splits it at the Advanced boundary. */
export const ROWS: readonly Row[] = [...BASIC_ROWS, ...ADVANCED_ROWS]

/**
 * The staged form's descriptor for one row.
 * @param row - the row to describe.
 * @returns its field descriptor.
 */
export function descriptorOf(row: Row): SettingsFieldDescriptor {
  switch (row.kind) {
    case 'number':
      return settingsNumberField(row.key)
    case 'boolean':
      return settingsBooleanField(row.key)
    case 'strategy':
      return settingsEnumField(
        row.key,
        STRATEGY_OPTIONS.map((option) => option.value),
      )
    case 'reasoning':
      // Effort ids are adapter-owned and discovered at render time, so the
      // descriptor cannot enumerate them; the segmented control is the only
      // writer, and the host validates the id against the route's declaration.
      return settingsTextField(row.key)
    default:
      return settingsTextField(row.key)
  }
}

/** Descriptors in display order; the form model holds one per row. */
export const FIELD_SPECS: readonly SettingsFieldDescriptor[] = ROWS.map((row) => descriptorOf(row))

/**
 * Build the staged form these pages render over one settings scope.
 *
 * Exported so a test can drive the same descriptors the pages use — the
 * boolean and enum rows exist precisely because their staged text must parse
 * back into a JSON boolean and a known enum string, and that contract is worth
 * holding down outside the minified shell.
 * @param scope - the settings scope of the plugin's entry.
 * @returns the staged form over every row.
 */
export function createSettingsForm(scope: unknown): SettingsFormModel {
  return new SettingsFormModel(scope, FIELD_SPECS)
}

/** One projection of the pages' form store. */
export interface SettingsSnapshot {
  writable?: boolean
  [key: string]: unknown
}

/** One row's projection inside that snapshot. */
export interface FieldView {
  text: string
  overridden: boolean
  invalid: boolean
}

/** The staged form's actions, as both slots hand them over. */
export interface FormProps {
  /**
   * The store hook, named after the `inject()` hook key (`promptEnhance`).
   * Absent when the host does not project hooks for this slot; the component
   * renders the explanation instead of throwing, because a throwing page
   * blanks the pane.
   */
  usePromptEnhance?: (selector: (snapshot: SettingsSnapshot) => SettingsSnapshot) => SettingsSnapshot
  edit?: (key: string, text: string) => void
  resetField?: (key: string) => void
  save?: () => void
  discard?: () => void
  writeField?: (key: string, text: string) => Promise<'saved' | 'invalid' | 'failed'>
}

/** One locale snapshot, as the client locale service exposes it. */
export interface LocaleSnapshotLike {
  /** Active locale id, e.g. `zh` or `en`. */
  active?: string
  /** Monotonic revision; changes on locale switches and dictionary registration. */
  revision?: number
}

/** The client locale service, reached structurally so no package type is needed. */
export interface LocaleFaceLike {
  bind(namespace: string): Translate
  getSnapshot(): LocaleSnapshotLike
  subscribe(listener: () => void): () => void
}

/** Props of the settings-dialog page. */
export type SectionProps = FormProps & {
  /** The locale-bound translate seat this plugin projects into the page. */
  translate?: Translate
  /** Locale snapshot selector hook; re-renders the page when the language changes. */
  usePromptEnhanceLocale?: (selector: (snapshot: LocaleSnapshotLike) => LocaleSnapshotLike) => LocaleSnapshotLike
}

/** Props the plugin manager hands a configuration page. */
export interface PageProps extends FormProps {
  /** Translate seat of this page's locale namespace, injected by the slot. */
  t?: Translate
  /** Which view the manager asks for: the form, or the one-line summary. */
  view?: 'page' | 'summary'
}

/** Props shared by every row component: the row, its copy, its state, its actions. */
export interface RowProps {
  /** The DOM id of the row's control. */
  id: string
  /** The row's title, already resolved. */
  label: string
  /** The hint under the row, already resolved. */
  hint: string
  /** The frame's copy, for the overridden badge and its reset button. */
  copy: RowCopy
  /** The row's staged state. */
  view: FieldView
  /** Whether writes are refused by this deployment. */
  disabled: boolean
  /**
   * Stage new text for this row. deferred asks the frame to debounce the
   * write instead of saving at once — free text (a hand-typed model id) should
   * not write the configuration once per keystroke, while a discrete choice
   * still saves immediately.
   */
  onEdit: (text: string, options?: { deferred?: boolean }) => void
  /** Clear the stored value so the row re-inherits the composition default. */
  onReset: () => void
  /** Commit the current text now, e.g. on blur or Enter. */
  onCommit?: () => void
}

/**
 * Read one row's projection out of the page snapshot.
 *
 * A row the host schema does not declare is absent from the projection; it
 * renders as an empty, non-overridden field rather than throwing.
 * @param snapshot - the page's current snapshot.
 * @param key - the row's config key.
 * @returns the row's text form and staging flags.
 */
export function viewOf(snapshot: SettingsSnapshot, key: string): FieldView {
  const value = snapshot[key]
  if (value === null || typeof value !== 'object') return { text: '', overridden: false, invalid: false }
  const field = value as { text?: unknown; overridden?: unknown; invalid?: unknown }
  return {
    text: typeof field.text === 'string' ? field.text : '',
    overridden: field.overridden === true,
    invalid: field.invalid === true,
  }
}

/**
 * Whether one row's current text equals its shipped default.
 *
 * The host form reports `overridden` as "this field was written explicitly"
 * (stored value or a staged set), which stays true even when the user edits
 * the value back to the default. The badge and its reset action only make
 * sense while there is something to reset, so visibility is derived from this
 * comparison instead — for text/number/enum rows alike.
 * @param key - the config key.
 * @param text - the row's current staged text.
 * @returns true when editing can no longer change anything from the default.
 */
/** The display text a reset row falls back to, from the shared defaults. */
export function defaultTextOf(key: string): string {
  const descriptor = FIELD_SPECS.find((item) => item.field === key)
  const fallback = (DEFAULT_VALUES as Record<string, unknown>)[key]
  if (descriptor === undefined || fallback === undefined) return ''
  try {
    return descriptor.format(fallback)
  } catch {
    return ''
  }
}

export function atDefaultValue(key: string, text: string): boolean {
  const fallback = (DEFAULT_VALUES as Record<string, unknown>)[key]
  // provider/model are absent from the defaults on purpose: empty means follow.
  if (fallback === undefined) return text.trim() === ''
  if (typeof fallback === 'boolean') return text.trim() === String(fallback)
  if (typeof fallback === 'number') {
    const parsed = Number(text.trim())
    return Number.isFinite(parsed) && parsed === fallback
  }
  return text.trim() === String(fallback)
}
