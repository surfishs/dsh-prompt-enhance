/**
 * The dsh-prompt-enhance configuration surfaces of the dsh web GUI.
 *
 * The plugin ships two entry points to the same staged form:
 *
 * - **Settings dialog** — a `settings.section` entry titled 提示词增强, the page
 *   this plugin has always drawn for hosts that no longer generate one from
 *   the schema. It keeps the diagnostic presentation: the raw config key beside
 *   the Chinese name, and a bilingual hint.
 * - **Plugins page** — a `plugins.row.config` entry for the row this bundle's
 *   patch declares. That slot is the host's documented seat for a plugin's own
 *   configuration (keyed `<bundle package>#<row id>`); the manager draws the
 *   chrome, asks for `view: 'page' | 'summary'`, and the row gains a configure
 *   control. Copy there is single-language, read through the locale seat.
 *
 * Both surfaces share one staged form: value rows draw a native input, boolean
 * rows the shell's `Switch`, enum rows its `SegmentedControl`. The primitives
 * package ships field helpers only for text and numbers, so this module
 * supplies the boolean and enum descriptors itself — a descriptor is
 * `{ field, format, parse }`, and `parse` decides the JSON value written,
 * which is what keeps a switch writing `true` instead of the string `"true"`.
 * @module dsh-prompt-enhance/client/settings-page
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReasoningCapabilities } from '../shared/reasoning'
import { DEFAULT_VALUES } from '../shared/defaults'
import { fetchReasoningCapabilities } from './reasoning-options'
import { useLlmRouting, type LlmRoutingState } from './llm-catalog'
import {
  SegmentedControl,
  SettingsFormModel,
  Switch,
  settingsNumberField,
  settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsFieldDescriptor } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS as LOCALE_NS, zh } from './locales'
import type { PromptEnhanceKey } from './locales'

/** The settings dialog's navigation slot. */
export const SETTINGS_SECTION_SLOT = 'settings.section'

/** Cell id of the settings-dialog page, and the locale namespace its label uses. */
export const SETTINGS_SECTION_ID = 'dsh-prompt-enhance'

/** Where the page sits among the dialog's sections. */
export const SETTINGS_SECTION_ORDER = 70

/** The settings-dialog row's title, used when no locale service is mounted. */
export const SETTINGS_SECTION_LABEL = '提示词增强'

/**
 * The settings dialog's navigation title in the active language, with the
 * shipped Chinese label as the fallback for a deployment without the locale
 * service.
 * @param getLocale - resolves the client locale service.
 * @returns the title the dialog's navigation should show.
 */
function sectionTitle(getLocale: (() => LocaleFaceLike | undefined) | undefined): string {
  try {
    const t = getLocale?.()?.bind(LOCALE_NS)
    return t === undefined ? SETTINGS_SECTION_LABEL : t('settings.title')
  } catch {
    return SETTINGS_SECTION_LABEL
  }
}

/** The plugin manager's keyed slot for one row's configuration page. */
export const SETTINGS_ROW_CONFIG_SLOT = 'plugins.row.config'

/**
 * Settings namespace the host half registers. Spelled here rather than
 * imported from `../config`: a client package must not depend on a host
 * package, whose module would drag the schema runtime into the browser
 * bundle.
 */
const SETTINGS_NAMESPACE = 'dsh-prompt-enhance'

/** The bundle whose patch declares the row, and that row's id. */
const SETTINGS_BUNDLE = '@surfishs/dsh-prompt-enhance'
const SETTINGS_ROW_ID = 'dsh-prompt-enhance'

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
function settingsBooleanField(key: string): SettingsFieldDescriptor {
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
function settingsEnumField(key: string, options: readonly string[]): SettingsFieldDescriptor {
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
const STRATEGY_OPTIONS: readonly { value: string; label: PromptEnhanceKey }[] = [
  { value: 'replace-default', label: 'settings.strategy.replace' },
  { value: 'extend-default', label: 'settings.strategy.extend' },
]

/** How one row is edited, which picks both its control and its descriptor. */
type RowKind = 'text' | 'number' | 'boolean' | 'strategy' | 'reasoning' | 'provider' | 'model'

/** One row of both pages, in display order. */
interface Row {
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
}

/**
 * Every row both pages edit, in display order: the master switch and the two
 * display/context switches first, then routing and generation, then the
 * context window, then the host-side resource caps, and the shortcut last.
 */
const ROWS: readonly Row[] = [
  { key: 'enabled', kind: 'boolean', label: 'settings.row.enabled.label', hint: 'settings.row.enabled.hint' },
  { key: 'contextAware', kind: 'boolean', label: 'settings.row.contextAware.label', hint: 'settings.row.contextAware.hint' },
  { key: 'streaming', kind: 'boolean', label: 'settings.row.streaming.label', hint: 'settings.row.streaming.hint' },
  { key: 'provider', kind: 'provider', label: 'settings.row.provider.label', hint: 'settings.row.provider.hint' },
  { key: 'model', kind: 'model', label: 'settings.row.model.label', hint: 'settings.row.model.hint' },
  { key: 'reasoningEffort', kind: 'reasoning', label: 'settings.row.reasoningEffort.label', hint: 'settings.row.reasoningEffort.hint' },
  { key: 'temperature', kind: 'number', label: 'settings.row.temperature.label', hint: 'settings.row.temperature.hint' },
  { key: 'maxOutputTokens', kind: 'number', label: 'settings.row.maxOutputTokens.label', hint: 'settings.row.maxOutputTokens.hint' },
  { key: 'maxInputChars', kind: 'number', label: 'settings.row.maxInputChars.label', hint: 'settings.row.maxInputChars.hint' },
  { key: 'timeoutMs', kind: 'number', label: 'settings.row.timeoutMs.label', hint: 'settings.row.timeoutMs.hint' },
  { key: 'strategyMode', kind: 'strategy', label: 'settings.row.strategyMode.label', hint: 'settings.row.strategyMode.hint' },
  { key: 'systemPrompt', kind: 'text', label: 'settings.row.systemPrompt.label', hint: 'settings.row.systemPrompt.hint', placeholder: 'settings.row.systemPrompt.placeholder' },
  { key: 'contextMaxMessages', kind: 'number', label: 'settings.row.contextMaxMessages.label', hint: 'settings.row.contextMaxMessages.hint' },
  { key: 'contextMaxChars', kind: 'number', label: 'settings.row.contextMaxChars.label', hint: 'settings.row.contextMaxChars.hint' },
  { key: 'maxConcurrent', kind: 'number', label: 'settings.row.maxConcurrent.label', hint: 'settings.row.maxConcurrent.hint' },
  { key: 'rateLimitPerMinute', kind: 'number', label: 'settings.row.rateLimitPerMinute.label', hint: 'settings.row.rateLimitPerMinute.hint' },
  { key: 'shortcut', kind: 'text', label: 'settings.row.shortcut.label', hint: 'settings.row.shortcut.hint', placeholder: 'settings.row.shortcut.placeholder' },
]

/**
 * The staged form's descriptor for one row.
 * @param row - the row to describe.
 * @returns its field descriptor.
 */
function descriptorOf(row: Row): SettingsFieldDescriptor {
  switch (row.kind) {
    case 'number':
      return settingsNumberField(row.key)
    case 'boolean':
      return settingsBooleanField(row.key)
    case 'strategy':
      return settingsEnumField(row.key, STRATEGY_OPTIONS.map((option) => option.value))
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
const FIELD_SPECS: readonly SettingsFieldDescriptor[] = ROWS.map((row) => descriptorOf(row))

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

/** The translate seat the slot framework injects for the declared namespace. */
type Translate = TranslateNS<typeof LOCALE_NS>

/** The shipped Chinese dictionary, used when a host projects no `t` seat. */
const ZH_COPY: Readonly<Record<string, string>> = zh

/**
 * Resolve the Plugins-page copy reader: the injected `t` when present, the
 * shipped Chinese dictionary otherwise. Falling back keeps an older host (or a
 * test) from rendering dictionary keys instead of copy.
 * @param t - the injected translate seat, if any.
 * @returns a reader for this page's keys.
 */
function translator(t: Translate | undefined): Translate {
  if (typeof t === 'function') return t
  // The fallback dictionary must interpolate `{name}` placeholders too, or a
  // parameterized line would render its raw template.
  return ((key: string, params?: Readonly<Record<string, unknown>>) => {
    let text = ZH_COPY[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.split(`{${name}}`).join(String(value))
    }
    return text
  }) as unknown as Translate
}

/** How one surface titles and explains the rows. */
interface RowCopy {
  /** Copy of the shared form frame, plus the labels the custom rows draw. */
  readonly labels: Readonly<Record<string, string>>
  /** The row's title. */
  readonly title: (row: Row) => string
  /** The hint under the row. */
  readonly hint: (row: Row) => string
  /** An example shown greyed out while the input is empty, when the row has one. */
  readonly placeholder: (row: Row) => string | undefined
  /** One choice label of a segmented control. */
  readonly choice: (key: PromptEnhanceKey) => string
  /** One parameterized status line (dynamic reasoning tiers). */
  readonly interpolate: (key: PromptEnhanceKey, params: Record<string, string>) => string
}

/**
 * The settings dialog's copy: the raw config key first, then the localized
 * name in parentheses while the client is Chinese, and one single-language
 * hint. English mode drops the parenthesized Chinese name entirely — the key
 * alone is the title there.
 * @param t - the locale-bound translate seat.
 * @param chinese - whether the active locale is Chinese.
 * @returns the row copy for that language.
 */
function sectionCopy(t: Translate, chinese: boolean): RowCopy {
  return {
    labels: {
      unavailable: t('settings.unavailable'),
      readOnly: t('settings.readOnly'),
      saveFailed: t('settings.saveFailed'),
      save: t('settings.save'),
      saving: t('settings.saving'),
      saved: t('settings.saved'),
      reset: t('settings.reset'),
      invalidNumber: t('settings.invalidNumber'),
    },
    title: (row) => (chinese ? `${row.key}（${t(row.label)}）` : row.key),
    hint: (row) => t(row.hint),
    placeholder: (row) => (row.placeholder === undefined ? undefined : t(row.placeholder)),
    choice: (key) => t(key),
    interpolate: (key, params) => t(key, params),
  }
}

/**
 * The Plugins page's copy: the active locale's title and single-sentence hint,
 * as the host's own configuration pages read.
 * @param t - the injected translate seat.
 * @returns the row copy for that locale.
 */
function pageCopy(t: Translate): RowCopy {
  return {
    labels: {
      unavailable: t('settings.unavailable'),
      readOnly: t('settings.readOnly'),
      saveFailed: t('settings.saveFailed'),
      save: t('settings.save'),
      saving: t('settings.saving'),
      saved: t('settings.saved'),
      reset: t('settings.reset'),
      invalidNumber: t('settings.invalidNumber'),
    },
    title: (row) => t(row.label),
    hint: (row) => t(row.hint),
    placeholder: (row) => (row.placeholder === undefined ? undefined : t(row.placeholder)),
    choice: (key) => t(key),
    interpolate: (key, params) => t(key, params),
  }
}

/**
 * Inline copies of the host form's row metrics (the shell's `181ew` styles
 * module), so a switch or segmented row lines up with the text rows the
 * primitives render instead of looking like a foreign control.
 */
const ROW_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0' }
const HEAD_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const LABEL_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
}
const HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
}
/** Dynamic-tier status line under the reasoning control. */
const STATUS_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary, inherit)',
}
/** The neutral chip surface shared by the row's quiet actions. */
const CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  border: 'none',
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.12))',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '17px',
  color: 'var(--dsw-alias-label-secondary, inherit)',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  cursor: 'pointer',
}
/** The tier refetch action, in the same chip surface. */
const REFRESH_STYLE: CSSProperties = { ...CHIP_STYLE, flex: 'none' }
/** The reset action: the neutral chip surface, with an underline for affordance. */
const RESET_STYLE: CSSProperties = CHIP_STYLE
/** One border for every form control, so focus never changes the outline width. */
const FIELD_BORDER = '1px solid rgba(128, 128, 128, 0.38)'
/** The form input, mirroring the host's `input` metrics for a native control. */
const INPUT_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: 34,
  padding: '0 12px',
  border: FIELD_BORDER,
  borderRadius: 'var(--dsw-radius-md, 8px)',
  background: 'var(--dsw-alias-bg-layer-3, transparent)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
  outline: 'none',
}
/** The error line under an invalid numeric row. */
const INVALID_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-error-primary, #f85149)',
}
/** The warning line under the routing rows; saves are not blocked by it. */
const WARN_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-error-primary, #f85149)',
}
/** The provider/model select, sharing the value input's metrics. */
const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
}
const SEPARATOR_STYLE: CSSProperties = {
  borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24))',
}

/** Public repository behind this build, linked from the page header. */
const REPOSITORY_URL = 'https://github.com/surfishs/dsh-prompt-enhance'

/** Public npm package page, linked from the page header next to the repository. */
const NPM_URL = 'https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance'

/** The GitHub mark (16×16), painted with the current text color. */
const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z'

/** The npm mark (24×24), painted with the current text color. */
const NPM_MARK =
  'M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z'

/** The version this bundle was built from; guarded for environments without the define. */
const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0'

/** Header block: title, repository link, version, and one description line. */
const HEADER_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 0' }
const HEADER_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
const HEADER_TITLE_STYLE: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.012em',
  lineHeight: 1.3,
  color: 'var(--dsw-alias-label-primary, inherit)',
}
const HEADER_LINK_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  height: 18,
  padding: '0 7px',
  border: '1px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.35))',
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-layer-3, transparent)',
  fontSize: 10.5,
  fontWeight: 500,
  lineHeight: 1,
  color: 'var(--dsw-alias-label-secondary, inherit)',
  textDecoration: 'none',
}
const HEADER_VERSION_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 7px',
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-layer-4, transparent)',
  fontSize: 10.5,
  lineHeight: 1,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
  fontVariantNumeric: 'tabular-nums',
}
const HEADER_DESCRIPTION_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.65,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
  textWrap: 'pretty',
  maxWidth: '72ch',
}

/**
 * The page header the settings dialog shows above the form: the plugin title,
 * a repository link chip and the shipped version, with one description line.
 * @param props - the localized title and description, plus the version.
 * @returns the header element.
 */
function PageHeader(props: { title: string; description: string; version: string }): ReactElement {
  return (
    <div style={HEADER_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <span style={HEADER_TITLE_STYLE}>{props.title}</span>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" style={HEADER_LINK_STYLE}>
          <svg width={11} height={11} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path fill="currentColor" d={GITHUB_MARK} />
          </svg>
          GitHub
        </a>
        <a href={NPM_URL} target="_blank" rel="noreferrer" style={HEADER_LINK_STYLE}>
          <svg width={11} height={11} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d={NPM_MARK} />
          </svg>
          npm
        </a>
        <span style={HEADER_VERSION_STYLE}>v{props.version}</span>
      </div>
      <p style={HEADER_DESCRIPTION_STYLE}>{props.description}</p>
    </div>
  )
}

/** One projection of the pages' form store. */
interface SettingsSnapshot {
  writable?: boolean
  [key: string]: unknown
}

/** One row's projection inside that snapshot. */
interface FieldView {
  text: string
  overridden: boolean
  invalid: boolean
}

/** The staged form's actions, as both slots hand them over. */
interface FormProps {
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
interface LocaleSnapshotLike {
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
type SectionProps = FormProps & {
  /** The locale-bound translate seat this plugin projects into the page. */
  translate?: Translate
  /** Locale snapshot selector hook; re-renders the page when the language changes. */
  usePromptEnhanceLocale?: (selector: (snapshot: LocaleSnapshotLike) => LocaleSnapshotLike) => LocaleSnapshotLike
}

/** Props the plugin manager hands a configuration page. */
interface PageProps extends FormProps {
  /** Translate seat of this page's locale namespace, injected by the slot. */
  t?: Translate
  /** Which view the manager asks for: the form, or the one-line summary. */
  view?: 'page' | 'summary'
}

/** Props shared by every row component: the row, its copy, its state, its actions. */
interface RowProps {
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
  /** Stage new text for this row. */
  onEdit: (text: string) => void
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
function viewOf(snapshot: SettingsSnapshot, key: string): FieldView {
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
function atDefaultValue(key: string, text: string): boolean {
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

/**
 * The "overridden" badge and its reset button, as the text rows draw them.
 * @param props - the frame copy, whether writes are refused, and the reset handler.
 * @returns the badge pair.
 */
function OverrideActions(props: { copy: RowCopy; disabled: boolean; onReset: () => void }): ReactElement {
  return (
    <button
      type="button"
      style={{ ...RESET_STYLE, ...props.disabled ? { opacity: 0.5, cursor: 'default' } : {} }}
      disabled={props.disabled}
      onClick={props.onReset}
    >
      {props.copy.labels.reset}
    </button>
  )
}

/**
 * A boolean row: the title and the shell's switch on one line, the hint below.
 * @param props - the row, its copy, its state, and its actions.
 * @returns the row element.
 */
function BooleanRow(props: RowProps): ReactElement {
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
        <Switch
          checked={props.view.text === 'true'}
          disabled={props.disabled}
          label={props.label}
          onChange={(next: boolean) => props.onEdit(next ? 'true' : 'false')}
        />
      </div>
      <p style={HINT_STYLE}>{props.hint}</p>
    </div>
  )
}

/**
 * A fixed-choice row: the shell's segmented control under the title.
 * @param props - the row, its choices, its state, and its actions.
 * @returns the row element.
 */
function ChoiceRow(props: RowProps & { options: readonly { value: string; label: string; title?: string }[] }): ReactElement {
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SegmentedControl
        id={props.id}
        className="dsh-pe-segmented-labels"
        value={props.view.text}
        options={props.options.map((option) => ({ ...option, title: option.title ?? option.label }))}
        disabled={props.disabled}
        label={props.label}
        onChange={(next: string) => props.onEdit(next)}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
    </div>
  )
}

/**
 * The reasoning row: choices come from what the configured route declares.
 *
 * - Both provider/model empty → follow the default model; the host answers from
 *   its static DeepSeek catalog, or reports unavailable when the default is not
 *   DeepSeek. This path is not cached (the page cannot observe the default).
 * - A pinned pair → the answer is cached in `localStorage` with no TTL; it is
 *   replaced only when the pair changes or the user presses refresh.
 *
 * While the answer is pending, or when it is unavailable, the control offers
 * only "follow provider default" instead of guessing a tier list.
 * @param props - the row, its copy, state, actions, and the pinned pair.
 * @returns the row element.
 */
function ReasoningRow(props: RowProps & { provider: string; model: string }): ReactElement {
  const pair = props.provider !== '' && props.model !== '' ? `${props.provider}/${props.model}` : ''
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [capabilities, setCapabilities] = useState<ReasoningCapabilities | undefined>(undefined)
  const [refreshToken, setRefreshToken] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'refreshing' | 'ok' | 'failed'>('idle')
  const forceRef = useRef(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    const force = forceRef.current
    forceRef.current = false
    setPhase('loading')
    setCapabilities(undefined)
    setFeedback(force ? 'refreshing' : 'idle')
    if (feedbackTimer.current !== undefined) {
      clearTimeout(feedbackTimer.current)
      feedbackTimer.current = undefined
    }
    /** Settle the manual-refresh feedback; initial loads show no outcome. */
    const settle = (result: 'ok' | 'failed'): void => {
      if (!force) return
      setFeedback(result)
      feedbackTimer.current = setTimeout(() => {
        setFeedback('idle')
        feedbackTimer.current = undefined
      }, 3000)
    }
    fetchReasoningCapabilities(
      props.provider === '' ? undefined : props.provider,
      props.model === '' ? undefined : props.model,
      { refresh: force, signal: controller.signal },
    )
      .then((answer) => {
        if (controller.signal.aborted) return
        setCapabilities(answer)
        setPhase('ready')
        settle(answer.source === 'unavailable' ? 'failed' : 'ok')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCapabilities({ efforts: [], source: 'unavailable', reason: 'resolve-failed' })
        setPhase('ready')
        settle('failed')
      })
    return () => {
      controller.abort()
      if (feedbackTimer.current !== undefined) {
        clearTimeout(feedbackTimer.current)
        feedbackTimer.current = undefined
      }
    }
    // `pair` covers both ids; the default path reuses the empty string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, refreshToken])

  // Every provider — DeepSeek included — shows the adapter's own tier names;
  // only the "follow provider default" sentinel is plugin copy.
  const current = props.view.text
  const realTierKnown = phase === 'ready' && capabilities !== undefined && capabilities.source !== 'unavailable'
    && capabilities.efforts.some((effort) => effort.id === current)
  const noTiers = phase === 'ready' && capabilities !== undefined && capabilities.source === 'unavailable' && capabilities.reason === 'no-efforts'
  const options: { value: string; label: string; title?: string }[] = []
  // A value the route does not declare (stale config, or while the list is
  // still loading) is kept as a visible synthetic choice. Without it the
  // segmented control's indicator has no matching option and slides off the
  // left edge.
  if (!noTiers && current !== '' && current !== 'inherit' && !realTierKnown) {
    options.push({
      value: current,
      label: props.copy.interpolate('settings.reasoning.current', { value: current }),
      title: props.copy.choice('settings.reasoning.currentTitle'),
    })
  }
  if (phase === 'ready' && capabilities !== undefined && capabilities.source !== 'unavailable') {
    for (const effort of capabilities.efforts) {
      options.push({
        value: effort.id,
        label: effort.name,
        title: effort.description === undefined ? effort.name : `${effort.name} — ${effort.description}`,
      })
    }
  }
  options.push({
    value: 'inherit',
    label: props.copy.choice('settings.reasoning.inherit'),
    title: props.copy.choice('settings.reasoning.inherit'),
  })
  const unsupported = !noTiers && phase === 'ready' && capabilities?.source !== 'unavailable'
    && current !== '' && current !== 'inherit' && !realTierKnown
  const refreshing = feedback === 'refreshing'
  const refresh = (): void => {
    forceRef.current = true
    setRefreshToken((token) => token + 1)
  }
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {phase === 'ready' || refreshing
          ? (
              <button
                type="button"
                style={{ ...REFRESH_STYLE, opacity: props.disabled || refreshing ? 0.5 : 1 }}
                disabled={props.disabled || refreshing}
                onClick={refresh}
              >
                {props.copy.choice(refreshing ? 'settings.reasoning.refreshing' : 'settings.reasoning.refresh')}
              </button>
            )
          : null}
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SegmentedControl
        id={props.id}
        className="dsh-pe-segmented-labels"
        // A route that declares no tiers is presented as "follow provider
        // default"; the stored tier stays in the config and the host omits it
        // on the call, so the displayed state matches what actually happens.
        value={noTiers ? 'inherit' : props.view.text}
        options={options}
        // "Follow provider default" stays selectable while the tier list is
        // still loading; the tier choices themselves only appear once known.
        disabled={props.disabled}
        label={props.label}
        onChange={(next: string) => props.onEdit(next)}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
      {phase === 'loading' ? <p style={STATUS_STYLE}>{props.copy.choice('settings.reasoning.loading')}</p> : null}
      {phase === 'ready' && capabilities?.source === 'unavailable'
        ? <p style={STATUS_STYLE}>{props.copy.choice(noTiers ? 'settings.reasoning.noTiers' : 'settings.reasoning.unavailable')}</p>
        : null}
      {unsupported ? (
        <p style={STATUS_STYLE}>{props.copy.interpolate('settings.reasoning.unsupported', { effort: props.view.text })}</p>
      ) : null}
      {feedback === 'ok' ? <p style={STATUS_STYLE} aria-live="polite">{props.copy.choice('settings.reasoning.refreshOk')}</p> : null}
      {feedback === 'failed' ? <p style={STATUS_STYLE} aria-live="polite">{props.copy.choice('settings.reasoning.refreshFailed')}</p> : null}
    </div>
  )
}

/**
 * The shared select control: a 1px resting border (a hairline can vanish at
 * some scale factors) and a business-colour border while focused, so the
 * control's outline never depends on the browser's focus ring.
 */
function SelectControl(props: { id: string; value: string; disabled?: boolean; onChange: (value: string) => void; children: ReactNode }): ReactElement {
  const [focused, setFocused] = useState(false)
  return (
    <select
      id={props.id}
      style={{ ...SELECT_STYLE, ...focused ? { borderColor: 'var(--dsw-alias-state-business-primary, #4f8cff)' } : {} }}
      value={props.value}
      disabled={props.disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.children}
    </select>
  )
}

/**
 * The provider select: registered providers plus dormant ones rendered
 * disabled, and a synthetic entry for a stored value outside the registry.
 * @param props - the row, its state, and the catalog reads.
 * @returns the row element.
 */
function ProviderRow(props: RowProps & { routing: LlmRoutingState }): ReactElement {
  const current = props.view.text
  const known = props.routing.providers.entries.find((entry) => entry.id === current)
  const missing = current !== '' && known === undefined
  const unconfigured = known !== undefined && !known.registered
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>{props.label}</label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SelectControl id={props.id} value={current} disabled={props.disabled} onChange={(value) => props.onEdit(value)}>
        <option value="">{props.copy.choice('settings.routing.followSession')}</option>
        {missing ? <option value={current} title={current}>{props.copy.interpolate('settings.routing.currentProvider', { value: current })}</option> : null}
        <optgroup label={props.copy.choice('settings.routing.groupRegistered')}>
          {props.routing.providers.entries.filter((entry) => entry.registered).map((entry) => (
            <option key={entry.id} value={entry.id} title={entry.id}>{entry.name}</option>
          ))}
        </optgroup>
        {props.routing.providers.entries.some((entry) => !entry.registered)
          ? (
              <optgroup label={props.copy.choice('settings.routing.groupDormant')}>
                {props.routing.providers.entries.filter((entry) => !entry.registered).map((entry) => (
                  <option key={entry.id} value={entry.id} disabled title={props.copy.choice('settings.routing.unconfiguredTitle')}>
                    {entry.name}{props.copy.choice('settings.routing.unconfiguredSuffix')}
                  </option>
                ))}
              </optgroup>
            )
          : null}
      </SelectControl>
      <p style={HINT_STYLE}>{props.hint}</p>
      {props.routing.providers.loading ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.providersLoading')}</p> : null}
      {props.routing.providers.failed ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.providersFailed')}</p> : null}
      {props.routing.providers.failed ? (
        <button type="button" style={REFRESH_STYLE} onClick={props.routing.providers.reload}>
          {props.copy.choice('settings.routing.retry')}
        </button>
      ) : null}
      {missing ? <p style={WARN_STYLE}>{props.copy.interpolate('settings.routing.providerMissing', { value: current })}</p> : null}
      {unconfigured ? <p style={WARN_STYLE}>{props.copy.interpolate('settings.routing.providerUnconfigured', { name: known.name })}</p> : null}
    </div>
  )
}

/**
 * The model select: the provider's advertised models, a "custom…" entry that
 * reveals a free-text input, and warnings (incomplete pair / unresolvable
 * route) that never block saving.
 * @param props - the row, its state, the catalog reads, and the provider value.
 * @returns the row element.
 */
function ModelRow(props: RowProps & { routing: LlmRoutingState; providerValue: string }): ReactElement {
  const current = props.view.text
  const provider = props.providerValue
  const [customMode, setCustomMode] = useState(false)
  const known = props.routing.models.entries.some((entry) => entry.id === current)
  // A stored model outside the advertised catalog is still editable, so the
  // custom input opens automatically for it instead of hiding the value.
  const showCustom = provider !== '' && (customMode || (current !== '' && !known))
  const pairIncomplete = provider !== '' && current === ''
  const routeUnavailable = provider !== '' && current !== '' && props.routing.route.available === false
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>{props.label}</label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SelectControl
        id={props.id}
        value={showCustom ? '__custom__' : current}
        disabled={props.disabled || provider === ''}
        onChange={(value) => {
          if (value === '__custom__') {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          props.onEdit(value)
        }}
      >
        <option value="">{provider === '' ? props.copy.choice('settings.routing.followSession') : props.copy.choice('settings.routing.selectModel')}</option>
        {props.routing.models.entries.map((entry) => (
          <option key={entry.id} value={entry.id} title={entry.id}>{entry.name}</option>
        ))}
        {provider !== '' && current !== '' && !known
          ? <option value={current} title={current}>{props.copy.interpolate('settings.routing.currentModel', { value: current })}</option>
          : null}
        {provider !== '' ? <option value="__custom__">{props.copy.choice('settings.routing.custom')}</option> : null}
      </SelectControl>
      {showCustom ? (
        <TextControl
          value={current}
          placeholder={props.copy.choice('settings.routing.customPlaceholder')}
          disabled={props.disabled}
          onChange={props.onEdit}
        />
      ) : null}
      <p style={HINT_STYLE}>{props.hint}</p>
      {props.routing.models.loading ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.modelsLoading')}</p> : null}
      {props.routing.models.failed && !showCustom ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.modelsFailed')}</p> : null}
      {pairIncomplete ? <p style={WARN_STYLE}>{props.copy.choice('settings.routing.pairIncomplete')}</p> : null}
      {routeUnavailable ? <p style={WARN_STYLE}>{props.copy.choice('settings.routing.routeUnavailable')}</p> : null}
    </div>
  )
}

/**
 * A text/number row: the title and the reset chip on one line, a native input,
 * then the hint. The host's `SettingsValueField` draws its own badge and reset
 * link, which would diverge from the chip the other rows use, so value rows
 * share this control instead.
 * @param props - the row, its copy, state, and whether it is numeric.
 * @returns the row element.
 */
/**
 * The shared text/number control: the same 1px border as the selects, turning
 * the same business colour while focused (the invalid state wins over focus).
 */
function TextControl(props: {
  id?: string
  value: string
  placeholder?: string
  numeric?: boolean
  invalid?: boolean
  disabled?: boolean
  onChange: (value: string) => void
  onCommit?: () => void
}): ReactElement {
  const [focused, setFocused] = useState(false)
  const [revealedInvalid, setRevealedInvalid] = useState(false)
  useEffect(() => {
    if (props.invalid !== true) setRevealedInvalid(false)
  }, [props.invalid])
  const showInvalid = props.invalid === true && revealedInvalid
  const borderColor = showInvalid
    ? 'var(--dsw-alias-state-error-primary, #f85149)'
    : focused ? 'var(--dsw-alias-state-business-primary, #4f8cff)' : undefined
  return (
    <input
      id={props.id}
      type="text"
      inputMode={props.numeric === true ? 'numeric' : undefined}
      aria-invalid={showInvalid || undefined}
      disabled={props.disabled}
      placeholder={props.placeholder}
      value={props.value}
      style={{
        ...INPUT_STYLE,
        ...props.disabled === true ? { color: 'var(--dsw-alias-label-tertiary, inherit)', cursor: 'default' } : {},
        ...borderColor === undefined ? {} : { borderColor },
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (props.invalid === true) setRevealedInvalid(true)
        props.onCommit?.()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        if (props.invalid === true) setRevealedInvalid(true)
        props.onCommit?.()
      }}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )
}

function ValueRow(props: RowProps & { numeric: boolean; placeholder?: string }): ReactElement {
  const invalid = props.view.invalid
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>{props.label}</label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <TextControl
        id={props.id}
        value={props.view.text}
        placeholder={props.placeholder}
        numeric={props.numeric}
        invalid={invalid}
        disabled={props.disabled}
        onChange={props.onEdit}
        onCommit={props.onCommit}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
      {invalid ? <p style={INVALID_STYLE}>{props.copy.labels.invalidNumber}</p> : null}
    </div>
  )
}

/**
 * One row, rendered as the control its kind asks for.
 * @param props - the row, its copy, its state, its actions, and the pinned pair.
 * @returns the row element.
 */
function SettingsRow(props: { row: Row; copy: RowCopy; view: FieldView; disabled: boolean; reasoningPair: { provider: string; model: string }; routing: LlmRoutingState; providerValue: string; onEdit: (text: string) => void; onReset: () => void; onCommit?: () => void }): ReactElement {
  const shared = {
    id: `dsh-prompt-enhance-${props.row.key}`,
    label: props.copy.title(props.row),
    hint: props.copy.hint(props.row),
    copy: props.copy,
    view: props.view,
    disabled: props.disabled,
    onEdit: props.onEdit,
    onReset: props.onReset,
    onCommit: props.onCommit,
  }
  switch (props.row.kind) {
    case 'boolean':
      return <BooleanRow {...shared} />
    case 'strategy':
      return <ChoiceRow {...shared} options={STRATEGY_OPTIONS.map((option) => ({ value: option.value, label: props.copy.choice(option.label) }))} />
    case 'reasoning':
      return <ReasoningRow {...shared} provider={props.reasoningPair.provider} model={props.reasoningPair.model} />
    case 'provider':
      return <ProviderRow {...shared} routing={props.routing} />
    case 'model':
      return <ModelRow {...shared} routing={props.routing} providerValue={props.providerValue} />
    default:
      return <ValueRow {...shared} numeric={props.row.kind === 'number'} placeholder={props.copy.placeholder(props.row)} />
  }
}

/**
 * The rows of one page, wrapped in the shared form frame.
 * @param props - the copy, the snapshot, the form actions, and the frame's handlers.
 * @returns the form element.
 */
function SettingsRows(props: {
  copy: RowCopy
  state: SettingsSnapshot
  edit: (key: string, text: string) => void
  resetField: (key: string) => void
  save?: () => void
  discard?: () => void
  writeField?: (key: string, text: string) => Promise<'saved' | 'invalid' | 'failed'>
}): ReactElement {
  // The reasoning row reads the staged pair so options follow the fields before
  // they are saved (typing a custom model refreshes them on its own).
  const provider = viewOf(props.state, 'provider').text.trim()
  const model = viewOf(props.state, 'model').text.trim()
  const routing = useLlmRouting(provider, model)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const savedValues = useRef(new Map<string, string>())
  const sequence = useRef(0)

  useEffect(() => {
    for (const row of ROWS) {
      if (!savedValues.current.has(row.key)) {
        savedValues.current.set(row.key, viewOf(props.state, row.key).text)
      }
    }
  }, [props.state])

  const runSave = async (key: string, text: string): Promise<void> => {
    if (props.writeField === undefined) return
    // A focus/blur with no edit, or an edit reverted to the stored value, is
    // not a write: skip it without touching the footer status.
    if (savedValues.current.get(key) === text) return
    const ticket = ++sequence.current
    setSaveState('saving')
    const result = await props.writeField(key, text)
    if (ticket !== sequence.current) return
    if (result === 'invalid') {
      setSaveState('idle')
      return
    }
    if (result === 'failed') {
      setSaveState('failed')
      return
    }
    savedValues.current.set(key, text)
    setSaveState('saved')
    if (savedTimer.current !== undefined) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => {
      setSaveState('idle')
      savedTimer.current = undefined
    }, 2000)
  }

  const scheduleSave = (key: string, text: string, immediate: boolean): void => {
    const pending = timers.current.get(key)
    if (pending !== undefined) clearTimeout(pending)
    if (immediate) {
      timers.current.delete(key)
      void runSave(key, text)
      return
    }
    const timer = setTimeout(() => {
      timers.current.delete(key)
      void runSave(key, text)
    }, 800)
    timers.current.set(key, timer)
  }

  const onEdit = (key: string, text: string): void => {
    props.edit(key, text)
    const row = ROWS.find((item) => item.key === key)
    const debounced = row !== undefined && (row.kind === 'text' || row.kind === 'number')
    scheduleSave(key, text, !debounced)
  }

  const flushField = (key: string, text?: string): void => {
    const pending = timers.current.get(key)
    if (pending !== undefined) {
      clearTimeout(pending)
      timers.current.delete(key)
    }
    void runSave(key, text ?? viewOf(props.state, key).text)
  }

  useEffect(() => () => {
    for (const timer of timers.current.values()) clearTimeout(timer)
    timers.current.clear()
    if (savedTimer.current !== undefined) clearTimeout(savedTimer.current)
  }, [])

  const statusText = props.state.writable === false
    ? props.copy.labels.readOnly
    : saveState === 'saving'
      ? props.copy.labels.saving
      : saveState === 'saved'
        ? props.copy.labels.saved
        : saveState === 'failed'
          ? props.copy.labels.saveFailed
          : ''

  return (
    <div className="dsh-pe-form">
      {ROWS.map((row, index) => {
        const raw = viewOf(props.state, row.key)
        // Hide the override badge once the value is back at its default; the
        // host's `overridden` flag alone would keep it visible.
        const view = raw.overridden && atDefaultValue(row.key, raw.text) ? { ...raw, overridden: false } : raw
        return (
          <div key={row.key} style={index === 0 ? undefined : SEPARATOR_STYLE}>
            <SettingsRow
              row={row}
              copy={props.copy}
              view={view}
              disabled={!props.state.writable}
              reasoningPair={{ provider, model }}
              routing={routing}
              providerValue={provider}
              onEdit={(text: string) => onEdit(row.key, text)}
              onReset={() => props.resetField(row.key)}
              onCommit={() => flushField(row.key, viewOf(props.state, row.key).text)}
            />
          </div>
        )
      })}
      <div className="dsh-pe-form-footer">
        <span className="dsh-pe-save-status" role="status" aria-live="polite">{statusText}</span>
        <button
          type="button"
          className="dsh-pe-save-button"
          disabled={props.save === undefined || props.state.writable === false}
          onClick={props.save}
        >
          {props.copy.labels.save}
        </button>
      </div>
    </div>
  )
}

/**
 * Render the settings dialog's page: the diagnostic presentation over the same
 * staged form.
 * @param props - the form store hook and the form's actions.
 * @returns the page body.
 */
export function SettingsSection(props: SectionProps): unknown {
  const read = props.usePromptEnhance
  // Stable per mount: the host either projects the hook for this slot or it
  // does not, so this conditional never changes between renders of one mount.
  const state = read === undefined ? undefined : read((snapshot) => snapshot)
  const readLocale = props.usePromptEnhanceLocale
  const locale = readLocale === undefined ? undefined : readLocale((snapshot) => snapshot)
  const t = translator(props.translate)
  // Chinese keeps the raw key beside its name; every other locale shows the
  // key alone, since the parenthesized Chinese name would be noise there.
  const chinese = (locale?.active ?? 'zh').toLowerCase().startsWith('zh')
  if (state === undefined) {
    return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>{t('settings.disconnected')}</p>
  }
  const edit = props.edit ?? ((): void => {})
  const resetField = props.resetField ?? ((): void => {})
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader title={t('settings.title')} description={t('settings.description')} version={PLUGIN_VERSION} />
      <SettingsRows
        copy={sectionCopy(t, chinese)}
        state={state}
        edit={edit}
        resetField={resetField}
        save={props.save}
        discard={props.discard}
        writeField={props.writeField}
      />
    </div>
  )
}

/**
 * Render the Plugins page's configuration entry, or the one-line summary the
 * manager shows for the row's description.
 * @param props - the view asked for, the form store hook, and the form's actions.
 * @returns the page body, or the summary string.
 */
export function SettingsPage(props: PageProps): unknown {
  const t = translator(props.t)
  // Hooks stay unconditional: the manager renders this component in two
  // places (the row description and the row's page), and React may reuse one
  // mounted instance if that ever changes.
  const read = props.usePromptEnhance
  const state = read === undefined ? undefined : read((snapshot) => snapshot)
  if (props.view === 'summary') return t('settings.summary')
  if (state === undefined) {
    return <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>{t('settings.disconnected')}</p>
  }
  const edit = props.edit ?? ((): void => {})
  const resetField = props.resetField ?? ((): void => {})
  return (
    <SettingsRows
      copy={pageCopy(t)}
      state={state}
      edit={edit}
      resetField={resetField}
      save={props.save}
      discard={props.discard}
      writeField={props.writeField}
    />
  )
}

/** Structural face of one bound settings scope. */
interface ConfigScopeLike {
  getSnapshot?: () => unknown
  subscribe?: (listener: () => void) => () => void
  set?: (field: string, value: unknown) => Promise<boolean>
  unset?: (field: string) => Promise<boolean>
}

/** Structural face of the host's config-forms provider. */
interface ConfigFormsLike {
  get?: (entryId: string) => ConfigScopeLike | undefined
  whileServed?: (namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void) => () => void
}

/** Structural face of the slot registry. */
interface SlotsFace {
  inject: (name: string, callback: () => unknown) => unknown
  register: (spec: Record<string, unknown>, component: unknown) => () => void
}

/** Bridges one settings scope onto both pages' staged form. */
class SettingsPageController {
  private readonly form: SettingsFormModel
  private readonly scope: ConfigScopeLike
  private readonly store: unknown
  private readonly getLocale: (() => LocaleFaceLike | undefined) | undefined

  /**
   * @param scope - the scope of the entry the host serves this plugin under.
   * @param getLocale - resolves the client locale service, when one is mounted.
   */
  constructor(scope: ConfigScopeLike, getLocale?: () => LocaleFaceLike | undefined) {
    this.getLocale = getLocale
    this.scope = scope
    this.form = createSettingsForm(scope)
    this.store = this.form.bind(() => {
      const out = this.form.shell()
      for (const row of ROWS) {
        try {
          out[row.key] = this.form.field(row.key)
        } catch {
          // A key the host schema does not declare: the row stays absent.
        }
      }
      return out
    })
  }

  /** The props the slots hand their pages. */
  inject(): Record<string, unknown> {
    const face = this.getLocale?.()
    const props: Record<string, unknown> = {
      hooks: { promptEnhance: this.store },
      ...this.form.actions(),
      writeField: (key: string, text: string) => this.writeField(key, text),
    }
    if (face !== undefined) {
      // A small observable the slot turns into `usePromptEnhanceLocale`; the
      // page reads the active language from it and re-renders on a switch.
      ;(props.hooks as Record<string, unknown>).promptEnhanceLocale = {
        getSnapshot: () => face.getSnapshot(),
        subscribe: (listener: () => void) => face.subscribe(listener),
      }
      props.translate = face.bind(LOCALE_NS)
    }
    return props
  }

  /** Write one field through the host's per-field mutation API. */
  private async writeField(key: string, text: string): Promise<'saved' | 'invalid' | 'failed'> {
    const descriptor = FIELD_SPECS.find((item) => item.field === key)
    if (descriptor === undefined) return 'failed'
    const parsed = descriptor.parse(text)
    if (parsed === undefined) return 'invalid'
    if (this.scope.set === undefined) return 'failed'
    try {
      if (parsed.kind === 'clear') {
        if (this.scope.unset === undefined) return 'failed'
        if (!(await this.scope.unset(key))) return 'failed'
      } else {
        if (!(await this.scope.set(key, parsed.value))) return 'failed'
      }
      return 'saved'
    } catch {
      return 'failed'
    }
  }

  /** Release the form's subscriptions. */
  dispose(): void {
    try {
      this.form.dispose()
    } catch {
      // Already released with the settings service.
    }
  }
}

/**
 * Mount both configuration surfaces of the plugin.
 *
 * The settings-dialog page registers eagerly (the frame renders its own
 * unavailable notice until the namespace is served), while the Plugins-page
 * entry registers only while the host serves the namespace — a deployment that
 * never composed the host half shows no configure control at all. Every step is
 * optional: a host without the forms service or the slot registry simply shows
 * no page and keeps the composition config, which is the documented fallback.
 * @param ctx - the browser plugin context.
 * @param getLocale - resolves the client locale service when one is mounted.
 */
export function installSettingsPages(ctx: ClientContext, getLocale?: () => LocaleFaceLike | undefined): void {
  ctx.inject(['configForms', 'slots'], (servicesCtx: ClientContext) => {
    const services = servicesCtx as unknown as { configForms?: ConfigFormsLike; slots?: SlotsFace }
    const forms = services.configForms
    const slots = services.slots
    if (forms === undefined || typeof forms.get !== 'function' || slots === undefined) return
    let controller: SettingsPageController
    try {
      const scope = forms.get(SETTINGS_NAMESPACE)
      if (scope === undefined) return
      controller = new SettingsPageController(scope, getLocale)
    } catch (error) {
      console.warn('[dsh-prompt-enhance] settings form failed; both configuration pages stay off.', error)
      return
    }
    ctx.effect(() => () => controller.dispose(), 'dsh-prompt-enhance: settings form')

    // The Settings dialog's page, unchanged in behaviour: a fresh id puts it
    // beside the shipped sections, and the frame handles an unloaded plugin.
    ctx.effect(() => {
      const stop = slots.inject(
        SETTINGS_SECTION_SLOT,
        () =>
          slots.register(
            {
              name: SETTINGS_SECTION_SLOT,
              id: SETTINGS_SECTION_ID,
              order: SETTINGS_SECTION_ORDER,
              label: () => sectionTitle(getLocale),
              locale: LOCALE_NS,
              inject: () => controller.inject(),
            },
            SettingsSection,
          ),
      ) as () => void
      return stop
    }, 'dsh-prompt-enhance: settings section')

    // The Plugins page's per-row configuration entry. `whileServed` keeps it
    // alive only while the namespace exists, so the control is never offered
    // for a namespace the Host does not serve.
    const whileServed = typeof forms.whileServed === 'function' ? forms.whileServed.bind(forms) : undefined
    const registerRowPage = (): (() => void) => {
      const stop = slots.inject(
        SETTINGS_ROW_CONFIG_SLOT,
        () =>
          slots.register(
            {
              name: SETTINGS_ROW_CONFIG_SLOT,
              key: SETTINGS_ROW_CONFIG_KEY,
              locale: LOCALE_NS,
              inject: () => controller.inject(),
            },
            SettingsPage,
          ),
      ) as () => void
      return stop
    }
    if (whileServed !== undefined) {
      ctx.effect(() => whileServed([SETTINGS_NAMESPACE], () => registerRowPage()), 'dsh-prompt-enhance: settings row page')
      return
    }
    // A host without `whileServed` (pre-0.2.1): register once.
    ctx.effect(() => registerRowPage(), 'dsh-prompt-enhance: settings row page')
  })
}
