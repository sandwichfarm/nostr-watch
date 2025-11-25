import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync, readdirSync, chmodSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  target: 'node20',
  platform: 'node',
  onSuccess: async () => {
    // Copy all JSON schemas to dist
    mkdirSync('dist/schemas', { recursive: true })
    const srcDir = 'src/schemas'
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'))
    for (const file of files) {
      copyFileSync(
        join(srcDir, file),
        join('dist', 'schemas', file)
      )
    }
    console.log(`✓ JSON schemas copied to dist/schemas (${files.length} files)`)

    // Make CLI executable
    try {
      chmodSync('dist/cli.js', '755')
      console.log('✓ CLI made executable')
    } catch (err) {
      console.warn('⚠ Could not make CLI executable:', err)
    }
  },
})
