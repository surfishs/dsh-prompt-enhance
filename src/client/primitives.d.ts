/**
 * Ambient surface of the web shell's UI primitives.
 *
 * `@deepseek-ai/dsh-client-ui-primitives` is bundled into the dsh web shell and
 * handed to client plugins through the module registry at runtime, so it is
 * never installed here. The declarations below mirror the shell bundle this
 * plugin targets (`dsh-web-frontend` of 0.2.2-rc.1), which is also where the
 * field-descriptor contract was read from: a spec is a plain
 * `{ field, format, parse }` object, so a page may hand `SettingsFormModel`
 * descriptors of its own for types the bundled helpers do not cover.
 *
 * Value types stay loose on purpose, because the real ones live in a package
 * this repository does not depend on.
 * @module dsh-prompt-enhance/client/primitives
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  /** What one parse answer tells the staged form to write. */
  export type SettingsFieldParse = { kind: 'clear' } | { kind: 'set'; value: unknown }

  /**
   * One field descriptor: how a config key renders (`format`) and how the text
   * the page stages turns back into a JSON value (`parse`).
   *
   * `format` is also the equality basis of the staged form: staging text equal
   * to `format(currentValue)` is what "this field is untouched" means, so a
   * descriptor must be deterministic.
   */
  export interface SettingsFieldDescriptor {
    /** The config key this descriptor reads and writes. */
    readonly field: string
    /** Project the stored value onto the staged text form. */
    format(value: unknown): string
    /** Read staged text back; `undefined` marks the row invalid. */
    parse(text: string): SettingsFieldParse | undefined
  }

  /** A plain text field over one key of the bound settings scope. */
  export function settingsTextField(key: string): SettingsFieldDescriptor

  /** A numeric field over one key of the bound settings scope. */
  export function settingsNumberField(key: string): SettingsFieldDescriptor

  /**
   * Staged form over one settings scope: `bind` yields the store the page
   * reads, `actions` the edit/save/discard handlers the page calls.
   */
  export class SettingsFormModel {
    constructor(scope: unknown, fields: readonly SettingsFieldDescriptor[], secretFields?: readonly SettingsFieldDescriptor[])
    bind(project: () => unknown): unknown
    shell(): Record<string, unknown>
    field(key: string): unknown
    actions(): Record<string, unknown>
    dispose(): void
  }

  /** The form frame: renders `children` plus the save/discard controls. */
  export const SettingsForm: any

  /** One labelled row of a settings form (text input only). */
  export const SettingsValueField: any

  /** A password row; masks as it types and reports `configured`. */
  export const SettingsSecretField: any

  /** The shell's on/off control (`role="switch"`), for boolean rows. */
  export const Switch: any

  /** The shell's button primitive; the ghost/sm pair draws a bare icon button. */
  export const Button: any

  /**
   * The shell's floating label bubble. Positioning, portal and the dark bubble
   * are the shell's; the trigger is hover (after `delayMs`), focus, or — with
   * `openOnClick` — a click.
   */
  export const Tooltip: any

  /** The shell's info glyph, drawn at 11px beside a label. */
  export const IconInfoOutlineRegular: any

  /**
   * The shell's status mark. `state="ongoing"` draws the animated 24-unit
   * spinner at `size` px (14 by default); other states draw a small colored dot.
   */
  export const StateDot: any

  /** The shell's segmented choice control (`role="tablist"`), for enum rows. */
  export const SegmentedControl: any

  /** The shell's small status tag, for the "overridden" badge. */
  export const Tag: any
}
