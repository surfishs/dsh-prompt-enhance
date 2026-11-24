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
   variables, which is why the undo row used to re-derive its own colors). The
   quick-settings menu lives in the composer slot instead, so it joins the same
   rule to read the same palette. */
.dsh-pe-dock {
  width: 100%;
}
.dsh-pe-dock {
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
  /* Same tint recipe for the truncation banner: red is a state, not a theme. */
  --pe-danger-border: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ffb4a8) 35%, transparent);
  --pe-danger-bg: color-mix(in srgb, var(--dsw-alias-state-error-primary, #ffb4a8) 12%, transparent);
}
/* Quick-settings menu, copied from the shell's own menu primitives:
   - the card surface is MenuSurface.module.css (radius-lg, elevation stroke,
     prominent shadow) with the menu fill over an opaque bg-base, so a
     translucent fill never shows the page through it;
   - rows and the trailing check are Menu.module.css (.item / .label /
     .separator / .check);
   - the check artwork is the exact check-outline regular glyph from
     @deepseek-ai/dsh-client-ui-primitives (16-unit viewBox, 1px stroke),
     painted at the shell's 14x14 check size through a mask. */
.dsh-pe-menu {
  z-index: 1100;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* The shell's model-menu card (ModelSelect.module.css .menu) is the closest
     relative of this card and starts at 240px, so a short value like "Off" does
     not leave the card cramped; the primitive's 144px floor is for plain lists. */
  min-width: min(240px, 100vw - 24px);
  max-width: min(360px, 100vw - 24px);
  padding: 4px;
  border: 0;
  border-radius: var(--dsw-radius-lg, 12px);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary, inherit);
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.24));
  cursor: default;
  /* The host isolates the card so the material below never becomes a backdrop
     root for nested menus; matching the shell keeps the blur behaviour equal. */
  isolation: isolate;
}
/* The material, exactly as MenuSurface.module.css paints it (the host uses a
   child element with z-index:-1; a pseudo-element is the same layer without
   touching the component): menu fill + backdrop blur. */
.dsh-pe-menu::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--dsw-menu-surface-fill, rgba(255, 255, 255, 0.96));
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(12px));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(12px));
  pointer-events: none;
}
/* macOS: the host backs the material with an opaque layer (its .backing
   element) because Chromium needs opaque pixels behind page content to blur it
   over native vibrancy. One opaque base colour on the card is that layer here. */
html[data-platform='darwin'] .dsh-pe-menu {
  background-color: var(--dsw-alias-bg-base, #ffffff);
}
.dsh-pe-menu-group { display: flex; flex-direction: column; }

.dsh-pe-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsh-pe-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
.dsh-pe-menu-item:focus-visible { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); outline: none; }/* Folded tier cell: the shell model menu's .cell (34px, value right in
   tertiary, a 12px chevron in the menu-icon tone) so the card reads as one
   compact row until the list is opened. */
.dsh-pe-menu-cell {
  height: 34px;
  min-height: 34px;
  padding: 0 8px;
}
/* Read-only route row: the cell metrics without a pointer or hover, because the
   value is changed on the plugin settings page, not here. */
.dsh-pe-menu-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md, 8px);
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  line-height: 20px;
  cursor: default;
}
.dsh-pe-menu-info .dsh-pe-menu-label { flex: 0 0 auto; }
.dsh-pe-menu-info .dsh-pe-menu-state {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-pe-menu-cell .dsh-pe-menu-label { flex: 0 0 auto; }
.dsh-pe-menu-cell .dsh-pe-menu-state {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* The chevron is the shell's own chevron-right-outline artwork (16-unit
   viewBox, 1px stroke) masked at the model menu's 12px cell size; it turns to
   point down while the list is open. */
.dsh-pe-menu-chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: var(--dsw-alias-menu-icon, var(--dsw-alias-label-tertiary, inherit));
  background-color: currentColor;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M6%2012L9.29289%208.70711C9.68342%208.31658%209.68342%207.68342%209.29289%207.29289L6%204'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M6%2012L9.29289%208.70711C9.68342%208.31658%209.68342%207.68342%209.29289%207.29289L6%204'/%3E%3C/svg%3E");
  -webkit-mask-size: 16px 16px;
  mask-size: 16px 16px;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  transition: transform 120ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-menu-chevron { transition: none; }
}
.dsh-pe-menu-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pe-menu-state { flex: none; margin-left: auto; color: var(--dsw-alias-label-tertiary, inherit); }
/* The shell's check: a 14x14 icon in label-primary. The text glyph is hidden
   and the exact outline artwork is masked in, so the shape, weight and size
   are the shell's own. */
.dsh-pe-menu-mark {
  flex: none;
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 0;
  background-color: transparent;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M2.25%208.5L5.49732%2011.7473C5.90519%2012.1552%206.57263%2012.1344%206.95426%2011.7018L13.75%204'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M2.25%208.5L5.49732%2011.7473C5.90519%2012.1552%206.57263%2012.1344%206.95426%2011.7018L13.75%204'/%3E%3C/svg%3E");
  -webkit-mask-size: 14px 14px;
  mask-size: 14px 14px;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}
.dsh-pe-menu-item[aria-checked='true'] .dsh-pe-menu-mark { background-color: currentColor; }
/* The context switch row, copied from the shell's TeamModeToggle row: the label
   on the left, the shell's own switch on the right, and the whole row (minus
   nothing here) as the switch's hit target. */
.dsh-pe-menu-switch {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 34px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-md, 8px);
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  line-height: 20px;
}
.dsh-pe-menu-switch-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
/* Extend the native switch hit target over the whole row. */
.dsh-pe-menu-switch .dsh-pe-menu-switch-input { position: static; }
.dsh-pe-menu-switch .dsh-pe-menu-switch-input::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--dsw-radius-md, 8px);
}
.dsh-pe-menu-switch:has(.dsh-pe-menu-switch-input:focus-visible) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}
/* The shell switch animates its thumb; its track colour is driven straight by
   aria-checked, so both get the same 120ms transition here, and both stop when
   the user asks for reduced motion. */
.dsh-pe-menu-switch .dsh-pe-menu-switch-input {
  transition: background-color 120ms ease;
}
.dsh-pe-menu-switch .dsh-pe-menu-switch-input > * {
  transition: transform 120ms ease, background-color 120ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-menu-switch .dsh-pe-menu-switch-input,
  .dsh-pe-menu-switch .dsh-pe-menu-switch-input > * {
    transition: none;
  }
}
@media (hover: hover) {
  .dsh-pe-menu-switch:has(.dsh-pe-menu-switch-input:not(:disabled)):hover {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  }
}
.dsh-pe-menu-sep { height: 0.5px; margin: 3px 8px; background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25)); }
.dsh-pe-menu-error { padding: 6px 8px; font-size: 12px; color: var(--dsw-alias-state-error-primary, #e5484d); }
/* Why the tier list is empty: an explanation, not an error. */
.dsh-pe-menu-note {
  padding: 4px 8px 6px;
  color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 12px;
  line-height: 16px;
}
/* Model picker: a search field above provider-grouped rows. The selected row
   keeps a quiet filled background, the way the shell's model list marks it. */
.dsh-pe-menu-model-pane { max-height: 320px; overflow-y: auto; }
.dsh-pe-menu-search { padding: 4px 6px 6px; }
.dsh-pe-menu-search-input {
  box-sizing: border-box;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  outline: none;
}
.dsh-pe-menu-search-input::placeholder { color: var(--dsw-alias-label-tertiary, inherit); }
.dsh-pe-menu-search-input:focus-visible { box-shadow: 0 0 0 1px var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.4)) inset; }
.dsh-pe-menu-group-label {
  padding: 6px 8px 2px;
  color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 12px;
  line-height: 16px;
}
.dsh-pe-menu-item.is-selected { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12)); }
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
  /* Four segments (model, elapsed, tokens, effort) can outgrow a narrow header:
     shrink with an ellipsis instead of pushing the fold and close controls. */
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
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
.dsh-pe-warn-dot.is-danger { color: var(--pe-danger); }
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

/* The context-usage button sits at the quiet end of the footer, opposite the
   actions. Its bubble is portaled to the document body and positioned in
   viewport coordinates by ContextUsageInfo, so it is fixed rather than anchored
   to this wrapper. Two ancestors make that mandatory: the card clips its own
   overflow (rounded corners and the fold), and the composer seat
   (ConversationRoot.composerSeat) declares will-change: transform, which makes
   it the containing block for fixed descendants — a bubble left inside the
   composer resolves left against the seat and lands a sidebar-width to the
   right. Portaling above both is also what the seat's own comment asks of fixed
   overlays inside the composer. */
.dsh-pe-context-wrap {
  position: relative;
  display: inline-flex;
}
.dsh-pe-context {
  box-sizing: border-box;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  /* The glyph carries the state on its own: grey when the window is healthy,
     amber when it had to cut something. The precise counts stay in the
     tooltip. */
  --pe-context-accent: var(--dsw-alias-label-tertiary, #8a8a8a);
  color: var(--pe-context-accent);
  cursor: default;
}
.dsh-pe-context:hover { background: var(--pe-hover); }
.dsh-pe-context.is-limited {
  --pe-context-accent: #b45309;
  color: var(--pe-context-accent);
}
/* The warning lives in the glyph alone by default; the amber tint appears on
   hover or keyboard focus, matching the plain state's on-demand background. */
.dsh-pe-context.is-limited:hover,
.dsh-pe-context.is-limited:focus-visible {
  background: rgba(180, 83, 9, 0.1);
}
.dsh-pe-context-icon {
  position: relative;
  z-index: 1;
  display: block;
  width: 20px;
  height: 20px;
  color: var(--pe-context-accent);
}
.dsh-pe-context-tip {
  position: fixed;
  /* Placed from the trigger's rect in JS; these only cover the frame before the
     measurement lands (and a host with no layout at all). */
  left: 0;
  bottom: 0;
  /* At the document body it competes with the whole shell, so it outranks the
     composer seat (z-index 9) and the plugin's own quick menu (1100). */
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  width: max-content;
  max-width: min(340px, calc(100vw - 40px));
  padding: 6px 10px;
  border-radius: var(--dsw-radius-sm, 6px);
  background: var(--dsw-alias-tooltip-bg, #2f2f2f);
  color: var(--dsw-alias-tooltip-label, #ffffff);
  font-size: 13px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  white-space: normal;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  animation: dsh-pe-context-tip-in 140ms ease-out;
}
/* The bubble needs an anchor: it floats above the icon and would otherwise
   read as disconnected from the footer. */
.dsh-pe-context-tip::after {
  content: '';
  position: absolute;
  left: 12px;
  bottom: -5px;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--dsw-alias-tooltip-bg, #2f2f2f);
}
@keyframes dsh-pe-context-tip-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-context-tip { animation: none; }
}
/* The stats line is one unit: a wrap that leaves the percentage alone reads
   as a layout bug. The reason line may wrap freely. */
.dsh-pe-context-tip .dsh-pe-context-stats { white-space: nowrap; }
.dsh-pe-context-tip .dsh-pe-context-reason { color: #f2c185; }
/* Attachment count is metadata, not a warning: same tooltip body color. */
.dsh-pe-context-tip .dsh-pe-context-attachments { white-space: nowrap; }
/* Narrow viewports: the card itself is close to the viewport width, so the
   fixed tooltip width would clip. Give it a viewport-relative cap and let the
   stats line wrap instead of overflowing. */
@media (max-width: 560px) {
  .dsh-pe-context-tip {
    min-width: 0;
    width: 230px;
    max-width: calc(100vw - 40px);
  }
  .dsh-pe-context-tip .dsh-pe-context-stats { white-space: normal; }
}
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
/* aria-disabled, not the native attribute: the button keeps focus and its
   click handler so the reason stays reachable (the handler refuses to run). */
.dsh-pe-btn-action[aria-disabled='true'] { opacity: 0.45; cursor: not-allowed; }
.dsh-pe-btn-action[aria-disabled='true']:hover { background: transparent; }

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
/* Truncation is a result-quality problem, not a stale-draft warning: red says
   the result itself is incomplete, while the stale banner keeps the amber. */
.dsh-pe-stale.dsh-pe-truncated {
  border-top-color: var(--pe-danger-border);
  background: var(--pe-danger-bg);
  color: var(--pe-danger);
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
/* Empty draft: dimmed and a forbidden pointer. The plain click really is inert
   here; the card stays reachable by right-click (long-press / Shift+F10) and the
   tooltip says so, so the cursor still marks "left click does nothing". */
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
/* The host's segmented control slides its indicator with a 160ms transform
   transition. This row re-lists its options whenever a capability answer lands
   (loading -> ready, model switch, a cleared tier), so the pill would appear to
   fly in from outside the track while the option count changes under it. The
   selection change is the information here, not the motion. */
.dsh-pe-segmented-labels > span[aria-hidden='true'] {
  transition: none !important;
}
.dsh-pe-segmented-labels [role="tab"] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  white-space: nowrap;
}
/* The Advanced disclosure reads as one more settings row: same 13px/500 label
   tone as every row title, same vertical rhythm, and a 16px chevron drawn from
   the shell's chevron-down-outline artwork instead of a hand-drawn triangle. */
.dsh-pe-advanced {
  margin-top: 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.22));
}
/* The shell's settings rows have no hover fill (its DisclosureRow only lifts the
   text tone), so the row keeps the page chrome and the glyph carries the state. */
.dsh-pe-advanced > summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  list-style: none;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
  user-select: none;
}
.dsh-pe-advanced > summary::-webkit-details-marker { display: none; }
.dsh-pe-advanced > summary::marker { content: ''; }
.dsh-pe-advanced > summary::before {
  content: '';
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--dsw-alias-label-tertiary, inherit);
  background-color: currentColor;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M4%206L7.29289%209.29289C7.68342%209.68342%208.31658%209.68342%208.70711%209.29289L12%206'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%20fill='none'%20stroke='%23fff'%20stroke-width='1'%3E%3Cpath%20d='M4%206L7.29289%209.29289C7.68342%209.68342%208.31658%209.68342%208.70711%209.29289L12%206'/%3E%3C/svg%3E");
  -webkit-mask-size: 16px 16px;
  mask-size: 16px 16px;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  /* Closed points at the collapsed content, open points down at it. */
  transform: rotate(-90deg);
  transition: transform 120ms ease;
}
.dsh-pe-advanced[open] > summary::before { transform: none; }
.dsh-pe-advanced > summary:hover {
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-pe-advanced > summary:hover::before {
  color: var(--dsw-alias-label-secondary, inherit);
}
.dsh-pe-advanced > summary:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f8cff);
  outline-offset: -2px;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-advanced > summary::before { transition: none; }
}/* The footer already adds its own 12px top margin; after the disclosure that would
   double the header's bottom whitespace (12px padding + 12px margin) against the
   12px above it, so the two gaps are equalised here. */
.dsh-pe-advanced + .dsh-pe-form-footer { margin-top: 0; }
/* Open: the first advanced row brings its own 12px top padding, so the header
   drops its bottom padding to keep the same rhythm between the two gaps. */
.dsh-pe-advanced[open] > summary { padding-bottom: 0; }
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

/* The settings header's GitHub / npm chips: the only links on that page, and
   the only place a <style> rule beats an inline object — :hover cannot be
   expressed inline, which is why these two had no feedback at all. */
.dsh-pe-header-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  /* Explicit border-box: the 20px keeps the pill the size it was measured at,
     and the 2px top padding nudges the glyph ink down to the optical centre
     (a fixed height alone centres the line box, which reads 1-2px high). */
  box-sizing: border-box;
  height: 20px;
  padding: 2px 7px 0;
  border: 1px solid var(--dsw-alias-border-l4, rgba(128, 128, 128, 0.35));
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-3, transparent);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  color: var(--dsw-alias-label-secondary, inherit);
  text-decoration: none;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}
.dsh-pe-header-link:hover,
.dsh-pe-header-link:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  border-color: var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.55));
  color: var(--dsw-alias-label-primary, inherit);
}
.dsh-pe-header-link:focus-visible { outline: 2px solid var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.55)); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .dsh-pe-header-link { transition: none; }
}
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
