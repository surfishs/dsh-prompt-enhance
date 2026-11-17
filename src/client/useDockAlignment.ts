/**
 * Align a dock entry to the composer card below it.
 *
 * The host renders conversation.input.dock entries full-width, while the
 * composer card is narrower and may be centered or offset. This hook measures
 * the composer THIS entry belongs to and copies its width and left margin onto
 * the returned wrapper.
 *
 * The slot exposes no layout or geometry prop — its standard props are hooks,
 * `inputActions` and `sessionId` — so the DOM is the only source, and it is read
 * in three tiers, most specific first:
 * 1. the composer button this plugin renders for the SAME session (it carries
 *    {@link SESSION_ANCHOR_ATTRIBUTE}), then the rounded surface above it;
 * 2. any editor inside the entry's own parent — dock entries and the composer
 *    card usually share that container, which keeps a multi-session layout from
 *    measuring a neighbour's composer;
 * 3. any editor in the document (the original heuristic, kept as the last
 *    resort for a host whose DOM matches neither of the above).
 * When nothing is found, the host's full width is left untouched.
 * @module dsh-prompt-enhance/client/useDockAlignment
 */

import { useEffect, useRef, type RefObject } from 'react'

/** Everything the composer has been seen to use as its editable surface. */
const EDITOR_SELECTOR = 'textarea, [contenteditable="true"], [role="textbox"]'

/**
 * Attribute the composer button carries, keyed by the session UI key. The dock
 * entries read it to find the composer of the session they render for.
 */
export const SESSION_ANCHOR_ATTRIBUTE = 'data-dsh-pe-key'

/** Geometry that makes an element plausible as the composer's card. */
const CARD_MIN_WIDTH = 360
const CARD_MIN_HEIGHT = 48
const CARD_MIN_RADIUS = 4
const CARD_MAX_DEPTH = 12
const CARD_MAX_VIEWPORT_SHARE = 0.8
const CARD_CENTER_TOLERANCE = 40
const EDITOR_BELOW_SLACK = 4

/** Whether one element looks like the composer's rounded, opaque surface. */
function isCardSurface(node: HTMLElement, minWidth: number): boolean {
  const rect = node.getBoundingClientRect()
  if (rect.width < minWidth || rect.width <= CARD_MIN_WIDTH || rect.height <= CARD_MIN_HEIGHT) return false
  const style = getComputedStyle(node)
  return (parseFloat(style.borderTopLeftRadius) || 0) >= CARD_MIN_RADIUS && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
}

/** The nearest card surface above one element (the session-anchor path). */
function cardAround(start: HTMLElement): DOMRect | undefined {
  let node: HTMLElement | null = start.parentElement
  for (let depth = 0; depth < CARD_MAX_DEPTH && node !== null; depth++) {
    if (isCardSurface(node, 0)) return node.getBoundingClientRect()
    node = node.parentElement
  }
  return undefined
}

/** Every editor inside one scope. */
function editorsIn(scope: ParentNode): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(EDITOR_SELECTOR))
}

/**
 * Measure the composer of this dock entry and align the returned wrapper to it.
 * @param active - whether this entry is currently rendered.
 * @param uiKey - session UI key of the entry; the button anchor is looked up by
 *   it. Omitted when the host gave this composer no id (legacy hosts), in which
 *   case only tiers 2 and 3 apply.
 * @returns the wrapper ref the caller must attach.
 */
export function useDockAlignment(active: boolean, uiKey?: string): RefObject<HTMLDivElement> {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    if (root === null) return
    let frame = 0

    /**
     * The composer card measured from an editor. Collects every rounded, opaque
     * ancestor of the editor, then takes the widest one that is still plausibly
     * the card: the first match is often an inner wrapper a few pixels narrower
     * than the card, while the conversation pane above it is too wide. Center
     * proximity rejects the pane when the composer is off-center, and the width
     * cap rejects it when both are centered.
     * @param editor - the composer's editable surface.
     * @returns the card rect, or undefined when no ancestor qualifies.
     */
    const cardFromEditor = (editor: HTMLElement): DOMRect | undefined => {
      const editorRect = editor.getBoundingClientRect()
      const candidates: DOMRect[] = []
      let node: HTMLElement | null = editor
      for (let depth = 0; depth < CARD_MAX_DEPTH && node !== null; depth++) {
        if (isCardSurface(node, editorRect.width)) candidates.push(node.getBoundingClientRect())
        node = node.parentElement
      }
      const widest = (list: DOMRect[]): DOMRect | undefined => list.sort((a, b) => b.width - a.width)[0]
      if (candidates.length === 0) return undefined
      const editorCenter = editorRect.left + editorRect.width / 2
      const centered = candidates.filter((rect) => rect.width <= window.innerWidth * CARD_MAX_VIEWPORT_SHARE && Math.abs(rect.left + rect.width / 2 - editorCenter) < CARD_CENTER_TOLERANCE)
      return widest(centered) ?? widest(candidates)
    }

    /** The first editor below the dock inside one scope. */
    const editorBelow = (scope: ParentNode, rootRect: DOMRect): HTMLElement | undefined =>
      editorsIn(scope).find((node) => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.top >= rootRect.bottom - EDITOR_BELOW_SLACK
      })

    /** The composer card of THIS entry, most specific anchor first. */
    const cardForThisEntry = (): DOMRect | undefined => {
      if (uiKey !== undefined) {
        const anchor = Array.from(document.querySelectorAll<HTMLElement>(`[${SESSION_ANCHOR_ATTRIBUTE}]`)).find((node) => node.getAttribute(SESSION_ANCHOR_ATTRIBUTE) === uiKey)
        if (anchor !== undefined) {
          const anchored = cardAround(anchor)
          if (anchored !== undefined) return anchored
        }
      }
      const rootRect = root.getBoundingClientRect()
      const parent = root.parentElement
      const scoped = parent === null ? undefined : editorBelow(parent, rootRect)
      if (scoped !== undefined) {
        const rect = cardFromEditor(scoped)
        if (rect !== undefined) return rect
      }
      const anywhere = editorBelow(document, rootRect)
      return anywhere === undefined ? undefined : cardFromEditor(anywhere)
    }

    /** Copy one card rect onto the wrapper; undefined restores the host width. */
    const apply = (cardRect: DOMRect | undefined): void => {
      if (cardRect === undefined) {
        root.style.width = ''
        root.style.marginLeft = ''
        return
      }
      const width = `${cardRect.width}px`
      if (root.style.width !== width) root.style.width = width
      // Width can shift a centered entry; measure again before deriving the
      // margin so the final left edge matches the composer card.
      const afterWidth = root.getBoundingClientRect()
      const currentMargin = parseFloat(root.style.marginLeft) || 0
      const marginLeft = `${cardRect.left - (afterWidth.left - currentMargin)}px`
      if (root.style.marginLeft !== marginLeft) root.style.marginLeft = marginLeft
    }

    const align = (): void => {
      // A transform-only offset is applied to the wrong base when the host
      // already centers this entry, and a translated box can be clipped by its
      // parent; use a layout margin instead. The previous margin is subtracted
      // from the measured left so repeated runs do not accumulate drift.
      root.style.transform = ''
      apply(cardForThisEntry())
    }
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(align)
    }
    schedule()
    schedule()
    window.addEventListener('resize', schedule)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(document.documentElement)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [active, uiKey])

  return rootRef
}
