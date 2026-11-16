/**
 * Align a dock entry to the composer card below it.
 *
 * The host renders conversation.input.dock entries full-width, while the
 * composer card is narrower and may be centered or offset. This hook measures
 * the nearest editor below the dock, walks up to the composer's rounded
 * surface, and copies its width and left margin onto the returned wrapper.
 * When no editor is found, the host's full width is left untouched.
 * @module dsh-prompt-enhance/client/useDockAlignment
 */

import { useEffect, useRef, type RefObject } from 'react'

/** Measure the composer below the dock and align the returned wrapper to it. */
export function useDockAlignment(active: boolean): RefObject<HTMLDivElement> {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    if (root === null) return
    let frame = 0
    const align = (): void => {
      const parent = root.parentElement
      if (parent === null) return
      // A transform-only offset is applied to the wrong base when the host
      // already centers this entry, and a translated box can be clipped by its
      // parent; use a layout margin instead. The previous margin is subtracted
      // from the measured left so repeated runs do not accumulate drift.
      root.style.transform = ''
      const previousMargin = parseFloat(root.style.marginLeft) || 0
      const rootRect = root.getBoundingClientRect()
      const editors = Array.from(document.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"], [role="textbox"]'))
      const editor = editors.find((node) => {
        const rect = node.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.top >= rootRect.bottom - 4
      })
      if (editor === undefined) {
        root.style.width = ''
        root.style.marginLeft = ''
        root.style.transform = ''
        return
      }
      const editorRect = editor.getBoundingClientRect()
      // Collect every rounded, opaque ancestor of the editor, then take the
      // widest one that is still plausibly the composer card. The first match
      // is often an inner wrapper a few pixels narrower than the card; the
      // conversation pane above it is too wide. Center proximity rejects the
      // pane when the composer is off-center, and the width cap rejects it
      // when both are centered.
      const candidates: { node: HTMLElement; rect: DOMRect }[] = []
      let node: HTMLElement | null = editor
      for (let depth = 0; depth < 12 && node !== null; depth++) {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        if (
          rect.width >= editorRect.width
          && rect.width > 360
          && rect.height > 48
          && (parseFloat(style.borderTopLeftRadius) || 0) >= 4
          && style.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ) {
          candidates.push({ node, rect })
        }
        node = node.parentElement
      }
      const editorCenter = editorRect.left + editorRect.width / 2
      const cardEntry = candidates
        .filter((candidate) => (
          candidate.rect.width <= window.innerWidth * 0.8
          && Math.abs(candidate.rect.left + candidate.rect.width / 2 - editorCenter) < 40
        ))
        .sort((a, b) => b.rect.width - a.rect.width)[0]
        ?? candidates.sort((a, b) => b.rect.width - a.rect.width)[0]
      if (cardEntry === undefined) return
      const cardRect = cardEntry.rect
      const width = `${cardRect.width}px`
      if (root.style.width !== width) root.style.width = width
      // Width can shift a centered entry; measure again before deriving the
      // margin so the final left edge matches the composer card.
      const afterWidth = root.getBoundingClientRect()
      const currentMargin = parseFloat(root.style.marginLeft) || 0
      const marginLeft = `${cardRect.left - (afterWidth.left - currentMargin)}px`
      if (root.style.marginLeft !== marginLeft) root.style.marginLeft = marginLeft
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
  }, [active])

  return rootRef
}
