import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { clean } from 'esbuild-plugin-clean';
import alias from 'esbuild-plugin-alias';
import workerPlugin from '@chialab/esbuild-plugin-worker';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { polyfillNode } from "esbuild-plugin-polyfill-node";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = process.env.NODE_ENV === 'production';

export async function buildWithWatch() {
  const commonPlugins = [
    clean({ patterns: ['./dist'] }),
    alias({
      entries: [
        { find: 'node:module', replacement: path.resolve(__dirname, 'src/shims/node-module-shim.js') },
      ],
    }),
    polyfillNode({}),
    esbuildPluginTsc({ force: true })
  ];

  const browserBuildOptions = {
    entryPoints: [
      path.resolve(__dirname, 'src/index.ts'),
      path.resolve(__dirname, 'src/workers/nostrsqlite.worker.ts')
    ],
    outdir: 'dist/browser',
    bundle: true,
    platform: 'browser',
    target: 'esnext',
    format: 'esm',
    sourcemap: true,
    minify: production,
    plugins: commonPlugins.concat([
      // workerPlugin({
      //   // output: 'workers',
      // }),
    ]),
    external: ['@nostrwatch/worker-relay'],
    loader: {
      '.ts': 'ts',
      '.js': 'js',
      '.wasm': 'file',
    },
    resolveExtensions: ['.ts'],
  };

  try {
    const browserContext = await esbuild.context(browserBuildOptions);
    await browserContext.watch();
    console.log('Watching for changes...');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Clean up on exit
process.on('SIGINT', () => {
  console.log('Terminating process...');
  process.exit(0);
});

buildWithWatch();
