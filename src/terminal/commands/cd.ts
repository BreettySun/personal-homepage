import type { Command } from '../types'
const DIRS: Record<string, string> = { '~': '/', essays: '/essays', projects: '/projects', about: '/about' }
export const cd: Command = {
  name: 'cd', usage: 'cd <essays|projects|about|~>', description: '去一个地方',
  run(args, ctx) {
    const d = args[0] ?? '~'
    if (!(d in DIRS)) return [`cd: ${d}: No such directory`]
    ctx.navigate(DIRS[d]); ctx.close()
    return []
  },
  complete: () => Object.keys(DIRS),
}
