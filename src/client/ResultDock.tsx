/**
 * The result dock (conversation.input.dock): renders the enhancement card in
 * the composer's dock row, above the input, instead of a modal overlay. It
 * owns session ownership (only the session that started the request sees its
 * card), the applied/undo bridge to the composer, Escape handling and the
 * auto-close when the draft is sent.
 * @module dsh-prompt-enhance/client/ResultDock
 */

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { ResultPanel } from './ResultPanel'
import * as ui from './ui-state'
import { useSessionKey } from './session-key'

/** Props of the input.dock entry: the InputZone owner share + session kit + locale seat. */
export type ResultDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dsh-prompt-enhance'>

/** One session's enhancement card, docked above its composer. */
export function ResultDock(props: ResultDockProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [undone, setUndone] = useState(false)
  const [regenerated, setRegenerated] = useState(false)
  const [pendingRegenerate, setPendingRegenerate] = useState(false)
  const previousResultRef = useRef<unknown>(undefined)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const draft = useInput((state) => {
    const value = (state as { draft?: unknown }).draft
    return typeof value === 'string' ? value : ''
  })
  const phase = useInput((state) => {
    const value = (state as { phase?: unknown }).phase
    return typeof value === 'string' ? value : ''
  })
  // The host exposes the session store as a standard hook; older hosts may
  // omit it, in which case the input phase is the only send signal.
  const useSession = (props as ResultDockProps & {
    useSession?: (selector: (s: unknown) => unknown) => unknown
  }).useSession
  const sessionRunning = useSession === undefined
    ? false
    : Boolean(useSession((state) => (state as { running?: unknown }).running))
  const sessionQueued = useSession === undefined
    ? 0
    : Number(useSession((state) => ((state as { queue?: unknown[] }).queue?.length ?? 0)))

  // The applied chip is derived from the undo stack: it is true exactly while
  // the composer still holds the applied text, and drops itself when the user
  // edits (the UndoBar drops the stale entry in the same situation).
  const entry = ui.peekUndo(uiKey)
  const applied = entry !== undefined && entry.applied === draft

  // Sending the draft dismisses the card; the undo row can still take over.
  // The phase is checked where the host provides it; the session transition
  // (running false→true, or a new queued turn) is the fallback for hosts that
  // use different phase names.
  const prevSession = useRef({ running: sessionRunning, queued: sessionQueued })
  useEffect(() => {
    const prev = prevSession.current
    prevSession.current = { running: sessionRunning, queued: sessionQueued }
    if (panel === undefined || panel.sessionId !== uiKey) return
    if (phase === 'sending' || (sessionRunning && !prev.running) || sessionQueued > prev.queued) {
      ui.closePanel()
    }
  }, [phase, sessionRunning, sessionQueued, panel, uiKey])

  // Non-modal, so Escape is the only keyboard affordance: abort/close.
  useEffect(() => {
    if (panel === undefined || panel.sessionId !== uiKey) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return
      event.preventDefault()
      ui.closePanel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [panel, uiKey])

  // The "undone" chip is transient: it confirms the undo for a moment, then
  // clears without needing another state change.
  useEffect(() => {
    if (!undone) return
    const timer = setTimeout(() => setUndone(false), 2500)
    return () => clearTimeout(timer)
  }, [undone])

  // "Regenerated" is a completion signal, not a click signal: wait until the
  // panel settles with a different result object, then show the chip briefly.
  useEffect(() => {
    if (!pendingRegenerate) return
    if (panel === undefined || panel.sessionId !== uiKey) {
      setPendingRegenerate(false)
      return
    }
    if (panel.phase === 'error') {
      setPendingRegenerate(false)
      return
    }
    if (panel.phase === 'result' && panel.result !== previousResultRef.current) {
      setPendingRegenerate(false)
      setRegenerated(true)
    }
  }, [panel, pendingRegenerate, uiKey])

  useEffect(() => {
    if (!regenerated) return
    const timer = setTimeout(() => setRegenerated(false), 2500)
    return () => clearTimeout(timer)
  }, [regenerated])

  // A regenerate click on an empty draft is a no-op; do not leave the pending
  // flag stuck forever in that case.
  useEffect(() => {
    if (!pendingRegenerate) return
    const timer = setTimeout(() => setPendingRegenerate(false), 15000)
    return () => clearTimeout(timer)
  }, [pendingRegenerate])

  // The dock row is wider than the composer card in some host layouts (the
  // conversation column spans the pane while the card is centered). Align the
  // card to the composer by measuring the composer's rounded card: find the
  // nearest editor below the dock, walk up to the rounded surface, and reuse
  // its width and left offset. The measurement is re-run on resize; when no
  // editor exists the dock keeps the host's full width.
  useEffect(() => {
    if (panel === undefined || panel.sessionId !== uiKey) return
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
      const baseLeft = rootRect.left - previousMargin
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
  }, [panel, uiKey])

  if (panel === undefined || panel.sessionId !== uiKey) return null

  const apply = (): void => {
    if (panel.phase !== 'result' || panel.result === undefined) return
    // Remember the CURRENT draft (which may have diverged from the text the
    // request started with) so undo restores the user's latest edits, then
    // fill the enhanced text. The card stays open in the applied state;
    // closing it falls back to the standalone undo row.
    ui.pushUndo(uiKey, { original: draft, applied: panel.result.text })
    inputActions.setDraft(panel.result.text)
    setUndone(false)
    setRegenerated(false)
  }

  const undo = (): void => {
    if (entry === undefined) return
    inputActions.setDraft(entry.original)
    ui.popUndo(uiKey)
    setUndone(true)
    setRegenerated(false)
  }

  const regenerate = (): void => {
    if (panel.phase !== 'result') return
    previousResultRef.current = panel.result
    setRegenerated(false)
    setPendingRegenerate(true)
    ui.runSession(uiKey)
  }

  return (
    <div ref={rootRef} className="dsh-pe-dock">
      <ResultPanel
        state={panel}
        t={t}
        applied={applied}
        undone={undone}
        regenerated={regenerated}
        onApply={apply}
        onUndo={undo}
        onRegenerate={regenerate}
        onCancel={() => ui.closePanel()}
        onRetry={panel.phase === 'error' ? () => ui.runSession(uiKey) : undefined}
      />
    </div>
  )
}
