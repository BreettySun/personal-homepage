import { describe, expect, it } from 'vitest'
import { countWords, firstSentence, readingMinutes, renderMarkdown } from '@/content/markdown'

describe('markdown helpers', () => {
  it('renders paragraphs', () => {
    expect(renderMarkdown('你好\n\n世界')).toBe('<p>你好</p>\n<p>世界</p>\n')
  })
  it('counts CJK characters and latin words, ignoring punctuation and spaces', () => {
    expect(countWords('我在实习，写前端。')).toBe(7)
    expect(countWords('hello world 你好')).toBe(4)
    expect(countWords('')).toBe(0)
  })
  it('estimates reading minutes at 400 words per minute, minimum 1', () => {
    expect(readingMinutes(0)).toBe(1)
    expect(readingMinutes(400)).toBe(1)
    expect(readingMinutes(401)).toBe(2)
    expect(readingMinutes(1203)).toBe(4)
  })
  it('takes the first sentence of the body', () => {
    expect(firstSentence('我在实习，写前端。\n\n摸鱼的时候会刷到一个问题。')).toBe('我在实习，写前端。')
    expect(firstSentence('没有句号的一段')).toBe('没有句号的一段')
  })
  it('rewrites content image srcs to bundled asset URLs', () => {
    const html = renderMarkdown('![一盆仙人掌](../images/Cactus.avif)')
    expect(html).toContain('alt="一盆仙人掌"')
    expect(html).toMatch(/src="[^"]*Cactus\.avif"/)
    expect(html).not.toContain('src="../images/Cactus.avif"')
  })
})
