/**
 * Output normalization for the model's rewritten prompt. The system prompt
 * already demands a bare body; this is the second line of defense against
 * fences, the draft's delimiters, stray whitespace, and degenerate empties.
 * @module dsh-prompt-enhance/shared/normalize
 */

/** Three or more consecutive newlines collapse to one blank line. */
const EXCESS_BLANK_LINES = /\n{3,}/g

/** One code-fence mark. */
const FENCE = '```'

/** The opening delimiter the user message puts around the draft. */
const OPEN_TAG = '<raw_prompt>'

/** The closing delimiter the user message puts around the draft. */
const CLOSE_TAG = '</raw_prompt>'

/** Sentence punctuation that carries no meaning of its own. */
const TRAILING_PUNCTUATION = /[。．.!！?？;；,，、]+$/

/** One model output with any draft wrapper removed. */
export interface UnwrappedOutput {
  /** The output without the wrapper tags, trimmed. */
  readonly text: string
  /** Whether the output carried at least one of the wrapper tags. */
  readonly wrapped: boolean
}

/**
 * Remove the `<raw_prompt>` / `</raw_prompt>` delimiters a model sometimes
 * copies into its answer.
 *
 * The draft is wrapped in those tags in the USER message, so a weak model
 * occasionally reproduces them — either as a pure echo of the block or as a
 * wrapper around an otherwise good answer. The delimiters are scaffolding, not
 * content, so they are stripped here; whether the remainder is a real rewrite
 * is a separate question, answered by {@link isDegenerateOutput}.
 * @param raw - the assembled text output of the model.
 * @returns the inner text and whether a wrapper was present.
 */
export function unwrapPromptWrapper(raw: string): UnwrappedOutput {
  let text = raw.trim()
  let wrapped = false
  if (text.endsWith(CLOSE_TAG)) {
    text = text.slice(0, text.length - CLOSE_TAG.length)
    wrapped = true
  }
  const lead = text.trimStart()
  if (lead.startsWith(OPEN_TAG)) {
    text = lead.slice(OPEN_TAG.length)
    wrapped = true
  }
  return { text: text.trim(), wrapped }
}

/**
 * Comparison form of one text: wrapper stripped, whitespace collapsed, trailing
 * sentence punctuation removed. Two texts with the same fingerprint say the
 * same thing; only their punctuation differs.
 * @param text - the model output or the raw draft.
 * @returns the comparison form.
 */
function fingerprintOf(text: string): string {
  return unwrapPromptWrapper(text).text.replace(/\s+/g, ' ').replace(TRAILING_PUNCTUATION, '').trim()
}

/**
 * Whether the model produced no rewrite at all.
 *
 * The draft is compared in {@link fingerprintOf} form, so an answer that only
 * adds a full stop, a question mark or a line break still counts as "nothing
 * was produced". The check is deliberately independent of HOW the model failed:
 * echoing the framed block, returning the draft bare, and decorating it with
 * punctuation are the same defect from the user's side.
 *
 * An untagged answer equal to an already well-formed draft lands here too. That
 * is intentional: the strategy may polish such a draft, never return it
 * untouched, and reporting "no rewrite" is accurate either way.
 * @param raw - the assembled text output of the model.
 * @param draft - the raw prompt the user typed.
 * @returns true when the output says no more than the draft itself.
 */
export function isDegenerateOutput(raw: string, draft: string): boolean {
  const output = fingerprintOf(raw)
  return output !== '' && output === fingerprintOf(draft)
}

/**
 * Normalize one model output into the final enhanced prompt body.
 *
 * A single fence PAIR that ends the answer is a wrapper and is stripped, even
 * when the model prefixed it with a lead-in line ("以下是改写后的提示词：") —
 * that lead-in used to stay glued to the fence, so the raw ``` reached the
 * composer. This also covers single-line fences like `` ```角色：翻译``` ``.
 *
 * The same treatment applies to the draft's `<raw_prompt>` delimiters when the
 * model copied them into its answer (see {@link unwrapPromptWrapper}).
 *
 * Two boundaries keep the lenient fence rule from corrupting real content:
 * - the pair must be the ONLY one in the text (a rewritten prompt that shows
 *   several code blocks keeps all of them);
 * - nothing but whitespace may follow the closing fence. Text after the block
 *   means the block is the model's content, not a wrapper around the answer.
 * @param raw - the assembled text output of the model.
 * @returns the normalized body; empty string when nothing usable remains.
 */
export function normalizeOutput(raw: string): string {
  let text = unwrapPromptWrapper(raw).text
  const fenceMarkCount = (text.match(/```/g) ?? []).length
  if (fenceMarkCount === 2 && /```[\s]*$/.test(text)) {
    const open = text.indexOf(FENCE)
    const close = text.indexOf(FENCE, open + FENCE.length)
    // Everything before the opening fence is the lead-in, if the model wrote
    // one; everything between the newline after the fence and the closing mark
    // is the body (the tail of the opening line is its language tag).
    const lead = text.slice(0, open).trim()
    const afterFence = text.slice(open + FENCE.length, close)
    const firstNewline = afterFence.indexOf('\n')
    const body = (firstNewline === -1 ? afterFence : afterFence.slice(firstNewline + 1)).trim()
    text = lead === '' ? body : `${lead}\n${body}`
  }
  text = text.replace(EXCESS_BLANK_LINES, '\n\n')
  return text.trim()
}
