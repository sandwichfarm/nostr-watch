import esbuild from 'esbuild';

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
};

await esbuild.build({
  ...common,
  platform: 'node',
  target: 'node14',
  outfile: 'dist/index.node.js',
  format: 'cjs',
});

await esbuild.build({
  ...common,
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/index.browser.js',
  format: 'esm',
});
