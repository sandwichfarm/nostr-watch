import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    server: { deps: { inline: ['@nostrability/schemata'] } },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/base/**/*', 'src/utils/**/*'],
    },
  },
  resolve: {
    alias: {
      'src': resolve(__dirname, './src'),
      '#base': resolve(__dirname, './src/base'),
      '#src': resolve(__dirname, './src'),
      '#utils': resolve(__dirname, './src/utils'),
    },
  },
})
