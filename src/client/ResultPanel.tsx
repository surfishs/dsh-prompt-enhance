/**
 * The enhancement card: header with model/usage meta, the enhanced body (or
 * the streamed text / error), and the apply/undo/copy/close actions. It is a
 * plain non-modal region rendered inside the composer dock, not a dialog:
 * the dock wrapper owns session ownership, keyboard handling and auto-close.
 * @module dsh-prompt-enhance/client/ResultPanel
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ContextUsage, EnhanceError, EnhanceUsage, ClientFailureReason } from '../shared/protocol'
import type { PromptEnhanceKey } from './locales'
import type { PanelState } from './ui-state'
import { ChevronIcon, CopyIcon, FillIcon, RegenerateIcon, UndoIcon, XIcon } from './ActionIcons'
import { SparkleFishIcon } from './SparkleFishIcon'

/** Props of the result card. */
export interface ResultPanelProps {
  state: PanelState
  t: TranslateNS<'dsh-prompt-enhance'>
  /** Fill the enhanced text back into the composer; the card stays visible. */
  onApply: () => void
  /** Close without touching the composer (also aborts an in-flight call). */
  onCancel: () => void
  /** Retry after a retryable error; undefined in non-error phases. */
  onRetry?: () => void
  /** True once the enhanced text is the composer's current draft. */
  applied?: boolean
  /** Restore the pre-apply draft; only meaningful while `applied`. */
  onUndo?: () => void
  /** Run the same source prompt through the model again. */
  onRegenerate?: () => void
  /** The composer draft is empty: regenerate cannot run, so the button reports why. */
  draftEmpty?: boolean
  /** Show the transient "regenerated" label on that button instead of its normal text. */
  regenerated?: boolean
  /** Hide the body, keeping the header and the footer rows (and their actions). */
  collapsed?: boolean
  /** Toggle {@link collapsed}. */
  onToggleCollapsed?: () => void
  /** Play the fold transition; false switches instantly (a setting). */
  foldAnimation?: boolean
}

/** Whether one error phase is worth retrying: model/transport failures, but never a call the user cancelled. */
const retryable = (error: EnhanceError | undefined): boolean => error?.code === 'upstream' || error?.code === 'timeout' || (error?.code === 'internal' && error.params?.reason !== 'cancelled')

/**
 * Wire `reason` (`UpstreamReason`, kebab-case as the host sends it) → the
 * dictionary key that carries its fix hint.
 *
 * This is an EXPLICIT table on purpose. The dictionary keys are camelCase
 * (`error.upstream.invalidCredential`) while the wire reasons are kebab-case
 * (`invalid-credential`), so building the key as
 * `` `error.upstream.${reason}` `` silently missed every multi-word reason
 * (`invalid-credential`, `rate-limit`, `context-window`, `tool-call`,
 * `max-tokens` — five of the eight) and always fell back to the generic
 * `error.upstream` copy. Spelling the mapping out keeps the two vocabularies
 * in one place: every entry is a literal key checked by `PromptEnhanceKey`,
 * and `tests/locales.test.ts` asserts each one exists in every dictionary.
 */
export const UPSTREAM_ERROR_KEYS: Record<string, PromptEnhanceKey> = {
  auth: 'error.upstream.auth',
  'invalid-credential': 'error.upstream.invalidCredential',
  'rate-limit': 'error.upstream.rateLimit',
  quota: 'error.upstream.quota',
  empty: 'error.upstream.empty',
  'context-window': 'error.upstream.contextWindow',
  'tool-call': 'error.upstream.toolCall',
  'max-tokens': 'error.upstream.maxTokens',
}

/**
 * Why the BROWSER half failed → the dictionary key that carries its fix hint.
 *
 * Same reasoning as {@link UPSTREAM_ERROR_KEYS}: the wire reasons are kebab-case
 * and the dictionary keys are camelCase, so an interpolated key would silently
 * miss `stream-closed` and fall back to the generic line. A `Record` over the
 * union (not a lookup with a fallback) also makes the type checker demand copy
 * for every reason the protocol can carry.
 */
export const CLIENT_ERROR_KEYS: Record<ClientFailureReason, PromptEnhanceKey> = {
  unreachable: 'error.client.unreachable',
  malformed: 'error.client.malformed',
  refused: 'error.client.refused',
  'stream-closed': 'error.client.streamClosed',
  cancelled: 'error.client.cancelled',
}

/** Whether a params value names one of the browser half's own failure reasons. */
function isClientFailureReason(value: unknown): value is ClientFailureReason {
  return typeof value === 'string' && Object.hasOwn(CLIENT_ERROR_KEYS, value)
}

/**
 * Primary line for a server-side error, localized by the stable code and its
 * structured params: an upstream `reason` picks a specific fix hint when one
 * exists, and an over-length rejection reuses the too-long input message the
 * client-side guard shows. The server's `message` (provider raw text, config
 * errors) renders beneath as the diagnostic detail line.
 */
function localizedErrorMessage(t: ResultPanelProps['t'], code: EnhanceError['code'], params: EnhanceError['params']): string {
  if (code === 'rejected' && typeof params?.count === 'number' && typeof params?.max === 'number') {
    return t('error.tooLong', { count: params.count, max: params.max })
  }
  if (code === 'upstream' && typeof params?.reason === 'string') {
    const specific = UPSTREAM_ERROR_KEYS[params.reason]
    if (specific !== undefined) return t(specific)
  }
  // A transport failure in this process carries a stable reason; its copy is
  // localized here instead of being a hardcoded Chinese `message`.
  if (code === 'internal' && isClientFailureReason(params?.reason)) {
    return t(CLIENT_ERROR_KEYS[params.reason], params)
  }
  switch (code) {
    case 'rejected':
      return t('error.rejected')
    case 'rate-limit':
      return t('error.rateLimit', params)
    case 'concurrency-limit':
      return t('error.concurrencyLimit', params)
    case 'cooldown':
      return t('error.cooldown', params)
    case 'timeout':
      return t('error.timeout', params)
    case 'unconfigured':
      return t('error.unconfigured')
    case 'effort-unsupported':
      return t('error.effortUnsupported', params)
    case 'upstream':
      return t('error.upstream')
    default:
      return t('error.internal')
  }
}

/**
 * Clipboard fallback for insecure contexts (LAN http), where
 * `navigator.clipboard` is undefined: a transient textarea plus the legacy
 * `execCommand('copy')`.
 */
function fallbackCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    textarea.remove()
    return ok
  } catch {
    return false
  }
}

/** Group thousands so a five-digit token count stays readable. */
function formatTokens(tokens: number): string {
  return tokens.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Title-case an adapter-owned effort id for the badge ("off" → "Off"). Ids are
 * opaque strings, so only a leading ASCII letter is changed.
 * @param value - the effort id the host reported.
 * @returns the label shown in the badge.
 */
function capitalizeEffort(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * The call's billed total: the provider's own number when it reported one,
 * otherwise the disjoint counters added up (uncached input + output + cache
 * reads/writes).
 */
function totalTokensOf(usage: EnhanceUsage): number {
  return usage.totalTokens ?? usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

/**
 * Footer info button: the call's context usage, on hover/focus (and a tap on
 * touch devices, where there is no hover). The card has no room for this in
 * its header, and the footer keeps the action row intact.
 * @param props - the usage numbers and the locale seat.
 * @returns the info button and its tooltip.
 */
function ContextUsageInfo(props: { usage?: ContextUsage; attachments?: { count: number }; t: TranslateNS<'dsh-prompt-enhance'> }): ReactNode {
  const { usage, attachments, t } = props
  const [open, setOpen] = useState(false)
  // Reaching the turn cap is the normal shape of the window, not a warning;
  // only a character squeeze or a cut turn needs the amber treatment.
  const limited = usage !== undefined && (usage.cutTurn || usage.limitedBy === 'chars')
  const percent = usage !== undefined && usage.maxChars > 0 ? Math.round((usage.usedChars / usage.maxChars) * 100) : 0
  const stats =
    usage === undefined
      ? t('panel.contextUnused')
      : t('panel.contextStats', {
          turns: usage.usedTurns,
          maxTurns: usage.maxTurns,
          chars: formatTokens(usage.usedChars),
          maxChars: formatTokens(usage.maxChars),
          percent,
        })
  const reason = usage === undefined ? '' : usage.cutTurn ? t('panel.contextCut') : usage.limitedBy === 'chars' ? t('panel.contextCharsLimited') : ''
  return (
    <span className="dsh-pe-context-wrap">
      <button
        type="button"
        className={`dsh-pe-context${limited ? ' is-limited' : ''}`}
        aria-label={t('panel.contextUsage')}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <svg className="dsh-pe-context-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.2 6.6h5.6M5.2 9.2h3.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span role="tooltip" className="dsh-pe-context-tip">
          <span className="dsh-pe-context-stats">{stats}</span>
          {reason !== '' && <span className="dsh-pe-context-reason">{reason}</span>}
          {attachments !== undefined && attachments.count > 0 && <span className="dsh-pe-context-attachments">{t('panel.attachmentsCount', { count: attachments.count })}</span>}
        </span>
      )}
    </span>
  )
}

/** One enhancement result card. */
export function ResultPanel(props: ResultPanelProps): ReactNode {
  const { state, t, onApply, onCancel, onRetry, applied = false, onUndo, onRegenerate, draftEmpty = false, regenerated = false, collapsed = false, onToggleCollapsed, foldAnimation = true } = props
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')
  /** Pending reset of the copy label; one timer only, so a second copy cannot be cut short by the first. */
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const copy = useCallback((): void => {
    if (state.result === undefined) return
    const text = state.result.text
    const done = (ok: boolean): void => {
      setCopied(ok ? 'ok' : 'failed')
      // Both outcomes are transient. A failure used to stay on the button until
      // the next click, which reads as a stuck control rather than an error; the
      // label now clears the same way a success does.
      if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied('idle'), 2500)
    }
    // navigator.clipboard only exists in secure contexts (https / localhost);
    // guard the dereference and fall back for plain-http LAN access.
    if (navigator.clipboard !== undefined) {
      navigator.clipboard.writeText(text).then(
        () => done(true),
        () => done(fallbackCopy(text)),
      )
      return
    }
    done(fallbackCopy(text))
  }, [state.result])

  const formatMs = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`)

  /**
   * The tooltip under the token total. Input and output always appear; a cache
   * counter only appears when the provider reported one above zero, so a route
   * without explicit cache writes does not print a meaningless 0.
   */
  const tokenDetail = (usage: EnhanceUsage): string => {
    const parts = [t('panel.tokens.input', { count: formatTokens(usage.inputTokens) }), t('panel.tokens.output', { count: formatTokens(usage.outputTokens) })]
    if ((usage.cacheReadTokens ?? 0) > 0) {
      parts.push(t('panel.tokens.cacheRead', { count: formatTokens(usage.cacheReadTokens ?? 0) }))
    }
    if ((usage.cacheWriteTokens ?? 0) > 0) {
      parts.push(t('panel.tokens.cacheWrite', { count: formatTokens(usage.cacheWriteTokens ?? 0) }))
    }
    return parts.join(' · ')
  }

  /**
   * One label of a swap group.
   *
   * Every label of the group sits in the same `.dsh-pe-swap` grid cell, so the
   * widest label of the active language defines the button width and swapping
   * the visible one cannot resize the button or shift the footer. Only the
   * active label is painted; `aria-hidden` keeps the inert ones out of the
   * accessibility tree even before the stylesheet applies.
   * @param active - whether this label is the one currently shown.
   * @param text - the label text.
   * @returns the label element.
   */
  const swapLabel = (active: boolean, text: string): ReactNode => (
    <span className={active ? 'on' : undefined} aria-hidden={active ? undefined : true}>
      {text}
    </span>
  )

  return (
    <section className={`dsh-pe-panel${collapsed ? ' is-collapsed' : ''}${foldAnimation ? '' : ' is-static'}`} role="region" aria-label={t('panel.title')}>
      <header className="dsh-pe-head">
        <span className="dsh-pe-title">
          <SparkleFishIcon size={15} />
          {t('panel.title')}
        </span>
        <div className="dsh-pe-head-actions">
          {state.phase === 'result' && state.result !== undefined && (
            <span className="dsh-pe-badge">
              {t('panel.model', { provider: state.result.provider, model: state.result.model })}
              {state.result.reasoningEffort === undefined ? null : (
                <>
                  {' · '}
                  {state.result.reasoningEffort === 'inherit' ? t('panel.effortDefault') : capitalizeEffort(state.result.reasoningEffort)}
                </>
              )}
              {' · '}
              {t('panel.elapsed', { ms: formatMs(state.result.elapsedMs) })}
              {state.result.usage === undefined ? null : (
                <>
                  {' · '}
                  <span title={tokenDetail(state.result.usage)}>{t('panel.tokens', { total: formatTokens(totalTokensOf(state.result.usage)) })}</span>
                </>
              )}
            </span>
          )}
          {/* Collapsed, the body — and with it the warnings — is hidden, so the
              header carries a marker instead of silently swallowing one. */}
          {collapsed && (state.stale === true || state.result?.truncated === true) ? (
            <span className="dsh-pe-warn-dot" title={state.stale === true ? t('panel.stale.warn') : t('panel.truncated')} aria-hidden="true">
              ⚠
            </span>
          ) : null}
          <button type="button" className="dsh-pe-collapse" aria-label={collapsed ? t('panel.expand') : t('panel.collapse')} aria-expanded={!collapsed} onClick={onToggleCollapsed}>
            <ChevronIcon open={!collapsed} />
          </button>
          <button type="button" className="dsh-pe-close" aria-label={t('panel.close')} onClick={onCancel}>
            <XIcon />
          </button>
        </div>
      </header>

      {/* The body keeps the header above and the footer below; only it folds.
          It stays mounted so the fold can animate (grid track 1fr ↔ 0fr) and the
          result's scroll position survives a fold. Collapsed, the CSS hides it
          from painting, selection and assistive tech. */}
      <div className="dsh-pe-body" aria-hidden={collapsed || undefined}>
        <div className="dsh-pe-body-inner">
          {state.phase === 'loading' && (
            <div className="dsh-pe-loading">
              {state.streaming === undefined || state.streaming === '' ? (
                <>
                  <div className="dsh-pe-spin" aria-hidden />
                  <div>{t('panel.loading')}</div>
                  <div className="dsh-pe-hint">{t('panel.loading.hint')}</div>
                </>
              ) : (
                <div className="dsh-pe-stream">
                  <div className="dsh-pe-col-title">
                    <span className="dsh-pe-spin small" aria-hidden />
                    {t('panel.streaming')}
                  </div>
                  <pre className="dsh-pe-result-text">{state.streaming}</pre>
                </div>
              )}
            </div>
          )}

          {state.phase === 'error' && state.error !== undefined && (
            <div className="dsh-pe-error">
              {state.error.localized !== undefined ? (
                <div>{state.error.localized}</div>
              ) : (
                <>
                  <div>{localizedErrorMessage(t, state.error.code, state.error.params)}</div>
                  {state.error.message !== undefined && state.error.message !== '' && <div className="dsh-pe-error-detail">{state.error.message}</div>}
                </>
              )}
            </div>
          )}

          {state.phase === 'result' && state.result !== undefined && (
            <div className="dsh-pe-result">
              <pre className="dsh-pe-result-text">{state.result.text}</pre>
            </div>
          )}

          {state.phase === 'result' && state.result?.truncated === true && <div className="dsh-pe-stale">⚠ {t('panel.truncated')}</div>}

          {state.phase === 'result' && state.stale && <div className="dsh-pe-stale">⚠ {t(draftEmpty ? 'panel.stale.empty' : 'panel.stale.warn')}</div>}
        </div>
      </div>

      <footer className="dsh-pe-foot">
        {state.phase === 'result' && <ContextUsageInfo usage={state.result?.context} attachments={state.attachments} t={t} />}
        <span className="dsh-pe-grow" />
        {state.phase === 'result' && (
          <button
            type="button"
            className="dsh-pe-btn-action plain dsh-pe-btn-floor"
            onClick={onRegenerate}
            disabled={onRegenerate === undefined}
            aria-disabled={draftEmpty || undefined}
            title={draftEmpty ? t('panel.regenerate.empty') : undefined}
          >
            <RegenerateIcon />
            <span className="dsh-pe-swap">
              {swapLabel(!regenerated, t('panel.regenerate'))}
              {swapLabel(regenerated, t('panel.regenerated'))}
            </span>
          </button>
        )}
        {state.phase === 'error' && (
          <>
            {retryable(state.error) && onRetry !== undefined && (
              <button type="button" className="dsh-pe-btn-action plain dsh-pe-btn-floor" onClick={onRetry}>
                {t('panel.retry')}
              </button>
            )}
          </>
        )}
        {state.phase === 'loading' && (
          <button type="button" className="dsh-pe-btn-action plain dsh-pe-btn-floor" onClick={onCancel}>
            {t('panel.cancel')}
          </button>
        )}
        {state.phase === 'result' && (
          <>
            <button type="button" className="dsh-pe-btn-action plain dsh-pe-btn-floor" onClick={copy}>
              <CopyIcon />
              <span className="dsh-pe-swap">
                {swapLabel(copied === 'idle', t('panel.copy'))}
                {swapLabel(copied === 'ok', t('panel.copied'))}
                {swapLabel(copied === 'failed', t('panel.copyFailed'))}
              </span>
            </button>
            {applied ? (
              <button type="button" className="dsh-pe-btn-action primary dsh-pe-btn-floor" onClick={onUndo} disabled={onUndo === undefined}>
                <UndoIcon />
                {/* The undo label reserves the width of the fill label it replaces,
                    so switching between the two does not resize the footer. */}
                <span className="dsh-pe-swap">
                  {swapLabel(true, t('undo.undo'))}
                  {swapLabel(false, t('panel.apply'))}
                </span>
              </button>
            ) : (
              <button type="button" className="dsh-pe-btn-action primary dsh-pe-btn-floor" onClick={onApply}>
                <FillIcon />
                <span className="dsh-pe-swap">
                  {swapLabel(true, t('panel.apply'))}
                  {swapLabel(false, t('undo.undo'))}
                </span>
              </button>
            )}
          </>
        )}
      </footer>
    </section>
  )
}
