import esbuild from 'esbuild';

const production = process.env.NODE_ENV === 'prod';

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: production,
  sourcemap: true,
  outdir: 'dist/esm',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  loader: { '.wasm': 'copy' },
  plugins: [wasmLoader({mode: 'embedded'})],
}).catch(() => process.exit(1));
