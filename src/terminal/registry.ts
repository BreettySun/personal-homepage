import { parseCommand } from './parse'
import type { Command, TerminalContext, TerminalOutput } from './types'
import { cat } from './commands/cat'
import { cd } from './commands/cd'
import { clear } from './commands/clear'
import { help } from './commands/help'
import { ls } from './commands/ls'
import { seed } from './commands/seed'
import { sudo } from './commands/sudo'
import { theme } from './commands/theme'
import { weather } from './commands/weather'
import { whoami } from './commands/whoami'

export const commands: Command[] = [help, ls, cat, cd, whoami, weather, seed, theme, clear, sudo]

export function findCommand(name: string): Command | undefined {
  return commands.find(c => c.name === name)
}

export async function execute(input: string, ctx: TerminalContext): Promise<TerminalOutput> {
  const { name, args } = parseCommand(input)
  if (!name) return []
  const cmd = findCommand(name)
  if (!cmd) return [`${name}: command not found. 试试 help`]
  return cmd.run(args, ctx)
}
