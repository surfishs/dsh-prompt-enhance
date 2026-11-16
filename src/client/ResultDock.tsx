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
import { useDockAlignment } from './useDockAlignment'

/** Props of the input.dock entry: the InputZone owner share + session kit + locale seat. */
export type ResultDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dsh-prompt-enhance'>

/** One session's enhancement card, docked above its composer. */
export function ResultDock(props: ResultDockProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const rootRef = useDockAlignment(panel !== undefined && panel.sessionId === uiKey)
  const [undone, setUndone] = useState(false)
  const [regenerated, setRegenerated] = useState(false)
  const [pendingRegenerate, setPendingRegenerate] = useState(false)
  const previousResultRef = useRef<unknown>(undefined)
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
