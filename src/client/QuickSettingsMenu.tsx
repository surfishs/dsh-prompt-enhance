/**
 * The quick-settings menu the composer button opens.
 *
 * Deliberately small: the reasoning tier (a radio list including "follow the
 * provider default"), the output shape (prose / structured), and the context
 * switch — nothing numeric. It renders as a fixed-position sibling of the
 * button — no portal, because the client bundle has never depended on
 * `react-dom` and a menu is not worth introducing that dependency. Escape and
 * an outside click close it; Tab walks the items.
 *
 * The selected row is marked by a check at the right edge only: no bold, no
 * accent colour — the same way the shell's own menus show a choice.
 *
 * Both choice rows are drilled, not expanded: the card opens showing one cell
 * per choice (推理等级 <current> ›, 输出形态 <current> ›) and activating one
 * replaces the card content with its radio list, exactly like the shell's model
 * menu switches panes. Escape backs out of the pane first and only then closes
 * the menu.
 * @module dsh-prompt-enhance/client/QuickSettingsMenu
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales'
import { INHERIT_EFFORT, menuOptionsOf, rankModelGroups, type QuickSettingsData } from './quick-settings'

/** Where the menu hangs, in viewport coordinates. */
export interface QuickMenuAnchor {
  readonly right: number
  readonly top: number
}

/** Props of one open menu. */
export interface QuickSettingsMenuProps {
  t: TranslateNS<typeof NS>
  data: QuickSettingsData
  anchor: QuickMenuAnchor
  /** Write failure shown in place; the menu stays open. */
  error?: string
  onPick(effort: string): void
  onPickMode(mode: string): void
  onPickRoute(route: { provider: string; model: string } | null): void
  onToggleContext(next: boolean): void
  onClose(): void
}

/** One radio row: the label on the left, the check at the right. */
function MenuRow(props: { label: string; checked: boolean; role: 'menuitemradio'; onSelect(): void; highlight?: boolean }): ReactElement {
  const { label, checked, role, onSelect } = props
  const className = props.highlight === true && checked ? 'dsh-pe-menu-item is-selected' : 'dsh-pe-menu-item'
  return (
    <button type="button" role={role} aria-checked={checked} className={className} onClick={onSelect}>
      <span className="dsh-pe-menu-label">{label}</span>
      <span className="dsh-pe-menu-mark" aria-hidden>
        {checked ? '✓' : ''}
      </span>
    </button>
  )
}

/**
 * Render the menu above its trigger, clamped to the viewport.
 * @param props - the data, the anchor, and the actions.
 * @returns the menu element.
 */
export function QuickSettingsMenu(props: QuickSettingsMenuProps): ReactElement {
  const { t, data, anchor, error, onPick, onPickMode, onPickRoute, onToggleContext, onClose } = props
  const ref = useRef<HTMLDivElement | null>(null)

  const [pane, setPane] = useState<'root' | 'effort' | 'mode' | 'model'>('root')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement | null>(null)
  const paneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      // Escape backs out of the drilled pane first, then closes — the shell's
      // model menu behaves the same way.
      setPane((current) => {
        if (current !== 'root') return 'root'
        onClose()
        return current
      })
    }
    const onPointerDown = (event: MouseEvent): void => {
      const node = ref.current
      if (node === null) return
      const target = event.target
      if (target instanceof Node && node.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onPointerDown, true)
    }
  }, [onClose])

  useEffect(() => {
    if (pane === 'root') return
    if (pane === 'model') {
      searchRef.current?.focus()
      return
    }
    const checked = paneRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    checked?.focus()
  }, [pane])

  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  const right = Math.max(8, viewportWidth - anchor.right)
  const bottom = Math.max(8, viewportHeight - anchor.top + 8)
  const options = menuOptionsOf(data)
  // The stored value is an id (off); the cell shows the tier's display name
  // (Off) the same way the shell's trigger prints the model's effort name.
  const currentEffort = options.find((option) => option.id === data.effort)
  // A route that declares no tiers gets no radio rows at all: the appended
  // stored-value row is only for naming the folded cell, not for offering a
  // tier the model never declared.
  const radioOptions = data.efforts.length === 0 ? [] : options
  const effortValue = data.effort === INHERIT_EFFORT ? t('menu.effortDefault') : (currentEffort?.name ?? data.effort)
  const modeValue = data.mode === 'structured' ? t('settings.mode.structured') : t('settings.mode.prose')
  // The routing override the enhancement call will use. Empty — or a half pair,
  // which the host resolves as follow-session — means the session's own model.
  const providerPart = data.providerLabel === '' ? data.provider : data.providerLabel
  const modelPart = data.modelLabel === '' ? data.model : data.modelLabel
  const pinnedRoute = [providerPart, modelPart].filter((part) => part !== '').join(' / ')
  const modelValue = pinnedRoute === '' ? t('menu.modelFollow') : pinnedRoute
  const following = data.provider === '' || data.model === ''
  const pinned = data.provider !== '' && data.model !== ''
  const filteredGroups = useMemo(() => rankModelGroups(data.modelGroups, query), [data.modelGroups, query])

  return (
    <div ref={ref} className="dsh-pe-menu" role="menu" aria-label={t('menu.title')} style={{ position: 'fixed', right, bottom }}>
      {pane === 'root' ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="dsh-pe-menu-item dsh-pe-menu-cell"
            onClick={() => {
              setQuery('')
              setPane('model')
            }}
            title={t('menu.modelHint')}
          >
            <span className="dsh-pe-menu-label">{t('menu.model')}</span>
            <span className="dsh-pe-menu-state">{modelValue}</span>
            <span className="dsh-pe-menu-chevron" aria-hidden />
          </button>
          <button type="button" role="menuitem" className="dsh-pe-menu-item dsh-pe-menu-cell" onClick={() => setPane('effort')}>
            <span className="dsh-pe-menu-label">{t('menu.effort')}</span>
            <span className="dsh-pe-menu-state">{effortValue}</span>
            <span className="dsh-pe-menu-chevron" aria-hidden />
          </button>
          <button type="button" role="menuitem" className="dsh-pe-menu-item dsh-pe-menu-cell" onClick={() => setPane('mode')}>
            <span className="dsh-pe-menu-label">{t('menu.mode')}</span>
            <span className="dsh-pe-menu-state">{modeValue}</span>
            <span className="dsh-pe-menu-chevron" aria-hidden />
          </button>
          <div className="dsh-pe-menu-sep" role="separator" />
          <div className="dsh-pe-menu-switch">
            <span className="dsh-pe-menu-switch-label">{t('menu.context')}</span>
            <Switch className="dsh-pe-menu-switch-input" checked={data.contextAware} label={t('menu.context')} onChange={(next: boolean) => onToggleContext(next)} />
          </div>
        </>
      ) : pane === 'effort' ? (
        <div ref={paneRef} className="dsh-pe-menu-group" role="group" aria-label={t('menu.effort')}>
          <MenuRow role="menuitemradio" label={t('menu.effortDefault')} checked={data.effort === INHERIT_EFFORT} onSelect={() => onPick(INHERIT_EFFORT)} />
          {radioOptions.map((option) => (
            <MenuRow key={option.id} role="menuitemradio" label={option.name} checked={data.effort === option.id} onSelect={() => onPick(option.id)} />
          ))}
          {radioOptions.length > 0 ? null : (
            <div className="dsh-pe-menu-note" role="status">
              {data.effortReason === 'no-efforts' ? t('menu.effortsNone') : t('menu.effortsFailed')}
            </div>
          )}
        </div>
      ) : pane === 'mode' ? (
        <div ref={paneRef} className="dsh-pe-menu-group" role="group" aria-label={t('menu.mode')}>
          <MenuRow role="menuitemradio" label={t('settings.mode.prose')} checked={data.mode !== 'structured'} onSelect={() => onPickMode('prose')} />
          <MenuRow role="menuitemradio" label={t('settings.mode.structured')} checked={data.mode === 'structured'} onSelect={() => onPickMode('structured')} />
        </div>
      ) : (
        <div ref={paneRef} className="dsh-pe-menu-group dsh-pe-menu-model-pane" role="group" aria-label={t('menu.model')}>
          <div className="dsh-pe-menu-search">
            <input
              ref={searchRef}
              type="text"
              role="searchbox"
              className="dsh-pe-menu-search-input"
              placeholder={t('menu.searchPlaceholder')}
              aria-label={t('menu.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query === '' ? null : (
              <button
                type="button"
                className="dsh-pe-menu-search-clear"
                aria-label={t('menu.clearSearch')}
                onClick={() => {
                  setQuery('')
                  searchRef.current?.focus()
                }}
              >
                ×
              </button>
            )}
          </div>
          <MenuRow role="menuitemradio" label={t('menu.followSession')} checked={following} highlight onSelect={() => onPickRoute(null)} />
          {data.modelGroupsState === 'loading' ? (
            <div className="dsh-pe-menu-note" role="status">
              {t('menu.modelsLoading')}
            </div>
          ) : null}
          {data.modelGroupsState === 'failed' ? (
            <div className="dsh-pe-menu-note" role="status">
              {t('menu.modelsFailed')}
            </div>
          ) : null}
          {data.modelGroupsState === 'ready' && data.modelGroups.length === 0 ? (
            <div className="dsh-pe-menu-note" role="status">
              {t('menu.modelsEmpty')}
            </div>
          ) : null}
          {data.modelGroupsState === 'ready' && data.modelGroups.length > 0 && filteredGroups.length === 0 ? (
            <div className="dsh-pe-menu-note" role="status">
              {t('menu.noMatch')}
            </div>
          ) : null}
          {filteredGroups.map((group) => (
            <div key={group.id} className="dsh-pe-menu-model-group">
              <div className="dsh-pe-menu-group-label">{group.id === 'deepseek-account' ? t('menu.accountProvider') : group.name}</div>
              {group.models.map((model) => (
                <MenuRow
                  key={`${group.id}/${model.id}`}
                  role="menuitemradio"
                  label={model.name}
                  checked={pinned && data.provider === group.id && data.model === model.id}
                  highlight
                  onSelect={() => onPickRoute({ provider: group.id, model: model.id })}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      {error === undefined ? null : (
        <div className="dsh-pe-menu-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
