/**
 * Behavioural double for the web shell's `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The real package is compiled into the dsh web shell: the browser bundle
 * imports it at runtime and never installs it. Vitest resolves imports while
 * transforming, so `vitest.config.ts` aliases the specifier here.
 *
 * The `SettingsFormModel` half is a port of the shell's own staged-form
 * contract (read from `dsh-web-frontend` of 0.2.2-rc.1), kept faithfully rather
 * than loosened: descriptors are `{ field, format, parse }`, a blank or cleared
 * field becomes an `unset` op, a staged text equal to the stored value's
 * `format` is not a change, and one `mutate` call carries every op at save
 * time. A looser double would let a page stage a string where the real form
 * writes a boolean, which is exactly the mistake a settings page makes.
 *
 * The presentational exports are intentionally thin: they keep the real
 * elements' roles and accessible names (`switch`, `tab`, `textbox`) so a test
 * queries the page the way the shell's own markup, not this file's layout,
 * decides.
 * @module tests/support/ui-primitives
 */

import { createElement, useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** What one parse answer tells the staged form to write. */
export type SettingsFieldParse = { kind: 'clear' } | { kind: 'set'; value: unknown }

/** How a config key renders and how staged text turns back into a value. */
export interface SettingsFieldDescriptor {
  readonly field: string
  format(value: unknown): string
  parse(text: string): SettingsFieldParse | undefined
}

/**
 * A text descriptor, matching the bundled helper.
 * @param field - the config key.
 * @returns the descriptor.
 */
export function settingsTextField(field: string): SettingsFieldDescriptor {
  return {
    field,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

/**
 * A numeric descriptor, matching the bundled helper.
 * @param field - the config key.
 * @returns the descriptor.
 */
export function settingsNumberField(field: string): SettingsFieldDescriptor {
  return {
    field,
    format: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const value = Number(trimmed)
      return Number.isFinite(value) ? { kind: 'set', value } : undefined
    },
  }
}

/** One namespace mutation, in the Host's wire shape. */
export interface SettingsPathOp {
  op: 'set' | 'unset'
  path: readonly string[]
  value?: unknown
}

/** Snapshot of the bound settings scope. */
export interface ScopeSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value?: Record<string, unknown>
  base?: Record<string, unknown>
  user?: Record<string, unknown>
  revision?: number
  writable: boolean
}

/** Structural face of the settings scope a staged form reads and writes. */
export interface ScopeLike {
  getSnapshot(): ScopeSnapshot
  subscribe(listener: () => void): () => void
  mutate(ops: readonly SettingsPathOp[], revision?: number): Promise<boolean>
}

/** A staged change: new text, and whether the user asked to clear the field. */
interface StagedField {
  text: string
  clear: boolean
}

/** One planned write; a row with neither an op nor a run is invalid. */
interface PlannedWrite {
  field: string
  op?: SettingsPathOp
  run?: () => Promise<boolean>
}

/** The store a bound form exposes to the page's selector hook. */
export interface SettingsStore {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

/** Staged form over one settings scope. */
export class SettingsFormModel {
  private readonly scope: ScopeLike
  private readonly specs: Map<string, SettingsFieldDescriptor>
  private readonly secretSpecs: Map<string, SettingsFieldDescriptor>
  private readonly staged = new Map<string, StagedField>()
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private saving = false
  private failed = false

  /**
   * @param scope - the bound settings scope.
   * @param fields - descriptors of the visible fields.
   * @param secretFields - descriptors whose values are written through a secret channel.
   */
  constructor(scope: ScopeLike, fields: readonly SettingsFieldDescriptor[], secretFields: readonly SettingsFieldDescriptor[] = []) {
    this.scope = scope
    this.specs = new Map(fields.map((field) => [field.field, field]))
    this.secretSpecs = new Map(secretFields.map((field) => [field.field, field]))
    this.unsubscribe = scope.subscribe(() => this.publish())
  }

  /**
   * Project the form onto a store the page reads through its hook.
   * @param project - builds the page's snapshot.
   * @returns the store handed to the page.
   */
  bind(project: () => unknown): SettingsStore {
    let snapshot = project()
    const subscribers = new Set<() => void>()
    this.listeners.add(() => {
      snapshot = project()
      for (const subscriber of subscribers) subscriber()
    })
    return {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        subscribers.add(listener)
        return () => {
          subscribers.delete(listener)
        }
      },
    }
  }

  /** @returns the frame's state flags. */
  shell(): { available: boolean; writable: boolean; dirty: boolean; invalid: boolean; saving: boolean; failed: boolean } {
    const snapshot = this.scope.getSnapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((entry) => entry.run === undefined && entry.op === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  /**
   * Project one row.
   * @param key - the config key.
   * @returns its text form and staging flags.
   */
  field(key: string): { text: string; overridden: boolean; invalid: boolean } {
    const staged = this.staged.get(key)
    if (this.secretSpecs.has(key)) return { text: staged?.text ?? '', overridden: false, invalid: false }
    const spec = this.spec(key)
    if (staged === undefined) {
      return { text: spec.format(this.sectionValue(key)), overridden: this.stored(key), invalid: false }
    }
    const parsed = staged.clear ? ({ kind: 'clear' } as const) : spec.parse(staged.text)
    return { text: staged.text, overridden: parsed?.kind === 'set', invalid: parsed === undefined }
  }

  /** @returns the handlers the page calls. */
  actions(): {
    edit: (key: string, text: string) => void
    resetField: (key: string) => void
    save: () => Promise<void>
    discard: () => void
  } {
    return {
      edit: (key, text) => this.stage(key, { text, clear: false }),
      resetField: (key) => this.stage(key, { text: this.spec(key).format(this.baseValue(key)), clear: true }),
      save: () => this.save(),
      discard: () => {
        if (this.staged.size === 0 && !this.failed) return
        this.staged.clear()
        this.failed = false
        this.publish()
      },
    }
  }

  /** Write every staged change in one mutation. */
  async save(): Promise<void> {
    const plan = this.plan()
    const scope = this.scope.getSnapshot()
    if (plan.length === 0 || this.saving || !scope.writable) return
    if (plan.some((entry) => entry.run === undefined && entry.op === undefined)) return
    this.saving = true
    this.failed = false
    this.publish()
    try {
      const ops = plan.flatMap((entry) => (entry.op === undefined ? [] : [entry.op]))
      let accepted = ops.length === 0 || (await this.scope.mutate(ops))
      if (!accepted) {
        this.failed = true
        return
      }
      for (const entry of plan) {
        if (entry.run !== undefined) accepted = (await entry.run()) && accepted
      }
      if (accepted) this.staged.clear()
      this.failed = !accepted
    } catch {
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  /** Stop deriving from the scope. */
  dispose(): void {
    this.unsubscribe()
    this.listeners.clear()
  }

  /** @returns the writes a save would emit right now. */
  plan(): PlannedWrite[] {
    const plan: PlannedWrite[] = []
    for (const [key, staged] of this.staged) {
      if (this.secretSpecs.has(key)) continue
      const spec = this.spec(key)
      if (staged.clear) {
        if (this.stored(key)) plan.push({ field: key, op: { op: 'unset', path: [key] } })
        continue
      }
      if (staged.text === spec.format(this.sectionValue(key))) continue
      const parsed = spec.parse(staged.text)
      if (parsed === undefined) plan.push({ field: key })
      else if (parsed.kind === 'clear') plan.push({ field: key, op: { op: 'unset', path: [key] } })
      else plan.push({ field: key, op: { op: 'set', path: [key], value: parsed.value } })
    }
    return plan
  }

  private stage(key: string, staged: StagedField): void {
    this.staged.set(key, staged)
    this.failed = false
    this.publish()
  }

  private spec(key: string): SettingsFieldDescriptor {
    const spec = this.specs.get(key)
    if (spec === undefined) throw new Error(`settings form has no field ${key}`)
    return spec
  }

  private sectionValue(key: string): unknown {
    return this.scope.getSnapshot().value?.[key]
  }

  private baseValue(key: string): unknown {
    return this.scope.getSnapshot().base?.[key]
  }

  private stored(key: string): boolean {
    const user = this.scope.getSnapshot().user
    return user !== undefined && Object.hasOwn(user, key)
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}

/** Frame state the form renders. */
export interface FrameState {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
}

/** Props of the form frame. */
interface FrameProps {
  labels: Record<string, string>
  state: FrameState
  onSave?: () => void
  onDiscard?: () => void
  children?: ReactNode
}

/**
 * The form frame: read-only notice, children, save button, and the
 * discard-on-unmount the shell's own frame performs.
 * @param props - copy, state, and the form's actions.
 * @returns the frame.
 */
export function SettingsForm(props: FrameProps): ReactElement {
  const discard = useRef(props.onDiscard)
  discard.current = props.onDiscard
  useEffect(() => () => discard.current?.(), [])
  if (!props.state.available) return createElement('p', { role: 'status' }, props.labels.unavailable)
  const saveDisabled = !props.state.dirty || props.state.invalid || props.state.saving
  return createElement(
    'div',
    null,
    props.state.writable ? null : createElement('p', { role: 'status' }, props.labels.readOnly),
    props.children,
    createElement(
      'div',
      null,
      props.state.failed ? createElement('p', { role: 'status' }, props.labels.saveFailed) : null,
      createElement('button', { type: 'button', disabled: saveDisabled, onClick: props.onSave }, props.state.saving ? props.labels.saving : props.labels.save),
    ),
  )
}

/** Props of one text row. */
interface ValueFieldProps {
  id: string
  label: string
  hint?: string
  placeholder?: string
  text: string
  numeric?: boolean
  disabled?: boolean
  overridden?: boolean
  overriddenLabel?: string
  resetLabel?: string
  invalid?: boolean
  invalidLabel?: string
  onEdit: (text: string) => void
  onReset?: () => void
}

/** One labelled text row. */
export function SettingsValueField(props: ValueFieldProps): ReactElement {
  return createElement(
    'div',
    null,
    createElement('label', { htmlFor: props.id }, props.label),
    props.overridden === true
      ? createElement('span', null, createElement('span', null, props.overriddenLabel), createElement('button', { type: 'button', disabled: props.disabled, onClick: props.onReset }, props.resetLabel))
      : null,
    createElement('input', {
      id: props.id,
      type: 'text',
      inputMode: props.numeric === true ? 'numeric' : undefined,
      placeholder: props.placeholder,
      value: props.text,
      disabled: props.disabled,
      'aria-invalid': props.invalid === true ? true : undefined,
      onChange: (event: { target: { value: string } }) => props.onEdit(event.target.value),
    }),
    props.invalid === true ? createElement('p', null, props.invalidLabel) : props.hint !== undefined ? createElement('p', null, props.hint) : null,
  )
}

/** One labelled password row. */
export function SettingsSecretField(props: { id: string; label: string; hint?: string; text: string; disabled?: boolean; onEdit: (text: string) => void }): ReactElement {
  return createElement(
    'div',
    null,
    createElement('label', { htmlFor: props.id }, props.label),
    createElement('input', {
      id: props.id,
      type: 'password',
      value: props.text,
      disabled: props.disabled,
      onChange: (event: { target: { value: string } }) => props.onEdit(event.target.value),
    }),
    props.hint === undefined ? null : createElement('p', null, props.hint),
  )
}

/** The shell's on/off control. */
export function Switch(props: { checked: boolean; onChange: (next: boolean) => void; label?: string; disabled?: boolean; title?: string }): ReactElement {
  return createElement('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': props.checked,
    'aria-label': props.label,
    title: props.title,
    disabled: props.disabled,
    onClick: () => props.onChange(!props.checked),
  })
}

/** The shell's segmented choice control. */
export function SegmentedControl(props: {
  id: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (next: string) => void
  label?: string
  disabled?: boolean
}): ReactElement {
  return createElement(
    'div',
    { role: 'tablist', 'aria-label': props.label },
    props.options.map((option) =>
      createElement(
        'button',
        {
          key: option.value,
          id: `${props.id}-${option.value}`,
          type: 'button',
          role: 'tab',
          'aria-selected': option.value === props.value,
          disabled: props.disabled,
          onClick: () => {
            if (option.value !== props.value) props.onChange(option.value)
          },
        },
        option.label,
      ),
    ),
  )
}

/** The shell's small status tag. */
export function Tag(props: { tone?: string; children?: ReactNode }): ReactElement {
  return createElement('span', { 'data-tone': props.tone }, props.children)
}

/** Re-exported so a test can drive a real browser-shaped store if it needs one. */
export { useSyncExternalStore }
