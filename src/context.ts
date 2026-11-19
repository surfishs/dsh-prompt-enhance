/**
 * Context-aware enhancement: turn the current conversation's derived history
 * into one bounded, neutralized snippet the rewrite can be grounded in.
 *
 * Two invariants drive the whole module:
 * - **Never fabricate.** The snippet is evidence, not instruction: it is
 *   handed to the model inside <conversation_context> tags and the system
 *   prompt forbids using it to introduce anything the raw prompt does not
 *   support. The raw prompt always wins on conflict.
 * - **Fail open to the original behaviour.** No session, no history, an empty
 *   window, or a session-layer throw all yield `undefined`, which makes the
 *   caller fall back to the plain single-prompt enhancement untouched.
 * @module dsh-prompt-enhance/context
 */

import { countText } from './shared/validate'
import type { ContextUsage } from './shared/protocol'

/** One turn of conversation history admitted into the context window. */
export interface ContextTurn {
  /** Speaker role; `system` is never part of the window. */
  role: 'user' | 'assistant'
  /** The turn's literal text (whitespace-trimmed, never empty). */
  text: string
}

/** The context window the operator configured. */
export interface ContextWindowOptions {
  /** How many recent turns may be admitted; 0 admits none. */
  maxMessages: number
  /** Character budget of the assembled snippet; 0 admits none. */
  maxChars: number
}

/** Structural face of one derived history message (brand types stay off this path). */
interface HistoryMessageLike {
  role?: unknown
  content?: unknown
  source?: unknown
}

/**
 * Whether a user-role message was injected by the harness rather than typed
 * by the user. DSH represents environment, skill and time context as
 * `user/message` events whose `source.kind` is not `user` (e.g.
 * `runtime-context`, `skill-catalog`, `time-context`); they are visible to the
 * model but not to the user, so they must not spend the conversation-context
 * budget or show up as "your recent turns".
 * @param message - one derived history message (untrusted).
 * @returns true for non-user producer kinds; false when the source is absent
 *   (older hosts) or is the user's own message.
 */
function isInjectedUserContext(message: HistoryMessageLike): boolean {
  const source = message.source
  if (source === null || typeof source !== 'object') return false
  const kind = (source as { kind?: unknown }).kind
  return typeof kind === 'string' && kind !== 'user'
}

/** Marker appended to a turn that was cut to fit the character budget. */
const TRUNCATION_MARK = '… (truncated)'

/**
 * Cut one text to at most `max` Unicode code points. Slicing by UTF-16 index
 * could split a surrogate pair (an emoji, a rare CJK ext-B glyph) and leave a
 * lone surrogate — invalid text the model cannot read back.
 * @param text - the text to cut.
 * @param max - the code-point budget; non-positive yields the empty string.
 * @returns the longest prefix of at most `max` code points.
 */
function cutToCodePoints(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  let out = ''
  let n = 0
  for (const ch of text) {
    if (n === max) break
    out += ch
    n++
  }
  return out
}

/**
 * The literal prose of one derived message. Only text blocks count: tool
 * calls, tool results, and reasoning carry no user-visible wording and would
 * spend the window budget on noise.
 * @param message - one untrusted derived message.
 * @returns the joined, trimmed text; empty when the message carries none.
 */
function turnTextOf(message: HistoryMessageLike): string {
  const content = message.content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const record = block as { type?: unknown; text?: unknown }
    if (record.type !== 'text' || typeof record.text !== 'string') continue
    const text = record.text.trim()
    if (text !== '') parts.push(text)
  }
  return parts.join('\n')
}

/** One selection plus the usage numbers the result card reports. */
export interface ContextSelection {
  /** Admitted turns, chronological. */
  turns: ContextTurn[]
  /** How much of the configured window was used, and why it stopped. */
  usage: ContextUsage
}

/**
 * Pick the turns that fit the configured window, newest last.
 *
 * The budget is spent from the newest turn backwards — a pronoun or an
 * ellipsis in the draft almost always refers to the most recent turns, so
 * truncating the window must drop the OLDEST material, never the newest.
 * @param messages - the session's derived history (untrusted).
 * @param options - the configured window.
 * @param draft - the raw draft being enhanced; a trailing user turn equal to
 *   it is dropped so the draft never appears as its own context.
 * @returns the admitted turns in chronological order; empty when none fit.
 */
export function selectTurns(messages: readonly unknown[], options: ContextWindowOptions, draft?: string): ContextTurn[] {
  return selectTurnsWithUsage(messages, options, draft).turns
}

/**
 * The same selection as {@link selectTurns}, plus what the result card shows.
 *
 * `usedChars` counts the admitted turn text only — the same gauge the budget
 * spends — so the reported fraction always matches the configured cap.
 * @param messages - the session's derived history (untrusted).
 * @param options - the configured window.
 * @param draft - the raw draft being enhanced.
 * @returns the admitted turns and their usage.
 */
export function selectTurnsWithUsage(messages: readonly unknown[], options: ContextWindowOptions, draft?: string): ContextSelection {
  const maxMessages = Number.isInteger(options.maxMessages) ? Math.max(0, options.maxMessages) : 0
  const maxChars = Number.isInteger(options.maxChars) ? Math.max(0, options.maxChars) : 0
  const empty = (): ContextSelection => ({
    turns: [],
    usage: { usedTurns: 0, maxTurns: maxMessages, usedChars: 0, maxChars, droppedTurns: 0, limitedBy: null, cutTurn: false },
  })
  if (maxMessages === 0 || maxChars === 0) return empty()

  const turns: ContextTurn[] = []
  for (const message of messages) {
    if (message === null || typeof message !== 'object') continue
    const record = message as HistoryMessageLike
    if (record.role !== 'user' && record.role !== 'assistant') continue
    if (record.role === 'user' && isInjectedUserContext(record)) continue
    const text = turnTextOf(record)
    if (text === '') continue
    turns.push({ role: record.role, text })
  }
  // Some hosts re-derive a history that already ends with the text under the
  // cursor; feeding the draft back as its own context only wastes budget.
  // Match the LATEST user turn equal to the draft (not the very last turn —
  // an assistant reply between the draft and its user message is fine).
  if (draft !== undefined) {
    const trimmed = draft.trim()
    if (trimmed !== '') {
      for (let index = turns.length - 1; index >= 0; index--) {
        const candidate = turns[index]
        if (candidate !== undefined && candidate.role === 'user' && candidate.text === trimmed) {
          turns.splice(index, 1)
          break
        }
      }
    }
  }

  const total = turns.length
  const windowed = turns.slice(-maxMessages)
  const droppedByMessages = total - windowed.length
  const kept: ContextTurn[] = []
  let used = 0
  let limitedBy: ContextUsage['limitedBy'] = null
  let cutTurn = false
  for (let index = windowed.length - 1; index >= 0; index--) {
    const turn = windowed[index]!
    // Same gauge as `shared/validate.countText`, the input cap, and the host
    // logs: Unicode code points, not UTF-16 units. `turn.text.length` would
    // spend double budget on CJK/emoji-heavy history and make `maxChars`
    // disagree with the "characters" the UI reports.
    const length = countText(turn.text)
    if (used + length > maxChars) {
      const room = maxChars - used
      // One very long recent turn must not blank the window: keep its head,
      // marked as cut. The head is what names the task, the stack, and the
      // constraints the draft is shorthand for.
      if (kept.length === 0 && room > TRUNCATION_MARK.length + 40) {
        const cut = `${cutToCodePoints(turn.text, room - TRUNCATION_MARK.length).trimEnd()}${TRUNCATION_MARK}`
        kept.unshift({ role: turn.role, text: cut })
        cutTurn = true
      } else {
        limitedBy = 'chars'
      }
      break
    }
    used += length
    kept.unshift(turn)
  }
  if (!cutTurn && limitedBy === null && droppedByMessages > 0) limitedBy = 'turns'
  const usedChars = kept.reduce((sum, turn) => sum + countText(turn.text), 0)
  return {
    turns: kept,
    usage: {
      usedTurns: kept.length,
      maxTurns: maxMessages,
      usedChars,
      maxChars,
      droppedTurns: total - kept.length,
      limitedBy,
      cutTurn,
    },
  }
}

/**
 * Neutralize a literal `conversation_context` tag inside untrusted turn text
 * so history can never close (or forge) the framing around itself. Mirrors
 * the `raw_prompt` escaping in `prompts.frameUserPrompt`.
 * @param text - one turn's text.
 * @returns the text with any framing tag defused.
 */
function neutralize(text: string): string {
  return text.replace(/<\/?(conversation_context)>/gi, '<\\/$1>')
}

/**
 * Render the admitted turns into the block handed to the model.
 * @param turns - the admitted turns, chronological.
 * @returns the framed snippet.
 */
export function formatContextBlock(turns: readonly ContextTurn[]): string {
  const body = turns.map((turn) => `[${turn.role}] ${neutralize(turn.text)}`).join('\n')
  return `<conversation_context>\n${body}\n</conversation_context>`
}

/**
 * Build the grounding snippet for one enhancement, or nothing at all.
 * @param messages - the session's derived history (untrusted, may be undefined).
 * @param options - the configured window.
 * @param draft - the raw draft being enhanced.
 * @returns the framed snippet, or `undefined` when there is no usable history
 *   — the caller then runs the original single-prompt enhancement.
 */
export function buildConversationContextWithUsage(messages: readonly unknown[] | undefined, options: ContextWindowOptions, draft?: string): { text: string; usage: ContextUsage } | undefined {
  if (messages === undefined) return undefined
  const selection = selectTurnsWithUsage(messages, options, draft)
  if (selection.turns.length === 0) return undefined
  return { text: formatContextBlock(selection.turns), usage: selection.usage }
}

/**
 * Build the grounding snippet for one enhancement, or nothing at all.
 * @param messages - the session's derived history (untrusted, may be undefined).
 * @param options - the configured window.
 * @param draft - the raw draft being enhanced.
 * @returns the framed snippet, or `undefined` when there is no usable history
 *   — the caller then runs the original single-prompt enhancement.
 */
export function buildConversationContext(messages: readonly unknown[] | undefined, options: ContextWindowOptions, draft?: string): string | undefined {
  return buildConversationContextWithUsage(messages, options, draft)?.text
}
