import type { Command } from '../types'
export const clear: Command = { name: 'clear', usage: 'clear', description: '清屏', run: () => ({ clear: true }) }
