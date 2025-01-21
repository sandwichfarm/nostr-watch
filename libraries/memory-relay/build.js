import esbuild from 'esbuild';

const production = process.env.NODE_ENV === 'prod';

esbuild.build({
  entryPoints: ['src/index.ts', 'src/abstract.ts', 'src/svelte.ts'],
  bundle: true,
  minify: production,
  sourcemap: !production,
  outdir: 'dist/esm',
  format: 'esm',
  splitting: true,
  external: ['nostr-tools', 'tseep', 'lodash', 'svelte'],
  outExtension: { '.js': '.mjs' },
}).catch(() => process.exit(1));
