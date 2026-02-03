import path from 'path'
import { fileURLToPath } from 'url'
import typescript from 'rollup-plugin-typescript2'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import alias from '@rollup/plugin-alias'
import replace from '@rollup/plugin-replace'
import { terser } from 'rollup-plugin-terser'
import livereload from 'rollup-plugin-livereload'
import webWorkerLoader from 'rollup-plugin-web-worker-loader'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import offMainThread from '@surma/rollup-plugin-off-main-thread'


import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const glob = require('glob');

/**
 * disallow circular deps
 * @see https://rollupjs.org/configuration-options/#onwarn
 * @param {*} warning
 * @param {*} warn
 */
function onwarn(warning, warn) {
  if (
    warning.plugin === 'off-main-thread' &&
    warning.message.includes('Very few browsers support ES modules in Workers')
  ) {
    console.warn('Ignoring known warning from off-main-thread plugin:', warning.message);
    return;
  }

  if (
    (warning.code === 'PLUGIN_WARNING' &&
      !warning.message.includes('sourcemap')) ||
    warning.code === 'CIRCULAR_DEPENDENCY'
  ) {
    console.error(warning);
    if (process.env.CI) {
      throw Object.assign(new Error(), warning);
    }
  }

  warn(warning);
}


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const production = !process.env.ROLLUP_WATCH

const input = glob.sync('src/**/index.ts')

const aliases = alias({
  entries: [
    { find: '@adapters', replacement: path.resolve(__dirname, 'adapters') },
    { find: '@core', replacement: path.resolve(__dirname, 'src/core') },
    { find: '@base', replacement: path.resolve(__dirname, 'src') },
    { find: '@models', replacement: path.resolve(__dirname, 'src/models') },
    { find: '@interfaces', replacement: path.resolve(__dirname, 'src/interfaces') },
    { find: '@services', replacement: path.resolve(__dirname, 'src/services') },
    { find: '@workers', replacement: path.resolve(__dirname, 'src/workers') }
  ]
})

const commonPlugins = [
  aliases,
  replace({
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    preventAssignment: true,
  }),
  typescript({
    tsconfig: './tsconfig.json',
    clean: true,
    useTsconfigDeclarationDir: true,
  }),
  nodePolyfills(),
  resolve({
    extensions: ['.ts', '.tsx', '.js', '.json', '.wasm'],
    preferBuiltins: false,
    browser: true,
  }),
  commonjs({
    include: /node_modules/, 
    requireReturnsDefault: 'auto'
  }),
  production && terser({
    keep_fnames: true,
    keep_classnames: true
  }),
];

const browserPlugins = [
  offMainThread(),
  webWorkerLoader({
    inline: false, 
    targetPlatform: 'browser',
  }),
  !production &&
    livereload({
      watch: "dist/browser",
      port: 35729,
    }),
]

const serverPlugins = [];

export default [
  {
    treeshake: true,
    input,
    output: {
      dir: 'dist/browser',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js'
    },
    external: [
      '@nostrwatch/route66',
      '@nostrwatch/relay-chronicle',
      '@base/*',
      '@models/*',
    ],
    plugins: [
      ...commonPlugins,
      ...browserPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    },
    onwarn
  },
  {
    treeshake: true,
    input,
    output: {
      dir: 'dist/browser',
      format: 'amd',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].amd.js',
      exports: 'auto'
    },
    external: ['@nostrwatch/relay-chronicle'],
    plugins: [
      ...commonPlugins,
      ...browserPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    },
    onwarn
  },
  {
    treeshake: true,
    input,
    output: {
      dir: 'dist/server',
      format: 'cjs',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].cjs.js',
      exports: 'auto'
    },
    external: ['@nostrwatch/relay-chronicle'],
    plugins: [
      ...commonPlugins,
      ...serverPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    },
    onwarn
  },
  {
    treeshake: true,
    input,
    output: {
      dir: 'dist/server',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js'
    },
    external: ['@nostrwatch/relay-chronicle'],
    plugins: [
      ...commonPlugins,
      ...serverPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    },
    onwarn
  }
]
