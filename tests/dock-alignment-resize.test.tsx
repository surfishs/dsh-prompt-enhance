// @vitest-environment jsdom
/**
 * The dock entry follows the conversation column when the shell's own chrome
 * opens or closes.
 *
 * A sidebar or workspace toggle resizes the column INSIDE the viewport: neither
 * the window nor the document element changes size, so a one-shot measurement
 * leaves the entry at the old width and offset (too wide for the narrowed
 * column). The hook has to watch its own ancestor chain instead.
 * @module tests/dock-alignment-resize
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useDockAlignment } from '../src/client/useDockAlignment'

/** Every fake observer created during a test, so it can be fired on demand. */
const observers: FakeResizeObserver[] = []

/** A ResizeObserver stand-in: records targets, fires on demand. */
class FakeResizeObserver {
  readonly targets: Element[] = []
  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }
  observe(target: Element): void {
    this.targets.push(target)
  }
  unobserve(): void {
    /* not needed by the hook */
  }
  disconnect(): void {
    this.targets.length = 0
  }
  /** Deliver one notification, the way a resized box would. */
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

/** The hook alone: the anchor and the composer card are supplied by the test. */
function Harness(): React.ReactElement {
  const ref = useDockAlignment(true, 's1')
  return <div ref={ref} data-testid="dock" />
}

/**
 * Stub one element's geometry.
 * @param element - the element to measure.
 * @param rect - left and width; height and the rest are derived.
 * @returns nothing.
 */
function withRect(element: Element, rect: { left: number; width: number; height?: number }): void {
  const height = rect.height ?? 60
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left: rect.left,
    top: 0,
    right: rect.left + rect.width,
    bottom: height,
    width: rect.width,
    height,
    x: rect.left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

/**
 * Render the harness under a column that holds both the composer card and the
 * dock entry, mimicking the prompt plugin's slot layout.
 * @returns the three measured nodes.
 */
function renderShell(): { column: HTMLElement; card: HTMLElement; dock: HTMLElement } {
  const { getByTestId } = render(
    <div data-testid="column">
      <div data-testid="card" style={{ borderTopLeftRadius: '16px', backgroundColor: 'rgb(255, 255, 255)' }}>
        <button data-dsh-pe-key="s1" type="button" data-testid="anchor">
          增强
        </button>
      </div>
      <Harness />
    </div>,
  )
  return { column: getByTestId('column'), card: getByTestId('card'), dock: getByTestId('dock') }
}

beforeEach(() => {
  observers.length = 0
  // The hook throttles through requestAnimationFrame; run it inline so one
  // notification is one synchronous re-measure.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('dock alignment across a shell chrome change', () => {
  it('watches the entry ancestors, not only the document element', () => {
    const { column, dock } = renderShell()
    const observer = observers[0]
    expect(observer).toBeDefined()
    // The column itself is what a sidebar toggle resizes.
    expect(observer!.targets).toContain(column)
    expect(observer!.targets).toContain(document.documentElement)
    expect(observer!.targets).not.toContain(dock)
  })

  it('copies the composer width and left margin, then follows a narrowed column', () => {
    const { column, card, dock } = renderShell()
    // Before the toggle: a wide column with the card at 100px.
    withRect(column, { left: 0, width: 1400 })
    withRect(card, { left: 100, width: 400 })
    withRect(dock, { left: 0, width: 400 })

    observers[0]!.trigger()

    expect(dock.style.width).toBe('400px')
    expect(dock.style.marginLeft).toBe('100px')

    // Sidebar opens: the column narrows, the card is narrower and further
    // right. The window and the document element never change size here. (The
    // card stays above the hook's 360px plausibility floor, as the real composer
    // card does: its width is capped at no less than its 680px content clamp.)
    withRect(column, { left: 0, width: 1000 })
    withRect(card, { left: 320, width: 380 })
    // The entry already sits at the old margin, so the new margin is derived
    // from where it actually renders.
    withRect(dock, { left: 100, width: 380 })

    observers[0]!.trigger()

    expect(dock.style.width).toBe('380px')
    expect(dock.style.marginLeft).toBe('320px')
  })

  it('drops the copy-back when no composer can be measured', () => {
    const { card, dock } = renderShell()
    withRect(card, { left: 100, width: 400 })
    withRect(dock, { left: 0, width: 400 })
    observers[0]!.trigger()
    expect(dock.style.width).toBe('400px')

    // The card vanishes (session switched before its composer mounted): the
    // entry returns to the host's full width instead of keeping a stale number.
    document.querySelector('[data-dsh-pe-key="s1"]')?.remove()
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0, left: 0, top: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)

    observers[0]!.trigger()

    expect(dock.style.width).toBe('')
    expect(dock.style.marginLeft).toBe('')
  })
})
