import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import * as glob from 'glob';
import { clean } from 'esbuild-plugin-clean';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { livereloadPlugin } from '@jgoz/esbuild-plugin-livereload';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import getPort from 'get-port'; 
import alias from 'esbuild-plugin-alias';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = process.env.NODE_ENV === 'production';

const input = glob.sync('src/**/index.ts');
const workers = glob.sync('src/**/*.worker.ts');

export async function buildWithWatch() {
  const watch = !production;

  const livereloadPort = await getPort({ port: 53100 });

  const commonPlugins = [
    clean({
      patterns: ['./dist'],
    }),
    alias({
      entries: [
        { find: 'node:module', replacement: path.resolve(__dirname, 'src/shims/node-module-shim.js') },
      ],
    }),
    esbuildPluginTsc({
      force: true,
    }),
    polyfillNode({
      polyfills: {
        module: true,
        path: true,
        'fs/promises': false
      },
    }),
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({
      process: true,
      buffer: true,
    }),
    inlineWorkerPlugin(),
    livereloadPlugin({
        port: livereloadPort,
        watch: 'dist',
      }),
  ].filter(Boolean);

  const mainBuildOptions = {
    entryPoints: input,
    outdir: 'dist/browser',
    bundle: true,
    platform: 'browser',
    conditions: ['browser'],
    format: 'esm',
    sourcemap: true,
    minify: production,
    splitting: true,
    target: ['esnext'],
    plugins: commonPlugins,
    external: ['@nostrwatch/utils', '@nostrwatch/logger', 'node:module'],
    loader: {
      '.ts': 'ts',
      '.js': 'js',
    },
  };

  try {
    if (watch) {
      const mainContext = await esbuild.context(mainBuildOptions);
      await mainContext.watch();
      //console.log(`Watching for changes... Livereload on port ${livereloadPort}`);
    } else {
      await esbuild.build(mainBuildOptions);
      //console.log('Build completed.');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildWithWatch();
