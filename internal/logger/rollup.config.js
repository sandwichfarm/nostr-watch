import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import livereload from 'rollup-plugin-livereload';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import nodeResolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const glob = require('glob');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = !process.env.ROLLUP_WATCH;

const input = glob.sync('src/**/index.ts');

console.log('inputs', input);

const parsedTsConfig = ts.parseJsonConfigFileContent(
  ts.readConfigFile(path.resolve(__dirname, 'tsconfig.json'), ts.sys.readFile).config,
  ts.sys,
  __dirname
);

function transpileTypeScript() {
  return {
    name: 'transpile-typescript',
    transform(code, id) {
      if (!/\.[cm]?tsx?$/.test(id) || id.endsWith('.d.ts')) {
        return null;
      }

      const result = ts.transpileModule(code, {
        compilerOptions: {
          ...parsedTsConfig.options,
          declaration: false,
          declarationMap: false,
          emitDeclarationOnly: false,
          noEmit: false,
          outDir: undefined,
          declarationDir: undefined,
          sourceMap: true,
        },
        fileName: id,
        reportDiagnostics: true,
      });

      const errors = result.diagnostics?.filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
      );

      if (errors?.length) {
        this.error(
          ts.formatDiagnosticsWithColorAndContext(errors, {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => __dirname,
            getNewLine: () => '\n',
          })
        );
      }

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}

const commonjsOptions = {
  include: /node_modules/,
  requireReturnsDefault: (id) => {
    if (id.includes('debug')) {
      return true;
    }
    return 'auto';
  },
  transformMixedEsModules: true,
};

const commonPlugins = [
  replace({
    'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
    preventAssignment: true,
  }),
  alias({
    entries: [
      { find: 'fs/promises', replacement: path.resolve(__dirname, 'src/shims/fs-promises.js') },
    ],
  }),
  transpileTypeScript(),
  production &&
    terser({
      keep_fnames: true,
      keep_classnames: true,
    }),
].filter(Boolean);

const serverPlugins = [
  nodeResolve({
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    preferBuiltins: true,
    browser: false,
  }),
  commonjs(commonjsOptions),
  json(),
];

const browserPlugins = [
  alias({
    entries: [
      { find: 'winston', replacement: path.resolve(__dirname, 'src/shims/empty.js') },
      { find: 'debug', replacement: path.resolve(__dirname, 'src/shims/debug.js') },
    ],
  }),
  nodePolyfills({
    include: ['fs', 'path', 'module'],
    sourceMap: true,
  }),
  nodeResolve({
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    preferBuiltins: false,
    browser: true,
    mainFields: ['module', 'main', 'browser'],
  }),
  commonjs({
    include: /node_modules/,
    requireReturnsDefault: 'auto',
  }),
  !production && livereload('dist/browser'),
];

const serverExternal = ['fs/promises', 'node:module', 'winston', 'debug'];
const browserExternal = ['winston', 'debug'];

export default [
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
      exports: 'auto',
    },
    external: serverExternal,
    plugins: [
      ...commonPlugins,
      importMetaAssets(),
      ...serverPlugins,
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false,
    },
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
      entryFileNames: '[name].esm.js',
      exports: 'auto',
    },
    external: serverExternal,
    plugins: [
      ...commonPlugins,
      ...serverPlugins,
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false,
    },
  },
  {
    input,
    output: {
      dir: 'dist/browser',
      format: 'esm',
      sourcemap: true,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].esm.js',
      exports: 'named',
    },
    external: browserExternal,
    plugins: [
      ...commonPlugins,
      ...browserPlugins,
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false,
    },
    treeshake: true,
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
      exports: 'named',
    },
    external: browserExternal,
    plugins: [
      ...commonPlugins,
      ...browserPlugins,
    ],
    watch: {
      exclude: 'node_modules/**',
      clearScreen: false,
    },
  },
];
