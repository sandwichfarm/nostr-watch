import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import tscAlias from 'rollup-plugin-tsc-alias';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';
import inject from '@rollup/plugin-inject';

const onwarn = (warning, warn) => {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  warn(warning);
}

export default [
  // {
  //   input: 'dist/server/index.js',
  //   output: {
  //     dir: 'dist/server/cjs',
  //     format: 'cjs',
  //     sourcemap: true,
  //     entryFileNames: '[name].cjs.js',
  //     strict: false,
  //     exports: 'named',
  //   },
  //   plugins: [
  //     importMetaAssets(),
  //     resolve({
  //       extensions: ['.js'],
  //       preferBuiltins: true,
  //     }),
  //     commonjs({
  //       sourceMap: true,
  //     }),
  //     json({
  //       sourceMap: true,
  //     }),
  //     terser(),
  //   ],
  //   onwarn
  // },
  {
    input: 'dist/web/index.js',
    output: {
      dir: 'dist/web',
      format: 'es',
      sourcemap: true,
      strict: false,
    },
    plugins: [
      inject({
        process: 'process/browser',
      }),
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
      terser(),
    ],
    onwarn
  },
];
