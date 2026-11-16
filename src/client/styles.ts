/**
 * Self-contained stylesheet, injected once as a <style> element: the plugin
 * ships no CSS build step, and class names are prefixed to stay collision
 * free inside the web shell. Colors are declared as panel-scoped variables
 * with a dark default and a light `prefers-color-scheme` override, so the
 * panel follows the OS/shell theme without depending on host theme internals.
 * @module dsh-prompt-enhance/client/styles
 */

const STYLE_ID = 'dsh-prompt-enhance-styles'

/** The plugin's stylesheet. */
export const CSS = `
.dsh-pe-dock { width: 100%; }
.dsh-pe-panel {
  box-sizing: border-box;
  --pe-bg: #1f2127;
  --pe-fg: #e6e8ee;
  --pe-fg-dim: rgba(230, 232, 238, 0.55);
  --pe-border: rgba(127, 127, 127, 0.35);
  --pe-separator: rgba(127, 127, 127, 0.25);
  --pe-hover: rgba(127, 127, 127, 0.18);
  --pe-danger: #ffb4a8;
  --pe-warn-fg: #e8c07d;
  --pe-warn-border: rgba(230, 158, 60, 0.35);
  --pe-warn-bg: rgba(230, 158, 60, 0.12);
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
}
@media (prefers-color-scheme: light) {
  .dsh-pe-panel {
    --pe-bg: #ffffff;
    --pe-fg: #1c1e24;
    --pe-fg-dim: rgba(28, 30, 36, 0.55);
    --pe-border: rgba(0, 0, 0, 0.18);
    --pe-separator: rgba(0, 0, 0, 0.12);
    --pe-hover: rgba(0, 0, 0, 0.08);
    --pe-danger: #a63a2e;
    --pe-warn-fg: #8a5a00;
    --pe-warn-border: rgba(176, 122, 0, 0.4);
    --pe-warn-bg: rgba(230, 158, 60, 0.15);
  }
}
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
.dsh-pe-head .dsh-pe-badge {
  margin-left: auto;
  border: 1px solid var(--pe-border);
  border-radius: 999px;
  padding: 1px 8px;
  font-weight: 400;
  font-size: 11px;
  opacity: 0.72;
  white-space: nowrap;
}
.dsh-pe-applied {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--dsw-alias-state-success-primary, #2da44e);
  border: 1px solid currentColor;
  white-space: nowrap;
}
.dsh-pe-close {
  border: none; background: transparent; color: inherit; opacity: 0.6;
  font-size: 15px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
}
.dsh-pe-close:hover { opacity: 1; background: var(--pe-hover); }
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
  border: 2px solid var(--pe-separator); border-top-color: #6ea8ff;
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
  min-width: 112px;
  border-color: transparent;
  background: #3f76e1;
  color: #fff;
}
.dsh-pe-btn-action.primary:hover { background: #4d82ec; }
.dsh-pe-btn-action.plain { background: transparent; color: inherit; }
.dsh-pe-btn-action.plain:hover { background: var(--pe-hover); }
.dsh-pe-btn-action.dsh-pe-copy { min-width: 96px; }
.dsh-pe-btn-action:disabled { opacity: 0.45; cursor: default; }

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
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1, transparent);
  font-size: 12px;
  color: inherit;
}
.dsh-pe-undo .dsh-pe-undo-check {
  color: var(--dsw-alias-state-success-primary, #2da44e);
  font-weight: 600;
}
.dsh-pe-undo-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.32));
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms ease;
}
.dsh-pe-undo-link:hover { background: rgba(127, 127, 127, 0.16); }
.dsh-pe-undo-link:active { background: rgba(127, 127, 127, 0.22); }
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
  opacity: 0.55;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}
.dsh-pe-undo-x:hover { opacity: 1; background: var(--dsw-alias-bg-layer-2, rgba(128, 128, 128, 0.12)); }
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
