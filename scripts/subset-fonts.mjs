// 下载 Noto Serif CJK SC 的 Regular / SemiBold（各约 24MB，缓存在 .cache/fonts），
// 收集 content/ 与 src/ 中出现过的全部字符，子集化为 woff2 写到 public/fonts。
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache/fonts')
const OUT = path.join(ROOT, 'public/fonts')
const BASE = 'https://github.com/notofonts/noto-cjk/raw/main/Serif/OTF/SimplifiedChinese'
const FACES = [
  { weight: 400, file: 'NotoSerifCJKsc-Regular.otf' },
  { weight: 600, file: 'NotoSerifCJKsc-SemiBold.otf' },
]
// 固定保留：ASCII 可见字符、常用中文标点、界面里可能动态出现的字
const ALWAYS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  + '，。、；：？！「」『』（）《》〈〉【】—…·～　'
  + '目录项目关于文章字分钟晴阴雨雪春夏秋冬手动默认实时年月日北京'

async function walk(dir, exts, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, exts, acc)
    else if (exts.includes(path.extname(entry.name))) acc.push(p)
  }
  return acc
}

async function collectText() {
  const files = [
    ...(await walk(path.join(ROOT, 'content'), ['.md'])),
    ...(await walk(path.join(ROOT, 'src'), ['.vue', '.ts'])),
  ]
  const chars = new Set(ALWAYS)
  for (const f of files) for (const ch of await readFile(f, 'utf8')) chars.add(ch)
  return [...chars].join('')
}

async function download(file) {
  await mkdir(CACHE, { recursive: true })
  const target = path.join(CACHE, file)
  if (existsSync(target) && (await stat(target)).size > 1_000_000) return target
  process.stdout.write(`downloading ${file} … `)
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${file}`)
  await writeFile(target, Buffer.from(await res.arrayBuffer()))
  console.log('ok')
  return target
}

const text = await collectText()
const hash = createHash('sha1').update(text).digest('hex').slice(0, 8)
await mkdir(OUT, { recursive: true })
console.log(`subsetting ${text.length} distinct chars (hash ${hash})`)
for (const face of FACES) {
  const src = await readFile(await download(face.file))
  const out = await subsetFont(src, text, { targetFormat: 'woff2' })
  const dest = path.join(OUT, `noto-serif-sc-${face.weight}.woff2`)
  await writeFile(dest, out)
  console.log(`${path.relative(ROOT, dest)}  ${(out.length / 1024).toFixed(0)} KB`)
}
