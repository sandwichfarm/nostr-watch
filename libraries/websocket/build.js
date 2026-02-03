/**
 * build.js
 * 
 * Run with:
 *   node build.js           (single build)
 *   node build.js --watch   (watch mode)
 */

import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fsp } from 'fs';

import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatchMode = process.argv.includes('--watch');

async function cleanDist() {
  const distDir = path.resolve(__dirname, 'dist');
  const distBrowserPath = path.join(distDir, 'web');
  const distWorkerPath  = path.join(distDir, 'worker');
  const distServerPath  = path.join(distDir, 'server');
  const distDenoPath    = path.join(distDir, 'deno');

  try {
    for (const dirPath of [distBrowserPath, distWorkerPath, distServerPath, distDenoPath]) {
      if (fs.existsSync(dirPath)) {
        console.log('Removing:', dirPath);
        await fsp.rm(dirPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    console.error('Error cleaning dist directories:', error);
    throw error;
  }
}

/**
 * Browser Build
 */
const browserConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist/web',
  format: 'esm',
  platform: 'browser',
  sourcemap: false,
  allowOverwrite: true,
  external: ['ws'],
  plugins: [
    polyfillNode({
      globals: {
        process: true,
        Buffer: true,
        global: true
      }
    })
  ]
};

/**
 * Worker Build
 */
const workerConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist/worker',
  format: 'esm',
  platform: 'browser',
  sourcemap: false,
  allowOverwrite: true,
  external: ['ws'],
  plugins: [
    polyfillNode({
      globals: {
        process: false,
        Buffer: false,
        global: false
      }
    })
  ]
};

/**
 * Server Build (Node.js)
 */
const serverConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist/server',
  format: 'esm',
  platform: 'node',
  sourcemap: false,
  allowOverwrite: true,
  plugins: []
};

/**
 * Deno Build (NEW)
 * - Uses platform: "neutral" to avoid Node.js-specific optimizations
 * - Excludes "ws" from being bundled (Deno has native WebSockets)
 */
const denoConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist/deno',
  format: 'esm',
  platform: 'neutral',
  sourcemap: false,
  allowOverwrite: true,
  external: ['ws'],
  plugins: []
};

/**
 * Run all builds
 */
async function buildAll() {
  await cleanDist();

  if (isWatchMode) {
    const browserContext = await esbuild.context(browserConfig);
    const workerContext  = await esbuild.context(workerConfig);
    const serverContext  = await esbuild.context(serverConfig);
    const denoContext    = await esbuild.context(denoConfig);

    await Promise.all([
      browserContext.watch(),
      workerContext.watch(),
      serverContext.watch(),
      denoContext.watch(),
    ]);

    console.log('[build.js] Watching for changes...');
  } else {
    await esbuild.build(browserConfig);
    console.log('[build.js] Browser build complete');

    await esbuild.build(workerConfig);
    console.log('[build.js] Worker build complete');

    await esbuild.build(serverConfig);
    console.log('[build.js] Server build complete');

    await esbuild.build(denoConfig);
    console.log('[build.js] Deno build complete');
  }
}

buildAll().catch(err => {
  console.error('[build.js] Build failed:', err);
  process.exit(1);
});
