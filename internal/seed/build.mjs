import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';

// Make sure the dist directory exists
if (!existsSync('./dist')) {
  mkdirSync('./dist', { recursive: true });
}

// Make sure the dist/utils directory exists
if (!existsSync('./dist/utils')) {
  mkdirSync('./dist/utils', { recursive: true });
}

try {
  // Build the main entry point
  await build({
    entryPoints: ['./src/index.ts'],
    outfile: './dist/index.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    sourcemap: true,
    external: [
      '@nostrwatch/db',
      '@nostrwatch/utils',
      '@nostrwatch/nostrings',
      'better-sqlite3',
      'js-yaml',
      'nostr-fetch'
    ],
  });

  // Build utils separately
  await build({
    entryPoints: ['./src/utils/logger.ts'],
    outfile: './dist/utils/logger.js',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    sourcemap: true,
  });

  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error);
  // Use Node.js global process
  process.exit(1);
} 