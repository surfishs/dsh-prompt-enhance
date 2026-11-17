/**
 * The panel's palette must come from the shell's theme tokens, not from the OS
 * color-scheme preference.
 *
 * The panel is rendered inside the app's DOM, so `--dsw-alias-*` resolves from
 * the shell's own root. That is the only source that follows an in-app theme
 * switch — `prefers-color-scheme` answers a different question and can disagree
 * with the app (a dark OS with a light shell, or the reverse), which is exactly
 * how the panel ended up dark inside a light shell.
 *
 * @module tests/styles
 */

import { describe, expect, it } from 'vitest'
import { CSS } from '../src/client/styles'

/** Every token the panel paints a surface, text, border or state with. */
const THEME_TOKENS = [
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-brand-primary',
] as const

describe('panel stylesheet', () => {
  it('resolves its palette from the shell theme tokens', () => {
    for (const token of THEME_TOKENS) {
      expect(CSS, `${token} must drive the panel palette`).toContain(`var(${token}`)
    }
  })

  it('does not key the palette on the OS colour scheme', () => {
    // A media query here would override the tokens whenever the OS preference
    // differs from the shell theme, which is the bug this replaced.
    expect(CSS).not.toContain('prefers-color-scheme')
  })

  it('keeps a fallback for a host that exposes no tokens', () => {
    // `var(--token, literal)` degrades instead of leaving the panel transparent.
    expect(CSS).toMatch(/--pe-bg:\s*var\(--dsw-alias-bg-layer-1,\s*#[0-9a-f]{6}\)/)
  })
})
