// @vitest-environment jsdom
/**
 * Regression tests for the plugin's two configuration surfaces.
 *
 * Both render the same staged form over the same scope, so the tests drive the
 * shared form through either page and assert the copy each surface is
 * responsible for: the Settings dialog keeps the raw key beside the Chinese
 * name with a bilingual hint, while the Plugins page speaks the active locale
 * and answers `view: 'summary'` with one line.
 *
 * The two row shapes the bundled field helpers cannot express are the ones
 * worth pinning down: a switch has to stage a boolean (`false`, not the string
 * `"false"`), and a segmented choice has to stage one of the schema's enum
 * literals. Both are asserted through the staged form the pages build
 * (`createSettingsForm`), so a descriptor that starts writing strings fails
 * here instead of in the settings document.
 *
 * The primitives module is the behavioural double Vitest resolves through
 * `vitest.config.ts`; its staged-form half is a port of the shell's contract.
 * @module tests/settings-page
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { SettingsPage, SettingsSection, createSettingsForm } from '../src/client/settings-page'
import { en, zh } from '../src/client/locales'

/** One dictionary entry from the shipped Chinese dictionary. */
const zhCopy = (key: string): string => (zh as Record<string, string>)[key] ?? key

/** One dictionary entry from the shipped English dictionary. */
const enCopy = (key: string): string => (en as Record<string, string>)[key] ?? key

/** A translate seat over the Chinese dictionary, as the slot would inject it. */
const t = (key: string): string => zhCopy(key)

/** Every row the pages must show, as its config key. */
const ROW_KEYS: readonly string[] = [
  'enabled',
  'contextAware',
  'streaming',
  'provider',
  'model',
  'temperature',
  'reasoningEffort',
  'maxOutputTokens',
  'maxInputChars',
  'timeoutMs',
  'strategyMode',
  'systemPrompt',
  'contextMaxMessages',
  'contextMaxChars',
  'maxConcurrent',
  'rateLimitPerMinute',
  'shortcut',
]

/** Stored values of one ready namespace, matching `DEFAULT_CONFIG`. */
const VALUES: Readonly<Record<string, unknown>> = {
  enabled: true,
  provider: '',
  model: '',
  temperature: 0.3,
  reasoningEffort: 'off',
  maxOutputTokens: 8192,
  maxInputChars: 12000,
  timeoutMs: 60000,
  systemPrompt: '',
  strategyMode: 'replace-default',
  shortcut: 'ctrl+alt+e',
  maxConcurrent: 2,
  rateLimitPerMinute: 10,
  streaming: true,
  contextAware: true,
  contextMaxMessages: 8,
  contextMaxChars: 4000,
}

/** One task-faked namespace scope, in the shape the Host serves. */
interface Scope {
  getSnapshot(): {
    status: 'ready'
    value: Record<string, unknown>
    base: Record<string, unknown>
    user?: Record<string, unknown>
    revision: number
    writable: boolean
  }
  subscribe(listener: () => void): () => void
  mutate: (ops: unknown) => Promise<boolean>
}

/** The form actions the pages call, as the slots hand them over. */
interface Actions {
  edit: (key: string, text: string) => void
  resetField: (key: string) => void
  save: () => Promise<void>
  discard: () => void
}

/** The store shape the selector hook reads. */
interface Store {
  getSnapshot(): unknown
  subscribe(listener: () => void): () => void
}

/**
 * Build one ready scope, its staged form, and the props a slot would inject.
 * @param options - stored user layer and writability.
 * @returns the write spy, the model, and the injected props.
 */
function setup(options: { user?: Record<string, unknown>; writable?: boolean } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
  props: Record<string, unknown>
} {
  const snapshot = {
    status: 'ready' as const,
    value: { ...VALUES },
    base: {},
    user: options.user,
    revision: 4,
    writable: options.writable ?? true,
  }
  const listeners = new Set<() => void>()
  const mutate = vi.fn(async () => true)
  const scope: Scope = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    mutate,
  }
  const model = createSettingsForm(scope)
  const store = model.bind(() => {
    const out = model.shell()
    for (const key of Object.keys(VALUES)) {
      try {
        out[key] = model.field(key)
      } catch {
        // A row the described scope does not carry.
      }
    }
    return out
  }) as Store
  const actions = model.actions() as unknown as Actions
  const usePromptEnhance = (selector: (snapshot: Record<string, unknown>) => Record<string, unknown>): Record<string, unknown> =>
    useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot() as Record<string, unknown>))
  return {
    mutate,
    model,
    props: {
      usePromptEnhance,
      edit: actions.edit,
      resetField: actions.resetField,
      save: actions.save,
      discard: actions.discard,
    },
  }
}

/**
 * Render the Settings dialog's page.
 * @param options - stored user layer, writability, and the active language.
 * @returns the write spy and the staged model.
 */
function renderSection(options: { user?: Record<string, unknown>; writable?: boolean; lang?: 'zh' | 'en' } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
} {
  const { mutate, model, props } = setup(options)
  const lang = options.lang ?? 'zh'
  render(
    <SettingsSection
      {...props}
      translate={lang === 'en' ? (enCopy as never) : (zhCopy as never)}
      usePromptEnhanceLocale={(selector) => selector({ active: lang })}
    />,
  )
  return { mutate, model }
}

/**
 * Render the Plugins page's configuration entry.
 * @param options - stored user layer, writability, and the view asked for.
 * @returns the write spy and the staged model.
 */
function renderRowPage(options: { user?: Record<string, unknown>; writable?: boolean; view?: 'page' | 'summary' } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
} {
  const { mutate, model, props } = setup(options)
  render(<SettingsPage {...props} t={t} view={options.view ?? 'page'} />)
  return { mutate, model }
}

/** The title the Settings dialog gives one row. */
const sectionTitle = (key: string): string => `${key}（${zhCopy(`settings.row.${key}.label`)}）`

/** The switch of one boolean row. */
function switchOf(title: string): HTMLElement {
  return screen.getByRole('switch', { name: title })
}

afterEach(() => {
  cleanup()
})

describe('settings dialog page', () => {
  it('renders every config row with its raw key, Chinese name, and a Chinese-only hint', () => {
    renderSection()
    for (const key of ROW_KEYS) {
      expect(screen.getByText(sectionTitle(key))).toBeTruthy()
    }
    // Three switches and two segmented choices; the rest are text inputs.
    expect(screen.getAllByRole('switch')).toHaveLength(3)
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
    expect(switchOf(sectionTitle('enabled')).getAttribute('aria-checked')).toBe('true')
    expect(switchOf(sectionTitle('contextAware')).getAttribute('aria-checked')).toBe('true')
    expect(switchOf(sectionTitle('streaming')).getAttribute('aria-checked')).toBe('true')
    // Chinese mode keeps one language per row: English copy lives in the
    // English locale and must not be concatenated here.
    expect(screen.getByText(zhCopy('settings.row.enabled.hint'))).toBeTruthy()
    expect(screen.queryByText(enCopy('settings.row.enabled.hint'))).toBeNull()
    expect(screen.queryByText(/｜/)).toBeNull()
    // The header carries the title, the repository link, the version and the description.
    expect(screen.getByText('提示词增强')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeTruthy()
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeTruthy()
    expect(screen.getByText(/把输入框草稿改写为结构化提示词/)).toBeTruthy()
    // Empty routing fields teach the expected format without writing a value.
    expect((screen.getByLabelText(sectionTitle('provider')) as HTMLInputElement).placeholder).toBe(
      zhCopy('settings.row.provider.placeholder'),
    )
    expect((screen.getByLabelText(sectionTitle('model')) as HTMLInputElement).placeholder).toBe(
      zhCopy('settings.row.model.placeholder'),
    )
    expect((screen.getByLabelText(sectionTitle('systemPrompt')) as HTMLInputElement).placeholder).toBe(
      zhCopy('settings.row.systemPrompt.placeholder'),
    )
    expect((screen.getByLabelText(sectionTitle('shortcut')) as HTMLInputElement).placeholder).toBe(
      zhCopy('settings.row.shortcut.placeholder'),
    )
  })

  it('switches to English and drops the parenthesized Chinese name', () => {
    renderSection({ lang: 'en' })
    expect(screen.getByText('enabled')).toBeTruthy()
    expect(screen.queryByText(sectionTitle('enabled'))).toBeNull()
    expect(screen.getByText(enCopy('settings.row.enabled.hint'))).toBeTruthy()
    expect((screen.getByLabelText('provider') as HTMLInputElement).placeholder).toBe(enCopy('settings.row.provider.placeholder'))
    expect(screen.getByRole('button', { name: enCopy('settings.save') })).toBeTruthy()
  })

  it('stages a switch as a JSON boolean, and writes it on save', async () => {
    const { mutate, model } = renderSection()
    fireEvent.click(switchOf(sectionTitle('enabled')))
    expect(switchOf(sectionTitle('enabled')).getAttribute('aria-checked')).toBe('false')
    expect(model.field('enabled')).toMatchObject({ text: 'false', overridden: true, invalid: false })
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([{ op: 'set', path: ['enabled'], value: false }])
  })

  it('stages a segmented choice as its enum literal', async () => {
    const { mutate, model } = renderSection()
    fireEvent.click(screen.getByRole('tab', { name: zhCopy('settings.reasoning.inherit') }))
    expect(model.field('reasoningEffort')).toMatchObject({ text: 'inherit', overridden: true, invalid: false })
    fireEvent.click(screen.getByRole('tab', { name: zhCopy('settings.strategy.extend') }))
    expect(model.field('strategyMode')).toMatchObject({ text: 'extend-default', overridden: true, invalid: false })
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([
      { op: 'set', path: ['reasoningEffort'], value: 'inherit' },
      { op: 'set', path: ['strategyMode'], value: 'extend-default' },
    ])
  })

  it('resets an overridden row by clearing the stored value', async () => {
    const { mutate } = renderSection({ user: { streaming: false } })
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.reset') }))
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([{ op: 'unset', path: ['streaming'] }])
  })

  it('disables every control when the deployment stores settings read-only', () => {
    renderSection({ writable: false })
    expect(screen.getByText(zhCopy('settings.readOnly'))).toBeTruthy()
    for (const control of screen.getAllByRole('switch')) expect((control as HTMLButtonElement).disabled).toBe(true)
    for (const control of screen.getAllByRole('tab')) expect((control as HTMLButtonElement).disabled).toBe(true)
    for (const control of screen.getAllByRole('textbox')) expect((control as HTMLInputElement).disabled).toBe(true)
  })

  it('carries no runtime probe output', () => {
    renderSection()
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/probe failed|SettingsFormModel|settingsNumberField, settingsTextField/)
  })
})

describe('plugins page entry', () => {
  it('renders the same rows under translated titles', () => {
    renderRowPage()
    for (const key of ROW_KEYS) {
      expect(screen.getByText(zhCopy(`settings.row.${key}.label`))).toBeTruthy()
    }
    expect(screen.getAllByRole('switch')).toHaveLength(3)
    expect(screen.getAllByRole('tablist')).toHaveLength(2)
    // No raw keys and no parenthesized name: this surface speaks the active locale.
    expect(screen.queryByText(sectionTitle('enabled'))).toBeNull()
    expect(screen.queryByText(/｜/)).toBeNull()
  })

  it('answers the summary view with one line and no controls', () => {
    renderRowPage({ view: 'summary' })
    expect(screen.getByText(zhCopy('settings.summary'))).toBeTruthy()
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })

  it('stages through the same form, so a save writes the same ops', async () => {
    const { mutate } = renderRowPage()
    fireEvent.click(switchOf(zhCopy('settings.row.contextAware.label')))
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([{ op: 'set', path: ['contextAware'], value: false }])
  })
})
