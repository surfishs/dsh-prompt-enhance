import { describe, expect, it } from 'vitest'
import { isDegenerateOutput, normalizeOutput } from '../src/shared/normalize'

describe('normalizeOutput', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeOutput('  你好\n')).toBe('你好')
  })

  it('strips one wrapping code fence with a language tag', () => {
    expect(normalizeOutput('```markdown\n# 标题\n正文\n```')).toBe('# 标题\n正文')
  })

  it('strips a bare wrapping fence', () => {
    expect(normalizeOutput('```\n角色：翻译\n```')).toBe('角色：翻译')
  })

  it('keeps fences that are part of the body', () => {
    const body = '输出示例：\n```\ncode\n```\n结束'
    expect(normalizeOutput(body)).toBe(body)
  })

  it('strips a single fence pair the model prefixed with a lead-in line', () => {
    // The lenient case: the lead-in used to keep the raw ``` in the draft.
    expect(normalizeOutput('以下是改写后的提示词：\n```\n角色：翻译\n```')).toBe('以下是改写后的提示词：\n角色：翻译')
    expect(normalizeOutput('```markdown\n# 标题\n```\n\n  ')).toBe('# 标题')
    expect(normalizeOutput('说明：```角色：翻译```')).toBe('说明：\n角色：翻译')
  })

  it('strips single-line fences', () => {
    expect(normalizeOutput('```角色：翻译```')).toBe('角色：翻译')
  })

  it('handles CRLF fences', () => {
    expect(normalizeOutput('```\r\n正文\r\n```')).toBe('正文')
  })

  it('keeps multiple fenced blocks intact instead of stripping the outer pair', () => {
    const body = '```\n第一块\n```\n```\n第二块\n```'
    expect(normalizeOutput(body)).toBe(body)
  })

  it('collapses three or more blank lines into one', () => {
    expect(normalizeOutput('一\n\n\n\n二')).toBe('一\n\n二')
  })

  it('returns empty string for whitespace-only or fence-only output', () => {
    expect(normalizeOutput('   ')).toBe('')
    expect(normalizeOutput('```\n```')).toBe('')
  })
})

describe('draft wrapper handling', () => {
  it('strips a raw_prompt wrapper around a real rewrite', () => {
    expect(normalizeOutput('<raw_prompt>\n角色：翻译\n</raw_prompt>')).toBe('角色：翻译')
    expect(normalizeOutput('<raw_prompt>角色：翻译</raw_prompt>')).toBe('角色：翻译')
  })

  it('strips a lone opening or closing tag', () => {
    // A truncated answer can carry only one side; the tag is still scaffolding.
    expect(normalizeOutput('<raw_prompt>\n角色：翻译')).toBe('角色：翻译')
    expect(normalizeOutput('角色：翻译\n</raw_prompt>')).toBe('角色：翻译')
  })

  it('leaves an unwrapped answer untouched', () => {
    expect(normalizeOutput('角色：翻译')).toBe('角色：翻译')
  })

  it('detects an echo whatever wrapper the model used', () => {
    expect(isDegenerateOutput('<raw_prompt>\n写个爬虫\n</raw_prompt>', '写个爬虫')).toBe(true)
    // The bare draft, and the draft with a full stop appended, are the same
    // defect from the user's side: nothing was rewritten.
    expect(isDegenerateOutput('写个爬虫', '写个爬虫')).toBe(true)
    expect(isDegenerateOutput('写个爬虫。', '写个爬虫')).toBe(true)
    // A real rewrite is not degenerate, even when it is short.
    expect(isDegenerateOutput('<raw_prompt>\n角色：翻译\n</raw_prompt>', '写个爬虫')).toBe(false)
    expect(isDegenerateOutput('角色：翻译', '写个爬虫')).toBe(false)
  })

  it('ignores whitespace and trailing punctuation when comparing', () => {
    expect(isDegenerateOutput('<raw_prompt>\n  写个爬虫 \n</raw_prompt>', ' 写个爬虫 ')).toBe(true)
    expect(isDegenerateOutput('修好了！', '修好了')).toBe(true)
    expect(isDegenerateOutput('修好了\n\n', '修好了')).toBe(true)
  })

  it('does not fire when the answer adds anything to the draft', () => {
    // The bare echo is caught, but a draft plus a note is left to the prompt
    // rules: pattern-matching every way a model can waffle would never end.
    expect(isDegenerateOutput('修好了。这条消息没有提出新的任务。', '修好了')).toBe(false)
  })
})
