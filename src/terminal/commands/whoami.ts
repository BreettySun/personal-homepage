import type { Command } from '../types'
export const whoami: Command = {
  name: 'whoami', usage: 'whoami', description: '我是谁',
  run: () => ['scream', '# 写前端，也写点别的。', '# 名字来自张悬的一首歌。'],
}
