import esbuild from 'esbuild';
import { wasmLoader } from 'esbuild-plugin-wasm'

esbuild.build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  minify: false,
  sourcemap: true,
  outdir: 'dist/esm',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  loader: { '.wasm': 'copy' },
  plugins: [wasmLoader({mode: 'embedded'})],
}).catch(() => process.exit(1));
