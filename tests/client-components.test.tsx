// @vitest-environment jsdom
/**
 * Component-level regression tests for the composer enhance flow: the guard
 * chain, the loading → result → apply → undo loop (including the apply/
 * pushUndo/setDraft/UndoBar ordering that must survive React batching),
 * stale marking both ways, and busy-state behavior. The host route is
 * mocked; the ui-state module is the real one.
 * @module tests/client-components
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { EnhanceButton } from '../src/client/EnhanceButton'
import { UndoBar } from '../src/client/UndoBar'
import { ResultDock } from '../src/client/ResultDock'
import { EnhanceClientError, requestEnhance, requestEnhanceStream } from '../src/client/enhance-client'
import { zh } from '../src/client/locales'
import * as ui from '../src/client/ui-state'
import { DEFAULT_CLIENT_SETTINGS, setClientSettings } from '../src/client/settings'
import { clearCatalogCache } from '../src/client/llm-catalog'
import { clearQuickModelCache } from '../src/client/quick-settings'
import { setSettingsWriter } from '../src/client/settings-writer'

/**
 * The slice of the conversation input machine this suite drives.
 *
 * Written out rather than imported: `InputState` lives in
 * `dsh-client-ui-conversation/lib/types/client/input/contract.ts` and is
 * deliberately NOT re-exported from the package root or its `./client` entry
 * (its own doc calls that three-tier visibility intentional), so importing it
 * from the package name is a type error — and it cannot be recovered from the
 * slot prop either, because `SnapshotSelectorHook<T>` is itself generic in the
 * selector's result, which erases the state type. Literal types are the honest
 * stand-in; the props below are built as `never` and the double is exercised
 * against the real `EnhanceButton`, so a contract drift still surfaces.
 */
interface InputState {
  readonly draft: string
  /** 0.2.x field name for composer attachments. */
  readonly attachmentIds: readonly unknown[]
  /** 0.1.x predecessor of {@link attachmentIds}; both are exercised below. */
  readonly imageIds?: readonly unknown[]
  readonly occurrences: readonly { readonly hint?: string }[]
  readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
  readonly draftRev: number
  readonly queue: readonly unknown[]
}

vi.mock('../src/client/enhance-client', () => ({
  EnhanceClientError: class extends Error {
    detail: { code: string; message: string }
    constructor(detail: { code: string; message: string }) {
      super(detail.message)
      this.detail = detail
    }
  },
  requestEnhance: vi.fn(),
  requestEnhanceStream: vi.fn(),
}))

const t = ((key: string, params?: Record<string, unknown>): string => {
  let s = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) s = s.split(`{${name}}`).join(String(value))
  return s
}) as TranslateNS<'dsh-prompt-enhance'>

/** Minimal fake of the per-session input machine store: synchronous, like the real one. */
function makeFakeInput(initial: Partial<InputState> & { draft: string }) {
  let state: InputState = {
    phase: 'plain',
    occurrences: [],
    attachmentIds: [],
    draftRev: 0,
    queue: [],
    ...initial,
  } as InputState
  const subscribers = new Set<() => void>()
  function useInput<S>(selector: (s: InputState) => S): S {
    return useSyncExternalStore(
      (onStoreChange) => {
        subscribers.add(onStoreChange)
        return () => {
          subscribers.delete(onStoreChange)
        }
      },
      () => selector(state),
    )
  }
  return {
    useInput,
    /** Simulate one machine publish: new snapshot object, all subscribers notified. */
    set(partial: Partial<InputState>): void {
      state = { ...state, ...partial }
      for (const notify of subscribers) notify()
    },
  }
}

function renderComposer(input: ReturnType<typeof makeFakeInput>, inputActions: Parameters<typeof EnhanceButton>[0]['inputActions'], sessionId: string | undefined, ctx?: unknown): void {
  const props = { t, sessionId, useInput: input.useInput, inputActions, ...(ctx === undefined ? {} : { __ctx: ctx }) } as never
  render(
    <>
      <EnhanceButton {...props} />
      <ResultDock {...props} />
      <UndoBar {...props} />
    </>,
  )
}

const enhanceButton = (): HTMLButtonElement => document.querySelector('.dsh-pe-btn') as HTMLButtonElement

describe('dock alignment anchor', () => {
  afterEach(cleanup)

  it('tags the composer button with the session key the dock entries look up', () => {
    // useDockAlignment finds this session's composer through this attribute
    // (falling back to container/document scanning), so it must carry the same
    // key the dock component keys its state with.
    const input = makeFakeInput({ draft: '文本' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    expect(enhanceButton().getAttribute('data-dsh-pe-key')).toBe('s1')
  })
})

// The one-shot path is the baseline every existing assertion was written
// against; the incremental path gets its own describe with streaming on.
beforeEach(() => {
  vi.mocked(requestEnhance).mockReset()
  vi.mocked(requestEnhanceStream).mockReset()
  setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false })
})

describe('dsh 0.1.2-rc.1 dual-compat (host omits sessionId)', () => {
  afterEach(cleanup)

  // rc.1 dropped `sessionId` from the input slot standard props. The button
  // (input.right) and the undo bar (input.dock) are separate component trees,
  // so both must still land on the SAME fallback key — otherwise the undo bar
  // silently never appears after an apply.
  it('keys the button and the undo bar to the same composer and drops the session route', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, undefined)
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    // No host id → the server degrades to the harness default model route.
    expect(requestEnhance).toHaveBeenCalledWith({ sessionId: undefined, text: '旧原文' }, expect.anything())

    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')
    expect(screen.getByRole('button', { name: zh['undo.undo'] })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(setDraft).toHaveBeenLastCalledWith('旧原文')
    expect(screen.getByRole('button', { name: zh['panel.apply'] })).toBeTruthy()
  })
})

describe('EnhanceButton guard chain', () => {
  afterEach(cleanup)

  it('dims for an empty draft and turns the click into a no-op', () => {
    const input = makeFakeInput({ draft: '   ' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    const button = enhanceButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toContain('提示词增强')
    expect(button.title).toContain('请先输入')
    fireEvent.click(button)
    expect(screen.queryByText(zh['error.empty'])).toBeNull()
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  // An empty draft stays empty even when the composer carries attachments: the
  // plugin only ever sends the text, so attachments neither enable the button
  // nor produce a dedicated message (there is no attachment guard by design).
  it('treats an empty draft with attachments as empty (0.2.x `attachmentIds`)', () => {
    const input = makeFakeInput({ draft: '', attachmentIds: ['att1' as never] })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    const button = enhanceButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  // Same behaviour on the 0.1.x field name, which older input states carried.
  it('treats an empty draft with attachments as empty on the legacy `imageIds` field', () => {
    const input = makeFakeInput({ draft: '', imageIds: ['img1' as never] })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    const button = enhanceButton()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('refuses drafts containing reference chips', () => {
    const input = makeFakeInput({ draft: '文本', occurrences: [{}] as never })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.click(enhanceButton())
    expect(screen.getByText(zh['error.occurrences'])).toBeTruthy()
  })

  // `claimed` means the leading command chip is waiting for its arguments — the
  // editor is editable, nothing is submitting. Naming it "busy (submitting)"
  // sent the user looking for a stuck submission instead of removing the
  // command, so the command case now has its own copy.
  it('refuses a command-chip draft with the command message, not the busy one', () => {
    const input = makeFakeInput({ draft: '/计划 帮我写个方案', phase: 'claimed' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.click(enhanceButton())
    expect(screen.getByText(zh['error.command'])).toBeTruthy()
    expect(screen.queryByText(zh['error.phase'])).toBeNull()
    expect(requestEnhance).not.toHaveBeenCalled()
    expect(requestEnhanceStream).not.toHaveBeenCalled()
  })

  it('keeps the busy copy for a phase that is actually submitting', () => {
    const input = makeFakeInput({ draft: '文本', phase: 'submitting' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.click(enhanceButton())
    expect(screen.getByText(zh['error.phase'])).toBeTruthy()
    expect(screen.queryByText(zh['error.command'])).toBeNull()
    expect(requestEnhance).not.toHaveBeenCalled()
  })

  it('fails closed when the host exposes no reference-chip view', () => {
    // Fill-back writes plain text over the editor document, so a chip the plugin
    // cannot see is a chip it would destroy — irreversibly. "Unknown" must not
    // read as "none": the guard refuses and says why, instead of applying.
    const input = makeFakeInput({ draft: '文本', occurrences: undefined as never })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.click(enhanceButton())
    expect(screen.getByText(zh['error.chipsUnknown'])).toBeTruthy()
    expect(requestEnhance).not.toHaveBeenCalled()
    expect(requestEnhanceStream).not.toHaveBeenCalled()
  })

  // Regression: attachment ids / `occurrences` are part of the input snapshot
  // in the dsh lines this plugin targets, but a slot host need not expose them.
  // Reading `.length` off a missing field throws DURING RENDER, and React
  // answers that by unmounting the whole slot entry behind its error boundary —
  // the composer silently loses the button and the console fills with a stack
  // trace (observed live as "slot entry crashed in 'conversation.input.right'").
  it('renders when the host input state omits attachment ids and occurrences', () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const bare = {
      useInput: <S,>(selector: (s: { draft: string; phase: string }) => S): S => selector({ draft: '旧原文', phase: 'plain' }),
      set: () => {},
    }
    expect(() => {
      render(
        <>
          <EnhanceButton {...({ t, sessionId: 's1', useInput: bare.useInput, inputActions: { setDraft: vi.fn() } } as never)} />
          <ResultDock {...({ t, sessionId: 's1', useInput: bare.useInput, inputActions: { setDraft: vi.fn() } } as never)} />
          <UndoBar {...({ t, sessionId: 's1', useInput: bare.useInput, inputActions: { setDraft: vi.fn() } } as never)} />
        </>,
      )
    }).not.toThrow()
    // The button is on screen and no guard fired during render. A click in this
    // state refuses (fail-closed) — asserted by the chip-view test above.
    expect(enhanceButton()).toBeTruthy()
    expect(screen.queryByText(zh['error.occurrences'])).toBeNull()
    expect(input).toBeDefined()
  })
})

describe('attachment notice', () => {
  afterEach(cleanup)

  it('forwards the request-time attachment count', async () => {
    const input = makeFakeInput({ draft: '旧原文', attachmentIds: ['a1' as never, 'a2' as never] })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    expect(requestEnhance).toHaveBeenCalledWith({ sessionId: 's1', text: '旧原文', attachments: { count: 2 } }, expect.anything())
  })

  it('leaves the request body untouched without attachments', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    expect(requestEnhance).toHaveBeenCalledWith({ sessionId: 's1', text: '旧原文' }, expect.anything())
  })

  it('reports the request-time count in the context tooltip', async () => {
    const input = makeFakeInput({ draft: '旧原文', attachmentIds: ['a1' as never] })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(zh['panel.contextUsage']))
    expect(screen.getByText(zh['panel.attachmentsCount'].replace('{count}', '1'))).toBeTruthy()
  })

  it('omits the line when the draft carries no attachment', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(zh['panel.contextUsage']))
    expect(document.querySelector('.dsh-pe-context-attachments')).toBeNull()
  })
})

describe('enhance → apply → undo loop', () => {
  afterEach(cleanup)

  it('runs the full loop: loading → result → apply fills back and raises the undo bar → undo restores', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({
      text: '增强文本',
      provider: 'p',
      model: 'm',
      elapsedMs: 5,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 1545, cacheReadTokens: 3 },
    })

    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
    // The call's token total rides the meta line next to model and duration,
    // with the input/output/cache breakdown on hover.
    const tokenText = screen.getByText('1,545 tokens')
    expect(tokenText).toBeTruthy()
    expect(tokenText.getAttribute('title')).toContain('输入 10')
    expect(tokenText.getAttribute('title')).toContain('输出 5')
    // A cache counter appears only when the provider reported one above zero:
    // cache reads show here, cache writes stay hidden.
    expect(tokenText.getAttribute('title')).toContain('缓存读取 3')
    expect(tokenText.getAttribute('title')).not.toContain('缓存写入')
    expect(requestEnhance).toHaveBeenCalledWith({ sessionId: 's1', text: '旧原文' }, expect.anything())

    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')
    // The undo bar must survive React batching: the pushed entry stays even
    // though the draft just changed to the applied text (regression lock for
    // the apply → pushUndo → setDraft → UndoBar ordering).
    expect(screen.getByRole('button', { name: zh['undo.undo'] })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(setDraft).toHaveBeenLastCalledWith('旧原文')
    expect(screen.getByRole('button', { name: zh['panel.apply'] })).toBeTruthy()
  })

  it('never flashes the dock undo bar when the card is dismissed by sending', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))

    // Send: the host publishes `sending` while the applied text is still in the
    // composer. ResultDock's auto-close effect drops the card on that commit,
    // which used to hand the dock row one frame in which all three visibility
    // conditions held — the flash this test locks down.
    act(() => {
      input.set({ phase: 'sending' })
    })
    expect(document.querySelector('.dsh-pe-panel')).toBeNull()
    expect(document.querySelector('.dsh-pe-undo')).toBeNull()

    // The host consumes the draft when the turn is accepted; the row must stay
    // out even though the undo entry itself is still on the stack.
    act(() => {
      input.set({ phase: 'plain', draft: '' })
    })
    expect(document.querySelector('.dsh-pe-undo')).toBeNull()
  })

  it('still raises the dock undo bar when the card is closed by hand', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    fireEvent.click(screen.getByRole('button', { name: zh['panel.close'] }))

    // Closing by hand is the case the row exists for: same draft, same entry,
    // but the composer is idle, so the affordance must be offered.
    expect(document.querySelector('.dsh-pe-undo')).toBeTruthy()
  })

  it('marks the result stale (both ways) when the draft changes after the request started', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    // User edits during the result view → stale warning appears…
    act(() => {
      input.set({ draft: '编辑后的新文本' })
    })
    expect(await screen.findByText(`⚠ ${zh['panel.stale.warn']}`)).toBeTruthy()
    // …and disappears again when the draft matches the source text.
    act(() => {
      input.set({ draft: '旧原文' })
    })
    await screen.findByText('增强文本')
    expect(screen.queryByText(`⚠ ${zh['panel.stale.warn']}`)).toBeNull()
  })

  it('disables regenerate when the draft is empty and explains why', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    act(() => {
      input.set({ draft: '   ' })
    })

    const regenerate = screen.getByRole('button', { name: zh['panel.regenerate'] })
    expect(regenerate.getAttribute('aria-disabled')).toBe('true')
    expect(await screen.findByText(`⚠ ${zh['panel.stale.empty']}`)).toBeTruthy()
    // The click is refused: no second model call, no pending label.
    fireEvent.click(regenerate)
    expect(requestEnhance).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: zh['panel.regenerate'] })).toBeTruthy()

    // Typing again re-enables the same button.
    act(() => {
      input.set({ draft: '新文本' })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: zh['panel.regenerate'] }).getAttribute('aria-disabled')).toBeNull())
  })

  it('applying over a diverged draft pushes the CURRENT draft as undo original', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    act(() => {
      input.set({ draft: '用户编辑的新文本' })
    })
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenLastCalledWith('增强文本')
    // Undo restores the user's latest edits, not the stale pre-enhance text.
    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(setDraft).toHaveBeenLastCalledWith('用户编辑的新文本')
  })

  it('regenerates from the current draft after applying', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance)
      .mockResolvedValueOnce({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })
      .mockResolvedValueOnce({ text: '增强文本 2', provider: 'p', model: 'm', elapsedMs: 6 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')

    fireEvent.click(screen.getByRole('button', { name: zh['panel.regenerate'] }))
    expect(requestEnhance).toHaveBeenCalledTimes(2)
    expect(vi.mocked(requestEnhance).mock.calls[1][0]).toMatchObject({ text: '增强文本' })
    expect(await screen.findByText('增强文本 2')).toBeTruthy()
    // The button disappears while the next round streams, so the confirmation
    // can only appear once that round settles: it relabels the button and then
    // returns to its normal text on its own.
    expect(await screen.findByRole('button', { name: zh['panel.regenerated'] })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: zh['panel.regenerate'] })).toBeTruthy(), { timeout: 3500 })
  }, 10000)

  it('keeps every state-switched footer label in one swap cell', async () => {
    // Width stability itself is CSS (all labels in one grid cell, see
    // styles.ts). This pins the DOM contract that makes it work: every switched
    // label group renders ALL of its labels and marks exactly one visible, so
    // the grid always reserves the widest one — in both languages.
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')

    /** Assert one swap group: several labels, exactly one visible, the rest inert. */
    const assertSwapped = (group: Element): void => {
      const labels = Array.from(group.children)
      expect(labels.length).toBeGreaterThanOrEqual(2)
      expect(labels.filter((label) => label.classList.contains('on'))).toHaveLength(1)
      for (const label of labels) {
        const active = label.classList.contains('on')
        expect(label.getAttribute('aria-hidden')).toBe(active ? null : 'true')
      }
    }

    // Result phase: regenerate (2 labels), copy (3 labels), fill (2 labels).
    const groups = Array.from(document.querySelectorAll('.dsh-pe-foot .dsh-pe-swap'))
    expect(groups).toHaveLength(3)
    for (const group of groups) assertSwapped(group)
    // Every button that owns a swap group carries the shared width floor, so a
    // collapse to empty labels cannot shrink it to the icon.
    for (const group of groups) expect(group.closest('.dsh-pe-btn-floor')).not.toBeNull()

    // Applied state swaps the primary button for undo, which must keep both the
    // group and the floor class.
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    const undoButton = screen.getByRole('button', { name: zh['undo.undo'] })
    expect(undoButton.classList.contains('dsh-pe-btn-floor')).toBe(true)
    const undoGroup = undoButton.querySelector('.dsh-pe-swap')
    expect(undoGroup).not.toBeNull()
    if (undoGroup !== null) assertSwapped(undoGroup)
  })

  it('confirms a successful copy on the copy button', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.resolve()) },
    })
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.copy'] }))
    expect(await screen.findByRole('button', { name: zh['panel.copied'] })).toBeTruthy()
  })

  it('offers no retry for a cancelled call', async () => {
    // A cancelled call is not a failure worth repeating: the panel says it was
    // cancelled and must not pair that with a retry button.
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockRejectedValue(new EnhanceClientError({ code: 'internal', message: '', params: { reason: 'cancelled' } } as never))

    fireEvent.click(enhanceButton())
    expect(await screen.findByText(zh['error.client.cancelled'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: zh['panel.retry'] })).toBeNull()
  }, 10000)

  it('keeps the retry button for a transport failure', async () => {
    // The cancelled carve-out must not swallow the retryable internal reasons.
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockRejectedValue(new EnhanceClientError({ code: 'internal', message: '', params: { reason: 'unreachable' } } as never))

    fireEvent.click(enhanceButton())
    expect(await screen.findByText(zh['error.client.unreachable'])).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['panel.retry'] })).toBeTruthy()
  }, 10000)

  it('collapses to the header and footer rows and expands again', async () => {
    // Collapsing hides the body only: the header row (with the toggle) and the
    // footer row (with the actions) stay usable, which is the whole point.
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')

    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    // The body stays mounted so the fold can animate; the collapsed state is
    // expressed by the panel class and by the body leaving the a11y tree.
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()
    expect(document.querySelector('.dsh-pe-body')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: zh['panel.copy'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: zh['panel.expand'] })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.expand'] }))
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).toBeNull()
    expect(document.querySelector('.dsh-pe-body')?.getAttribute('aria-hidden')).toBeNull()
    expect(await screen.findByText('增强文本')).toBeTruthy()
  }, 10000)

  it('marks a hidden warning on the collapsed header', async () => {
    // A stale or truncated result must not fold away silently: the collapsed
    // header carries the marker the banner used to carry.
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    act(() => {
      input.set({ draft: '改了草稿' })
    })
    expect(await screen.findByText(`⚠ ${zh['panel.stale.warn']}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    // The banner is still mounted (the body is only collapsed), so the marker —
    // not the banner — is what tells the user a warning is folded away.
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()
    expect(document.querySelector('.dsh-pe-warn-dot')).not.toBeNull()
    // The marker carries the short state title, never the full banner copy.
    expect(document.querySelector('.dsh-pe-warn-dot')?.getAttribute('title')).toBe(zh['panel.stale.dot'])
  }, 10000)

  it('uses the short stale title on the collapsed marker even when the draft is empty', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    act(() => {
      input.set({ draft: '   ' })
    })
    expect(await screen.findByText(`⚠ ${zh['panel.stale.empty']}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    // The old title promised a regenerate that cannot run; the short marker
    // title is state-neutral and stays true for the empty draft too.
    expect(document.querySelector('.dsh-pe-warn-dot')?.getAttribute('title')).toBe(zh['panel.stale.dot'])
  }, 10000)

  it('uses the short truncated title on the collapsed marker', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5, truncated: true })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(await screen.findByText(`⚠ ${zh['panel.truncated']}`)).toBeTruthy()
    expect(document.querySelector('.dsh-pe-truncated')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    expect(document.querySelector('.dsh-pe-warn-dot')?.getAttribute('title')).toBe(zh['panel.truncated.dot'])
    expect(document.querySelector('.dsh-pe-warn-dot')?.classList.contains('is-danger')).toBe(true)
  }, 10000)

  it('hides the truncation banner once the draft changes, leaving only the stale banner', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5, truncated: true })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(await screen.findByText(`⚠ ${zh['panel.truncated']}`)).toBeTruthy()

    act(() => {
      input.set({ draft: '改了草稿' })
    })
    expect(await screen.findByText(`⚠ ${zh['panel.stale.warn']}`)).toBeTruthy()
    expect(screen.queryByText(`⚠ ${zh['panel.truncated']}`)).toBeNull()
    expect(document.querySelector('.dsh-pe-truncated')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    const dot = document.querySelector('.dsh-pe-warn-dot')
    expect(dot?.getAttribute('title')).toBe(zh['panel.stale.dot'])
    expect(dot?.classList.contains('is-danger')).toBe(false)
  }, 10000)

  it('folds the card after applying the result', async () => {
    // Apply is the moment the card stops being needed: the text is in the
    // composer, so the card folds and stops covering the conversation.
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()
    // The footer stays usable, so undo is still one click away.
    expect(screen.getByRole('button', { name: zh['undo.undo'] })).toBeTruthy()
  }, 10000)

  it('leaves an already folded card folded when apply runs', async () => {
    // Clicking apply on a folded card must not restart the fold animation:
    // setCollapsed is a no-op when the card is already collapsed.
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()
  }, 10000)

  it('re-expands the card when undo runs', async () => {
    // Undo mirrors apply: the draft goes back, so the card re-opens to show the
    // result it came from (and expanding an open card stays a no-op).
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(setDraft).toHaveBeenLastCalledWith('旧原文')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).toBeNull()
  }, 10000)

  it('skips the fold transition when the animation setting is off', async () => {
    // foldAnimation: false marks the panel static; the CSS drops the transition
    // (and prefers-reduced-motion still wins inside that rule).
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, foldAnimation: false })
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(document.querySelector('.dsh-pe-panel.is-static')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['panel.collapse'] }))
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).not.toBeNull()
  }, 10000)

  it('leaves the card as it is when auto-fold is off', async () => {
    // autoFold: false keeps the user in control: apply no longer folds the card
    // and undo no longer re-opens it, while both still move the draft.
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: false, autoFold: false })
    const input = makeFakeInput({ draft: '旧原文' })
    const setDraft = vi.fn((text: string) => input.set({ draft: text }))
    renderComposer(input, { setDraft } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')

    fireEvent.click(screen.getByRole('button', { name: zh['panel.apply'] }))
    expect(setDraft).toHaveBeenCalledWith('增强文本')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['undo.undo'] }))
    expect(setDraft).toHaveBeenLastCalledWith('旧原文')
    expect(document.querySelector('.dsh-pe-panel.is-collapsed')).toBeNull()
  }, 10000)

  it('shows the reasoning effort the call actually used', async () => {
    // The card reports the effort of that call: `inherit` renders as the
    // default label instead of the raw word.
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5, reasoningEffort: 'inherit' })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(screen.getByText(new RegExp(`${zh['panel.effortDefault']}`))).toBeTruthy()
  }, 10000)

  it('shows the bare effort name with a capitalized first letter', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5, reasoningEffort: 'high' })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    // The badge shows the tier name only ("High"), not "推理 high".
    expect(screen.getByText(/· High ·/)).toBeTruthy()
    expect(screen.queryByText(/推理/)).toBeNull()
  }, 10000)

  it('leaves the badge alone when the host reports no effort', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    expect(screen.queryByText(/^推理/)).toBeNull()
  }, 10000)

  it('clears the copy-failure label after the notice window', async () => {
    // A failed copy must not pin the button on "copy failed" until the next
    // click: the label is a transient confirmation for both outcomes.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) },
    })
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    fireEvent.click(screen.getByRole('button', { name: zh['panel.copy'] }))
    expect(await screen.findByRole('button', { name: zh['panel.copyFailed'] })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: zh['panel.copy'] })).toBeTruthy(), { timeout: 3500 })
  }, 10000)

  it('regenerates from edits made after the result arrives', async () => {
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })

    fireEvent.click(enhanceButton())
    await screen.findByText('增强文本')
    act(() => {
      input.set({ draft: '2222' })
    })

    fireEvent.click(screen.getByRole('button', { name: zh['panel.regenerate'] }))
    expect(requestEnhance).toHaveBeenCalledTimes(2)
    expect(vi.mocked(requestEnhance).mock.calls[1][0]).toMatchObject({ text: '2222' })
  })

  it('ignores a click while this session is already enhancing (no orphaned panel swap)', async () => {
    const input = makeFakeInput({ draft: '草稿' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockReturnValue(new Promise(() => {}))

    fireEvent.click(enhanceButton())
    expect(await screen.findByText(zh['panel.loading'])).toBeTruthy()
    fireEvent.click(enhanceButton())
    // The loading panel is untouched — no error panel swap, request not orphaned.
    expect(screen.getByText(zh['panel.loading'])).toBeTruthy()
    expect(screen.queryByText(zh['error.phase'])).toBeNull()
  })
})

describe('incremental streaming display', () => {
  afterEach(cleanup)

  it('shows partial text while the call is in flight and settles on the final body', async () => {
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, streaming: true })
    const input = makeFakeInput({ draft: '旧原文' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's2')
    const result = { text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 }
    let release!: (value: typeof result) => void
    const gate = new Promise<typeof result>((resolve) => {
      release = resolve
    })
    vi.mocked(requestEnhanceStream).mockImplementation(async (_body, options) => {
      options.onDelta('增强')
      return gate
    })

    fireEvent.click(enhanceButton())
    // The first tokens are on screen long before the call settles.
    expect(await screen.findByText('增强')).toBeTruthy()
    expect(screen.getByText(zh['panel.streaming'])).toBeTruthy()
    expect(requestEnhance).not.toHaveBeenCalled()

    release(result)
    // …and the settled panel replaces the partial view with the real result.
    expect(await screen.findByText('增强文本')).toBeTruthy()
    expect(screen.queryByText(zh['panel.streaming'])).toBeNull()
  })

  it('drops deltas that arrive after the panel moved on', async () => {
    ui.openLoading({ sessionId: 'late', original: 'x', abort: () => {} })
    ui.settleResult('late', { text: 'done', provider: 'p', model: 'm', elapsedMs: 1 })
    ui.appendDelta('late', 'stale text')
    // The stale delta is buffered behind a microtask flush; the panel must
    // still be streaming-undefined after the flush has run.
    await Promise.resolve()
    expect(ui.getPanel()?.streaming).toBeUndefined()
    ui.closePanel()
  })

  // Regression for the P1-1 batching optimization: 50 deltas in the same JS
  // turn must collapse into a single panelState mutation + one subscriber
  // notification, so React re-renders the preview panel exactly once instead
  // of 50 times during a fast model's first second of output.
  it('batches many same-turn deltas into a single panel update', async () => {
    const listener = vi.fn()
    const unsubscribe = ui.subscribe(listener)
    try {
      ui.openLoading({ sessionId: 'batch', original: 'x', abort: () => {} })
      const beforeBatching = listener.mock.calls.length
      for (let i = 0; i < 50; i++) ui.appendDelta('batch', `tok${i} `)
      // Synchronously, the panel is still the pre-batch snapshot — the
      // batching has scheduled the flush but not run it.
      expect(ui.getPanel()?.streaming).toBeUndefined()
      // No listener fire happened yet: the buffer absorbed everything.
      expect(listener.mock.calls.length).toBe(beforeBatching)
      await Promise.resolve()
      expect(ui.getPanel()?.streaming).toBe(
        'tok0 tok1 tok2 tok3 tok4 tok5 tok6 tok7 tok8 tok9 tok10 tok11 tok12 tok13 tok14 tok15 tok16 tok17 tok18 tok19 tok20 tok21 tok22 tok23 tok24 tok25 tok26 tok27 tok28 tok29 tok30 tok31 tok32 tok33 tok34 tok35 tok36 tok37 tok38 tok39 tok40 tok41 tok42 tok43 tok44 tok45 tok46 tok47 tok48 tok49 ',
      )
      // One notify for the whole batch, not 50.
      expect(listener.mock.calls.length).toBe(beforeBatching + 1)
    } finally {
      unsubscribe()
      ui.closePanel()
    }
  })
})

describe('quick settings menu', () => {
  afterEach(() => {
    cleanup()
    setSettingsWriter(undefined)
    clearCatalogCache()
    clearQuickModelCache()
  })

  /** Install a writer double and render one composer. */
  function setupMenu(): { set: ReturnType<typeof vi.fn>; button: HTMLButtonElement } {
    const set = vi.fn(async () => true)
    setSettingsWriter({ set, unset: vi.fn(async () => true) })
    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    return { set, button: enhanceButton() }
  }

  it('writes the picked tier and the picked output shape', async () => {
    const { set, button } = setupMenu()
    fireEvent.contextMenu(button)
    expect(await screen.findByRole('menu')).toBeTruthy()

    // The tier list starts folded into its cell, like the shell's model menu.
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: zh['menu.effortDefault'] }))
    await waitFor(() => expect(set).toHaveBeenCalledWith('reasoningEffort', 'inherit'))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    // The output shape is a second drilled cell on the same card.
    fireEvent.contextMenu(button)
    await screen.findByRole('menu')
    fireEvent.click(screen.getByRole('menuitem', { name: /输出形态/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: zh['settings.mode.structured'] }))
    await waitFor(() => expect(set).toHaveBeenCalledWith('mode', 'structured'))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('turns the route row into a model picker with a search field', async () => {
    setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, provider: 'zhipu', model: 'glm-4.6' })
    const { button } = setupMenu()
    fireEvent.contextMenu(button)
    const row = await screen.findByText(zh['menu.model'])
    // The value is the route it would call, and the row is now a control.
    expect(row.parentElement?.textContent).toContain('zhipu / glm-4.6')
    const cell = row.closest('button')
    expect(cell).not.toBeNull()
    fireEvent.click(cell as HTMLElement)
    expect(await screen.findByRole('searchbox')).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: zh['menu.followSession'] })).toBeTruthy()
  })

  it('lists registered models by provider and pins the picked one', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input)
        if (href.includes('/llm-providers')) {
          return json({
            ok: true,
            value: {
              providers: [
                { id: 'deepseek-account', name: 'DeepSeek', registered: true },
                { id: 'zhipu', name: 'Zhipu', registered: true },
                { id: 'dormant', name: 'Dormant', registered: false },
              ],
            },
          })
        }
        if (href.includes('provider=deepseek-account')) return json({ ok: true, value: { models: [{ id: 'deepseek-v4', name: 'DeepSeek-V4' }] } })
        if (href.includes('provider=zhipu')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        return json({ ok: false })
      }),
    )
    try {
      const unset = vi.fn(async () => true)
      const set = vi.fn(async () => true)
      setSettingsWriter({ set, unset })
      const input = makeFakeInput({ draft: '写个爬虫' })
      renderComposer(input, { setDraft: vi.fn() } as never, 's1')
      const button = enhanceButton()
      fireEvent.contextMenu(button)
      await screen.findByRole('menu')
      fireEvent.click(screen.getByRole('menuitem', { name: /^模型/ }))
      expect(await screen.findByText(zh['menu.accountProvider'])).toBeTruthy()
      expect(await screen.findByText('GLM-4.6')).toBeTruthy()
      // The dormant provider is not offered at all.
      expect(screen.queryByText('Dormant')).toBeNull()

      // Search filters within the groups (ordered subsequence, shell rule).
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'qwen' } })
      expect(screen.queryByText('GLM-4.6')).toBeNull()
      expect(screen.getByText(zh['menu.noMatch'])).toBeTruthy()
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'glm' } })
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'GLM-4.6' }))
      await waitFor(() => expect(unset).toHaveBeenCalledWith('model'))
      await waitFor(() => expect(set).toHaveBeenCalledWith('provider', 'zhipu'))
      await waitFor(() => expect(set).toHaveBeenCalledWith('model', 'glm-4.6'))
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('shows the catalog names for a pinned route when the host advertises them', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input)
        if (href.includes('llm-providers')) return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        if (href.includes('llm-route-check')) return json({ ok: true, value: { available: true } })
        return json({ ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } })
      }),
    )
    try {
      setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, provider: 'zhipu', model: 'glm-4.6' })
      const { button } = setupMenu()
      fireEvent.contextMenu(button)
      const row = await screen.findByText(zh['menu.model'])
      await waitFor(() => expect(row.parentElement?.textContent).toContain('Zhipu / GLM-4.6'))
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('explains an empty tier list for a pinned model instead of showing DeepSeek tiers', async () => {
    const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const href = String(input)
        if (href.includes('llm-providers')) return json({ ok: true, value: { providers: [{ id: 'zhipu', name: 'Zhipu', registered: true }] } })
        if (href.includes('llm-models')) return json({ ok: true, value: { models: [{ id: 'glm-4.6', name: 'GLM-4.6' }] } })
        // The pinned route declares no reasoning tiers.
        return json({ ok: true, value: { efforts: [], source: 'unavailable', reason: 'no-efforts' } })
      }),
    )
    try {
      setClientSettings({ ...DEFAULT_CLIENT_SETTINGS, provider: 'zhipu', model: 'glm-4.6' })
      const { button } = setupMenu()
      fireEvent.contextMenu(button)
      await screen.findByRole('menu')
      fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
      // Only the "model default" row, plus a line that says why it is alone.
      expect(screen.queryByRole('menuitemradio', { name: 'Off' })).toBeNull()
      expect(await screen.findByText(zh['menu.effortsNone'])).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('follows a model switched outside the card while it is open', async () => {
    // One session directory double: the snapshot swaps when the host reports a
    // model change, exactly like ctx.modelDirectories in the running shell.
    let snapshot: unknown = {
      current: { provider: 'deepseek-official', model: 'deepseek-flash' },
      groups: [
        {
          id: 'deepseek-official',
          models: [
            {
              id: 'deepseek-flash',
              reasoning: {
                efforts: [
                  { id: 'off', name: 'Off' },
                  { id: 'low', name: 'Low' },
                ],
              },
            },
          ],
        },
      ],
    }
    const listeners = new Set<() => void>()
    const directory = {
      store: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
      load: async () => undefined,
    }
    const ctx = { modelDirectories: { directoryFor: () => directory } }
    const set = vi.fn(async () => true)
    setSettingsWriter({ set, unset: vi.fn(async () => true) })

    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1', ctx)
    fireEvent.contextMenu(enhanceButton())
    await screen.findByRole('menu')
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(await screen.findByRole('menuitemradio', { name: 'Off' })).toBeTruthy()

    // The session switches to another model that declares its own tier.
    snapshot = {
      current: { provider: 'qwen', model: 'qwen3.8-flash' },
      groups: [{ id: 'qwen', models: [{ id: 'qwen3.8-flash', reasoning: { efforts: [{ id: 'fast', name: 'Fast' }] } }] }],
    }
    for (const listener of listeners) listener()

    // The open card swaps the list instead of keeping the old model's tiers, and
    // the stored tier is cleared because the new model never declares it.
    expect(await screen.findByRole('menuitemradio', { name: 'Fast' })).toBeTruthy()
    await waitFor(() => expect(set).toHaveBeenCalledWith('reasoningEffort', 'inherit'))
    await waitFor(() => expect(screen.queryByRole('menuitemradio', { name: 'Low' })).toBeNull())
    expect(screen.queryByRole('menuitemradio', { name: 'Off' })).toBeNull()
  })

  it('keeps the stored tier when the current model declares it', async () => {
    const snapshot: unknown = {
      current: { provider: 'deepseek-official', model: 'deepseek-flash' },
      groups: [{ id: 'deepseek-official', models: [{ id: 'deepseek-flash', reasoning: { efforts: [{ id: 'off', name: 'Off' }] } }] }],
    }
    const directory = {
      store: { getSnapshot: () => snapshot, subscribe: () => () => {} },
      load: async () => undefined,
    }
    const ctx = { modelDirectories: { directoryFor: () => directory } }
    const set = vi.fn(async () => true)
    setSettingsWriter({ set, unset: vi.fn(async () => true) })

    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1', ctx)
    fireEvent.contextMenu(enhanceButton())
    await screen.findByRole('menu')
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    expect(await screen.findByRole('menuitemradio', { name: 'Off' })).toBeTruthy()
    expect(set).not.toHaveBeenCalled()
  })

  it('shows the follow-session label when no provider is pinned', async () => {
    const { button } = setupMenu()
    fireEvent.contextMenu(button)
    await screen.findByRole('menu')
    const row = screen.getByText(zh['menu.model'])
    expect(row.parentElement?.textContent).toContain(zh['menu.modelFollow'])
  })

  it('advertises the right-click entry while the draft is empty', () => {
    setSettingsWriter({ set: vi.fn(async () => true), unset: vi.fn(async () => true) })
    const input = makeFakeInput({ draft: '   ' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    const button = enhanceButton()
    // The plain click is inert, but the card is still one right-click away, and
    // the tooltip says so in the empty state too.
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.title).toContain('提示词增强')
    expect(button.title).toContain('请先输入')
    expect(button.title).toContain('右键配置')
  })

  it('closes the card before the tier write settles', async () => {
    const { calls } = deferredWriter()
    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.contextMenu(enhanceButton())
    await screen.findByRole('menu')
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: zh['menu.effortDefault'] }))
    // Closing does not wait for the host: the card is gone, the write is in flight.
    expect(screen.queryByRole('menu')).toBeNull()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.value).toBe('inherit')
    calls[0]!.resolve(true)
  })

  it('closes without writing when the picked tier is already stored', async () => {
    const { set, button } = setupMenu()
    fireEvent.contextMenu(button)
    await screen.findByRole('menu')
    fireEvent.click(screen.getByRole('menuitem', { name: /推理等级/ }))
    // The fixture stores `off`, so picking Off changes nothing.
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Off' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(set).not.toHaveBeenCalled()
  })

  it('toggles the context switch without closing the menu', async () => {
    const { set, button } = setupMenu()
    fireEvent.contextMenu(button)
    const toggle = await screen.findByRole('switch', { name: /上下文/ })
    fireEvent.click(toggle)
    await waitFor(() => expect(set).toHaveBeenCalledWith('contextAware', false))
    // The card stays open and the switch already shows the written state.
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(toggle.getAttribute('aria-checked')).toBe('false')
  })

  it('rolls the switch back and reports a refused write in place', async () => {
    const set = vi.fn(async () => false)
    setSettingsWriter({ set, unset: vi.fn(async () => true) })
    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.contextMenu(enhanceButton())
    const toggle = await screen.findByRole('switch', { name: /上下文/ })
    fireEvent.click(toggle)
    // Refused: the switch returns to its stored state, the card shows the error.
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('closes on a pointer press outside the card', async () => {
    const { button } = setupMenu()
    fireEvent.contextMenu(button)
    const menu = await screen.findByRole('menu')
    // A press inside the card (the switch row) must not dismiss it…
    fireEvent.mouseDown(menu)
    expect(screen.queryByRole('menu')).toBeTruthy()
    // …and the same press on the page does.
    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  /** Install a writer whose writes stay pending until the test resolves them. */
  function deferredWriter(): { calls: { value: unknown; resolve: (ok: boolean) => void }[] } {
    const calls: { value: unknown; resolve: (ok: boolean) => void }[] = []
    const set = vi.fn(
      (_field: string, value: unknown) =>
        new Promise<boolean>((resolve) => {
          calls.push({ value, resolve })
        }),
    )
    setSettingsWriter({ set, unset: vi.fn(async () => true) })
    return { calls }
  }

  /** Open the card on a fresh composer and return its switch. */
  async function openSwitch(): Promise<HTMLElement> {
    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    fireEvent.contextMenu(enhanceButton())
    return screen.findByRole('switch', { name: /上下文/ })
  }

  it('coalesces fast context flips onto the last click', async () => {
    const { calls } = deferredWriter()
    const toggle = await openSwitch()
    fireEvent.click(toggle) // 开 -> 关
    fireEvent.click(toggle) // 关 -> 开
    // One write in flight, and it carries the first click only.
    expect(calls).toHaveLength(1)
    expect(calls[0]?.value).toBe(false)
    calls[0]!.resolve(true)
    // The newest click is then written once the first settles.
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.value).toBe(true)
    calls[1]!.resolve(true)
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
  })

  it('flushes the newest intent when the card closes and repairs a late write', async () => {
    const { calls } = deferredWriter()
    const toggle = await openSwitch()
    fireEvent.click(toggle) // 写 false（在飞）
    fireEvent.click(toggle) // 意图 true，排队
    fireEvent.keyDown(document, { key: 'Escape' })
    // Closing starts the pending intent at once instead of queueing behind the write.
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]?.value).toBe(true)
    // The older write lands late and overwrites the host: the newest intent is re-asserted.
    calls[0]!.resolve(true)
    await waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[2]?.value).toBe(true)
    calls[1]!.resolve(true)
    calls[2]!.resolve(true)
  })

  it('closes on Escape', async () => {
    const { button } = setupMenu()
    fireEvent.contextMenu(button)
    await screen.findByRole('menu')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('opens from the keyboard menu key', async () => {
    const { button } = setupMenu()
    button.focus()
    fireEvent.keyDown(document, { key: 'F10', shiftKey: true })
    expect(await screen.findByRole('menu')).toBeTruthy()
  })

  it('swallows the click that follows a long press', async () => {
    // The press opens the menu; the release must not also start an enhancement.
    const { button } = setupMenu()
    fireEvent.pointerDown(button, { clientX: 10, clientY: 10 })
    await screen.findByRole('menu', undefined, { timeout: 2500 })
    fireEvent.pointerUp(button, { clientX: 10, clientY: 10 })
    fireEvent.click(button)
    expect(requestEnhance).not.toHaveBeenCalled()
  }, 10000)

  it('drills into the tier pane and Escape backs out before closing', async () => {
    const { button } = setupMenu()
    fireEvent.contextMenu(button)
    await screen.findByRole('menu')

    // Root pane: one cell plus the context switch, no tier radios. The cell
    // prints the tier's display name, not the stored lowercase id.
    const cell = screen.getByRole('menuitem', { name: /推理等级/ })
    expect(cell.textContent).toContain('Off')
    expect(screen.queryByRole('menuitemradio')).toBeNull()

    fireEvent.click(cell)
    expect(screen.queryByRole('menuitem', { name: /推理等级/ })).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getAllByRole('menuitemradio').length).toBeGreaterThan(1)

    // Escape backs out of the pane, a second Escape closes the menu.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(await screen.findByRole('menuitem', { name: /推理等级/ })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('does not register the entry when no writer is installed', async () => {
    // No writer: no menu, and the button still enhances as before.
    const input = makeFakeInput({ draft: '写个爬虫' })
    renderComposer(input, { setDraft: vi.fn() } as never, 's1')
    vi.mocked(requestEnhance).mockResolvedValue({ text: '增强文本', provider: 'p', model: 'm', elapsedMs: 5 })
    fireEvent.contextMenu(enhanceButton())
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(enhanceButton())
    expect(await screen.findByText('增强文本')).toBeTruthy()
  }, 10000)
})
