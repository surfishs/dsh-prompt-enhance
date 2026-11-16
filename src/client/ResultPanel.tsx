/**
 * The enhancement card: header with model/usage meta, the enhanced body (or
 * the streamed text / error), and the apply/undo/copy/close actions. It is a
 * plain non-modal region rendered inside the composer dock, not a dialog:
 * the dock wrapper owns session ownership, keyboard handling and auto-close.
 * @module dsh-prompt-enhance/client/ResultPanel
 */

import { useCallback, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { EnhanceError, EnhanceUsage } from '../shared/protocol'
import type { PromptEnhanceKey } from './locales'
import type { PanelState } from './ui-state'
import { CopyIcon, FillIcon, RegenerateIcon, UndoIcon } from './ActionIcons'
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
  /** Show the transient 'undone' chip after an undo. */
  undone?: boolean
  /** Show the transient 'regenerated' chip after a regenerate request settles. */
  regenerated?: boolean
}

/** Whether one error phase is worth retrying (model/transport failures). */
const retryable = (code: string | undefined): boolean => code === 'upstream' || code === 'timeout' || code === 'internal'

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
 * Primary line for a server-side error, localized by the stable code and its
 * structured params: an upstream `reason` picks a specific fix hint when one
 * exists, and an over-length rejection reuses the too-long input message the
 * client-side guard shows. The server's `message` (provider raw text, config
 * errors) renders beneath as the diagnostic detail line.
 */
function localizedErrorMessage(
  t: ResultPanelProps['t'],
  code: EnhanceError['code'],
  params: EnhanceError['params'],
): string {
  if (code === 'rejected' && typeof params?.count === 'number' && typeof params?.max === 'number') {
    return t('error.tooLong', { count: params.count, max: params.max })
  }
  if (code === 'upstream' && typeof params?.reason === 'string') {
    const specific = UPSTREAM_ERROR_KEYS[params.reason]
    if (specific !== undefined) return t(specific)
  }
  switch (code) {
    case 'rejected': return t('error.rejected')
    case 'rate-limit': return t('error.rateLimit', params)
    case 'concurrency-limit': return t('error.concurrencyLimit', params)
    case 'cooldown': return t('error.cooldown', params)
    case 'timeout': return t('error.timeout', params)
    case 'unconfigured': return t('error.unconfigured')
    case 'effort-unsupported': return t('error.effortUnsupported', params)
    case 'upstream': return t('error.upstream')
    default: return t('error.internal')
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
 * The call's billed total: the provider's own number when it reported one,
 * otherwise the disjoint counters added up (uncached input + output + cache
 * reads/writes).
 */
function totalTokensOf(usage: EnhanceUsage): number {
  return usage.totalTokens ?? usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

/** One enhancement result card. */
export function ResultPanel(props: ResultPanelProps): ReactNode {
  const { state, t, onApply, onCancel, onRetry, applied = false, onUndo, onRegenerate, undone = false, regenerated = false } = props
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle')

  const copy = useCallback((): void => {
    if (state.result === undefined) return
    const text = state.result.text
    const done = (ok: boolean): void => {
      setCopied(ok ? 'ok' : 'failed')
      if (ok) setTimeout(() => setCopied('idle'), 2500)
    }
    // navigator.clipboard only exists in secure contexts (https / localhost);
    // guard the dereference and fall back for plain-http LAN access.
    if (navigator.clipboard !== undefined) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)))
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
    const parts = [
      t('panel.tokens.input', { count: formatTokens(usage.inputTokens) }),
      t('panel.tokens.output', { count: formatTokens(usage.outputTokens) }),
    ]
    if ((usage.cacheReadTokens ?? 0) > 0) {
      parts.push(t('panel.tokens.cacheRead', { count: formatTokens(usage.cacheReadTokens ?? 0) }))
    }
    if ((usage.cacheWriteTokens ?? 0) > 0) {
      parts.push(t('panel.tokens.cacheWrite', { count: formatTokens(usage.cacheWriteTokens ?? 0) }))
    }
    return parts.join(' · ')
  }

  return (
    <section className="dsh-pe-panel" role="region" aria-label={t('panel.title')}>
      <header className="dsh-pe-head">
        <span className="dsh-pe-title">
          <SparkleFishIcon size={15} />
          {t('panel.title')}
        </span>
        <div className="dsh-pe-head-actions">
          {state.phase === 'result' && state.result !== undefined && (
            <span className="dsh-pe-badge">
              {t('panel.model', { provider: state.result.provider, model: state.result.model })} · {t('panel.elapsed', { ms: formatMs(state.result.elapsedMs) })}
              {state.result.usage === undefined
                ? null
                : (
                    <>
                      {' · '}
                      <span title={tokenDetail(state.result.usage)}>
                        {t('panel.tokens', { total: formatTokens(totalTokensOf(state.result.usage)) })}
                      </span>
                    </>
                  )}
            </span>
          )}
          {copied === 'ok'
            ? <span className="dsh-pe-applied">{t('panel.copiedShort')}</span>
            : regenerated
              ? <span className="dsh-pe-applied">{t('panel.regeneratedShort')}</span>
              : applied
                ? <span className="dsh-pe-applied">{t('panel.appliedShort')}</span>
                : undone
                  ? <span className="dsh-pe-applied">{t('panel.undoneShort')}</span>
                  : null}
          <button type="button" className="dsh-pe-close" aria-label={t('panel.close')} onClick={onCancel}>✕</button>
        </div>
      </header>

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
              {state.error.message !== undefined && state.error.message !== '' && (
                <div className="dsh-pe-error-detail">{state.error.message}</div>
              )}
            </>
          )}
        </div>
      )}

      {state.phase === 'result' && state.result !== undefined && (
        <div className="dsh-pe-result">
          <pre className="dsh-pe-result-text">{state.result.text}</pre>
        </div>
      )}

      {state.phase === 'result' && state.result?.truncated === true && (
        <div className="dsh-pe-stale">⚠ {t('panel.truncated')}</div>
      )}

      {state.phase === 'result' && state.stale && (
        <div className="dsh-pe-stale">⚠ {t('panel.stale.warn')}</div>
      )}

      <footer className="dsh-pe-foot">
        <span className="dsh-pe-grow" />
        {state.phase === 'result' && (
          <button type="button" className="dsh-pe-btn-action plain" onClick={onRegenerate} disabled={onRegenerate === undefined}>
            <RegenerateIcon />
            {t('panel.regenerate')}
          </button>
        )}
        {state.phase === 'error' && (
          <>
            {retryable(state.error?.code) && onRetry !== undefined && (
              <button type="button" className="dsh-pe-btn-action plain" onClick={onRetry}>{t('panel.retry')}</button>
            )}
          </>
        )}
        {state.phase === 'loading' && (
          <button type="button" className="dsh-pe-btn-action plain" onClick={onCancel}>{t('panel.cancel')}</button>
        )}
        {state.phase === 'result' && (
          <>
            <button type="button" className="dsh-pe-btn-action plain dsh-pe-copy" onClick={copy}>
              <CopyIcon />
              {copied === 'ok' ? t('panel.copied') : copied === 'failed' ? t('panel.copyFailed') : t('panel.copy')}
            </button>
            {applied ? (
              <button type="button" className="dsh-pe-btn-action primary" onClick={onUndo} disabled={onUndo === undefined}>
                <UndoIcon />
                {t('undo.undo')}
              </button>
            ) : (
              <button type="button" className="dsh-pe-btn-action primary" onClick={onApply}><FillIcon />{t('panel.apply')}</button>
            )}
          </>
        )}
      </footer>
    </section>
  )
}
