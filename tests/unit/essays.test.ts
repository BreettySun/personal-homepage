import { describe, expect, it } from 'vitest'
import { groupByYear, loadEssays, parseEssay } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import { loadAbout } from '@/content/about'

const raw = `---
title: 丘陵
date: 2025-11-30
city: 随州
weather: 雨
---

当车轮驶过积水的波浪潮水一般向我涌来的时候，我知道，我不该期待什么狂风暴雨。

北京今年下太多雨了。
`

describe('parseEssay', () => {
  it('builds an Essay from frontmatter and body', () => {
    const e = parseEssay(raw, '/content/essays/丘陵.md')
    expect(e.slug).toBe('丘陵')
    expect(e.title).toBe('丘陵')
    expect(e.year).toBe(2025)
    expect(e.city).toBe('随州')
    expect(e.weather).toBe('雨')
    expect(e.summary).toBe('当车轮驶过积水的波浪潮水一般向我涌来的时候，我知道，我不该期待什么狂风暴雨。')
    expect(e.html).toContain('<p>北京今年下太多雨了。</p>')
    expect(e.wordCount).toBeGreaterThan(30)
    expect(e.readingMinutes).toBe(1)
  })
  it('throws a message that names the file when a field is missing', () => {
    expect(() => parseEssay(`---\ntitle: x\n---\n正文`, '/content/essays/x.md'))
      .toThrow(/x\.md.*date/)
  })
})

describe('parseEssay lead paragraph', () => {
  const mk = (body: string, extra = '') =>
    parseEssay(`---\ntitle: t\ndate: 2026-01-01\ncity: c\nweather: w\n${extra}---\n${body}`, '/content/essays/t.md')

  it('drops a single-sentence lead paragraph that already became the summary', () => {
    const e = mk('第一段只有一句。\n\n第二段留下。\n')
    expect(e.summary).toBe('第一段只有一句。')
    expect(e.html).not.toContain('第一段只有一句。')
    expect(e.html).toContain('<p>第二段留下。</p>')
  })

  it('keeps a lead paragraph that says more than the summary', () => {
    const e = mk('第一句。第二句还在同一段。\n\n第二段留下。\n')
    expect(e.summary).toBe('第一句。')
    expect(e.html).toContain('<p>第一句。第二句还在同一段。</p>')
  })

  it('never touches the body when summary is explicit', () => {
    const e = mk('第一段只有一句。\n\n第二段留下。\n', 'summary: 自己写的摘要\n')
    expect(e.summary).toBe('自己写的摘要')
    expect(e.html).toContain('<p>第一段只有一句。</p>')
  })

  it('counts words on the full body even when the lead paragraph is dropped', () => {
    const body = '第一段只有一句。\n\n第二段留下。\n'
    expect(mk(body).wordCount).toBe(mk(body, 'summary: 自己写的摘要\n').wordCount)
  })
})

describe('groupByYear', () => {
  it('groups newest year first, keeping input order inside a year', () => {
    const mk = (slug: string, date: string) => parseEssay(`---\ntitle: ${slug}\ndate: ${date}\ncity: c\nweather: w\n---\n正文。`, `/content/essays/${slug}.md`)
    const groups = groupByYear([mk('a', '2026-01-02'), mk('b', '2025-06-01'), mk('c', '2026-01-01')])
    expect(groups.map(g => g.year)).toEqual([2026, 2025])
    expect(groups[0].essays.map(e => e.slug)).toEqual(['a', 'c'])
  })
})

describe('real content', () => {
  it('loads all essays sorted newest first', () => {
    const list = loadEssays()
    expect(list.length).toBeGreaterThan(0)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].date >= list[i].date).toBe(true)
  })
  it('loads projects and about', () => {
    expect(loadProjects().length).toBeGreaterThan(0)
    expect(loadAbout().links.length).toBe(2)
  })
})
