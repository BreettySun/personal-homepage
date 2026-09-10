import { parseFrontmatter } from './frontmatter'
import { renderMarkdown } from './markdown'
import type { Project } from './types'

function str(data: Record<string, unknown>, key: string, filePath: string): string {
  const v = data[key]
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${filePath}: frontmatter 缺少字段 "${key}"`)
  return v.trim()
}
function optional(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function parseProject(raw: string, filePath: string): Project {
  const { data, body } = parseFrontmatter(raw)
  const yearRaw = str(data, 'year', filePath)
  const year = Number(yearRaw)
  if (!Number.isInteger(year)) throw new Error(`${filePath}: year 必须是整数，得到 "${yearRaw}"`)
  const stack = Array.isArray(data.stack) ? data.stack : []
  return {
    slug: filePath.split('/').pop()!.replace(/\.md$/, ''),
    name: str(data, 'name', filePath),
    tagline: str(data, 'tagline', filePath),
    stack,
    year,
    github: optional(data, 'github'),
    url: optional(data, 'url'),
    cover: optional(data, 'cover'),
    html: renderMarkdown(body),
  }
}

const files = import.meta.glob('/content/projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

let cache: Project[] | null = null
export function loadProjects(): Project[] {
  if (!cache) {
    cache = Object.entries(files).map(([p, raw]) => parseProject(raw, p)).sort((a, b) => b.year - a.year)
  }
  return cache
}
