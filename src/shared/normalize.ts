/**
 * Output normalization for the model's rewritten prompt. The system prompt
 * already demands a bare body; this is the second line of defense against
 * fences, stray whitespace, and degenerate empties.
 * @module dsh-prompt-enhance/shared/normalize
 */

/** Three or more consecutive newlines collapse to one blank line. */
const EXCESS_BLANK_LINES = /\n{3,}/g

/** One code-fence mark. */
const FENCE = '```'

/**
 * Normalize one model output into the final enhanced prompt body.
 *
 * A single fence PAIR that ends the answer is a wrapper and is stripped, even
 * when the model prefixed it with a lead-in line ("以下是改写后的提示词：") —
 * that lead-in used to stay glued to the fence, so the raw ``` reached the
 * composer. This also covers single-line fences like `` ```角色：翻译``` ``.
 *
 * Two boundaries keep the lenient rule from corrupting real content:
 * - the pair must be the ONLY one in the text (a rewritten prompt that shows
 *   several code blocks keeps all of them);
 * - nothing but whitespace may follow the closing fence. Text after the block
 *   means the block is the model's content, not a wrapper around the answer.
 * @param raw - the assembled text output of the model.
 * @returns the normalized body; empty string when nothing usable remains.
 */
export function normalizeOutput(raw: string): string {
  let text = raw.trim()
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
