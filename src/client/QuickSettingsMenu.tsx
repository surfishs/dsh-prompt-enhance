/**
 * The quick-settings menu the composer button opens.
 *
 * Deliberately small: the reasoning tier (a radio list including "follow the
 * provider default") and the context switch, nothing numeric. It renders as a
 * fixed-position sibling of the button — no portal, because the client bundle
 * has never depended on `react-dom` and a menu is not worth introducing that
 * dependency. Escape and an outside click close it; Tab walks the items.
 *
 * The selected row is marked by a check at the right edge only: no bold, no
 * accent colour — the same way the shell's own menus show a choice.
 *
 * The tier list is drilled, not expanded: the card opens showing one cell
 * (推理等级   <current>   ›) and activating it replaces the card content with
 * the radio list, exactly like the shell's model menu switches panes. Escape
 * backs out of the pane first and only then closes the menu.
 * @module dsh-prompt-enhance/client/QuickSettingsMenu
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales'
import { INHERIT_EFFORT, menuOptionsOf, type QuickSettingsData } from './quick-settings'

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
  onToggleContext(next: boolean): void
  onClose(): void
}

/** One row: the label on the left, an optional state word, the check at the right. */
function MenuRow(props: { label: string; state?: string; checked: boolean; role: 'menuitemradio' | 'menuitemcheckbox'; onSelect(): void }): ReactElement {
  const { label, state, checked, role, onSelect } = props
  return (
    <button type="button" role={role} aria-checked={checked} className="dsh-pe-menu-item" onClick={onSelect}>
      <span className="dsh-pe-menu-label">{label}</span>
      {state === undefined ? null : <span className="dsh-pe-menu-state">{state}</span>}
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
  const { t, data, anchor, error, onPick, onToggleContext, onClose } = props
  const ref = useRef<HTMLDivElement | null>(null)

  const [pane, setPane] = useState<'root' | 'effort'>('root')
  const paneRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      // Escape backs out of the drilled pane first, then closes — the shell's
      // model menu behaves the same way.
      setPane((current) => {
        if (current === 'effort') return 'root'
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
    if (pane !== 'effort') return
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
  const effortValue = data.effort === INHERIT_EFFORT ? t('menu.effortDefault') : (currentEffort?.name ?? data.effort)

  return (
    <div ref={ref} className="dsh-pe-menu" role="menu" aria-label={t('menu.title')} style={{ position: 'fixed', right, bottom }}>
      {pane === 'root' ? (
        <>
          <button type="button" role="menuitem" className="dsh-pe-menu-item dsh-pe-menu-cell" onClick={() => setPane('effort')}>
            <span className="dsh-pe-menu-label">{t('menu.effort')}</span>
            <span className="dsh-pe-menu-state">{effortValue}</span>
            <span className="dsh-pe-menu-chevron" aria-hidden />
          </button>
          <div className="dsh-pe-menu-sep" role="separator" />
          <MenuRow
            role="menuitemcheckbox"
            label={t('menu.context')}
            state={data.contextAware ? t('menu.contextOn') : t('menu.contextOff')}
            checked={data.contextAware}
            onSelect={() => onToggleContext(!data.contextAware)}
          />
        </>
      ) : (
        <div ref={paneRef} className="dsh-pe-menu-group" role="group" aria-label={t('menu.effort')}>
          <MenuRow role="menuitemradio" label={t('menu.effortDefault')} checked={data.effort === INHERIT_EFFORT} onSelect={() => onPick(INHERIT_EFFORT)} />
          {options.map((option) => (
            <MenuRow key={option.id} role="menuitemradio" label={option.name} checked={data.effort === option.id} onSelect={() => onPick(option.id)} />
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
