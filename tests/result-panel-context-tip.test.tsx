// @vitest-environment jsdom
/**
 * The context bubble is portaled to `document.body` and placed from the
 * trigger's viewport rect.
 *
 * Two ancestors force both halves: the card clips its own overflow (rounded
 * corners + the fold), and the composer seat declares `will-change: transform`,
 * which makes it the containing block for `position: fixed` descendants — a
 * bubble left inside the composer is positioned against the seat and lands a
 * sidebar-width to the right (the bug this pins down).
 * @module tests/result-panel-context-tip
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  it('renders the bubble at the document body, clear of the card and the composer seat', () => {
    const { container } = render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.focus(trigger)

    const bubble = screen.getByRole('tooltip')
    // Body-level is what keeps the seat's `will-change: transform` from becoming
    // the bubble's containing block; anywhere inside the card is also clipped.
    expect(bubble.parentElement).toBe(document.body)
    expect(bubble.closest('.dsh-pe-panel')).toBeNull()
    expect(container.querySelector('.dsh-pe-context-tip')).toBeNull()
  })

  it('sits the bubble 8px above the trigger measured in viewport coordinates', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.focus(trigger)

    const bubble = screen.getByRole('tooltip')
    // jsdom's viewport is 768px tall: bottom = 768 - 500 + 8.
    expect(bubble.style.left).toBe('120px')
    expect(bubble.style.bottom).toBe('276px')
  })

  it('keeps the bubble off the viewport edge', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    // A rect that has left the viewport (a scrolled dock) still yields a visible
    // bubble rather than a negative offset.
    withRect(trigger, { left: -6, top: 780 })

    fireEvent.focus(trigger)

    const bubble = screen.getByRole('tooltip')
    expect(bubble.style.left).toBe('8px')
    expect(bubble.style.bottom).toBe('8px')
  })

  it('re-measures while open, so scrolling cannot strand the bubble', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })
    fireEvent.focus(trigger)

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

describe('context usage bubble timing', () => {
  it('waits 300ms on hover and cancels the open when the pointer leaves first', () => {
    vi.useFakeTimers()
    try {
      render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
      const trigger = screen.getByLabelText(zh['panel.contextUsage'])
      withRect(trigger, { left: 120, top: 500 })

      fireEvent.mouseEnter(trigger)
      expect(screen.queryByRole('tooltip')).toBeNull()
      act(() => {
        vi.advanceTimersByTime(299)
      })
      expect(screen.queryByRole('tooltip')).toBeNull()

      // A pass-over must not flash the bubble after the pointer has gone.
      fireEvent.mouseLeave(trigger)
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.queryByRole('tooltip')).toBeNull()

      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.queryByRole('tooltip')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens at once on keyboard focus and on click', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.focus(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()
  })
})

describe('context usage bubble pinning', () => {
  it('keeps a clicked bubble open through blur and pointer leave', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()

    // The click turns the transient bubble into a pinned one: neither moving
    // the pointer away nor losing focus may dismiss it.
    fireEvent.mouseLeave(trigger)
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()

    // The same click toggles it off again.
    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('pins a bubble that a hover had already opened', () => {
    vi.useFakeTimers()
    try {
      render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
      const trigger = screen.getByLabelText(zh['panel.contextUsage'])
      withRect(trigger, { left: 120, top: 500 })

      fireEvent.mouseEnter(trigger)
      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.queryByRole('tooltip')).not.toBeNull()

      fireEvent.click(trigger)
      fireEvent.mouseLeave(trigger)
      // Already open from the hover: the click pins it instead of closing it.
      expect(screen.queryByRole('tooltip')).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('dismisses a pinned bubble on a press outside the trigger', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.click(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('dismisses a pinned bubble on escape even after focus has moved on', () => {
    render(<ResultPanel state={state()} t={t} onApply={() => {}} onCancel={() => {}} />)
    const trigger = screen.getByLabelText(zh['panel.contextUsage'])
    withRect(trigger, { left: 120, top: 500 })

    fireEvent.click(trigger)
    // A pinned bubble survives the blur; Escape must still reach it.
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).not.toBeNull()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
