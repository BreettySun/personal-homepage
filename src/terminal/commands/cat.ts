import type { Command } from '../types'
export const cat: Command = {
  name: 'cat', usage: 'cat <文章>', description: '打开一篇文章',
  run(args, ctx) {
    const key = args.join(' ')
    if (!key) return ['cat: 缺少文件名，试试 ls']
    const e = ctx.essays.find(x => x.title === key || x.slug === key || x.slug === key.replace(/\.md$/, ''))
    if (!e) return [`cat: ${key}: No such file`]
    ctx.navigate(`/essays/${e.slug}`)
    ctx.close()
    return [`opening ${e.title} …`]
  },
  complete: (_p, ctx) => ctx.essays.map(e => e.title),
}
