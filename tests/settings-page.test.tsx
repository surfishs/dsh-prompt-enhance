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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { clearCatalogCache } from '../src/client/llm-catalog'
import { forgetReasoningCapabilities } from '../src/client/settings-page-controls'
import { SettingsPage, SettingsSection, createSettingsForm } from '../src/client/settings-page'
import { ADVANCED_ROWS, BASIC_ROWS, ROWS } from '../src/client/settings-page-spec'
import { en, zh } from '../src/client/locales'

/** Interpolate one dictionary entry, as the locale service would. */
function copyOf(dictionary: Readonly<Record<string, string>>, key: string, params?: Readonly<Record<string, unknown>>): string {
  let text = dictionary[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.split(`{${name}}`).join(String(value))
  }
  return text
}

/** One dictionary entry from the shipped Chinese dictionary. */
const zhCopy = (key: string, params?: Readonly<Record<string, unknown>>): string => copyOf(zh as Record<string, string>, key, params)

/** One dictionary entry from the shipped English dictionary. */
const enCopy = (key: string, params?: Readonly<Record<string, unknown>>): string => copyOf(en as Record<string, string>, key, params)

/** A translate seat over the Chinese dictionary, as the slot would inject it. */
const t = (key: string): string => zhCopy(key)

/** Every row the pages must show, as its config key. */
const ROW_KEYS: readonly string[] = [
  'enabled',
  'contextAware',
  'streaming',
  'foldAnimation',
  'autoFold',
  'provider',
  'model',
  'temperature',
  'reasoningEffort',
  'mode',
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
  mode: 'prose',
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
  foldAnimation: true,
  autoFold: true,
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
function setup(options: { user?: Record<string, unknown>; values?: Record<string, unknown>; writable?: boolean } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
  props: Record<string, unknown>
} {
  const snapshot = {
    status: 'ready' as const,
    value: { ...VALUES, ...options.values },
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
function renderSection(options: { user?: Record<string, unknown>; values?: Record<string, unknown>; writable?: boolean; lang?: 'zh' | 'en' } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
} {
  const { mutate, model, props } = setup(options)
  const lang = options.lang ?? 'zh'
  render(<SettingsSection {...props} translate={lang === 'en' ? (enCopy as never) : (zhCopy as never)} usePromptEnhanceLocale={(selector) => selector({ active: lang })} />)
  fireEvent.click(screen.getByText(lang === 'en' ? enCopy('settings.advanced') : zhCopy('settings.advanced')))
  return { mutate, model }
}

/**
 * Render the Plugins page's configuration entry.
 * @param options - stored user layer, writability, and the view asked for.
 * @returns the write spy and the staged model.
 */
function renderRowPage(options: { user?: Record<string, unknown>; writable?: boolean; view?: 'page' | 'summary'; values?: Record<string, unknown> } = {}): {
  mutate: ReturnType<typeof vi.fn>
  model: ReturnType<typeof createSettingsForm>
} {
  const { mutate, model, props } = setup(options)
  const view = options.view ?? 'page'
  render(<SettingsPage {...props} t={t} view={view} />)
  if (view === 'page') fireEvent.click(screen.getByText(zhCopy('settings.advanced')))
  return { mutate, model }
}

/** The title the Settings dialog gives one row. */
const sectionTitle = (key: string): string => `${key}（${zhCopy(`settings.row.${key}.label`)}）`

/** The switch of one boolean row. */
function switchOf(title: string): HTMLElement {
  return screen.getByRole('switch', { name: title })
}

/** One JSON success response. */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

/** Install a catalog-aware fetch: providers/models/route-check, then reasoning. */
function stubCatalogFetch(
  options: {
    providers?: { id: string; name: string; registered: boolean }[]
    models?: { id: string; name: string }[]
    routeAvailable?: boolean
  } = {},
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      const href = String(url)
      if (href.includes('llm-providers')) return jsonResponse({ ok: true, value: { providers: options.providers ?? [] } })
      if (href.includes('llm-models')) return jsonResponse({ ok: true, value: { models: options.models ?? [] } })
      if (href.includes('llm-route-check')) return jsonResponse({ ok: true, value: { available: options.routeAvailable ?? true } })
      return jsonResponse({ ok: true, value: { efforts: [], source: 'unavailable' } })
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // The catalog memo outlives one test, and each case stubs its own registry.
  clearCatalogCache()
  forgetReasoningCapabilities()
})

describe('settings dialog page', () => {
  it('keeps the temperature row inside the advanced disclosure, after the persona row', () => {
    // Sampling temperature is a set-once tuning knob, not a per-use switch: it
    // belongs with the advanced rows, next to the rows that also shape the
    // rewrite, and the basic list must not carry it any more.
    const advancedKeys = ADVANCED_ROWS.map((row) => row.key)
    expect(BASIC_ROWS.map((row) => row.key)).not.toContain('temperature')
    expect(advancedKeys.indexOf('systemPrompt')).toBe(advancedKeys.indexOf('strategyMode') + 1)
    expect(advancedKeys.indexOf('temperature')).toBe(advancedKeys.indexOf('systemPrompt') + 1)

    renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.temperature.label'))
    expect(document.querySelector('.dsh-pe-advanced')?.contains(input)).toBe(true)
  })

  it('keeps the custom persona inside the advanced disclosure, next to the strategy row', () => {
    // The persona is set-once prompt tuning whose meaning depends on how it
    // combines with the built-in one, so it moved out of the basic list and
    // stays directly after the strategy row.
    const advancedKeys = ADVANCED_ROWS.map((row) => row.key)
    expect(BASIC_ROWS.map((row) => row.key)).not.toContain('systemPrompt')
    expect(advancedKeys.indexOf('systemPrompt')).toBe(advancedKeys.indexOf('strategyMode') + 1)

    renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.systemPrompt.label'))
    expect(document.querySelector('.dsh-pe-advanced')?.contains(input)).toBe(true)
  })

  it('keeps the streaming switch inside the advanced disclosure, after the fold switches', () => {
    // Display-only transport, set once rather than per use: it joins the two
    // fold switches, and the basic list must not carry it any more.
    const advancedKeys = ADVANCED_ROWS.map((row) => row.key)
    expect(BASIC_ROWS.map((row) => row.key)).not.toContain('streaming')
    expect(advancedKeys.indexOf('streaming')).toBe(advancedKeys.indexOf('autoFold') + 1)

    renderSection()
    const control = switchOf(sectionTitle('streaming'))
    expect(document.querySelector('.dsh-pe-advanced')?.contains(control)).toBe(true)
  })

  it('renders every config row with its raw key, Chinese name, and a Chinese-only hint', () => {
    renderSection()
    for (const key of ROW_KEYS) {
      expect(screen.getByText(sectionTitle(key))).toBeTruthy()
    }
    // Five switches and three segmented choices; the rest are text inputs.
    expect(screen.getAllByRole('switch')).toHaveLength(5)
    expect(screen.getAllByRole('tablist')).toHaveLength(3)
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
    expect(screen.getByRole('link', { name: 'npm' })).toBeTruthy()
    // The chips are styled from the stylesheet, never inline: a style object
    // cannot express :hover, which is why both links had no hover state.
    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    const npmLink = screen.getByRole('link', { name: 'npm' })
    expect(githubLink.getAttribute('class')).toBe('dsh-pe-header-link')
    expect(npmLink.getAttribute('class')).toBe('dsh-pe-header-link')
    expect(githubLink.getAttribute('style')).toBeNull()
    // The feedback chip opens the tracker the package declares in `bugs.url`,
    // and it shares the header chip styling so it gets the same hover state.
    const issueLink = screen.getByRole('link', { name: '问题反馈' })
    expect(issueLink.getAttribute('href')).toBe('https://github.com/surfishs/dsh-prompt-enhance/issues')
    expect(issueLink.getAttribute('class')).toBe('dsh-pe-header-link')
    expect(issueLink.getAttribute('style')).toBeNull()
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeTruthy()
    expect(screen.getByText(/把输入框草稿改写成结构化提示词/)).toBeTruthy()
    // Routing rows are selects fed by the registration catalog; their first
    // option is the empty "follow session" value.
    const providerSelect = screen.getByLabelText(sectionTitle('provider')) as HTMLSelectElement
    expect(providerSelect.tagName).toBe('SELECT')
    expect(providerSelect.querySelector('option')?.textContent).toBe(zhCopy('settings.routing.followSession'))
    expect(screen.getByLabelText(sectionTitle('model'))).toBeTruthy()
    expect((screen.getByLabelText(sectionTitle('systemPrompt')) as HTMLInputElement).placeholder).toBe(zhCopy('settings.row.systemPrompt.placeholder'))
    expect((screen.getByLabelText(sectionTitle('shortcut')) as HTMLInputElement).placeholder).toBe(zhCopy('settings.row.shortcut.placeholder'))
  })

  it('switches to English and drops the parenthesized Chinese name', () => {
    renderSection({ lang: 'en' })
    expect(screen.getByText('enabled')).toBeTruthy()
    expect(screen.queryByText(sectionTitle('enabled'))).toBeNull()
    expect(screen.getByText(enCopy('settings.row.enabled.hint'))).toBeTruthy()
    const providerSelect = screen.getByLabelText('provider') as HTMLSelectElement
    expect(providerSelect.tagName).toBe('SELECT')
    expect(providerSelect.querySelector('option')?.textContent).toBe(enCopy('settings.routing.followSession'))
    expect(screen.getByRole('button', { name: enCopy('settings.save') })).toBeTruthy()
  })

  it('lists registered providers and greys out unconfigured ones', async () => {
    stubCatalogFetch({
      providers: [
        { id: 'deepseek-official', name: 'DeepSeek', registered: true },
        { id: 'qwen', name: 'Qwen', registered: false },
      ],
    })
    renderSection()
    const select = screen.getByLabelText(sectionTitle('provider')) as HTMLSelectElement
    await waitFor(() => expect(select.querySelector('option[value="deepseek-official"]')).toBeTruthy())
    const dormant = select.querySelector('option[value="qwen"]') as HTMLOptionElement
    expect(dormant.disabled).toBe(true)
    expect(dormant.textContent).toContain(zhCopy('settings.routing.unconfiguredSuffix'))
  })

  it('loads the chosen provider’s models and accepts a custom model', async () => {
    stubCatalogFetch({
      providers: [{ id: 'deepseek-official', name: 'DeepSeek', registered: true }],
      models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
    })
    renderSection()
    const provider = screen.getByLabelText(sectionTitle('provider')) as HTMLSelectElement
    await waitFor(() => expect(provider.querySelector('option[value="deepseek-official"]')).toBeTruthy())
    fireEvent.change(provider, { target: { value: 'deepseek-official' } })
    const model = screen.getByLabelText(sectionTitle('model')) as HTMLSelectElement
    await waitFor(() => expect(model.querySelector('option[value="deepseek-flash"]')).toBeTruthy())
    fireEvent.change(model, { target: { value: '__custom__' } })
    const input = screen.getByPlaceholderText(zhCopy('settings.routing.customPlaceholder'))
    fireEvent.change(input, { target: { value: 'my-model' } })
    expect(screen.getByDisplayValue('my-model')).toBeTruthy()
  })

  it('warns about an incomplete pair without blocking save', async () => {
    stubCatalogFetch({ providers: [{ id: 'deepseek-official', name: 'DeepSeek', registered: true }] })
    renderSection()
    const provider = screen.getByLabelText(sectionTitle('provider')) as HTMLSelectElement
    await waitFor(() => expect(provider.querySelector('option[value="deepseek-official"]')).toBeTruthy())
    fireEvent.change(provider, { target: { value: 'deepseek-official' } })
    expect(await screen.findByText(zhCopy('settings.routing.pairIncomplete'))).toBeTruthy()
    expect((screen.getByRole('button', { name: zhCopy('settings.save') }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('warns when the selected route does not resolve', async () => {
    stubCatalogFetch({
      providers: [{ id: 'deepseek-official', name: 'DeepSeek', registered: true }],
      models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
      routeAvailable: false,
    })
    renderSection()
    const provider = screen.getByLabelText(sectionTitle('provider')) as HTMLSelectElement
    await waitFor(() => expect(provider.querySelector('option[value="deepseek-official"]')).toBeTruthy())
    fireEvent.change(provider, { target: { value: 'deepseek-official' } })
    const model = screen.getByLabelText(sectionTitle('model')) as HTMLSelectElement
    await waitFor(() => expect(model.querySelector('option[value="deepseek-flash"]')).toBeTruthy())
    fireEvent.change(model, { target: { value: 'deepseek-flash' } })
    expect(await screen.findByText(zhCopy('settings.routing.routeUnavailable'), undefined, { timeout: 3000 })).toBeTruthy()
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

  it('puts the output shape in the basic list right after the reasoning tier', async () => {
    // Position mirrors the quick card (model → effort → shape → context), so the
    // two surfaces put the control in the same relative place.
    const basic = BASIC_ROWS.map((row) => row.key)
    expect(basic.indexOf('mode')).toBe(basic.indexOf('reasoningEffort') + 1)
    expect(basic.indexOf('contextAware')).toBe(basic.indexOf('mode') + 1)

    const { mutate, model } = renderSection()
    fireEvent.click(screen.getByRole('tab', { name: zhCopy('settings.mode.structured') }))
    expect(model.field('mode')).toMatchObject({ text: 'structured', overridden: true, invalid: false })
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([{ op: 'set', path: ['mode'], value: 'structured' }])
  })

  it('renders the pinned model’s own tiers from the capability route', async () => {
    localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              value: {
                efforts: [
                  { id: 'off', name: 'Off' },
                  { id: 'low', name: 'Low' },
                  { id: 'max', name: 'Max' },
                ],
                defaultEffort: 'low',
                source: 'resolved',
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    )
    renderSection({ user: { provider: 'zhipu', model: 'glm-4.6' } })
    // Non-DeepSeek providers keep their own names, and Max is present.
    expect(await screen.findByRole('tab', { name: 'Max' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Low' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: zhCopy('settings.reasoning.inherit') })).toBeTruthy()
  })

  it('collapses to follow-provider-default when the route declares no tiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              value: { efforts: [], source: 'unavailable', reason: 'no-efforts' },
            }),
            { status: 200 },
          ),
      ),
    )
    renderSection({ values: { reasoningEffort: 'off' }, user: { provider: 'zhipu', model: 'glm-4.6' } })
    expect(await screen.findByText(zhCopy('settings.reasoning.noTiers'))).toBeTruthy()
    // Only the follow-default choice is offered in this row; no synthetic
    // current value (the page also has the strategy tablist, so scope it).
    const row = screen.getByRole('tablist', { name: sectionTitle('reasoningEffort') })
    const tabs = within(row).getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    // The stored `off` is not offered here, so the control is handed a value it
    // can select — otherwise the host indicator would sit outside the track.
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true')
    expect(within(row).queryByRole('tab', { name: zhCopy('settings.reasoning.current', { value: 'off' }) })).toBeNull()
  })

  it('keeps an undeclared stored tier visible when the capability read fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              value: { efforts: [], source: 'unavailable', reason: 'resolve-failed' },
            }),
            { status: 200 },
          ),
      ),
    )
    renderSection({ values: { reasoningEffort: 'high' }, user: { reasoningEffort: true } })
    const synthetic = zhCopy('settings.reasoning.current', { value: 'high' })
    // The read failed rather than declaring "no tiers", so the stored value
    // stays visible; otherwise the segmented indicator would have no option.
    const tab = await screen.findByRole('tab', { name: synthetic })
    expect(tab.getAttribute('aria-selected')).toBe('true')
  })

  it('renders the last known tiers immediately when the row mounts again', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ ok: true, value: { efforts: [{ id: 'off', name: 'Off' }], source: 'resolved' } })),
    )
    renderSection({ values: { reasoningEffort: 'off' }, user: { provider: 'zhipu', model: 'glm-4.6' } })
    expect(await screen.findByRole('tab', { name: 'Off' })).toBeTruthy()
    cleanup()

    // The next read hangs: whatever shows up now comes from the session cache.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderSection({ values: { reasoningEffort: 'off' }, user: { provider: 'zhipu', model: 'glm-4.6' } })
    expect(screen.getByRole('tab', { name: 'Off' })).toBeTruthy()
    expect(screen.queryByText(zhCopy('settings.reasoning.loading'))).toBeNull()
  })

  it('pins the refresh action to the right and reports its outcome', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    let reasoningCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        const href = String(url)
        // The routing rows read their own catalog endpoints; only the reasoning
        // endpoint participates in this test's success/failure sequence.
        if (href.includes('llm-providers')) return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        if (href.includes('llm-route-check')) return json({ ok: true, value: { available: true } })
        reasoningCalls += 1
        return json(
          reasoningCalls <= 2 ? { ok: true, value: { efforts: [{ id: 'off', name: 'Off' }], source: 'resolved' } } : { ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } },
        )
      }),
    )
    renderSection({ user: { provider: 'zhipu', model: 'glm-4.6' } })
    expect(await screen.findByRole('tab', { name: 'Off' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.reasoning.refresh') }))
    expect(await screen.findByText(zhCopy('settings.reasoning.refreshOk'))).toBeTruthy()
    // A refresh that comes back unavailable must say so instead of looking quiet.
    fireEvent.click(await screen.findByRole('button', { name: zhCopy('settings.reasoning.refresh') }))
    expect(await screen.findByText(zhCopy('settings.reasoning.refreshFailed'))).toBeTruthy()
  })

  it('hides the reset action when a manual edit returns to the default', () => {
    const { model } = renderSection({
      values: { enabled: false, timeoutMs: 30000 },
      user: { enabled: true, timeoutMs: true },
    })
    const resetButtons = (): HTMLElement[] => screen.queryAllByRole('button', { name: zhCopy('settings.reset') })
    expect(resetButtons()).toHaveLength(2)
    // Toggle the switch and type the number back to their shipped defaults.
    fireEvent.click(switchOf(sectionTitle('enabled')))
    fireEvent.change(screen.getByLabelText(sectionTitle('timeoutMs')), { target: { value: '60000' } })
    // The form still stages an explicit value (the host flag stays true)…
    expect(model.field('enabled').overridden).toBe(true)
    expect(model.field('timeoutMs').overridden).toBe(true)
    // …but there is nothing left to reset, so the action disappears.
    expect(resetButtons()).toHaveLength(0)
  })

  it('clears the model when the provider is reset, so its reset action follows', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        const href = String(url)
        if (href.includes('llm-providers')) return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        if (href.includes('llm-route-check')) return json({ ok: true, value: { available: true } })
        return json({ ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } })
      }),
    )
    // The double renders `values`; `user` marks both keys as stored overrides.
    const { model } = renderSection({ values: { provider: 'zhipu', model: 'glm-4.6' }, user: { provider: 'zhipu', model: 'glm-4.6' } })
    const resets = (): HTMLElement[] => screen.queryAllByRole('button', { name: zhCopy('settings.reset') })
    // provider + model are both overridden to start with.
    expect(resets()).toHaveLength(2)

    fireEvent.click(resets()[0]!)

    // The pair clears together: the select, the staged text and the chip agree.
    const modelSelect = screen.getByLabelText(sectionTitle('model')) as HTMLSelectElement
    await waitFor(() => expect(modelSelect.value).toBe(''))
    expect(model.field('provider').text).toBe('')
    expect(model.field('model').text).toBe('')
    expect(resets()).toHaveLength(0)
  })

  it('clears the model when the provider is switched', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        const href = String(url)
        if (href.includes('llm-providers')) {
          return json({
            ok: true,
            value: {
              providers: [
                { id: 'zhipu', name: 'Zhipu', registered: true },
                { id: 'qwen', name: 'Qwen', registered: true },
              ],
            },
          })
        }
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        if (href.includes('llm-route-check')) return json({ ok: true, value: { available: true } })
        return json({ ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } })
      }),
    )
    const { model } = renderSection({ values: { provider: 'zhipu', model: 'glm-4.6' }, user: { provider: 'zhipu', model: 'glm-4.6' } })
    const resets = (): HTMLElement[] => screen.queryAllByRole('button', { name: zhCopy('settings.reset') })
    expect(resets()).toHaveLength(2)
    // Wait for the provider catalog: a select cannot take a value it has no
    // option for, and jsdom would silently fall back to the empty one.
    await screen.findByRole('option', { name: /Qwen/ })

    fireEvent.change(screen.getByLabelText(sectionTitle('provider')), { target: { value: 'qwen' } })

    // The model belonged to the old provider, so it leaves with it.
    await waitFor(() => expect(model.field('model').text).toBe(''))
    expect(model.field('provider').text).toBe('qwen')
    // Only the provider row still has something to reset.
    expect(resets()).toHaveLength(1)
  })

  it('resets an overridden row by clearing the stored value', async () => {
    const { mutate } = renderSection({ values: { streaming: false }, user: { streaming: true } })
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
    expect(screen.getAllByRole('switch')).toHaveLength(5)
    expect(screen.getAllByRole('tablist')).toHaveLength(3)
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

  it('records a shortcut from the keyboard', async () => {
    // The recorder fills the same text field, so the stored format stays the one
    // the parser and the runner already understand.
    renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.shortcut.label')) as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.record') }))
    expect(screen.getByText(zhCopy('settings.recordPrompt'))).toBeTruthy()

    fireEvent.keyDown(window, { key: 'e', code: 'KeyE', ctrlKey: true, altKey: true })
    expect(input.value).toBe('ctrl+alt+e')
    expect(screen.queryByText(zhCopy('settings.recordPrompt'))).toBeNull()
  })

  it('keeps recording on a bare key and cancels on Escape', async () => {
    renderRowPage()
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.record') }))
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' })
    expect(screen.getByText(zhCopy('settings.recordNeedsModifier'))).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(zhCopy('settings.recordPrompt'))).toBeNull()
    expect(screen.queryByText(zhCopy('settings.recordNeedsModifier'))).toBeNull()
  })

  it('validates every numeric row against its real range', () => {
    const numeric = ROWS.filter((row) => row.kind === 'number')
    expect(numeric.length).toBeGreaterThan(0)
    for (const row of numeric) {
      const range = row.range
      if (range === undefined) throw new Error(`${row.key} has no range`)
      expect(row.validate?.(''), row.key).toBe(true)
      expect(row.validate?.(String(range.min)), row.key).toBe(true)
      expect(row.validate?.(String(range.max)), row.key).toBe(true)
      expect(row.validate?.(String(range.min - 1)), row.key).toBe(false)
      expect(row.validate?.(String(range.max + 1)), row.key).toBe(false)
      if (range.integer !== false) expect(row.validate?.(String(range.min + 0.5)), row.key).toBe(false)
    }
  })

  it('refuses an out-of-range number and shows the real range', async () => {
    const { mutate } = renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.maxOutputTokens.label'))
    fireEvent.change(input, { target: { value: '1' } })
    fireEvent.blur(input)
    expect(await screen.findByText(zhCopy('settings.row.invalidInteger', { min: 256, max: 32768 }))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).not.toHaveBeenCalled())

    fireEvent.change(input, { target: { value: '256' } })
    fireEvent.blur(input)
    await waitFor(() => expect(screen.queryByText(zhCopy('settings.row.invalidInteger', { min: 256, max: 32768 }))).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
  })

  it('uses the numeric message for the fractional temperature row', async () => {
    renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.temperature.label'))
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.blur(input)
    expect(await screen.findByText(zhCopy('settings.row.invalidNumber', { min: 0, max: 1 }))).toBeTruthy()

    fireEvent.change(input, { target: { value: '0.5' } })
    fireEvent.blur(input)
    await waitFor(() => expect(screen.queryByText(zhCopy('settings.row.invalidNumber', { min: 0, max: 1 }))).toBeNull())
  })

  it('shows the effective default as the placeholder of an empty numeric row', () => {
    renderRowPage({ values: { contextMaxMessages: '' } })
    const empty = screen.getByLabelText(new RegExp(zhCopy('settings.row.contextMaxMessages.label'))) as HTMLInputElement
    expect(empty.value).toBe('')
    expect(empty.placeholder).toBe(zhCopy('settings.row.blankDefault', { value: '8' }))

    const filled = screen.getByLabelText(new RegExp(zhCopy('settings.row.contextMaxChars.label'))) as HTMLInputElement
    expect(filled.placeholder).toBe('')
  })

  it('refuses to write an invalid shortcut and explains why', async () => {
    // The host schema accepts any string, so a malformed shortcut would be
    // stored and then silently never fire; the row refuses the write instead.
    const { mutate } = renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.shortcut.label'))
    fireEvent.change(input, { target: { value: 'hello' } })
    // Nothing while typing: the warning waits for the commit, like the numbers.
    expect(screen.queryByText(zhCopy('settings.invalidShortcut'))).toBeNull()
    fireEvent.blur(input)
    expect(await screen.findByText(zhCopy('settings.invalidShortcut'))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).not.toHaveBeenCalled())
  })

  it('writes a valid shortcut and stops warning', async () => {
    const { mutate } = renderRowPage()
    const input = screen.getByLabelText(zhCopy('settings.row.shortcut.label'))
    // A value different from the stored one, so the save actually has work.
    fireEvent.change(input, { target: { value: 'ctrl+shift+e' } })
    fireEvent.blur(input)
    expect(screen.queryByText(zhCopy('settings.invalidShortcut'))).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalled())
  })

  it('stages through the same form, so a save writes the same ops', async () => {
    const { mutate } = renderRowPage()
    fireEvent.click(switchOf(zhCopy('settings.row.contextAware.label')))
    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    expect(mutate.mock.calls[0]?.[0]).toEqual([{ op: 'set', path: ['contextAware'], value: false }])
  })

  it('edits the custom persona as a multiline textarea that keeps newlines', async () => {
    // The persona is prose: a single-line input cannot hold the paragraph
    // breaks the built-in persona itself is written with.
    const { mutate } = renderRowPage()
    const control = screen.getByLabelText(zhCopy('settings.row.systemPrompt.label')) as HTMLTextAreaElement
    expect(control.tagName).toBe('TEXTAREA')

    const persona = '你是产品需求文档的提示词工程师。\n只输出 Markdown 小节，不要解释。'
    fireEvent.change(control, { target: { value: persona } })
    expect(control.value).toBe(persona)
    fireEvent.blur(control)

    fireEvent.click(screen.getByRole('button', { name: zhCopy('settings.save') }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith(expect.arrayContaining([{ op: 'set', path: ['systemPrompt'], value: persona }])))
  })
})
