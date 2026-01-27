import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('esbuild').BuildOptions} */
const baseConfig = {
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/index.js'),
  platform: 'node',
  target: 'node16',
  format: 'esm',
  sourcemap: isDev,
  minify: !isDev,
  external: [
    '@nostr-fetch/adapter-nostr-tools',
    'bullmq',
    'dotenv',
    'ioredis',
    'javascript-time-ago',
    'lmdb',
    'nostr-fetch',
    'nostr-tools',
    'p-queue',
    'promise-deferred',
    'ramda',
    'websocket-polyfill'
  ],
  // Ignore type errors during build
  tsconfig: resolve(__dirname, 'tsconfig.build.json'),
};

// Build for production
if (process.argv.includes('--build')) {
  esbuild.build(baseConfig).catch(() => process.exit(1));
}

// Watch mode for development
if (process.argv.includes('--watch')) {
  const context = await esbuild.context(baseConfig);
  await context.watch();
  console.log('Watching for changes...');
} 