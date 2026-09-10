import type { Command, TerminalContext } from './types'

export function parseCommand(input: string): { name: string; args: string[] } {
  const [name = '', ...args] = input.trim().split(/\s+/).filter(Boolean)
  return { name, args }
}

export function complete(input: string, commands: Command[], ctx: TerminalContext): string[] {
  const hasSpace = /\s/.test(input.trim()) || input.endsWith(' ')
  const { name, args } = parseCommand(input)
  if (!hasSpace) return commands.map(c => c.name).filter(n => n.startsWith(name))
  const cmd = commands.find(c => c.name === name)
  if (!cmd?.complete) return []
  const partial = args[0] ?? ''
  return cmd.complete(partial, ctx).filter(c => c.startsWith(partial)).map(c => `${name} ${c}`)
}
