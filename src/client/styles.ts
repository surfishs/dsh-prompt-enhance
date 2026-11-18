/**
 * Self-contained stylesheet, injected once as a <style> element: the plugin
 * ships no CSS build step, and class names are prefixed to stay collision
 * free inside the web shell.
 *
 * Colors resolve from the shell's own theme tokens (`--dsw-alias-*`) so the
 * panel follows the application's light/dark switch. The literals after each
 * comma are fallbacks for a host that exposes no tokens; `prefers-color-scheme`
 * is deliberately NOT used, because the OS preference and the app's theme can
 * disagree — that mismatch is exactly what left the panel dark inside a light
 * shell.
 * @module dsh-prompt-enhance/client/styles
 */

const STYLE_ID = 'dsh-prompt-enhance-styles'

/** The plugin's stylesheet. */
export const CSS = `
/* One palette for everything the plugin paints into the dock: the result card
   and the standalone undo row are siblings, so the tokens live on their shared
   parent instead of on the card alone (a child could not reach its sibling's
   variables, which is why the undo row used to re-derive its own colors). */
.dsh-pe-dock {
  width: 100%;
  --pe-bg: var(--dsw-alias-bg-layer-1, #1f2127);
  --pe-fg: var(--dsw-alias-label-primary, #e6e8ee);
  --pe-fg-dim: var(--dsw-alias-label-secondary, rgba(230, 232, 238, 0.55));
  --pe-border: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  --pe-separator: var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.25));
  /* No hover token exists: a neutral grey alpha is already theme-agnostic. */
  --pe-hover: rgba(127, 127, 127, 0.18);
  --pe-danger: var(--dsw-alias-state-error-primary, #ffb4a8);
  --pe-success: var(--dsw-alias-state-success-primary, #2da44e);
  --pe-warn-fg: var(--dsw-alias-state-warn-primary, #e8c07d);
  /* Tints of the themed warning color, so the banner cannot keep an amber cast
     from the other scheme. */
  --pe-warn-border: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e8c07d) 35%, transparent);
  --pe-warn-bg: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #e8c07d) 12%, transparent);
}
.dsh-pe-panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 6px;
  border-radius: 12px;
  border: 1px solid var(--pe-border);
  background: var(--pe-bg);
  color: var(--pe-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 4px 14px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  /* The card is chrome: titles, badges, banners and button labels are not
     content to be selected. The two blocks the user may want to copy opt back
     in below (.dsh-pe-result-text, .dsh-pe-error). */
  -webkit-user-select: none;
  user-select: none;
}
/* The body folds along a single grid track (1fr <-> 0fr): the height animates to
   the content's own size, so nothing is measured in JS and the fold can never
   overshoot a long result. The inner clips, and once the track has closed it
   also leaves the paint, selection and accessibility trees. */
.dsh-pe-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 160ms ease;
}
.dsh-pe-body > .dsh-pe-body-inner {
  min-height: 0;
  overflow: hidden;
  visibility: visible;
  transition: visibility 0s;
}
.dsh-pe-panel.is-collapsed .dsh-pe-body { grid-template-rows: 0fr; }
.dsh-pe-panel.is-collapsed .dsh-pe-body > .dsh-pe-body-inner {
  visibility: hidden;
  /* Hidden only after the track has finished closing, so the fold is visible
     the whole way down; expanding drops the delay and shows it at once. */
  transition: visibility 0s linear 160ms;
}
/* The chevron turns with the fold, so the button and the body read as one gesture. */
.dsh-pe-collapse svg { transition: transform 160ms ease; }
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-body,
  .dsh-pe-body > .dsh-pe-body-inner,
  .dsh-pe-collapse svg { transition: none; }
}
/* The fold animation is a setting; switching it off makes the fold instant.
   The OS preference above still wins for users who ask for less motion. */
.dsh-pe-panel.is-static .dsh-pe-body,
.dsh-pe-panel.is-static .dsh-pe-body > .dsh-pe-body-inner,
.dsh-pe-panel.is-static .dsh-pe-collapse svg { transition: none; }
.dsh-pe-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--pe-separator);
  font-size: 12.5px;
  font-weight: 600;
}
.dsh-pe-head .dsh-pe-title { display: inline-flex; align-items: center; gap: 6px; }
.dsh-pe-head .dsh-pe-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  min-width: 0;
}
.dsh-pe-head .dsh-pe-badge {
  margin-left: 0;
  border: 1px solid var(--pe-border);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 400;
  font-size: 11px;
  opacity: 0.72;
  white-space: nowrap;
  cursor: default;
}
/* The close and collapse controls share one square hit target: same box, same
   hover surface, so the two glyphs read as a pair instead of one looking
   flatter than the other. */
.dsh-pe-close,
.dsh-pe-collapse {
  box-sizing: border-box;
  border: none; background: transparent; color: inherit; opacity: 0.6;
  cursor: pointer; border-radius: 4px; padding: 0;
  width: 22px; height: 22px; line-height: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.dsh-pe-close { font-size: 15px; }
.dsh-pe-close:hover,
.dsh-pe-collapse:hover { opacity: 1; background: var(--pe-hover); }
/* Collapsed, the warning banners live in the hidden body; this marker stands in
   for them so a stale or truncated result never folds away silently. */
.dsh-pe-warn-dot { font-size: 15px; line-height: 1; color: var(--pe-warn-fg); }
.dsh-pe-result { padding: 2px 10px 6px; }
.dsh-pe-result-text {
  margin: 0;
  max-height: 30vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.6;
  /* The one block in the card the user is expected to copy by hand. */
  -webkit-user-select: text;
  user-select: text;
}
.dsh-pe-col-title {
  padding: 4px 10px 2px;
  font-size: 11px;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.dsh-pe-error {
  padding: 10px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--pe-danger);
  white-space: pre-wrap;
  /* Selectable with its detail line: the provider message is what users paste
     into an issue when they report a failure. */
  -webkit-user-select: text;
  user-select: text;
}
.dsh-pe-error .dsh-pe-error-detail {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.75;
  color: inherit;
}
.dsh-pe-loading {
  display: flex; flex-direction: column; gap: 8px;
  align-items: center; justify-content: center;
  flex: 1; padding: 14px 10px; font-size: 12.5px;
}
.dsh-pe-loading .dsh-pe-hint { font-size: 11px; opacity: 0.55; }
/* Incremental view: the streamed text takes the whole body, left-aligned. */
.dsh-pe-stream {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0; width: 100%;
}
.dsh-pe-stream .dsh-pe-col-title {
  display: flex; align-items: center; gap: 6px;
  padding-left: 0;
}
.dsh-pe-spin.small { width: 11px; height: 11px; border-width: 1px; }
.dsh-pe-spin {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--pe-separator); border-top-color: var(--dsw-alias-brand-primary, #6ea8ff);
  animation: dsh-pe-spin 0.9s linear infinite;
}
.dsh-pe-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--pe-separator);
}
.dsh-pe-foot .dsh-pe-grow { flex: 1; }
.dsh-pe-btn-action {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--pe-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-pe-btn-action.primary {
  border-color: transparent;
  /* Fill and label are a PAIR: the alias layer flips brand-primary from
     near-black (light theme) to near-white (dark theme), so the label has to
     flip with it — a hardcoded foreground turns the dark theme into
     white-on-white. label-primary-inverted is the color the shell itself
     paints onto an inverted surface; the fallback chain keeps an inverted label
     on hosts that predate that token. */
  background: var(--dsw-alias-brand-primary, #3f76e1);
  color: var(--dsw-alias-label-primary-inverted, var(--dsw-alias-bg-base, #ffffff));
}
.dsh-pe-btn-action.primary:hover {
  /* Blend toward the panel surface, not toward white: in the dark theme white
     IS the fill, so a white-ward blend would show no hover change at all. */
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3f76e1) 88%, var(--dsw-alias-bg-layer-1, #1f2127));
}
.dsh-pe-btn-action.plain { background: transparent; color: inherit; }
.dsh-pe-btn-action.plain:hover { background: var(--pe-hover); }
/* A floor for every footer action button, so a button keeps a visible, clickable
   width even if its label ever collapses to nothing. The label-swap groups
   (.dsh-pe-swap) already make a button as wide as its longest label, and 96px is
   below every real content width here, so this never widens a labelled button in
   practice — it only bounds the empty case and keeps the single-label buttons
   (retry, cancel) the same size as the rest. */
.dsh-pe-btn-floor { min-width: 96px; }
.dsh-pe-btn-action:disabled { opacity: 0.45; cursor: default; }

/* Both labels of the regenerate button share one cell, so the button is as wide
   as the longer label of the active language and a label swap can never move
   the footer. visibility:hidden keeps the inert label out of the accessibility
   tree, leaving the visible text as the button's name. */
.dsh-pe-swap { display: inline-grid; }
.dsh-pe-swap > * { grid-area: 1 / 1; visibility: hidden; }
.dsh-pe-swap > .on { visibility: visible; }

.dsh-pe-stale {
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.5;
  border-top: 1px solid var(--pe-warn-border);
  background: var(--pe-warn-bg);
  color: var(--pe-warn-fg);
}

.dsh-pe-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-pe-btn:hover:not(:disabled) { opacity: 1; background: var(--pe-hover); }
.dsh-pe-btn.is-busy { cursor: progress; }
.dsh-pe-btn.is-blocked { cursor: progress; }
.dsh-pe-btn.is-empty { opacity: 0.4; cursor: not-allowed; }
.dsh-pe-btn.is-empty:hover { opacity: 0.4; background: transparent; }
.dsh-pe-btn:disabled { opacity: 0.45; cursor: default; }
.dsh-pe-btn .dsh-pe-btn-icon { display: inline-flex; align-items: center; }
@keyframes dsh-pe-spin { to { transform: rotate(360deg); } }

.dsh-pe-undo {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  margin-left: auto;
  padding: 3px 6px 3px 10px;
  border: 1px solid var(--pe-border);
  border-radius: 12px;
  background: var(--pe-bg);
  font-size: 12px;
  color: var(--pe-fg);
  /* The undo row is chrome too, like the card header and footer. */
  -webkit-user-select: none;
  user-select: none;
}
.dsh-pe-undo .dsh-pe-undo-check {
  display: inline-flex;
  align-items: center;
  color: var(--pe-success);
}
.dsh-pe-undo-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--pe-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-pe-undo-link:hover { background: var(--pe-hover); }
.dsh-pe-undo-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}
.dsh-pe-undo-x:hover { opacity: 1; background: var(--pe-hover); }
.dsh-pe-segmented-labels [role="tab"] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  white-space: nowrap;
}
.dsh-pe-advanced {
  margin-top: 12px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.22));
}
.dsh-pe-advanced > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 4px;
  list-style: none;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, inherit);
  cursor: pointer;
  user-select: none;
}
.dsh-pe-advanced > summary::-webkit-details-marker { display: none; }
.dsh-pe-advanced > summary::marker { content: ''; }
.dsh-pe-advanced > summary::before {
  content: '';
  flex: none;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 5px solid currentColor;
  transition: transform 120ms ease;
}
.dsh-pe-advanced[open] > summary::before { transform: rotate(90deg); }
.dsh-pe-advanced > summary:hover {
  color: var(--dsw-alias-label-primary, inherit);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
  border-radius: 6px;
}
.dsh-pe-advanced > summary:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f8cff);
  outline-offset: -2px;
  border-radius: 6px;
}
.dsh-pe-advanced[open] > summary { margin-bottom: 4px; }
.dsh-pe-advanced + .dsh-pe-form-footer { margin-top: 0; }
.dsh-pe-chip-reset:hover:not(:disabled),
.dsh-pe-chip-refresh:hover:not(:disabled) {
  --pe-chip-bg: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.18));
  --pe-chip-color: var(--dsw-alias-label-primary, inherit);
}
.dsh-pe-chip-reset:focus-visible,
.dsh-pe-chip-refresh:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f8cff);
  outline-offset: 2px;
}
.dsh-pe-form-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.22));
}
.dsh-pe-save-group {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}
.dsh-pe-save-status {
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, inherit);
  text-align: right;
  overflow-wrap: anywhere;
}
.dsh-pe-save-button {
  flex: none;
  margin-left: 0;
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-pe-save-button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dsh-pe-save-button:disabled { opacity: 0.5; cursor: default; }
`

/**
 * Inject the stylesheet once per document.
 * @returns true when injected, false when it was already present.
 */
export function ensureStyles(): boolean {
  if (document.getElementById(STYLE_ID) !== null) return false
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
  return true
}
