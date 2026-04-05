import { defineConfig } from 'vite-plus'

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      'web-haptic-engine': new URL('../src/index.ts', import.meta.url).pathname,
    },
  },
})
