export type FrontmatterValue = string | string[]
export interface Frontmatter { data: Record<string, FrontmatterValue>; body: string }

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function unquote(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  return t
}

function parseValue(v: string): FrontmatterValue {
  const t = v.trim()
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim()
    return inner === '' ? [] : inner.split(',').map(unquote)
  }
  return unquote(t)
}

export function parseFrontmatter(raw: string): Frontmatter {
  const m = raw.match(FENCE)
  if (!m) return { data: {}, body: raw }
  const data: Record<string, FrontmatterValue> = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    data[line.slice(0, idx).trim()] = parseValue(line.slice(idx + 1))
  }
  const body = raw.slice(m[0].length).replace(/^\r?\n/, '')
  return { data, body }
}
