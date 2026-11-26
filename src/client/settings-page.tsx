/**
 * The plugin's two configuration surfaces — the Settings dialog section and the
 * plugin row's config page — rendered over one staged form.
 *
 * This module owns the rendering, the page registration, and the re-exports the
 * rest of the plugin imports. The row table lives in `settings-page-spec`, the
 * copy in `settings-page-copy`, the inline styles in `settings-page-styles`, and
 * the per-kind row controls in `settings-page-controls`.
 * @module dsh-prompt-enhance/client/settings-page
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { SettingsFormModel } from '@deepseek-ai/dsh-client-ui-primitives'
import type {} from '../shared/reasoning'
import { useLlmRouting } from './llm-catalog'
import type { LlmRoutingState } from './llm-catalog'
import { NS as LOCALE_NS } from './locales'

import {
  ADVANCED_ROWS,
  BASIC_ROWS,
  FIELD_SPECS,
  MODE_OPTIONS,
  ROWS,
  SETTINGS_NAMESPACE,
  SETTINGS_ROW_CONFIG_KEY,
  SETTINGS_ROW_CONFIG_SLOT,
  SETTINGS_SECTION_ID,
  SETTINGS_SECTION_LABEL,
  SETTINGS_SECTION_ORDER,
  SETTINGS_SECTION_SLOT,
  STRATEGY_OPTIONS,
  atDefaultValue,
  createSettingsForm,
  defaultTextOf,
  viewOf,
} from './settings-page-spec'
import type { FieldView, LocaleFaceLike, PageProps, Row, SectionProps, SettingsSnapshot } from './settings-page-spec'
import { pageCopy, sectionCopy, translator } from './settings-page-copy'
import type { RowCopy } from './settings-page-copy'
import { BooleanRow, ChoiceRow, ModelRow, ProviderRow, ReasoningRow, ValueRow } from './settings-page-controls'
import {
  HEADER_DESCRIPTION_STYLE,
  HEADER_ROW_STYLE,
  HEADER_STYLE,
  HEADER_TITLE_STYLE,
  HEADER_VERSION_STYLE,
  ISSUE_URL,
  NPM_MARK,
  NPM_URL,
  PLUGIN_VERSION,
  REPOSITORY_URL,
  SEPARATOR_STYLE,
  GITHUB_MARK,
} from './settings-page-styles'

export { SETTINGS_ROW_CONFIG_KEY, SETTINGS_ROW_CONFIG_SLOT, SETTINGS_SECTION_ID, SETTINGS_SECTION_LABEL, SETTINGS_SECTION_ORDER, SETTINGS_SECTION_SLOT } from './settings-page-spec'
export { createSettingsForm } from './settings-page-spec'
export type { LocaleFaceLike } from './settings-page-spec'

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

/**
 * The page header the settings dialog shows above the form: the plugin title,
 * a repository link chip and the shipped version, with one description line.
 * @param props - the localized title and description, plus the version.
 * @returns the header element.
 */
function PageHeader(props: { title: string; description: string; issue: string; version: string }): ReactElement {
  return (
    <div style={HEADER_STYLE}>
      <div style={HEADER_ROW_STYLE}>
        <span style={HEADER_TITLE_STYLE}>{props.title}</span>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="dsh-pe-header-link">
          <svg width={11} height={11} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path fill="currentColor" d={GITHUB_MARK} />
          </svg>
          GitHub
        </a>
        <a href={NPM_URL} target="_blank" rel="noreferrer" className="dsh-pe-header-link">
          <svg width={11} height={11} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d={NPM_MARK} />
          </svg>
          npm
        </a>
        <a href={ISSUE_URL} target="_blank" rel="noreferrer" className="dsh-pe-header-link">
          <svg width={11} height={11} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M2.8 2h7l3.4 3.4V14H2.8zM9.8 2v3.4h3.4M5.2 8.6h5.6M5.2 11.2h5.6" />
          </svg>
          {props.issue}
        </a>
        <span style={HEADER_VERSION_STYLE}>v{props.version}</span>
      </div>
      <p style={HEADER_DESCRIPTION_STYLE}>{props.description}</p>
    </div>
  )
}

/**
 * The red-box reason for a staged row, or undefined when the text is writable.
 * @param row - the row being rendered.
 * @param text - its staged text.
 * @param copy - the page copy, for the row-specific message.
 * @returns the message to show inline, or undefined.
 */
function invalidMessageOf(row: Row, text: string, copy: RowCopy): string | undefined {
  if (row.validate === undefined || row.validate(text)) return undefined
  if (row.range !== undefined) {
    const key = row.range.integer === false ? 'settings.row.invalidNumber' : 'settings.row.invalidInteger'
    return copy.interpolate(key, { min: String(row.range.min), max: String(row.range.max) })
  }
  return copy.labels.invalidShortcut
}

/**
 * The input placeholder for one row. A numeric row that is empty shows the
 * effective default, so "blank" visibly means "use the default" instead of
 * looking like a silent clear.
 * @param row - the row being rendered.
 * @param view - its staged state.
 * @param copy - the page copy, for the placeholder text.
 * @returns the placeholder, or undefined.
 */
function placeholderOf(row: Row, view: FieldView, copy: RowCopy): string | undefined {
  if (row.kind !== 'number' || view.text.trim() !== '') return copy.placeholder(row)
  const fallback = defaultTextOf(row.key)
  return fallback === '' ? copy.placeholder(row) : copy.interpolate('settings.row.blankDefault', { value: fallback })
}

/**
 * One row, rendered as the control its kind asks for.
 * @param props - the row, its copy, its state, its actions, and the pinned pair.
 * @returns the row element.
 */
function SettingsRow(props: {
  row: Row
  copy: RowCopy
  view: FieldView
  disabled: boolean
  reasoningPair: { provider: string; model: string }
  routing: LlmRoutingState
  providerValue: string
  onEdit: (text: string) => void
  onReset: () => void
  onCommit?: () => void
}): ReactElement {
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
    case 'mode':
      return <ChoiceRow {...shared} options={MODE_OPTIONS.map((option) => ({ value: option.value, label: props.copy.choice(option.label) }))} />
    case 'reasoning':
      return <ReasoningRow {...shared} provider={props.reasoningPair.provider} model={props.reasoningPair.model} />
    case 'provider':
      return <ProviderRow {...shared} routing={props.routing} />
    case 'model':
      return <ModelRow {...shared} routing={props.routing} providerValue={props.providerValue} />
    default:
      return (
        <ValueRow
          {...shared}
          numeric={props.row.kind === 'number'}
          multiline={props.row.multiline === true}
          placeholder={placeholderOf(props.row, props.view, props.copy)}
          invalidMessage={invalidMessageOf(props.row, props.view.text, props.copy)}
          recordable={props.row.recordable === true}
        />
      )
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

  const isStagedInvalid = (key: string, text: string): boolean => {
    const row = ROWS.find((item) => item.key === key)
    return row?.validate !== undefined && !row.validate(text)
  }

  const hasStagedInvalid = (): boolean => ROWS.some((row) => row.validate !== undefined && !row.validate(viewOf(props.state, row.key).text))

  const runSave = async (key: string, text: string): Promise<void> => {
    if (props.writeField === undefined) return
    // A row whose staged text fails its own validation is never written: the row
    // explains why, and the value already in the config keeps working.
    if (isStagedInvalid(key, text)) {
      setSaveState('idle')
      return
    }
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
    markSaved()
  }

  const markSaved = (): void => {
    setSaveState('saved')
    if (savedTimer.current !== undefined) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => {
      setSaveState('idle')
      savedTimer.current = undefined
    }, 2000)
  }

  const runReset = async (key: string, fallback: string): Promise<void> => {
    if (props.writeField === undefined) return
    const ticket = ++sequence.current
    setSaveState('saving')
    const result = await props.writeField(key, '')
    if (ticket !== sequence.current) return
    if (result === 'failed') {
      setSaveState('failed')
      return
    }
    if (result === 'invalid') {
      setSaveState('idle')
      return
    }
    savedValues.current.set(key, fallback)
    markSaved()
  }

  /**
   * The rows a reset of key also clears. provider and model are one pair:
   * clearing the provider leaves a model its (now empty) provider can no longer
   * offer, so the select falls back to drawing its first option ("follow
   * session") while the staged value — and its reset chip — stay behind. The
   * pair is reset together so the control and its chip report the same state.
   */
  const resetTargets = (key: string): string[] => (key === 'provider' && viewOf(props.state, 'model').text !== '' ? ['provider', 'model'] : [key])

  const resetAndSave = (key: string): void => {
    const targets = resetTargets(key)
    for (const target of targets) {
      props.resetField(target)
      savedValues.current.set(target, defaultTextOf(target))
    }
    // Sequential: runReset takes a sequence ticket per call, and awaiting keeps
    // the provider write from being superseded by the model write.
    void (async () => {
      for (const target of targets) await runReset(target, defaultTextOf(target))
    })()
  }

  const manualSave = async (): Promise<void> => {
    if (props.writeField === undefined) {
      // Hosts without per-field writes keep the original whole-form action — but
      // an invalid row must not ride along, so the save is refused until it is
      // fixed or cleared.
      if (hasStagedInvalid()) {
        setSaveState('idle')
        return
      }
      props.save?.()
      markSaved()
      return
    }
    const changed = ROWS.map((row) => ({ key: row.key, text: viewOf(props.state, row.key).text })).filter(
      (item) => savedValues.current.get(item.key) !== item.text && !isStagedInvalid(item.key, item.text),
    )
    if (changed.length === 0) {
      if (hasStagedInvalid()) {
        setSaveState('idle')
        return
      }
      markSaved()
      return
    }
    const ticket = ++sequence.current
    setSaveState('saving')
    let failed = false
    let invalid = false
    for (const item of changed) {
      const result = await props.writeField(item.key, item.text)
      if (result === 'saved') savedValues.current.set(item.key, item.text)
      else if (result === 'failed') failed = true
      else invalid = true
    }
    if (ticket !== sequence.current) return
    if (failed) setSaveState('failed')
    else if (invalid && changed.every((item) => savedValues.current.get(item.key) !== item.text)) setSaveState('idle')
    else markSaved()
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

  const onEdit = (key: string, text: string, options?: { deferred?: boolean }): void => {
    const previousProvider = key === 'provider' ? viewOf(props.state, 'provider').text : ''
    props.edit(key, text)
    // provider and model are one unit: a hand-typed model id belongs to the
    // provider it was typed for, so switching providers clears it instead of
    // leaving a value the new provider cannot serve (and a stale reset chip).
    if (key === 'provider' && text !== previousProvider && viewOf(props.state, 'model').text !== '') {
      props.resetField('model')
      savedValues.current.set('model', '')
      void runReset('model', '')
    }
    const row = ROWS.find((item) => item.key === key)
    const typing = row !== undefined && (row.kind === 'text' || row.kind === 'number')
    const debounced = options?.deferred === true || typing
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

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer)
      timers.current.clear()
      if (savedTimer.current !== undefined) clearTimeout(savedTimer.current)
    },
    [],
  )

  const statusText =
    props.state.writable === false
      ? props.copy.labels.readOnly
      : saveState === 'saving'
        ? props.copy.labels.saving
        : saveState === 'saved'
          ? props.copy.labels.saved
          : saveState === 'failed'
            ? props.copy.labels.saveFailedShort
            : ''

  const renderRow = (row: Row, index: number): ReactElement => {
    const raw = viewOf(props.state, row.key)
    // Hide the override badge once the value is back at its default; the
    // host's `overridden` flag alone would keep it visible.
    const view = raw.overridden && atDefaultValue(row.key, raw.text) ? { ...raw, overridden: false } : raw
    return (
      <div key={row.key} className="dsh-pe-field-row" style={index === 0 ? undefined : SEPARATOR_STYLE}>
        <SettingsRow
          row={row}
          copy={props.copy}
          view={view}
          disabled={!props.state.writable}
          reasoningPair={{ provider, model }}
          routing={routing}
          providerValue={provider}
          onEdit={(text: string, options?: { deferred?: boolean }) => onEdit(row.key, text, options)}
          onReset={() => resetAndSave(row.key)}
          onCommit={() => flushField(row.key, viewOf(props.state, row.key).text)}
        />
      </div>
    )
  }

  return (
    <div className="dsh-pe-form">
      {BASIC_ROWS.map(renderRow)}
      <details className="dsh-pe-advanced">
        <summary>{props.copy.labels.advanced}</summary>
        {ADVANCED_ROWS.map(renderRow)}
      </details>
      <div className="dsh-pe-form-footer">
        <div className="dsh-pe-save-group">
          {statusText === '' ? null : (
            <span className="dsh-pe-save-status" role="status" aria-live="polite">
              {statusText}
            </span>
          )}
          <button
            type="button"
            className="dsh-pe-save-button"
            disabled={props.save === undefined || props.state.writable === false}
            onClick={() => {
              void manualSave()
            }}
          >
            {props.copy.labels.save}
          </button>
        </div>
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
      <PageHeader title={t('settings.title')} description={t('settings.description')} issue={t('settings.issue')} version={PLUGIN_VERSION} />
      <SettingsRows copy={sectionCopy(t, chinese)} state={state} edit={edit} resetField={resetField} save={props.save} discard={props.discard} writeField={props.writeField} />
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
  return <SettingsRows copy={pageCopy(t)} state={state} edit={edit} resetField={resetField} save={props.save} discard={props.discard} writeField={props.writeField} />
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
      const stop = slots.inject(SETTINGS_SECTION_SLOT, () =>
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
      const stop = slots.inject(SETTINGS_ROW_CONFIG_SLOT, () =>
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
