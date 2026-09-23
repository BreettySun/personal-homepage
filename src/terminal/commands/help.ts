import type { Command } from '../types'
import { commands } from '../registry'
/**
 * 用法和说明之间是一个制表符，终端按最长的用法设制表位（Terminal.vue 的 tabSize）。
 * 不能按字符数补空格：用法里有中文（"cat <文章>"）时，中文比等宽字符宽，说明那一列就错开了；
 * 制表位是按行首算的绝对位置，前面的字多宽都对得齐。
 */
export const help: Command = {
  name: 'help', usage: 'help', description: '列出命令',
  run() {
    return commands.filter(c => c.name !== 'sudo').map(c => `${c.usage}\t${c.description}`)
  },
}
