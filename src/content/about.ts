import { parseFrontmatter } from './frontmatter'
import { renderMarkdown } from './markdown'
import type { About, AboutLink } from './types'
import raw from '/content/about.md?raw'

export function parseAbout(source: string): About {
  const { data, body } = parseFrontmatter(source)
  const list = Array.isArray(data.links) ? data.links : []
  const links: AboutLink[] = list.map((item) => {
    const [label, ...rest] = item.split('|')
    return { label: label.trim(), href: rest.join('|').trim() }
  })
  return { html: renderMarkdown(body), links }
}

export function loadAbout(): About {
  return parseAbout(raw)
}
