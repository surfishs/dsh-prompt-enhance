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
import { HEAD_STYLE, HINT_STYLE, INPUT_STYLE, INVALID_STYLE, LABEL_STYLE, REFRESH_STYLE, RESET_STYLE, ROW_STYLE, SELECT_STYLE, STATUS_STYLE, WARN_STYLE } from './settings-page-styles'

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
export function ReasoningRow(props: RowProps & { provider: string; model: string }): ReactElement {
  const pair = props.provider !== '' && props.model !== '' ? `${props.provider}/${props.model}` : ''
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [capabilities, setCapabilities] = useState<ReasoningCapabilities | undefined>(undefined)
  const [refreshToken, setRefreshToken] = useState(0)
  const [feedback, setFeedback] = useState<'idle' | 'refreshing' | 'ok' | 'failed'>('idle')
  const forceRef = useRef(false)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    const force = forceRef.current
    forceRef.current = false
    setPhase('loading')
    setCapabilities(undefined)
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
  }, [pair, refreshToken])

  // Every provider — DeepSeek included — shows the adapter's own tier names;
  // only the "follow provider default" sentinel is plugin copy.
  const current = props.view.text
  const realTierKnown = phase === 'ready' && capabilities !== undefined && capabilities.source !== 'unavailable' && capabilities.efforts.some((effort) => effort.id === current)
  const noTiers = phase === 'ready' && capabilities !== undefined && capabilities.source === 'unavailable' && capabilities.reason === 'no-efforts'
  const options: { value: string; label: string; title?: string }[] = []
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
  options.push({
    value: 'inherit',
    label: props.copy.choice('settings.reasoning.inherit'),
    title: props.copy.choice('settings.reasoning.inherit'),
  })
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
        value={noTiers ? 'inherit' : props.view.text}
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
        <p style={STATUS_STYLE} aria-live="polite">
          {props.copy.choice('settings.reasoning.refreshOk')}
        </p>
      ) : null}
      {feedback === 'failed' ? (
        <p style={STATUS_STYLE} aria-live="polite">
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
      {showCustom ? <TextControl value={current} placeholder={props.copy.choice('settings.routing.customPlaceholder')} disabled={props.disabled} onChange={props.onEdit} /> : null}
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
  return (
    <input
      id={props.id}
      type="text"
      inputMode={props.numeric === true ? 'numeric' : undefined}
      aria-invalid={showInvalid || undefined}
      disabled={props.disabled}
      placeholder={props.placeholder}
      value={props.value}
      style={{
        ...INPUT_STYLE,
        ...(props.disabled === true ? { color: 'var(--dsw-alias-label-tertiary, inherit)', cursor: 'default' } : {}),
        ...(borderColor === undefined ? {} : { borderColor }),
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (props.invalid === true) setRevealedInvalid(true)
        props.onCommit?.()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        if (props.invalid === true) setRevealedInvalid(true)
        props.onCommit?.()
      }}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )
}

export function ValueRow(props: RowProps & { numeric: boolean; placeholder?: string }): ReactElement {
  const invalid = props.view.invalid
  return (
    <div style={ROW_STYLE}>
      <div style={HEAD_STYLE}>
        <label htmlFor={props.id} style={LABEL_STYLE}>
          {props.label}
        </label>
        {props.view.overridden ? <OverrideActions copy={props.copy} disabled={props.disabled} onReset={props.onReset} /> : null}
      </div>
      <TextControl
        id={props.id}
        value={props.view.text}
        placeholder={props.placeholder}
        numeric={props.numeric}
        invalid={invalid}
        disabled={props.disabled}
        onChange={props.onEdit}
        onCommit={props.onCommit}
      />
      <p style={HINT_STYLE}>{props.hint}</p>
      {invalid ? <p style={INVALID_STYLE}>{props.copy.labels.invalidNumber}</p> : null}
    </div>
  )
}
