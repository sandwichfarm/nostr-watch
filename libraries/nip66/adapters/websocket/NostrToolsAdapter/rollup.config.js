import path from 'path';
import { fileURLToPath } from 'url';
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import livereload from 'rollup-plugin-livereload';
import { visualizer } from 'rollup-plugin-visualizer';
import webWorkerLoader from 'rollup-plugin-web-worker-loader';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import offMainThread from '@surma/rollup-plugin-off-main-thread';
import glob from 'glob';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = !process.env.ROLLUP_WATCH;

const input = glob.sync('src/**/index.ts');

//console.log('Rollup is processing the following entry points:', input);

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
});

const commonPluginsServer = [
  peerDepsExternal(),
  resolve({
    extensions: ['.ts', '.tsx', '.js', '.json', '.wasm'],
    preferBuiltins: true,
    browser: false
  }),
  commonjs({
    include: /node_modules/, 
    requireReturnsDefault: 'auto'
  }),
  aliases,
  replace({
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    preventAssignment: true
  }),
  typescript({
    tsconfig: './tsconfig.json',
    clean: true,
    useTsconfigDeclarationDir: true
  }),
  terser()
];

const commonPluginsBrowser = [
  peerDepsExternal(),
  resolve({
    extensions: ['.ts', '.tsx', '.js', '.json', '.wasm'],
    preferBuiltins: false,
    browser: true
  }),
  commonjs({
    include: /node_modules/, 
    requireReturnsDefault: 'auto'
  }),
  aliases,
  replace({
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    preventAssignment: true
  }),
  typescript({
    tsconfig: './tsconfig.json',
    clean: true,
    useTsconfigDeclarationDir: true
  }),
  terser({
    keep_fnames: true,
    keep_classnames: true
  }),
];

const serverPlugins = [
  nodePolyfills()
];

const browserPlugins = [
  offMainThread(),
  webWorkerLoader({
    inline: true,
    format: 'es',
    filename: '[name].js'
  }),
  livereload('dist/browser')
];

export default [
  {
    treeshake: false,
    input,
    output: {
      dir: 'dist/server',
      format: 'cjs',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].cjs',
      exports: 'auto'
    },
    external: ['@nostrwatch/nip66-cacheadapter-dexie', 'dexie'],
    plugins: [
      ...commonPluginsServer,
      ...serverPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    }
  },
  {
    treeshake: false,
    input,
    output: {
      dir: 'dist/server',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js'
    },
    external: ['@nostrwatch/nip66-cacheadapter-dexie', 'dexie'],
    plugins: [
      ...commonPluginsServer,
      ...serverPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    }
  },
  {
    treeshake: false,
    input,
    output: {
      dir: 'dist/browser',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js'
    },
    external: [],
    plugins: [
      ...commonPluginsBrowser,
      ...browserPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    }
  },
  {
    treeshake: false,
    input,
    output: {
      dir: 'dist/browser',
      format: 'amd',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].amd.js',
      exports: 'auto',
      globals: {}
    },
    external: [],
    plugins: [
      ...commonPluginsBrowser,
      ...browserPlugins
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false
    }
  }
];
