/**
 * The row controls: one component per row kind, plus the chip, select and text
 * primitives they build on.
 * @module dsh-prompt-enhance/client/settings-page-controls
 */

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { SegmentedControl, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReasoningCapabilities } from '../shared/reasoning'
import { fetchReasoningCapabilities } from './reasoning-options'
import type { LlmRoutingState } from './llm-catalog'
import type { RowProps } from './settings-page-spec'
import type { RowCopy } from './settings-page-copy'
import {
  HEAD_STYLE,
  HINT_STYLE,
  FIELD_INPUT_STYLE,
  FIELD_SHELL_STYLE,
  INVALID_STYLE,
  LABEL_STYLE,
  NOTICE_STYLE,
  RECORD_STYLE,
  REFRESH_STYLE,
  RESET_STYLE,
  ROW_STYLE,
  SELECT_STYLE,
  STATUS_STYLE,
  WARN_STYLE,
} from './settings-page-styles'
import { shortcutSpecOf } from './shortcut'

/**
 * The "overridden" badge and its reset button, as the text rows draw them.
 * @param props - the frame copy, whether writes are refused, and the reset handler.
 * @returns the badge pair.
 */
export function OverrideActions(props: { copy: RowCopy; disabled: boolean; onReset: () => void }): ReactElement {
  return (
    <button type="button" className="dsh-pe-chip-reset" style={{ ...RESET_STYLE, ...(props.disabled ? { opacity: 0.5, cursor: 'default' } : {}) }} disabled={props.disabled} onClick={props.onReset}>
      {props.copy.labels.reset}
    </button>
  )
}

/**
 * A boolean row: the title and the shell's switch on one line, the hint below.
 * @param props - the row, its copy, its state, and its actions.
 * @returns the row element.
 */
export function BooleanRow(props: RowProps): ReactElement {
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
        <Switch checked={props.view.text === 'true'} disabled={props.disabled} label={props.label} onChange={(next: boolean) => props.onEdit(next ? 'true' : 'false')} />
      </div>
      <p style={HINT_STYLE}>{props.hint}</p>
    </div>
  )
}

/**
 * A fixed-choice row: the shell's segmented control under the title.
 * @param props - the row, its choices, its state, and its actions.
 * @returns the row element.
 */
export function ChoiceRow(props: RowProps & { options: readonly { value: string; label: string; title?: string }[] }): ReactElement {
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SegmentedControl
        id={props.id}
        className="dsh-pe-segmented-labels"
        value={props.view.text}
        options={props.options.map((option) => ({ ...option, title: option.title ?? option.label }))}
        disabled={props.disabled}
        label={props.label}
        onChange={(next: string) => props.onEdit(next)}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
    </div>
  )
}

/**
 * The reasoning row: choices come from what the configured route declares.
 *
 * - Both provider/model empty → follow the default model; the host answers from
 *   its static DeepSeek catalog, or reports unavailable when the default is not
 *   DeepSeek. This path is not cached (the page cannot observe the default).
 * - A pinned pair → the answer is cached in `localStorage` with no TTL; it is
 *   replaced only when the pair changes or the user presses refresh.
 *
 * While the answer is pending, or when it is unavailable, the control offers
 * only "follow provider default" instead of guessing a tier list.
 * @param props - the row, its copy, state, actions, and the pinned pair.
 * @returns the row element.
 */
/**
 * Last capability answer per provider/model pair, for this browser session.
 *
 * The host already keeps a durable disk cache; this one exists so a remount or a
 * model switch the user has already inspected renders the tier list in the same
 * frame instead of flashing "正在读取该模型的档位…" and re-listing the control.
 * Transport failures are not remembered.
 */
const capabilityCache = new Map<string, ReasoningCapabilities>()

/** Key of one pair (`''` when the plugin follows the session model). */
function capabilityKey(provider: string, model: string): string {
  return `${provider}\u0000${model}`
}

/**
 * Drop the session-level capability cache. Tests swap the host answer between
 * cases; a deployment may call it after an adapter change.
 */
export function forgetReasoningCapabilities(): void {
  capabilityCache.clear()
}

export function ReasoningRow(props: RowProps & { provider: string; model: string }): ReactElement {
  const pair = props.provider !== '' && props.model !== '' ? `${props.provider}/${props.model}` : ''
  const cacheKey = capabilityKey(props.provider, props.model)
  const cached = capabilityCache.get(cacheKey)
  const [phase, setPhase] = useState<'loading' | 'ready'>(cached === undefined ? 'loading' : 'ready')
  const [capabilities, setCapabilities] = useState<ReasoningCapabilities | undefined>(cached)
  const [refreshToken, setRefreshToken] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'refreshing' | 'ok' | 'failed'>('idle')
  const forceRef = useRef(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    const force = forceRef.current
    forceRef.current = false
    // Keep the last answer on screen while the fresh read is in flight: the list
    // then swaps once, instead of collapsing to the sentinel and rebuilding.
    const known = capabilityCache.get(cacheKey)
    setPhase(known === undefined ? 'loading' : 'ready')
    setCapabilities(known)
    setFeedback(force ? 'refreshing' : 'idle')
    if (feedbackTimer.current !== undefined) {
      clearTimeout(feedbackTimer.current)
      feedbackTimer.current = undefined
    }
    /** Settle the manual-refresh feedback; initial loads show no outcome. */
    const settle = (result: 'ok' | 'failed'): void => {
      if (!force) return
      setFeedback(result)
      feedbackTimer.current = setTimeout(() => {
        setFeedback('idle')
        feedbackTimer.current = undefined
      }, 3000)
    }
    fetchReasoningCapabilities(props.provider === '' ? undefined : props.provider, props.model === '' ? undefined : props.model, { refresh: force, signal: controller.signal })
      .then((answer) => {
        if (controller.signal.aborted) return
        setCapabilities(answer)
        setPhase('ready')
        // Remember every answer the host actually gave; a transport failure is
        // not an answer and must be retried next time.
        if (answer.source !== 'unavailable' || answer.reason === 'no-efforts') capabilityCache.set(cacheKey, answer)
        settle(answer.source === 'unavailable' ? 'failed' : 'ok')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCapabilities({ efforts: [], source: 'unavailable', reason: 'resolve-failed' })
        setPhase('ready')
        settle('failed')
      })
    return () => {
      controller.abort()
      if (feedbackTimer.current !== undefined) {
        clearTimeout(feedbackTimer.current)
        feedbackTimer.current = undefined
      }
    }
    // `pair` covers both ids; the default path reuses the empty string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, pair, refreshToken])

  // Every provider — DeepSeek included — shows the adapter's own tier names;
  // only the "model default" sentinel is plugin copy. It leads the control: the
  // stored value can point at it, and it must not trail the concrete tiers.
  const current = props.view.text
  const realTierKnown = phase === 'ready' && capabilities !== undefined && capabilities.source !== 'unavailable' && capabilities.efforts.some((effort) => effort.id === current)
  const noTiers = phase === 'ready' && capabilities !== undefined && capabilities.source === 'unavailable' && capabilities.reason === 'no-efforts'
  const options: { value: string; label: string; title?: string }[] = []
  // The sentinel comes first: it is the fallback state, and a config that
  // stores it must not render its selection at the tail of the control.
  options.push({
    value: 'inherit',
    label: props.copy.choice('settings.reasoning.inherit'),
    title: props.copy.choice('settings.reasoning.inherit'),
  })
  // A value the route does not declare (stale config, or while the list is
  // still loading) is kept as a visible synthetic choice. Without it the
  // segmented control's indicator has no matching option and slides off the
  // left edge.
  if (!noTiers && current !== '' && current !== 'inherit' && !realTierKnown) {
    options.push({
      value: current,
      label: props.copy.interpolate('settings.reasoning.current', { value: current }),
      title: props.copy.choice('settings.reasoning.currentTitle'),
    })
  }
  if (phase === 'ready' && capabilities !== undefined && capabilities.source !== 'unavailable') {
    for (const effort of capabilities.efforts) {
      options.push({
        value: effort.id,
        label: effort.name,
        title: effort.description === undefined ? effort.name : `${effort.name} — ${effort.description}`,
      })
    }
  }
  // The host control derives the indicator from `findIndex(value)`: a value the
  // option list does not carry makes that -1, which parks the pill outside the
  // track. Whatever the host projects (including an empty text), the control is
  // only ever handed a value it can select.
  const selected = options.some((option) => option.value === current) ? current : 'inherit'
  const unsupported = !noTiers && phase === 'ready' && capabilities?.source !== 'unavailable' && current !== '' && current !== 'inherit' && !realTierKnown
  const refreshing = feedback === 'refreshing'
  const refresh = (): void => {
    forceRef.current = true
    setRefreshToken((token) => token + 1)
  }
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <span style={LABEL_STYLE}>{props.label}</span>
        {phase === 'ready' || refreshing ? (
          <button type="button" className="dsh-pe-chip-refresh" style={{ ...REFRESH_STYLE, opacity: props.disabled || refreshing ? 0.5 : 1 }} disabled={props.disabled || refreshing} onClick={refresh}>
            {props.copy.choice(refreshing ? 'settings.reasoning.refreshing' : 'settings.reasoning.refresh')}
          </button>
        ) : null}
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SegmentedControl
        id={props.id}
        className="dsh-pe-segmented-labels"
        // A route that declares no tiers is presented as "follow provider
        // default"; the stored tier stays in the config and the host omits it
        // on the call, so the displayed state matches what actually happens.
        value={selected}
        options={options}
        // "Follow provider default" stays selectable while the tier list is
        // still loading; the tier choices themselves only appear once known.
        disabled={props.disabled}
        label={props.label}
        onChange={(next: string) => props.onEdit(next)}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
      {phase === 'loading' ? <p style={STATUS_STYLE}>{props.copy.choice('settings.reasoning.loading')}</p> : null}
      {phase === 'ready' && capabilities?.source === 'unavailable' ? <p style={STATUS_STYLE}>{props.copy.choice(noTiers ? 'settings.reasoning.noTiers' : 'settings.reasoning.unavailable')}</p> : null}
      {unsupported ? <p style={STATUS_STYLE}>{props.copy.interpolate('settings.reasoning.unsupported', { effort: props.view.text })}</p> : null}
      {feedback === 'ok' ? (
        <p style={NOTICE_STYLE} aria-live="polite">
          {props.copy.choice('settings.reasoning.refreshOk')}
        </p>
      ) : null}
      {feedback === 'failed' ? (
        <p style={NOTICE_STYLE} aria-live="polite">
          {props.copy.choice('settings.reasoning.refreshFailed')}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The shared select control: a 1px resting border (a hairline can vanish at
 * some scale factors) and a business-colour border while focused, so the
 * control's outline never depends on the browser's focus ring.
 */
export function SelectControl(props: { id: string; value: string; disabled?: boolean; onChange: (value: string) => void; children: ReactNode }): ReactElement {
  const [focused, setFocused] = useState(false)
  return (
    <select
      id={props.id}
      style={{ ...SELECT_STYLE, ...(focused ? { borderColor: 'var(--dsw-alias-state-business-primary, #4f8cff)' } : {}) }}
      value={props.value}
      disabled={props.disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.children}
    </select>
  )
}

/**
 * The provider select: registered providers plus dormant ones rendered
 * disabled, and a synthetic entry for a stored value outside the registry.
 * @param props - the row, its state, and the catalog reads.
 * @returns the row element.
 */
export function ProviderRow(props: RowProps & { routing: LlmRoutingState }): ReactElement {
  const current = props.view.text
  const known = props.routing.providers.entries.find((entry) => entry.id === current)
  const missing = current !== '' && known === undefined
  const unconfigured = known !== undefined && !known.registered
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>
          {props.label}
        </label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SelectControl id={props.id} value={current} disabled={props.disabled} onChange={(value) => props.onEdit(value)}>
        <option value="">{props.copy.choice('settings.routing.followSession')}</option>
        {missing ? (
          <option value={current} title={current}>
            {props.copy.interpolate('settings.routing.currentProvider', { value: current })}
          </option>
        ) : null}
        <optgroup label={props.copy.choice('settings.routing.groupRegistered')}>
          {props.routing.providers.entries
            .filter((entry) => entry.registered)
            .map((entry) => (
              <option key={entry.id} value={entry.id} title={entry.id}>
                {entry.name}
              </option>
            ))}
        </optgroup>
        {props.routing.providers.entries.some((entry) => !entry.registered) ? (
          <optgroup label={props.copy.choice('settings.routing.groupDormant')}>
            {props.routing.providers.entries
              .filter((entry) => !entry.registered)
              .map((entry) => (
                <option key={entry.id} value={entry.id} disabled title={props.copy.choice('settings.routing.unconfiguredTitle')}>
                  {entry.name}
                  {props.copy.choice('settings.routing.unconfiguredSuffix')}
                </option>
              ))}
          </optgroup>
        ) : null}
      </SelectControl>
      <p style={HINT_STYLE}>{props.hint}</p>
      {props.routing.providers.loading ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.providersLoading')}</p> : null}
      {props.routing.providers.failed ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.providersFailed')}</p> : null}
      {props.routing.providers.failed ? (
        <button type="button" style={REFRESH_STYLE} onClick={props.routing.providers.reload}>
          {props.copy.choice('settings.routing.retry')}
        </button>
      ) : null}
      {missing ? <p style={WARN_STYLE}>{props.copy.interpolate('settings.routing.providerMissing', { value: current })}</p> : null}
      {unconfigured ? <p style={WARN_STYLE}>{props.copy.interpolate('settings.routing.providerUnconfigured', { name: known.name })}</p> : null}
    </div>
  )
}

/**
 * The model select: the provider's advertised models, a "custom…" entry that
 * reveals a free-text input, and warnings (incomplete pair / unresolvable
 * route) that never block saving.
 * @param props - the row, its state, the catalog reads, and the provider value.
 * @returns the row element.
 */
export function ModelRow(props: RowProps & { routing: LlmRoutingState; providerValue: string }): ReactElement {
  const current = props.view.text
  const provider = props.providerValue
  const [customMode, setCustomMode] = useState(false)
  const known = props.routing.models.entries.some((entry) => entry.id === current)
  // A stored model outside the advertised catalog is still editable, so the
  // custom input opens automatically for it instead of hiding the value.
  const showCustom = provider !== '' && (customMode || (current !== '' && !known))
  const pairIncomplete = provider !== '' && current === ''
  const routeUnavailable = provider !== '' && current !== '' && props.routing.route.available === false
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>
          {props.label}
        </label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <SelectControl
        id={props.id}
        value={showCustom ? '__custom__' : current}
        disabled={props.disabled || provider === ''}
        onChange={(value) => {
          if (value === '__custom__') {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          props.onEdit(value)
        }}
      >
        <option value="">{provider === '' ? props.copy.choice('settings.routing.followSession') : props.copy.choice('settings.routing.selectModel')}</option>
        {props.routing.models.entries.map((entry) => (
          <option key={entry.id} value={entry.id} title={entry.id}>
            {entry.name}
          </option>
        ))}
        {provider !== '' && current !== '' && !known ? (
          <option value={current} title={current}>
            {props.copy.interpolate('settings.routing.currentModel', { value: current })}
          </option>
        ) : null}
        {provider !== '' ? <option value="__custom__">{props.copy.choice('settings.routing.custom')}</option> : null}
      </SelectControl>
      {showCustom ? (
        <TextControl
          value={current}
          placeholder={props.copy.choice('settings.routing.customPlaceholder')}
          disabled={props.disabled}
          onChange={(text) => props.onEdit(text, { deferred: true })}
          onCommit={props.onCommit}
        />
      ) : null}
      <p style={HINT_STYLE}>{props.hint}</p>
      {props.routing.models.loading ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.modelsLoading')}</p> : null}
      {props.routing.models.failed && !showCustom ? <p style={STATUS_STYLE}>{props.copy.choice('settings.routing.modelsFailed')}</p> : null}
      {pairIncomplete ? <p style={WARN_STYLE}>{props.copy.choice('settings.routing.pairIncomplete')}</p> : null}
      {routeUnavailable ? <p style={WARN_STYLE}>{props.copy.choice('settings.routing.routeUnavailable')}</p> : null}
    </div>
  )
}

/**
 * A text/number row: the title and the reset chip on one line, a native input,
 * then the hint. The host's `SettingsValueField` draws its own badge and reset
 * link, which would diverge from the chip the other rows use, so value rows
 * share this control instead.
 * @param props - the row, its copy, state, and whether it is numeric.
 * @returns the row element.
 */
/**
 * The shared text/number control: the same 1px border as the selects, turning
 * the same business colour while focused (the invalid state wins over focus).
 */
export function TextControl(props: {
  id?: string
  value: string
  placeholder?: string
  numeric?: boolean
  invalid?: boolean
  disabled?: boolean
  multiline?: boolean
  onChange: (value: string) => void
  onCommit?: () => void
}): ReactElement {
  const [focused, setFocused] = useState(false)
  const [revealedInvalid, setRevealedInvalid] = useState(false)
  useEffect(() => {
    if (props.invalid !== true) setRevealedInvalid(false)
  }, [props.invalid])
  const showInvalid = props.invalid === true && revealedInvalid
  const borderColor = showInvalid ? 'var(--dsw-alias-state-error-primary, #f85149)' : focused ? 'var(--dsw-alias-state-business-primary, #4f8cff)' : undefined
  const multiline = props.multiline === true
  const commit = (): void => {
    if (props.invalid === true) setRevealedInvalid(true)
    props.onCommit?.()
  }
  return (
    // Host primitives Input: a flex shell centers a borderless inner input, so
    // the text sits on the shell's center line instead of relying on a fixed
    // height plus a line-height to be centered by the browser. The multiline
    // variant grows instead of centering: its rows are prose, not one value.
    <div style={{ ...(multiline ? { ...FIELD_SHELL_STYLE, height: 'auto', padding: '8px 12px', alignItems: 'stretch' } : FIELD_SHELL_STYLE), ...(borderColor === undefined ? {} : { borderColor }) }}>
      {multiline ? (
        <textarea
          id={props.id}
          rows={5}
          aria-invalid={showInvalid || undefined}
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={props.value}
          style={{
            ...FIELD_INPUT_STYLE,
            height: 'auto',
            minHeight: 88,
            resize: 'vertical',
            ...(props.disabled === true ? { color: 'var(--dsw-alias-label-tertiary, inherit)', cursor: 'default' } : {}),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(event) => {
            // Enter belongs to the text here; Ctrl/Cmd+Enter commits without
            // leaving the field, so a keyboard user can still save a paragraph.
            if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
            event.preventDefault()
            commit()
          }}
          onChange={(event) => props.onChange(event.target.value)}
        />
      ) : (
        <input
          id={props.id}
          type="text"
          inputMode={props.numeric === true ? 'numeric' : undefined}
          aria-invalid={showInvalid || undefined}
          disabled={props.disabled}
          placeholder={props.placeholder}
          value={props.value}
          style={{
            ...FIELD_INPUT_STYLE,
            ...(props.disabled === true ? { color: 'var(--dsw-alias-label-tertiary, inherit)', cursor: 'default' } : {}),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            commit()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
          }}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </div>
  )
}

export function ValueRow(props: RowProps & { numeric: boolean; placeholder?: string; invalidMessage?: string; recordable?: boolean; multiline?: boolean }): ReactElement {
  // Two sources of "invalid": the descriptor refused the staged text (numbers),
  // and the row's own client-side validation (the shortcut format).
  const invalid = props.view.invalid || props.invalidMessage !== undefined
  // The client-side message waits for blur / Enter, like the number rows' border,
  // so typing "ctrl+alt+" does not flash a warning mid-combination. A value that
  // was already invalid when the page opened shows it immediately.
  const [revealed, setRevealed] = useState(props.invalidMessage !== undefined)
  useEffect(() => {
    if (props.invalidMessage === undefined) setRevealed(false)
  }, [props.invalidMessage])
  const showMessage = invalid && (props.view.invalid || revealed)
  // Recorder: one press fills the field instead of typing the spec by hand.
  const [recording, setRecording] = useState(false)
  const [recordRejected, setRecordRejected] = useState(false)
  const { onEdit, onCommit } = props
  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.repeat) return
      const key = event.key
      // Modifier-only presses keep waiting for the real key.
      if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return
      if (key === 'Escape' || key === 'Tab') {
        // Escape cancels; Tab keeps its navigation and just stops recording.
        setRecording(false)
        setRecordRejected(false)
        if (key === 'Escape') event.preventDefault()
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const spec = shortcutSpecOf(event)
      if (spec === null) {
        setRecordRejected(true)
        return
      }
      setRecording(false)
      setRecordRejected(false)
      onEdit(spec)
      onCommit?.()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, onEdit, onCommit])
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>
          {props.label}
        </label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
        {props.recordable === true ? (
          <button
            type="button"
            className="dsh-pe-chip-reset"
            style={RECORD_STYLE}
            disabled={props.disabled}
            aria-pressed={recording}
            onClick={() => {
              setRecording((open) => !open)
              setRecordRejected(false)
            }}
          >
            {recording ? props.copy.labels.recordStop : props.copy.labels.record}
          </button>
        ) : null}
      </div>
      <TextControl
        id={props.id}
        value={props.view.text}
        placeholder={props.placeholder}
        numeric={props.numeric}
        multiline={props.multiline}
        invalid={invalid}
        disabled={props.disabled}
        onChange={(text: string) => {
          setRevealed(false)
          props.onEdit(text)
        }}
        onCommit={() => {
          setRevealed(true)
          props.onCommit?.()
        }}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
      {recording ? <p style={NOTICE_STYLE}>{recordRejected ? props.copy.labels.recordNeedsModifier : props.copy.labels.recordPrompt}</p> : null}
      {showMessage ? <p style={INVALID_STYLE}>{props.invalidMessage ?? props.copy.labels.invalidNumber}</p> : null}
    </div>
  )
}
