/**
 * Hand-drawn sparkle mark: one large and one small four-point star, the usual
 * AI semantic. Used instead of the ✨ emoji, whose platform rendering is loud
 * and inconsistent across systems, for the composer button and the result
 * panel header.
 * @module dsh-prompt-enhance/client/SparkleIcon
 */

import type { ReactElement } from 'react'

/** A sparkle sized to its container, painted with the current text color. */
export function SparkleIcon(props: { size?: number; spinning?: boolean }): ReactElement {
  const size = props.size ?? 14
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Main star, upper left. */}
      <path d="M10 2 L11.6 8.4 L18 10 L11.6 11.6 L10 18 L8.4 11.6 L2 10 L8.4 8.4 Z" fill="currentColor" />
      {/* Companion star, lower right. */}
      <path d="M17.5 14 L18.3 16.7 L21 17.5 L18.3 18.3 L17.5 21 L16.7 18.3 L14 17.5 L16.7 16.7 Z" fill="currentColor" />
      {props.spinning === true
        ? <animate attributeName="opacity" values="1;0.35;1" dur="1.1s" repeatCount="indefinite" />
        : null}
    </svg>
  )
}
