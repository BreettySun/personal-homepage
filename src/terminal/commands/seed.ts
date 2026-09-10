import type { Command } from '../types'
export const seed: Command = {
  name: 'seed', usage: 'seed [0xhex|random]', description: '换一片地形',
  run(args, ctx) {
    if (!args[0]) return [`seed 0x${ctx.params.seed.toString(16)}`]
    const n = args[0] === 'random' ? Math.floor(Math.random() * 0xffff) : Number(args[0])
    if (!Number.isInteger(n) || n < 0) return [`seed: "${args[0]}" 不是整数`]
    ctx.setManual({ seed: n })
    return [`seed → 0x${n.toString(16)}`]
  },
  complete: () => ['random'],
}
