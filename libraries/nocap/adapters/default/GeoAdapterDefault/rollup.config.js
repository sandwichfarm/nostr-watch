import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';

const onwarn = (warning, warn) => {
  // Ignore circular dependency warnings
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  warn(warning);
}

export default [
  {
    input: 'dist/server/index.js',  // The JavaScript file output by tsc
    output: {
      dir: 'dist/server/cjs',
      format: 'cjs',
      sourcemap: true,
      entryFileNames: '[name].cjs.js',
      strict: false,
      exports: 'named',
    },
    plugins: [
      resolve({
        extensions: ['.js'],
        preferBuiltins: true,
      }),
      commonjs({
        sourceMap: true,
      }),
      json({
        sourceMap: true,
      }),
      nodePolyfills(),
      terser(),
    ],
    onwarn
  },

  {
    input: 'dist/web/index.js',
    output: {
      dir: 'dist/web',
      format: 'es',
      sourcemap: true,
      strict: false,
    },
    plugins: [
      resolve({
        browser: true,
        extensions: ['.js'],
      }),
      commonjs({
        sourceMap: true,
      }),
      json({
        sourceMap: true,
      }),
      nodePolyfills(),
      // terser(),
    ],
    onwarn
  },
];
