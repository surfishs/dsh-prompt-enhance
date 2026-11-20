/**
 * The copy both configuration surfaces render: row titles, hints, labels and
 * the two page descriptions, in the host language when a translate seat exists
 * and in the shipped Chinese dictionary otherwise.
 * @module dsh-prompt-enhance/client/settings-page-copy
 */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { NS as LOCALE_NS, zh } from './locales'
import type { PromptEnhanceKey } from './locales'
import type { Row } from './settings-page-spec'

/** The translate seat the slot framework injects for the declared namespace. */
export type Translate = TranslateNS<typeof LOCALE_NS>

/** The shipped Chinese dictionary, used when a host projects no `t` seat. */
export const ZH_COPY: Readonly<Record<string, string>> = zh

/**
 * Fill `{name}` placeholders from `params`, then hand the result to the seat.
 * The seat's own parameter support is host-dependent; doing the substitution
 * locally keeps a parameterized row message working on every host (and in the
 * test double, whose `t` takes the key only).
 * @param t - the locale-bound translate seat.
 * @param key - the dictionary key.
 * @param params - placeholder values.
 * @returns the interpolated copy.
 */
function interpolate(t: Translate, key: PromptEnhanceKey, params: Record<string, string>): string {
  let text = t(key)
  for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(value)
  return text
}

/**
 * Resolve the Plugins-page copy reader: the injected `t` when present, the
 * shipped Chinese dictionary otherwise. Falling back keeps an older host (or a
 * test) from rendering dictionary keys instead of copy.
 * @param t - the injected translate seat, if any.
 * @returns a reader for this page's keys.
 */
export function translator(t: Translate | undefined): Translate {
  if (typeof t === 'function') return t
  // The fallback dictionary must interpolate `{name}` placeholders too, or a
  // parameterized line would render its raw template.
  return ((key: string, params?: Readonly<Record<string, unknown>>) => {
    let text = ZH_COPY[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.split(`{${name}}`).join(String(value))
    }
    return text
  }) as unknown as Translate
}

/** How one surface titles and explains the rows. */
export interface RowCopy {
  /** Copy of the shared form frame, plus the labels the custom rows draw. */
  readonly labels: Readonly<Record<string, string>>
  /** The row's title. */
  readonly title: (row: Row) => string
  /** The hint under the row. */
  readonly hint: (row: Row) => string
  /** An example shown greyed out while the input is empty, when the row has one. */
  readonly placeholder: (row: Row) => string | undefined
  /** One choice label of a segmented control. */
  readonly choice: (key: PromptEnhanceKey) => string
  /** One parameterized status line (dynamic reasoning tiers). */
  readonly interpolate: (key: PromptEnhanceKey, params: Record<string, string>) => string
}

/**
 * The settings dialog's copy: the raw config key first, then the localized
 * name in parentheses while the client is Chinese, and one single-language
 * hint. English mode drops the parenthesized Chinese name entirely — the key
 * alone is the title there.
 * @param t - the locale-bound translate seat.
 * @param chinese - whether the active locale is Chinese.
 * @returns the row copy for that language.
 */
export function sectionCopy(t: Translate, chinese: boolean): RowCopy {
  return {
    labels: {
      unavailable: t('settings.unavailable'),
      readOnly: t('settings.readOnly'),
      saveFailed: t('settings.saveFailed'),
      saveFailedShort: t('settings.saveFailedShort'),
      save: t('settings.save'),
      saving: t('settings.saving'),
      saved: t('settings.saved'),
      advanced: t('settings.advanced'),
      reset: t('settings.reset'),
      invalidNumber: t('settings.invalidNumber'),
      invalidShortcut: t('settings.invalidShortcut'),
      record: t('settings.record'),
      recordStop: t('settings.recordStop'),
      recordPrompt: t('settings.recordPrompt'),
      recordNeedsModifier: t('settings.recordNeedsModifier'),
    },
    title: (row) => (chinese ? `${row.key}（${t(row.label)}）` : row.key),
    hint: (row) => t(row.hint),
    placeholder: (row) => (row.placeholder === undefined ? undefined : t(row.placeholder)),
    choice: (key) => t(key),
    interpolate: (key, params) => interpolate(t, key, params),
  }
}

/**
 * The Plugins page's copy: the active locale's title and single-sentence hint,
 * as the host's own configuration pages read.
 * @param t - the injected translate seat.
 * @returns the row copy for that locale.
 */
export function pageCopy(t: Translate): RowCopy {
  return {
    labels: {
      unavailable: t('settings.unavailable'),
      readOnly: t('settings.readOnly'),
      saveFailed: t('settings.saveFailed'),
      saveFailedShort: t('settings.saveFailedShort'),
      save: t('settings.save'),
      saving: t('settings.saving'),
      saved: t('settings.saved'),
      advanced: t('settings.advanced'),
      reset: t('settings.reset'),
      invalidNumber: t('settings.invalidNumber'),
      invalidShortcut: t('settings.invalidShortcut'),
      record: t('settings.record'),
      recordStop: t('settings.recordStop'),
      recordPrompt: t('settings.recordPrompt'),
      recordNeedsModifier: t('settings.recordNeedsModifier'),
    },
    title: (row) => t(row.label),
    hint: (row) => t(row.hint),
    placeholder: (row) => (row.placeholder === undefined ? undefined : t(row.placeholder)),
    choice: (key) => t(key),
    interpolate: (key, params) => interpolate(t, key, params),
  }
}
