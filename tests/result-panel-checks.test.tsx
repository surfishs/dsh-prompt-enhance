// @vitest-environment jsdom
/**
 * The result card's contract-check row: one non-blocking warning, hidden while
 * a stale draft or a truncated body already owns the warning slot.
 * @module tests/result-panel-checks
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContractCheck, EnhanceResult } from '../src/shared/protocol'
import { zh } from '../src/client/locales'
import { ResultPanel } from '../src/client/ResultPanel'
import type { PanelState } from '../src/client/ui-state'

/** Minimal zh renderer matching the shell's `t` seat (placeholders + unknown keys). */
const t = ((key: string, params?: Record<string, unknown>): string => {
  let text = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.split(`{${name}}`).join(String(value))
  return text
}) as TranslateNS<'dsh-prompt-enhance'>

/** One result-phase panel state, with the checks under test. */
const state = (checks: ContractCheck[], extra: Partial<EnhanceResult> = {}, panel: Partial<PanelState> = {}): PanelState => ({
  sessionId: 's1',
  phase: 'result',
  original: '原文',
  result: { text: '增强后的文本', provider: 'deepseek', model: 'chat', elapsedMs: 1200, checks, ...extra },
  ...panel,
})

/** Render one result card; returns the container. */
const renderPanel = (panel: PanelState, collapsed = false): HTMLElement => render(<ResultPanel state={panel} t={t} onApply={() => {}} onCancel={() => {}} collapsed={collapsed} />).container

afterEach(() => {
  cleanup()
})

describe('result card contract checks', () => {
  it('renders a framework leak as a warning row', () => {
    const container = renderPanel(state([{ code: 'framework-leak', count: 1, detail: '<conversation_context>' }]))
    expect(container.textContent).toContain(zh['panel.checks.leak'])
  })

  it('keeps the unchanged body visible with a no-rewrite warning', () => {
    const container = renderPanel(state([{ code: 'no-rewrite', count: 1 }], { text: '原样文本' }))
    expect(container.textContent).toContain('原样文本')
    expect(container.textContent).toContain(zh['panel.checks.noRewrite'])
  })

  it('names the lost placeholders', () => {
    const container = renderPanel(state([{ code: 'placeholder-lost', count: 2, detail: '{{topic}}, {{n}}' }]))
    expect(container.textContent).toContain('占位符 {{topic}}, {{n}} 没有保留')
  })

  it('shows only the top check and counts the rest', () => {
    const container = renderPanel(
      state([
        { code: 'framework-leak', count: 1, detail: '<conversation_context>' },
        { code: 'placeholder-lost', count: 1, detail: '{{topic}}' },
      ]),
    )
    expect(container.textContent).toContain(zh['panel.checks.leak'])
    expect(container.textContent).toContain('等 1 项')
    expect(container.textContent).not.toContain('占位符 {{topic}} 没有保留')
  })

  it('hides checks while the draft is stale', () => {
    const container = renderPanel(state([{ code: 'placeholder-lost', count: 1, detail: '{{topic}}' }], {}, { stale: true }))
    expect(container.textContent).not.toContain('占位符 {{topic}} 没有保留')
    expect(container.textContent).toContain(zh['panel.stale.warn'])
  })

  it('lets truncation outrank checks', () => {
    const container = renderPanel(state([{ code: 'placeholder-lost', count: 1, detail: '{{topic}}' }], { truncated: true }))
    expect(container.textContent).not.toContain('占位符 {{topic}} 没有保留')
    expect(container.textContent).toContain(zh['panel.truncated'])
  })

  it('marks the collapsed header when only checks are present', () => {
    const container = renderPanel(state([{ code: 'placeholder-lost', count: 1, detail: '{{topic}}' }]), true)
    const dot = container.querySelector('.dsh-pe-warn-dot')
    expect(dot).not.toBeNull()
    expect(dot?.getAttribute('title')).toBe('结果有 1 项提示')
  })
})
