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

/**
 * How long the regenerate button keeps the "regenerated" label.
 *
 * Matches the copy confirmation's window (`ResultPanel`'s copy handler uses the
 * same 2500ms) so both transient confirmations feel like one system.
 */
const REGENERATED_NOTICE_MS = 2500

/** One session's enhancement card, docked above its composer. */
export function ResultDock(props: ResultDockProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const rootRef = useDockAlignment(panel !== undefined && panel.sessionId === uiKey, uiKey)
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
  const useSession = (
    props as ResultDockProps & {
      useSession?: (selector: (s: unknown) => unknown) => unknown
    }
  ).useSession
  // Whether the host supplies `useSession` is a property of the HOST VERSION,
  // not of session state, so the hook count below is constant for the whole
  // lifetime of a mount — the reason this conditional call is safe here. It is
  // still invisible to the linter, which cannot know that. Replacing it with an
  // unconditional call would mean fabricating a hook on hosts that ship none,
  // and that trade is worse than the documented suppression; a real refactor
  // needs a live host to validate against.
  const sessionRunning =
    useSession === undefined
      ? false
      : // eslint-disable-next-line react-hooks/rules-of-hooks
        Boolean(useSession((state) => (state as { running?: unknown }).running))
  const sessionQueued =
    useSession === undefined
      ? 0
      : // eslint-disable-next-line react-hooks/rules-of-hooks
        Number(useSession((state) => (state as { queue?: unknown[] }).queue?.length ?? 0))

  // The applied state is derived from the undo stack: it is true exactly while
  // the composer still holds the applied text, and drops itself when the user
  // edits (the UndoBar drops the stale entry in the same situation). It drives
  // the footer button (fill vs undo); the header shows no status chip.
  const entry = ui.peekUndo(uiKey)
  const applied = entry !== undefined && entry.applied === draft

  // The regenerate button is HIDDEN while the next round streams, so its
  // confirmation has to be a completion signal: it turns on only after a result
  // that differs from the one the click captured arrives, and clears itself
  // after REGENERATED_NOTICE_MS. A failure or a closed panel only drops the
  // pending flag — there is no button to relabel in those states.
  const [regeneratedNotice, setRegeneratedNotice] = useState(false)
  const pendingRegenerate = useRef(false)
  const previousResultRef = useRef<unknown>(undefined)

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

  // Turn the completion signal into the transient label, and clear it on time.
  // The two effects are separate on purpose: the first only watches the panel
  // settling, the second only owns the timer, so a re-render of the panel cannot
  // restart the countdown.
  useEffect(() => {
    if (!pendingRegenerate.current) return
    if (panel === undefined || panel.sessionId !== uiKey || panel.phase === 'error') {
      pendingRegenerate.current = false
      return
    }
    if (panel.phase === 'result' && panel.result !== previousResultRef.current) {
      pendingRegenerate.current = false
      setRegeneratedNotice(true)
    }
  }, [panel, uiKey])

  useEffect(() => {
    if (!regeneratedNotice) return
    const timer = setTimeout(() => setRegeneratedNotice(false), REGENERATED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [regeneratedNotice])

  if (panel === undefined || panel.sessionId !== uiKey) return null

  const apply = (): void => {
    if (panel.phase !== 'result' || panel.result === undefined) return
    // Remember the CURRENT draft (which may have diverged from the text the
    // request started with) so undo restores the user's latest edits, then
    // fill the enhanced text. The card stays open in the applied state;
    // closing it falls back to the standalone undo row.
    ui.pushUndo(uiKey, { original: draft, applied: panel.result.text })
    inputActions.setDraft(panel.result.text)
  }

  const undo = (): void => {
    if (entry === undefined) return
    inputActions.setDraft(entry.original)
    ui.popUndo(uiKey)
  }

  const regenerate = (): void => {
    if (panel.phase !== 'result') return
    // A click during the notice window starts a fresh round: drop the label now
    // so the button shows its normal text before it disappears, and remember
    // which result this round has to replace.
    setRegeneratedNotice(false)
    previousResultRef.current = panel.result
    pendingRegenerate.current = true
    ui.runSession(uiKey)
  }

  return (
    <div ref={rootRef} className="dsh-pe-dock">
      <ResultPanel
        state={panel}
        t={t}
        applied={applied}
        regenerated={regeneratedNotice}
        onApply={apply}
        onUndo={undo}
        onRegenerate={regenerate}
        onCancel={() => ui.closePanel()}
        onRetry={panel.phase === 'error' ? () => ui.runSession(uiKey) : undefined}
      />
    </div>
  )
}
