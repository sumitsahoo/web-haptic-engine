import { defineConfig } from 'vite-plus'

export default defineConfig({
  root: __dirname,
  server: {
    allowedHosts: true,
  },
  resolve: {
    alias: {
      'web-haptic-engine': new URL('../src/index.ts', import.meta.url).pathname,
    },
  },
})
