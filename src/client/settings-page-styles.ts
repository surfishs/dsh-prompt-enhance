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
/**
 * The title group owns the empty part of the title line. The label inside it
 * hugs its text, so the stretch to the right of a title is inert — it must not
 * activate the row's field the way clicking the title itself does. This is the
 * host's settings-field layout: `labelGroup` takes the free space and its child
 * label is `flex: 0 1 auto`.
 */
export const LABEL_GROUP_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }
export const LABEL_STYLE: CSSProperties = {
  flex: '0 1 auto',
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
/**
 * A short-lived answer to a row action (the recorder's "press a combination"
 * prompt, the tier refetch result). One step louder than a status line: this is
 * the row telling the user what to do right now, not background information.
 */
export const NOTICE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
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
/** The shortcut recorder: the same neutral chip, so it reads as a row action. */
export const RECORD_STYLE: CSSProperties = CHIP_STYLE
/**
 * The resting edge of every form control, written as its own value because a
 * control has to be able to return to it on blur. Dropping the inline
 * `borderColor` instead leaves the `border` shorthand to be re-resolved, which
 * is how a blurred field keeps a `currentColor` (near-black) edge.
 */
export const FIELD_BORDER_COLOR = 'var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.38))'
/** One border for every form control, so focus never changes the outline width. */
export const FIELD_BORDER = `1px solid ${FIELD_BORDER_COLOR}`
/** The focused edge: the business colour the host's own inputs use. */
export const FIELD_FOCUS_COLOR = 'var(--dsw-alias-state-business-primary, #4f8cff)'
/**
 * The form control box: the same 34px / 1px border / 12px inline padding the
 * page always used. It is shared by the text-field shell and the select so the
 * two controls keep one outer size.
 */
export const FIELD_BOX_STYLE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: 34,
  padding: '0 12px',
  border: FIELD_BORDER,
  borderRadius: 'var(--dsw-radius-md, 8px)',
  background: 'var(--dsw-alias-bg-layer-3, transparent)',
}
/**
 * The text-field shell: the host primitives Input pattern (a flex box that
 * centers a borderless inner input), so vertical centering is a layout decision
 * instead of a fixed-height plus line-height compromise.
 */
export const FIELD_SHELL_STYLE: CSSProperties = {
  ...FIELD_BOX_STYLE,
  display: 'flex',
  alignItems: 'center',
}
/**
 * The borderless inner input (host primitives Input .input): it fills the
 * shell, keeps the page's 13px text, and takes the host's 22px line box so the
 * glyphs sit on the same rhythm as the shell's other text.
 */
export const FIELD_INPUT_STYLE: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  font: 'inherit',
  fontSize: 13,
  lineHeight: '22px',
  color: 'var(--dsw-alias-label-primary, inherit)',
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
/**
 * The provider/model select: the same box as the text field. Chromium adds
 * about 3px of its own inline inset to a select's text (measured from the
 * settings screenshots: 17px vs the input's 14px), so the left padding drops to
 * 9px to put both text edges on the same line.
 */
export const SELECT_STYLE: CSSProperties = {
  ...FIELD_BOX_STYLE,
  paddingLeft: 9,
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary, inherit)',
  outline: 'none',
  cursor: 'pointer',
}
export const SEPARATOR_STYLE: CSSProperties = {
  borderTop: '0.5px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.24))',
}

/** Public repository behind this build, linked from the page header. */
export const REPOSITORY_URL = 'https://github.com/surfishs/dsh-prompt-enhance'

/** Public npm package page, linked from the page header next to the repository. */
export const NPM_URL = 'https://www.npmjs.com/package/@surfishs/dsh-prompt-enhance'

/** The tracker declared in `package.json` (`bugs.url`), so the chip cannot drift from it. */
export const ISSUE_URL = 'https://github.com/surfishs/dsh-prompt-enhance/issues'

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
