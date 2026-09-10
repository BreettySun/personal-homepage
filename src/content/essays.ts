import { parseFrontmatter } from './frontmatter'
import { countWords, firstSentence, readingMinutes, renderMarkdown, stripMarkdown } from './markdown'
import type { Essay } from './types'

function slugFromPath(filePath: string): string {
  return filePath.split('/').pop()!.replace(/\.md$/, '')
}

function requireString(data: Record<string, unknown>, key: string, filePath: string): string {
  const v = data[key]
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${filePath}: frontmatter 缺少字段 "${key}"`)
  return v.trim()
}

export function parseEssay(raw: string, filePath: string): Essay {
  const { data, body } = parseFrontmatter(raw)
  const date = requireString(data, 'date', filePath)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${filePath}: date 必须是 YYYY-MM-DD，得到 "${date}"`)
  const plain = stripMarkdown(body)
  const wordCount = countWords(plain)
  return {
    slug: slugFromPath(filePath),
    title: requireString(data, 'title', filePath),
    date,
    year: Number(date.slice(0, 4)),
    city: requireString(data, 'city', filePath),
    weather: requireString(data, 'weather', filePath),
    summary: typeof data.summary === 'string' && data.summary ? data.summary : firstSentence(plain),
    html: renderMarkdown(body),
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  }
}

const files = import.meta.glob('/content/essays/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

let cache: Essay[] | null = null
export function loadEssays(): Essay[] {
  if (!cache) {
    cache = Object.entries(files)
      .map(([path, raw]) => parseEssay(raw, path))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }
  return cache
}

export function findEssay(slug: string): Essay | undefined {
  return loadEssays().find(e => e.slug === slug)
}

export function groupByYear(essays: Essay[]): { year: number; essays: Essay[] }[] {
  const map = new Map<number, Essay[]>()
  for (const e of essays) map.set(e.year, [...(map.get(e.year) ?? []), e])
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, essays: list }))
}
