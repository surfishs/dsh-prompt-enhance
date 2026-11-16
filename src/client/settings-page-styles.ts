/**
 * Inline styles and the header constants of the configuration pages.
 *
 * Kept apart from the components on purpose: a visual tweak should not have to
 * open the row table or the renderer, and the values here are pure data.
 * @module dsh-prompt-enhance/client/settings-page-styles
 */

import type { CSSProperties } from 'react'

/**
 * Inline copies of the host form's row metrics (the shell's `181ew` styles
 * module), so a switch or segmented row lines up with the text rows the
 * primitives render instead of looking like a foreign control.
 */
export const ROW_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 0' }
export const HEAD_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
export const LABEL_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
}
export const HINT_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
}
/** Dynamic-tier status line under the reasoning control. */
export const STATUS_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary, inherit)',
}
/** The neutral chip surface shared by the row's quiet actions. */
export const CHIP_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  border: 'none',
  borderRadius: 999,
  background: 'var(--pe-chip-bg, var(--dsw-alias-bg-module-platform, rgba(128, 128, 128, 0.12)))',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '17px',
  color: 'var(--pe-chip-color, var(--dsw-alias-label-secondary, inherit))',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  cursor: 'pointer',
}
/** The tier refetch action, in the same chip surface. */
export const REFRESH_STYLE: CSSProperties = { ...CHIP_STYLE, flex: 'none' }
/** The reset action: the neutral chip surface, with an underline for affordance. */
export const RESET_STYLE: CSSProperties = CHIP_STYLE
/** One border for every form control, so focus never changes the outline width. */
export const FIELD_BORDER = '1px solid rgba(128, 128, 128, 0.38)'
/** The form input, mirroring the host's `input` metrics for a native control. */
export const INPUT_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: 34,
  padding: '0 12px',
  border: FIELD_BORDER,
  borderRadius: 'var(--dsw-radius-md, 8px)',
  background: 'var(--dsw-alias-bg-layer-3, transparent)',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
  outline: 'none',
}
/** The error line under an invalid numeric row. */
export const INVALID_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-error-primary, #f85149)',
}
/** The warning line under the routing rows; saves are not blocked by it. */
export const WARN_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-error-primary, #f85149)',
}
/** The provider/model select, sharing the value input's metrics. */
export const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
}
export const SEPARATOR_STYLE: CSSProperties = {
  borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24))',
}

/** Public repository behind this build, linked from the page header. */
export const REPOSITORY_URL = 'https://github.com/surfishs/dsh-prompt-enhance'

/** Public npm package page, linked from the page header next to the repository. */
export const NPM_URL = 'https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance'

/** The GitHub mark (16×16), painted with the current text color. */
export const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z'

/** The npm mark (24×24), painted with the current text color. */
export const NPM_MARK =
  'M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z'

/** The version this bundle was built from; guarded for environments without the define. */
export const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0'

/** Header block: title, repository link, version, and one description line. */
export const HEADER_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 0' }
export const HEADER_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
export const HEADER_TITLE_STYLE: CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.012em',
  lineHeight: 1.3,
  color: 'var(--dsw-alias-label-primary, inherit)',
}
export const HEADER_LINK_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  height: 18,
  padding: '0 7px',
  border: '1px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.35))',
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-layer-3, transparent)',
  fontSize: 10.5,
  fontWeight: 500,
  lineHeight: 1,
  color: 'var(--dsw-alias-label-secondary, inherit)',
  textDecoration: 'none',
}
export const HEADER_VERSION_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 18,
  padding: '0 7px',
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-layer-4, transparent)',
  fontSize: 10.5,
  lineHeight: 1,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
  fontVariantNumeric: 'tabular-nums',
}
export const HEADER_DESCRIPTION_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.65,
  color: 'var(--dsw-alias-label-tertiary, inherit)',
  textWrap: 'pretty',
  maxWidth: '72ch',
}
