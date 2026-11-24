import { describe, expect, it } from 'vitest'
import { checkContract, placeholderNames } from '../src/shared/contract'

/** Placeholder checks are opt-in per call; most cases keep them on. */
const withSlots = { placeholders: true } as const

describe('checkContract', () => {
  it('returns nothing for a clean rewrite', () => {
    expect(checkContract('写个爬虫', '请写一个爬虫，输出 Python 代码。', withSlots)).toEqual([])
  })

  it('flags a framework marker the draft did not contain', () => {
    expect(checkContract('写个爬虫', '请写一个爬虫\n<conversation_context>\n用户: 上面那个\n</conversation_context>', withSlots)).toEqual([
      { code: 'framework-leak', count: 2, detail: '<conversation_context>, </conversation_context>' },
    ])
  })

  it('does not flag a marker the draft itself contains', () => {
    expect(checkContract('解释 <raw_prompt> 的含义', '解释 <raw_prompt> 的含义，用中文。', withSlots)).toEqual([])
  })

  it('ignores a marker the draft contains even when the result repeats it', () => {
    // The user may be asking a downstream model to emit that marker; quoting it
    // twice is content, not a framework leak.
    expect(checkContract('请输出 <conversation_context>', '请输出 <conversation_context>，验收时再检查 <conversation_context>', withSlots)).toEqual([])
  })

  it('reports a no-rewrite when the body says no more than the draft', () => {
    expect(checkContract('写个爬虫', '写个爬虫。', withSlots)).toEqual([{ code: 'no-rewrite', count: 1 }])
    // A wrapper echo is both "nothing rewritten" and a framework marker; the
    // body stays visible and the card reports the quality verdict first.
    expect(checkContract('写个爬虫', '<raw_prompt>\n写个爬虫\n</raw_prompt>', withSlots)).toEqual([
      { code: 'no-rewrite', count: 1 },
      { code: 'framework-leak', count: 2, detail: '<raw_prompt>, </raw_prompt>' },
    ])
  })

  it('reports a lost placeholder only when the draft has one', () => {
    expect(checkContract('写一篇关于 {{topic}} 的文章', '写一篇关于人工智能的文章', withSlots)).toEqual([{ code: 'placeholder-lost', count: 1, detail: '{{topic}}' }])
    expect(checkContract('写一篇文章', '写一篇关于人工智能的文章', withSlots)).toEqual([])
  })

  it('treats a whitespace-only variant as kept', () => {
    expect(checkContract('{{ topic }}', '{{topic}}', withSlots)).toEqual([])
  })

  it('skips the placeholder check when the strategy does not promise it', () => {
    expect(checkContract('{{topic}}', '无占位符', { placeholders: false })).toEqual([])
  })

  it('reports several lost placeholders in one check', () => {
    const checks = checkContract('{{a}} {{b}} {{c}}', '{{a}}', withSlots)
    expect(checks).toHaveLength(1)
    expect(checks[0]).toMatchObject({ code: 'placeholder-lost', count: 2 })
    expect(checks[0]?.detail).toContain('{{b}}')
  })

  it('orders framework leaks before lost slots', () => {
    const checks = checkContract('{{topic}}\n写个周报', '<conversation_context>\n写个周报\n</conversation_context>', withSlots)
    expect(checks.map((check) => check.code)).toEqual(['framework-leak', 'placeholder-lost'])
  })

  it('ignores model-authored gap markers instead of pretending to count them', () => {
    // `TBD`, `待确认`, `待核实` are free-form prose: any count would be a false
    // precision, so the checker deliberately ignores them.
    expect(checkContract('写个周报', '写个周报（TBD: 目标读者）', withSlots)).toEqual([])
    expect(checkContract('写个周报', '写个周报（字数：待确认）', withSlots)).toEqual([])
  })
})

describe('placeholderNames', () => {
  it('dedupes and trims names', () => {
    expect(placeholderNames('{{ a }} {{a}} {{b}}')).toEqual(['a', 'b'])
  })

  it('ignores empty and multi-line braces', () => {
    expect(placeholderNames('{{}} {{a\nb}}')).toEqual([])
  })
})
