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
const watchMode = process.argv.includes('--watch');

export async function build() {
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
    external: ['fs', 'path', 'node-localstorage', 'worker_threads', '@nostrwatch/nip66'],
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
    external: ['@nostrwatch/nip66'],
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
    if (watchMode) {
      ////console.log('Watch mode enabled...');
      const browserContext = await esbuild.context(browserBuildOptions);
      await browserContext.watch();
    } else {
      ////console.log('Building...');
      await Promise.all([
        esbuild.build(browserBuildOptions),
        esbuild.build(nodeBuildOptions),
      ]);
      ////console.log('Build completed successfully!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  ////console.log('Terminating process...');
  process.exit(0);
});

build();
