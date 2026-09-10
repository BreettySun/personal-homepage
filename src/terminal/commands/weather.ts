import type { Command } from '../types'
const zhW = { clear: '晴', cloudy: '阴', rain: '雨', snow: '雪' } as const
const zhS = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const
const zhSrc = { live: '实时', default: '默认', manual: '手动' } as const
export const weather: Command = {
  name: 'weather', usage: 'weather [晴|阴|雨|雪]', description: '看或改天气',
  run(args, ctx) {
    const p = ctx.params
    if (!args[0]) return [`北京 · ${zhW[p.weather]} · ${zhS[p.season]} · ${zhSrc[p.source]} · intensity ${p.intensity}`]
    const entry = (Object.entries(zhW) as [keyof typeof zhW, string][]).find(([, v]) => v === args[0])
    if (!entry) return [`weather: 只认识 晴 阴 雨 雪`]
    ctx.setManual({ weather: entry[0] })
    return [`weather → ${args[0]} (manual)`]
  },
  complete: () => Object.values(zhW),
}
