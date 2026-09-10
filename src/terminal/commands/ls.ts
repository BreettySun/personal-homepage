import type { Command } from '../types'
export const ls: Command = {
  name: 'ls', usage: 'ls [essays|projects]', description: '列出文章或项目',
  run(args, ctx) {
    const what = args[0] ?? 'essays'
    if (what === 'essays') return ctx.essays.map(e => `${e.date}  ${e.title}  # ${e.city} · ${e.weather}`)
    if (what === 'projects') return ctx.projects.map(p => `${p.year}  ${p.name}  # ${p.stack.join(' ')}`)
    return [`ls: ${what}: No such directory`]
  },
  complete: () => ['essays', 'projects'],
}
