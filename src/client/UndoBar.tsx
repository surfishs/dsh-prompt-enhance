/**
 * The undo bar (conversation.input.dock): after an enhanced result was
 * applied, one quiet row above the composer card offers a single-click
 * restore of the original draft. It hides itself once the draft diverges
 * from the applied text (the user kept typing) — the entry is dropped, so
 * the bar can never restore stale text over newer edits.
 * @module dsh-prompt-enhance/client/UndoBar
 */

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import * as ui from './ui-state'
import { useSessionKey } from './session-key'
import { CheckIcon, UndoIcon } from './ActionIcons'
import { useDockAlignment } from './useDockAlignment'

/** Props of the input.dock entry: the InputZone owner share + session kit + locale seat. */
export type UndoBarProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dsh-prompt-enhance'>

/** One session's undo affordance. */
export function UndoBar(props: UndoBarProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  // Defensive like the button: a host that omits `draft` must not make the
  // applied/current comparison read `undefined` as "the user kept typing" and
  // silently drop an undo entry.
  const draft = useInput((state) => {
    const value = (state as { draft?: unknown }).draft
    return typeof value === 'string' ? value : ''
  })
  useSyncExternalStore(ui.subscribe, ui.getVersion)
  const entry = ui.peekUndo(uiKey)

  // The draft moved on (user edited after applying): drop the stale entry.
  useEffect(() => {
    if (entry !== undefined && entry.applied !== draft) ui.popUndo(uiKey)
  }, [draft, entry, uiKey])

  // The composer's own phase decides whether an undo makes sense. While it is
  // mid-submit (sending / submitting / adjudicating) the draft is about to be
  // consumed, so restoring the pre-apply text is not what the user asked for —
  // and the single commit between "card closed" and "draft cleared" used to
  // flash the bar for exactly that moment. A host that publishes no phase reads
  // as idle here, keeping the shipped behaviour on those versions.
  const phase = useInput((state) => {
    const value = (state as { phase?: unknown }).phase
    return typeof value === 'string' ? value : ''
  })
  const composerIdle = phase === '' || phase === 'plain'

  // The result card owns the undo affordance while it is open; the standalone
  // row takes over only after the card is closed.
  const panel = ui.getPanel()
  const cardGone = panel === undefined || panel.sessionId !== uiKey
  const visible = cardGone && composerIdle && entry !== undefined && entry.applied === draft
  const rootRef = useDockAlignment(visible, uiKey)
  if (!visible) return null

  const undo = (): void => {
    inputActions.setDraft(entry.original)
    ui.popUndo(uiKey)
  }
  const dismiss = (): void => {
    ui.popUndo(uiKey)
  }

  return (
    <div ref={rootRef} className="dsh-pe-dock">
      <div className="dsh-pe-undo">
        <span className="dsh-pe-undo-check" aria-hidden>
          <CheckIcon />
        </span>
        <span>{t('undo.applied')}</span>
        <button type="button" className="dsh-pe-undo-link" onClick={undo}>
          <UndoIcon />
          {t('undo.undo')}
        </button>
        <button type="button" className="dsh-pe-undo-x" aria-label={t('undo.dismiss')} onClick={dismiss}>
          ✕
        </button>
      </div>
    </div>
  )
}
