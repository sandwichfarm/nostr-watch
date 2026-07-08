import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: 'dist/esm',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  loader: { '.wasm': 'copy' },
});
