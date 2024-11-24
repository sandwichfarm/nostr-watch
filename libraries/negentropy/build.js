// build.js
const esbuild = require('esbuild');

const commonOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  minify: true,
};

esbuild.build({
  ...commonOptions,
  platform: 'node',
  target: ['node14'],
  outfile: 'dist/index.node.js',
  format: 'cjs',
});

esbuild.build({
  ...commonOptions,
  platform: 'browser',
  target: ['es2020'],
  outfile: 'dist/index.browser.js',
  format: 'esm',
});
