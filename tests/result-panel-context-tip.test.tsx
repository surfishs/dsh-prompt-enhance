// @vitest-environment jsdom
/**
 * The context bubble is placed from the trigger's viewport rect, not anchored by
 * CSS inside the card.
 *
 * The card clips its own overflow (rounded corners + the fold animation), and a
 * folded card leaves only the header above the footer. An anchored bubble grows
 * out of the card and gets cut in half — the bug this pins down.
 * @module tests/result-panel-context-tip
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContextUsage, EnhanceResult } from '../src/shared/protocol'
import { zh } from '../src/client/locales'
import { ResultPanel } from '../src/client/ResultPanel'
import type { PanelState } from '../src/client/ui-state'

/** Minimal zh renderer matching the shell's `t` seat (placeholders + unknown keys). */
const t = ((key: string, params?: Record<string, unknown>): string => {
  let text = (zh as Record<string, string>)[key] ?? key
  for (const [name, value] of Object.entries(params ?? {})) text = text.split(`{${name}}`).join(String(value))
  return text
}) as TranslateNS<'dsh-prompt-enhance'>

/** A context window that fitted cleanly. */
const USAGE: ContextUsage = { usedTurns: 4, maxTurns: 8, usedChars: 2887, maxChars: 4000, droppedTurns: 0, limitedBy: null, cutTurn: false }

/** One result-phase panel state carrying the given context usage. */
const state = (usage: ContextUsage = USAGE): PanelState => ({
  sessionId: 's1',
  phase: 'result',
  original: '原文',
  result: { text: '增强后的文本', provider: 'deepseek', model: 'chat', elapsedMs: 1200, context: usage } as EnhanceResult,
})

/**
 * Stub one element's geometry, the way a real layout would report it.
 * @param element - the element to measure.
 * @param rect - the viewport rect it should report.
 * @returns the spy.
 */
const withRect = (element: Element, rect: { left: number; top: number }): ReturnType<typeof vi.spyOn> =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ ...rect, right: rect.left + 28, bottom: rect.top + 28, width: 28, height: 28, x: rect.left, y: rect.top, toJSON: () => ({}) } as DOMRect)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('context usage bubble placement', () => {
  it('sits the bubble 8px above the trigger measured in viewport coordinates', () => {
    const { container } = render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.mouseEnter(trigger)

    const bubble = screen.getByRole('tooltip')
    // jsdom's viewport is 768px tall: bottom = 768 - 500 + 8.
    expect(bubble.style.left).toBe('120px')
    expect(bubble.style.bottom).toBe('276px')
    expect(container.querySelector('.dsh-pe-context-tip')).not.toBeNull()
  })

  it('keeps the bubble off the viewport edge', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    // A rect that has left the viewport (a scrolled dock) still yields a visible
    // bubble rather than a negative offset.
    withRect(trigger, { left: -6, top: 780 })

    fireEvent.mouseEnter(trigger)

    const bubble = screen.getByRole('tooltip')
    expect(bubble.style.left).toBe('8px')
    expect(bubble.style.bottom).toBe('8px')
  })

  it('re-measures while open, so scrolling cannot strand the bubble', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })
    fireEvent.mouseEnter(trigger)

    withRect(trigger, { left: 40, top: 400 })
    fireEvent.scroll(document)
    const bubble = screen.getByRole('tooltip')
    expect(bubble.style.left).toBe('40px')
    expect(bubble.style.bottom).toBe('376px')

    // A resize is the other way the trigger's rect moves out from under it.
    withRect(trigger, { left: 60, top: 300 })
    fireEvent(window, new Event('resize'))
    expect(screen.getByRole('tooltip').style.left).toBe('60px')
  })

  it('places the bubble on a folded card, where there is no room above the footer', () => {
    const { container } = render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} collapsed />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    // The footer outlives the fold: only the body folds away.
    expect(container.querySelector('.dsh-pe-body .dsh-pe-context')).toBeNull()
    withRect(trigger, { left: 90, top: 640 })

    fireEvent.click(trigger)

    const bubble = screen.getByRole('tooltip')
    expect(bubble.style.left).toBe('90px')
    expect(bubble.style.bottom).toBe('136px')
  })

  it('closes on escape and on the second click', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 10, top: 10 })

    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()
    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
