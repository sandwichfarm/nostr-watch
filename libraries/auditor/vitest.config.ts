import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/base/**/*', 'src/utils/**/*'],
    },
  },
  resolve: {
    alias: {
      '#base': resolve(__dirname, './src/base'),
      '#src': resolve(__dirname, './src'),
      '#utils': resolve(__dirname, './src/utils'),
    },
  },
}) 