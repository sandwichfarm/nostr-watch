import svelte from '@sveltejs/rollup-plugin-svelte';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import css from 'rollup-plugin-css-only';
import copy from 'rollup-plugin-copy';
import { terser } from 'rollup-plugin-terser';

export default {
  input: {
    background: 'src/background/index.ts',
    popup: 'src/popup/main.ts'
  },
  output: {
    dir: 'dist',
    format: 'esm'
  },
  plugins: [
    svelte({
      emitCss: false
    }),
    css({ output: 'popup.css' }),
    nodeResolve(),
    typescript(),
    json(),
    terser(),
    copy({
      targets: [
        { src: 'src/manifest.json', dest: 'dist' },
        { src: 'src/popup/index.html', dest: 'dist/src/popup' },
        { src: 'public/icon.png', dest: 'dist/public' }
      ]
    })
  ]
};
