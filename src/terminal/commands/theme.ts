import type { Command } from '../types'
export const theme: Command = {
  name: 'theme', usage: 'theme <dark|light>', description: '雨夜 / 宣纸',
  run(args, ctx) {
    if (args[0] !== 'dark' && args[0] !== 'light') return ['theme: dark 或 light']
    ctx.setTheme(args[0])
    return [`theme → ${args[0] === 'dark' ? '雨夜' : '宣纸'}`]
  },
  complete: () => ['dark', 'light'],
}
