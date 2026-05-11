import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 避免 lightningcss 在 Linux CI 上缺少可选原生绑定导致 build 失败
  build: {
    cssMinify: 'esbuild',
  },
})
