/**
 * The composer enhance button (conversation.input.right): reads the live
 * draft through the session standard kit, applies every local guard
 * (empty / over-length / images-only / command-or-reference chips / busy),
 * then calls the host route and shows the preview panel. Applying the
 * result remembers the original on the undo stack before setDraft, so one
 * click restores it. The button never blocks the composer: on any failure
 * the draft stays exactly as the user typed it.
 * @module dsh-prompt-enhance/client/EnhanceButton
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { EnhanceError } from '../shared/protocol'
import { checkInputText } from '../shared/validate'
import { EnhanceClientError, requestEnhance, requestEnhanceStream } from './enhance-client'
import { SparkleFishIcon } from './SparkleFishIcon'
import * as ui from './ui-state'
import { getClientSettings, subscribeClientSettings } from './settings'
import { getSettingsWriter, subscribeSettingsWriter } from './settings-writer'
import { QuickSettingsMenu, type QuickMenuAnchor } from './QuickSettingsMenu'
import {
  directoryFaceOf,
  INHERIT_EFFORT,
  loadQuickModelGroups,
  modelDirectoryOf,
  resolveQuickSettings,
  writeQuickContext,
  writeQuickEffort,
  writeQuickMode,
  writeQuickRoute,
  type QuickContext,
  type QuickRouteOverride,
  type QuickSettingsData,
} from './quick-settings'
import { useSessionKey, serverSessionId } from './session-key'

/** Props of the input.right entry: the InputZone owner share + session kit + locale seat. */
export type EnhanceButtonProps = PropsRuntime<'conversation.input.right'> &
  PropsLocale<'dsh-prompt-enhance'> & {
    /** Client context handed in by the slot registration (the quick menu reads model directories through it). */
    __ctx?: QuickContext
  }

/** How long a press on the button must last to open the quick menu. */
const LONG_PRESS_MS = 600

/** Movement past this many pixels turns a long press back into a drag/click. */
const LONG_PRESS_SLOP_PX = 6

/** Sentinel of {@link occurrenceCountOf} for a host that exposes no chip view. */
const OCCURRENCES_UNKNOWN = -1

/**
 * Read the composer's reference-chip count, or {@link OCCURRENCES_UNKNOWN} when
 * the host state cannot answer.
 *
 * Why this is not a plain `Array.isArray(x) ? x.length : 0`: applying a result
 * happens through `inputActions.setDraft`, which replaces the editor document
 * with plain text. A command or file-reference chip is not text, so that write
 * destroys it — irreversibly, and with no undo entry covering the chip. "The
 * host did not tell us" is therefore not the same answer as "there are none":
 * the guard below fails CLOSED on it.
 *
 * Reading `.length` off a missing field was the original bug class here: it
 * threw DURING RENDER and React unmounted the whole slot entry behind its error
 * boundary. This reader keeps the defensive shape (never throws, never assumes
 * a type) but hands the uncertainty to the guard instead of silently answering
 * "zero".
 * @param value - the untrusted field.
 * @returns the chip count, or {@link OCCURRENCES_UNKNOWN} when unreadable.
 */
function occurrenceCountOf(value: unknown): number {
  return Array.isArray(value) ? value.length : OCCURRENCES_UNKNOWN
}

/**
 * Read the composer's attachment count. Only the count is forwarded into the
 * prompt — the contents are never sent — and a host without the field counts
 * as zero, the same defensive shape as the other optional input fields.
 * @param value - the untrusted field.
 * @returns the array length, or 0 when absent/not an array.
 */
function attachmentCountOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/**
 * Read a field that downstream code requires to be a string. `draft` drives
 * `checkInputText`, which iterates the text — an absent field would throw on
 * click instead of on render, but it is the same class of brittleness against
 * an unknown host state shape.
 * @param value - the untrusted field.
 * @returns the string, or `''` when the field is absent/not a string.
 */
function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** One composer's enhance trigger. */
export function EnhanceButton(props: EnhanceButtonProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const wireId = serverSessionId(sessionId)
  const draft = useInput((state: InputState) => stringOf((state as { draft?: unknown }).draft))
  const phase = useInput((state: InputState) => (state as { phase?: unknown }).phase)
  const occurrenceCount = useInput((state: InputState) => occurrenceCountOf((state as { occurrences?: unknown }).occurrences))
  const attachmentCount = useInput((state: InputState) => attachmentCountOf((state as { attachmentIds?: unknown }).attachmentIds))
  const settings = useSyncExternalStore(subscribeClientSettings, getClientSettings)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const busy = panel !== undefined && panel.sessionId === uiKey && panel.phase === 'loading'
  // The preview panel is a single shared slot, so the UI admits exactly ONE
  // in-flight enhancement at a time across all sessions: `anyBusy` disables
  // every other composer's button while one request is loading. This is
  // deliberately stricter than the host `maxConcurrent` cap (default 2) —
  // that cap protects the /enhance command plane and multi-client callers,
  // while the single-panel UI cannot show two loading states anyway.
  const anyBusy = panel !== undefined && panel.phase === 'loading'
  // The OTHER composer is the one loading. See the button render below: a
  // cross-session busy state used to disable this button with no explanation,
  // which reads as "broken" in a multi-session layout.
  const otherBusy = anyBusy && !busy
  /** No draft text at all (whitespace and attachment-only drafts count as empty): the icon dims and clicks are no-ops. */
  const empty = draft.trim() === ''

  // ── quick settings ──────────────────────────────────────────────────────
  // The writer arrives asynchronously (the settings source binds it after
  // apply). Until it exists the entry does not exist either: a menu that
  // cannot save is worse than no menu.
  const writer = useSyncExternalStore(subscribeSettingsWriter, getSettingsWriter)
  const [menu, setMenu] = useState<{ anchor: QuickMenuAnchor; data: QuickSettingsData } | null>(null)
  const [menuError, setMenuError] = useState<string | undefined>(undefined)
  // Settings writes started from this card. The count drives the corner saving
  // dot; the failure flag keeps the red badge until the next successful write.
  const [savePending, setSavePending] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)

  /**
   * Count one settings write so the button can show the saving dot until the
   * last one settles. A refusal keeps the failure badge until a later write
   * succeeds; the card is already closed by then, so this is its only notice.
   * @param write - the writer promise for one settings change.
   */
  const trackSave = useCallback((write: Promise<boolean>): void => {
    setSavePending((pending) => pending + 1)
    void write.then((ok) => setSaveFailed(!ok)).finally(() => setSavePending((pending) => Math.max(0, pending - 1)))
  }, [])
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null)
  const longPressFired = useRef(false)

  // Context writes are coalesced: one write is in flight at a time and only the
  // newest requested state is written once it settles, so a fast double flip
  // lands on the last click. The intent is kept in refs so the close path can
  // start it at once instead of waiting behind the write already running.
  const contextWrites = useRef<{
    /** The state the user last asked for; null when nothing is waiting. */
    desired: boolean | null
    /** The last state the host accepted, and the baseline a failed write rolls back to. */
    accepted: boolean | null
    /** The state of the write currently in flight, if any. */
    inFlight: boolean | null
    running: boolean
    /** Bumped per write so a superseded resolve can tell it lost the race. */
    seq: number
    closing: boolean
  }>({ desired: null, accepted: null, inFlight: null, running: false, seq: 0, closing: false })
  const flushContextRef = useRef<() => void>(() => {})

  const applyContext = (value: boolean): void => {
    setMenu((current) => (current === null ? current : { ...current, data: { ...current.data, contextAware: value } }))
  }

  /**
   * Start the newest requested state once no write is in flight. "force" re-asserts
   * the intent even when it matches the last accepted value, which is what a stale
   * write that landed late requires.
   */
  const kickContextWrite = (force = false): void => {
    const state = contextWrites.current
    if (writer === undefined || state.running) return
    const target = state.desired
    if (target === null) return
    const accepted = state.accepted ?? settings.contextAware
    state.accepted = accepted
    if (!force && target === accepted) {
      state.desired = null
      return
    }
    state.running = true
    state.inFlight = target
    const ticket = ++state.seq
    const write = writeQuickContext(writer, target)
    trackSave(write)
    void write.then((ok) => {
      state.running = false
      state.inFlight = null
      if (ticket !== state.seq) {
        // The close flush already started a newer write; if this older one still
        // reached the host, the host now holds it, so re-assert the newest intent.
        if (ok && state.accepted !== null) {
          state.desired = state.accepted
          kickContextWrite(true)
        }
        return
      }
      if (!ok) {
        state.desired = null
        applyContext(state.accepted ?? settings.contextAware)
        setMenuError(t('menu.writeFailed'))
        return
      }
      state.accepted = target
      if (state.desired === target) state.desired = null
      kickContextWrite()
    })
  }

  /**
   * The card is leaving: start the pending intent now rather than queueing behind
   * the write in flight. A refusal has no surface left to report on, so it is
   * logged instead of shown.
   */
  const flushContextWrite = (): void => {
    const state = contextWrites.current
    if (writer === undefined || state.closing) return
    const target = state.desired
    if (target === null || target === state.inFlight) return
    const accepted = state.accepted ?? settings.contextAware
    // The in-flight write will overwrite the host, so an intent that merely equals
    // the last accepted value still has to be written when something is in flight.
    const supersededValue = state.inFlight !== null
    state.accepted = accepted
    state.desired = null
    if (!supersededValue && target === accepted) return
    state.closing = true
    const ticket = ++state.seq
    const write = writeQuickContext(writer, target)
    trackSave(write)
    void write.then((ok) => {
      state.closing = false
      if (!ok) {
        console.warn('[dsh-prompt-enhance] the contextAware write was refused while closing the quick settings card')
        return
      }
      if (ticket === state.seq) state.accepted = target
    })
  }
  flushContextRef.current = flushContextWrite

  // The route the user just picked, with the names captured from the list at
  // click time. The host mirror can lag the write; until it catches up (and
  // after it lands) the card shows this instead of an old route or a bare id.
  const routeWrites = useRef<{ route: QuickRouteOverride; baseline: { provider: string; model: string } } | null>(null)

  /**
   * The optimistic route for this render, if the mirror has not moved past it.
   *
   * `pending` means the write has not reached the settings mirror yet;
   * `landed` means it has. A third value means another writer won and the
   * local choice is stale.
   * @returns the route to paint, or undefined to use the stored settings.
   */
  const localRoute = useCallback((): QuickRouteOverride | undefined => {
    const stored = routeWrites.current
    if (stored === null) return undefined
    const pending = settings.provider === stored.baseline.provider && settings.model === stored.baseline.model
    const landed = settings.provider === stored.route.provider && settings.model === stored.route.model
    if (pending || landed) return stored.route
    routeWrites.current = null
    return undefined
  }, [settings.provider, settings.model])

  /** Close the card, flushing a pending context flip first. */
  const dismissMenu = useCallback((): void => {
    flushContextRef.current()
    setMenu(null)
  }, [])

  const toggleContext = (next: boolean): void => {
    if (writer === undefined) return
    const state = contextWrites.current
    setMenuError(undefined)
    applyContext(next)
    state.desired = next
    if (state.accepted === null) state.accepted = settings.contextAware
    kickContextWrite()
  }

  // The stored settings feed the accepted baseline until the first write.
  const reconcileEffort = useCallback(
    async (data: QuickSettingsData): Promise<QuickSettingsData> => {
      if (writer === undefined) return data
      if (data.effort === '' || data.effort === INHERIT_EFFORT) return data
      if (data.efforts.some((effort) => effort.id === data.effort)) return data
      const write = writeQuickEffort(writer, INHERIT_EFFORT)
      trackSave(write)
      const cleared = await write
      if (!cleared) {
        console.warn('[dsh-prompt-enhance] could not clear the stored reasoning effort for the current model')
        return data
      }
      return { ...data, effort: INHERIT_EFFORT }
    },
    [writer, trackSave],
  )

  // The stored settings feed the accepted baseline until the first write.
  useEffect(() => {
    const state = contextWrites.current
    if (state.seq === 0 && state.desired === null) state.accepted = settings.contextAware
  }, [settings.contextAware])

  // Unmounting must not park a pending flip: start it and let it settle.
  useEffect(() => () => flushContextRef.current(), [])

  // While the card is open, follow the session's model directory (and a pinned
  // route change): the tier list belongs to the model actually in use, so a
  // switch made outside the card must swap the list instead of showing the
  // previous model's tiers until the next open.
  const menuOpen = menu !== null
  useEffect(() => {
    if (!menuOpen) return
    const directory = directoryFaceOf(modelDirectoryOf(props.__ctx, sessionId))
    const store = directory?.store
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = (): void => {
      if (cancelled) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        const route = localRoute()
        void resolveQuickSettings({ ctx: props.__ctx, sessionId, settings, ...(route === undefined ? {} : { route }) }).then(async (resolved) => {
          const data = await reconcileEffort(resolved)
          if (cancelled) return
          const local = contextWrites.current.desired ?? contextWrites.current.accepted
          setMenu((current) => {
            if (current === null) return current
            const next = local === null ? data : { ...data, contextAware: local }
            // The model groups are loaded once per open; a directory refresh
            // must not wipe the list the user is looking at.
            return { ...current, data: { ...next, modelGroups: current.data.modelGroups, modelGroupsState: current.data.modelGroupsState } }
          })
        })
      }, 80)
    }
    const stop = store?.subscribe?.(refresh)
    // Nudge the host directory so a model switched after the last load answers
    // with the current catalog rather than the previous snapshot.
    try {
      void Promise.resolve(directory?.load?.()).catch(() => {})
    } catch {
      // A directory that refuses to load simply keeps the current snapshot.
    }
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
      stop?.()
    }
  }, [menuOpen, props.__ctx, sessionId, settings, reconcileEffort, localRoute])

  const openMenu = useCallback(
    async (rect: DOMRect): Promise<void> => {
      const anchor = { right: rect.right, top: rect.top }
      setMenuError(undefined)
      const route = localRoute()
      const resolved = await resolveQuickSettings({ ctx: props.__ctx, sessionId, settings, ...(route === undefined ? {} : { route }) })
      const data = await reconcileEffort(resolved)
      // A flip that the mirror has not reflected yet still wins on reopen.
      const local = contextWrites.current.desired ?? contextWrites.current.accepted
      const base = local === null ? data : { ...data, contextAware: local }
      setMenu({ anchor, data: { ...base, modelGroupsState: 'loading' } })
      // The model catalog is read behind the open card, so the menu never waits
      // for N provider round trips; a cached answer settles it on the next tick.
      void loadQuickModelGroups().then((groups) => {
        setMenu((current) =>
          current === null
            ? current
            : {
                ...current,
                data: { ...current.data, modelGroups: groups ?? [], modelGroupsState: groups === undefined ? 'failed' : 'ready' },
              },
        )
      })
    },
    [props.__ctx, sessionId, settings, reconcileEffort, localRoute],
  )

  const pickEffort = (id: string): void => {
    if (writer === undefined) return
    // The choice applies on the click itself: close the card first and let the
    // write land in the background, so the host round trip never reads as lag.
    // With the card gone there is no surface left to report a refusal on.
    const unchanged = menu !== null && menu.data.effort === id
    dismissMenu()
    if (unchanged) return
    const write = writeQuickEffort(writer, id)
    trackSave(write)
    void write.then((ok) => {
      if (!ok) console.warn('[dsh-prompt-enhance] the reasoningEffort write was refused')
    })
  }

  const pickMode = (mode: string): void => {
    if (writer === undefined) return
    // Same contract as the tier row: the click is the decision, the write rides
    // behind it, and a refusal is logged because the card is already gone.
    const unchanged = menu !== null && menu.data.mode === mode
    dismissMenu()
    if (unchanged) return
    const write = writeQuickMode(writer, mode)
    trackSave(write)
    void write.then((ok) => {
      if (!ok) console.warn('[dsh-prompt-enhance] the mode write was refused')
    })
  }

  const pickRoute = (route: { provider: string; model: string } | null): void => {
    if (writer === undefined) return
    const unchanged = menu !== null && (route === null ? menu.data.provider === '' || menu.data.model === '' : menu.data.provider === route.provider && menu.data.model === route.model)
    // The click is the decision: capture the names from the list the user just
    // clicked, park them as the route to paint, and let the write land behind
    // the closed card. Reopening before the mirror catches up therefore shows
    // the picked names, never the old route or a bare id.
    const labels =
      route === null
        ? { providerLabel: '', modelLabel: '' }
        : (() => {
            const group = menu?.data.modelGroups.find((entry) => entry.id === route.provider)
            const model = group?.models.find((entry) => entry.id === route.model)
            return { providerLabel: group?.name ?? '', modelLabel: model?.name ?? '' }
          })()
    routeWrites.current = {
      route: route === null ? { provider: '', model: '', ...labels } : { ...route, ...labels },
      baseline: { provider: settings.provider, model: settings.model },
    }
    dismissMenu()
    if (unchanged) return
    const write = writeQuickRoute(writer, route)
    trackSave(write)
    void write.then((ok) => {
      if (ok) return
      // The card is gone and the write was refused: drop the optimistic route so
      // the next open tells the truth instead of showing a value that never stuck.
      routeWrites.current = null
      console.warn('[dsh-prompt-enhance] the provider/model write was refused')
    })
  }

  /** Guard chain + fetch + panel transition for this session. */
  const start = useCallback(
    (overrideText?: string): void => {
      const source = overrideText ?? draft
      if (anyBusy || source.trim() === '') return
      if (!settings.enabled) {
        const disabled = t('error.disabled')
        ui.openError(uiKey, draft, { code: 'rejected', localized: disabled })
        return
      }
      const check = checkInputText(source, settings.maxInputChars)
      if (!check.ok) {
        const message = check.code === 'empty' ? t('error.empty') : t('error.tooLong', { count: check.count, max: check.max })
        ui.openError(uiKey, source, { code: 'rejected', localized: message })
        return
      }
      // Fail CLOSED on an unreadable chip view (see occurrenceCountOf): the
      // fill-back writes plain text over the editor document, so a chip we
      // cannot see is a chip we would destroy. Refusing is recoverable; the
      // destroyed reference is not.
      if (occurrenceCount === OCCURRENCES_UNKNOWN) {
        const unknown = t('error.chipsUnknown')
        ui.openError(uiKey, source, { code: 'rejected', localized: unknown })
        return
      }
      if (occurrenceCount > 0) {
        const occurrences = t('error.occurrences')
        ui.openError(uiKey, source, { code: 'rejected', localized: occurrences })
        return
      }
      // `claimed` is a command chip waiting for its arguments (`/plan ` in
      // front of the body), not a submission in flight: the editor is still
      // editable and the phase persists until the command runs. The busy copy
      // named the wrong state and hid what the user had to do, so a
      // command-led draft gets its own message. The genuinely busy phases
      // (adjudicating / submitting / sending) keep the busy copy below.
      if (phase === 'claimed') {
        const command = t('error.command')
        ui.openError(uiKey, source, { code: 'rejected', localized: command })
        return
      }
      if (phase !== 'plain') {
        const busyPhase = t('error.phase')
        ui.openError(uiKey, source, { code: 'rejected', localized: busyPhase })
        return
      }
      const controller = new AbortController()
      // Snapshot the count at request time: the result card reports what the
      // call announced, not what the composer holds later.
      const attachments = attachmentCount > 0 ? { attachments: { count: attachmentCount } } : {}
      ui.openLoading({ sessionId: uiKey, original: source, abort: () => controller.abort(), ...attachments })
      const settle = (result: Parameters<typeof ui.settleResult>[1]): void => ui.settleResult(uiKey, result)
      const fail = (error: unknown): void => {
        const detail: EnhanceError = error instanceof EnhanceClientError ? error.detail : { code: 'internal', message: error instanceof Error ? error.message : String(error) }
        ui.settleError(uiKey, detail)
      }
      // Progressive display when enabled: the panel fills in as the model
      // writes, and degrades to the one-shot call on its own when the host or
      // the transport cannot stream.
      if (settings.streaming) {
        requestEnhanceStream(
          { sessionId: wireId, text: source, ...attachments },
          {
            signal: controller.signal,
            onDelta: (delta: string): void => ui.appendDelta(uiKey, delta),
          },
        ).then(settle, fail)
        return
      }
      requestEnhance({ sessionId: wireId, text: source, ...attachments }, controller.signal).then(settle, fail)
    },
    [anyBusy, draft, occurrenceCount, attachmentCount, phase, settings, uiKey, wireId, t],
  )

  // The session registry holds a stable identity; run always dispatches to
  // the latest start callback. The refresh rides an effect (never the render
  // phase, which is unsafe under React 18 concurrent rendering).
  const runRef = useRef(start)
  useEffect(() => {
    runRef.current = start
  })
  useEffect(() => {
    const entry: ui.SessionEntry = {
      root: rootRef.current,
      run: (text?: string) => runRef.current(text),
    }
    return ui.registerSession(uiKey, entry)
  }, [uiKey])

  // Draft changed after the request started → flag (or clear) the result
  // panel's stale marker so the user knows the result is based on the
  // pre-enhance text.
  useEffect(() => {
    if (panel !== undefined && panel.sessionId === uiKey && panel.phase === 'result') {
      ui.setStale(uiKey, draft !== panel.original)
    }
  }, [draft, panel, uiKey])

  // Right-click, a 600 ms press, or Shift+F10 / the context-menu key open the
  // same menu. Registered only when the host can persist settings, so an
  // unsupported host keeps exactly the old button behaviour.
  useEffect(() => {
    if (writer === undefined || !settings.enabled) return
    const button = rootRef.current
    if (button === null) return
    const clearTimer = (): void => {
      if (longPressTimer.current !== undefined) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = undefined
      }
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node) || !button.contains(target)) return
      clearTimer()
      longPressFired.current = false
      longPressOrigin.current = { x: event.clientX, y: event.clientY }
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = undefined
        // The press itself must not also fire the enhance click on release.
        longPressFired.current = true
        void openMenu(button.getBoundingClientRect())
      }, LONG_PRESS_MS)
    }
    const onPointerMove = (event: PointerEvent): void => {
      const origin = longPressOrigin.current
      if (origin === null) return
      if (Math.abs(event.clientX - origin.x) > LONG_PRESS_SLOP_PX || Math.abs(event.clientY - origin.y) > LONG_PRESS_SLOP_PX) {
        longPressOrigin.current = null
        clearTimer()
      }
    }
    const onPointerUp = (): void => {
      longPressOrigin.current = null
      clearTimer()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const menuKey = (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu'
      if (!menuKey) return
      if (document.activeElement !== button) return
      event.preventDefault()
      void openMenu(button.getBoundingClientRect())
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerUp, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      clearTimer()
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerUp, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [writer, settings.enabled, openMenu])

  if (!settings.enabled) return null

  // The tooltip carries the discoverability the entry cannot get from chrome. It
  // rides along in every state: the card is reachable by right-click (and by
  // long-press / Shift+F10) even while a plain click is inert, so an empty or
  // busy button must not hide the way in.
  const statusTitle = busy ? t('button.busy') : otherBusy ? t('button.otherBusy') : empty ? t('button.emptyTitle') : t('button.title')
  // The hint names the way in while the card is actually reachable on hover; the
  // busy states are short-lived and keep their own single message.
  const quickHint = writer === undefined || busy || otherBusy ? '' : t('button.quickHint')
  // Hovering the button says what the corner mark means; the mark itself only
  // carries the failure title because its wrapper is decorative for AT.
  const saveLabel = savePending > 0 ? ` · ${t('settings.saving')}` : saveFailed ? ` · ${t('button.saveFailedTitle')}` : ''
  const buttonLabel = statusTitle + quickHint + saveLabel

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        // Session anchor for the dock entries this plugin renders: the composer
        // card has to be found per session, and this button lives inside it.
        // Read by useDockAlignment (same attribute constant).
        data-dsh-pe-key={uiKey}
        className={`dsh-pe-btn${busy ? ' is-busy' : ''}${otherBusy && !empty ? ' is-blocked' : ''}${empty && !busy ? ' is-empty' : ''}`}
        title={buttonLabel}
        aria-label={statusTitle}
        aria-haspopup={writer === undefined ? undefined : 'menu'}
        onContextMenu={(event) => {
          if (writer === undefined) return
          event.preventDefault()
          void openMenu(event.currentTarget.getBoundingClientRect())
        }}
        // `aria-disabled` instead of `disabled`: a disabled button is skipped by
        // the keyboard and by screen readers, so the reason this composer is
        // inert (empty draft, or another session's enhancement occupies the
        // single preview panel) would be unreachable exactly for the users who
        // need it. The click is a no-op either way.
        aria-disabled={empty || otherBusy || undefined}
        onClick={() => {
          // A long press opened the menu; its trailing click must not enhance.
          if (longPressFired.current) {
            longPressFired.current = false
            return
          }
          start()
        }}
      >
        <span className="dsh-pe-btn-icon" aria-hidden>
          <SparkleFishIcon size={15} spinning={busy} />
          {savePending > 0 ? (
            <span className="dsh-pe-btn-saving" data-dsh-pe-save="saving">
              <StateDot state="ongoing" size={10} />
            </span>
          ) : saveFailed ? (
            <span className="dsh-pe-btn-saving dsh-pe-btn-save-failed" data-dsh-pe-save="failed" title={t('button.saveFailedTitle')}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
                <circle cx="5" cy="5" r="5" fill="currentColor" />
                <path d="M5 2.3v3.2" stroke="var(--dsw-alias-label-primary-inverted, #fff)" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="5" cy="7.5" r=".75" fill="var(--dsw-alias-label-primary-inverted, #fff)" />
              </svg>
            </span>
          ) : null}
        </span>
      </button>
      {menu === null ? null : (
        <QuickSettingsMenu
          t={t}
          data={menu.data}
          anchor={menu.anchor}
          error={menuError}
          onPick={pickEffort}
          onPickMode={pickMode}
          onPickRoute={pickRoute}
          onToggleContext={toggleContext}
          onClose={dismissMenu}
        />
      )}
    </>
  )
}
