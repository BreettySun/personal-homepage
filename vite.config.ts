import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 子路径：CI 通过 BASE_PATH 注入，本地默认 '/'
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // nested: `/essays` -> `essays/index.html` (required by Step 15's expected dist/ layout)
    dirStyle: 'nested',
  },
})
