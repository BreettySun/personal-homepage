import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })

export function renderMarkdown(source: string): string {
  return md.render(source)
}

/** 中日韩字符每字计 1，拉丁字母/数字连续串计 1，标点与空白不计。 */
export function countWords(text: string): number {
  const cjk = text.match(/[㐀-䶿一-鿿豈-﫿]/g)?.length ?? 0
  const latin = text.match(/[A-Za-z0-9]+/g)?.length ?? 0
  return cjk + latin
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 400))
}

/** 正文第一句：到第一个句号/问号/叹号（中英文）为止，否则取第一行。 */
export function firstSentence(body: string): string {
  const firstLine = body.split(/\r?\n/).find(l => l.trim() !== '') ?? ''
  const m = firstLine.match(/^.*?[。！？.!?]/)
  return (m ? m[0] : firstLine).trim()
}

export function stripMarkdown(body: string): string {
  return body.replace(/!\[[^\]]*]\([^)]*\)/g, '').replace(/[#>*_`~-]/g, '')
}
