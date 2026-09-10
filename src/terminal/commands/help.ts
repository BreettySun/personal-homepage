import type { Command } from '../types'
import { commands } from '../registry'
export const help: Command = {
  name: 'help', usage: 'help', description: '列出命令',
  run() {
    const w = Math.max(...commands.map(c => c.usage.length))
    return commands.filter(c => c.name !== 'sudo').map(c => `${c.usage.padEnd(w + 2)}${c.description}`)
  },
}
