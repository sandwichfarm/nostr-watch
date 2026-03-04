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
  noExternal: [/^@nostrwatch\//],
  onSuccess: async () => {
    // Copy all JSON schemas to dist (if schemas directory exists)
    const srcDir = 'src/schemas'
    try {
      const files = readdirSync(srcDir).filter((f) => f.endsWith('.json'))
      if (files.length > 0) {
        mkdirSync('dist/schemas', { recursive: true })
        for (const file of files) {
          copyFileSync(
            join(srcDir, file),
            join('dist', 'schemas', file)
          )
        }
        console.log(`✓ JSON schemas copied to dist/schemas (${files.length} files)`)
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('⚠ No schemas directory found, skipping schema copy')
      } else {
        throw err
      }
    }

    // Make CLI executable
    try {
      chmodSync('dist/cli.js', '755')
      console.log('✓ CLI made executable')
    } catch (err) {
      console.warn('⚠ Could not make CLI executable:', err)
    }
  },
})
