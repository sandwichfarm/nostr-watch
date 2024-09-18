import path from 'path';
import { fileURLToPath } from 'url';
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';
import livereload from 'rollup-plugin-livereload';
import copy from 'rollup-plugin-copy';
import glob from 'glob';
import worker from 'rollup-plugin-workers';
// import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import { cleandir } from "rollup-plugin-cleandir";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = !process.env.ROLLUP_WATCH;

const input = glob.sync('src/**/index.ts');
const workers = glob.sync('src/**/*.worker.ts');

const commonPlugins = [
  replace({
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    preventAssignment: true,
  }),
  worker(),
  typescript({
    tsconfig: './tsconfig.json',
    clean: true,
    useTsconfigDeclarationDir: true
  }),
  resolve({
    extensions: ['.ts', '.js'],
    browser: true,
    preferBuiltins: false,
    moduleDirectories: ['node_modules']
  }),
  commonjs(),

  terser({
    keep_fnames: true,
    keep_classnames: true
  }),
  livereload('dist/browser')
];

export default [
  {
    input,
    output: {
      dir: 'dist/browser',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js',
    },
    plugins: [
      cleandir('dist'),
      ...commonPlugins
      // copy({
      //   targets: [
      //     { src: 'src/workers/*.worker.ts', dest: 'dist/browser/workers', rename: (name) => name.replace('.ts', '.js') }
      //   ]
      // }),
    ]
  }
  // {
  //   input: workers,
  //   output: {
  //     dir: 'dist/workers',
  //     format: 'esm',
  //     sourcemap: true,
  //     entryFileNames: '[name].js',
  //   },
  //   plugins: [
  //     ...commonPlugins,
      
  //   ],
  //   watch: {
  //     exclude: 'node_modules/**',
  //     clearScreen: false
  //   }
  // }
];
