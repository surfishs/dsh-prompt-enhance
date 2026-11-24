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

  it('pairs the primary fill with the inverted label token', () => {
    // `--dsw-alias-brand-primary` flips from near-black (light) to near-white
    // (dark). A hardcoded foreground therefore turns the dark theme into
    // white-on-white; the label has to come from the paired token.
    expect(CSS).toMatch(/\.dsh-pe-btn-action\.primary\s*\{[^}]*color:\s*var\(--dsw-alias-label-primary-inverted/)
    expect(CSS).not.toMatch(/\.dsh-pe-btn-action\.primary\s*\{[^}]*color:\s*#fff/i)
  })

  it('blends the primary hover toward the surface rather than toward white', () => {
    // White is the dark-theme fill itself, so a white-ward blend has no visible
    // hover state there.
    expect(CSS).toMatch(/\.dsh-pe-btn-action\.primary:hover\s*\{[^}]*var\(--dsw-alias-bg-layer-1/)
  })

  it('places the context bubble in the viewport, not anchored inside the clipping card', () => {
    // The card clips its own overflow (rounded corners + the fold), and a folded
    // card leaves only the header above the footer: an anchored bubble grows out
    // of the card and is cut in half. It must be fixed and JS-positioned.
    expect(CSS).toMatch(/\.dsh-pe-context-tip\s*\{[^}]*position:\s*fixed/)
    expect(CSS).not.toMatch(/\.dsh-pe-context-tip\s*\{[^}]*bottom:\s*calc\(100% \+ 8px\)/)
  })

  it('gives the settings header links a hover and a keyboard-focus state', () => {
    // Inline style objects cannot express pseudo-classes, so both chips shipped
    // with no feedback at all; the state has to live in the stylesheet.
    expect(CSS).toMatch(/\.dsh-pe-header-link:hover/)
    expect(CSS).toMatch(/\.dsh-pe-header-link:focus-visible/)
    expect(CSS).toMatch(/\.dsh-pe-header-link\s*\{[^}]*transition:\s*background-color/)
  })
})
