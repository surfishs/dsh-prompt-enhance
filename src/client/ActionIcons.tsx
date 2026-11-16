/**
 * Small inline icons for the action row. They are stroke-only, 24-unit
 * viewBoxes painted with currentColor so they inherit the button's label
 * color in both themes.
 * @module dsh-prompt-enhance/client/ActionIcons
 */

import type { ReactElement } from 'react'

function icon(paths: ReactElement[]): ReactElement {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {paths}
    </svg>
  )
}

/** Circular arrow: run the same prompt again. */
export function RegenerateIcon(): ReactElement {
  return icon([<path key="arc" d="M21 12a9 9 0 1 1-3-6.7L21 8" />, <path key="head" d="M21 3v5h-5" />])
}

/** Two overlapping sheets: copy the result. */
export function CopyIcon(): ReactElement {
  return icon([<rect key="front" x="9" y="9" width="13" height="13" rx="2" />, <path key="back" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />])
}

/** Arrow falling into a tray: fill the result into the composer. */
export function FillIcon(): ReactElement {
  return icon([<path key="stem" d="M12 3v12" />, <path key="head" d="m7 10 5 5 5-5" />, <path key="tray" d="M5 21h14" />])
}

/** Left arrow over a return curve: restore the pre-apply draft. */
export function UndoIcon(): ReactElement {
  return icon([<path key="head" d="M9 14 4 9l5-5" />, <path key="curve" d="M4 9h10.5a5.5 5.5 0 0 1 0 11H8" />])
}
