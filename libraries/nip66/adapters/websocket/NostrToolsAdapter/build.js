import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import * as glob from 'glob';
import { clean } from 'esbuild-plugin-clean';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { livereloadPlugin } from '@jgoz/esbuild-plugin-livereload';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import getPort from 'get-port';
import alias from 'esbuild-plugin-alias';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = process.env.NODE_ENV === 'production';

export async function buildWithWatch() {
  const livereloadPortBrowser = await getPort({ port: [53101, 53102] });
  const livereloadPortNode = await getPort({ port: [53103, 53104] });

  const commonPlugins = [
    clean({ patterns: ['./dist'] }),
    esbuildPluginTsc({ force: true }),
    polyfillNode({
      polyfills: { module: true, path: true, 'fs/promises': false },
    }),
    NodeModulesPolyfillPlugin(),
    NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
    inlineWorkerPlugin({
      external: ['fs', 'path', 'node-localstorage', 'worker_threads'],
    }),
  ];

  const browserPlugins = [
    alias({
      entries: [
        { find: 'node:module', replacement: path.resolve(__dirname, 'src/shims/node-module-shim.js') },
        { find: 'node-localstorage', replacement: path.resolve(__dirname, 'src/shims/empty.js') },
      ],
    }),
    ...commonPlugins,
    livereloadPlugin({
      port: livereloadPortBrowser,
      watch: 'dist/browser',
    }),
  ];

  const nodePlugins = [
    ...commonPlugins,
    livereloadPlugin({
      port: livereloadPortNode,
      watch: 'dist/node',
    }),
  ];

  const browserBuildOptions = {
    entryPoints: ['src/index.ts'],
    external: ['fs', 'path', 'node-localstorage', 'worker_threads'],
    
    outdir: 'dist/browser',
    bundle: true,
    platform: 'browser',
    target: 'esnext',
    format: 'esm',
    sourcemap: true,
    minify: production,
    plugins: browserPlugins,
  };

  const nodeBuildOptions = {
    entryPoints: ['src/index.ts'],
    outdir: 'dist/node',
    bundle: true,
    platform: 'node',
    target: 'node14',
    format: 'cjs',
    sourcemap: true,
    minify: production,
    plugins: nodePlugins,
  };

  try {
    const browserContext = await esbuild.context(browserBuildOptions);
    // const nodeContext = await esbuild.context(nodeBuildOptions);

    await browserContext.watch();
    // await nodeContext.watch();

    console.log('Watching for changes...');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildWithWatch();
