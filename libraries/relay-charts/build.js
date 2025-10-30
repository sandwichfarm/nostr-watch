#!/usr/bin/env node

import * as esbuild from 'esbuild';
import { readdir } from 'fs/promises';
import { join } from 'path';

const sharedConfig = {
  bundle: true,
  sourcemap: true,
  minify: false,
  target: 'es2020',
  external: [
    '@nostrwatch/relay-chronicle',
    'chart.js',
    'echarts',
    'recharts',
    'react',
  ],
};

async function build() {
  console.log('Building @nostrwatch/relay-chronicle-charts...\n');

  // Build main entry point (ESM and CJS)
  console.log('Building main entry point...');
  await esbuild.build({
    ...sharedConfig,
    entryPoints: ['src/index.ts'],
    format: 'esm',
    outfile: 'dist/index.js',
    platform: 'neutral',
  });

  await esbuild.build({
    ...sharedConfig,
    entryPoints: ['src/index.ts'],
    format: 'cjs',
    outfile: 'dist/index.cjs',
    platform: 'node',
  });

  console.log('✓ Main entry point built\n');

  // Build each adapter separately for tree-shaking
  const adapters = ['chartjs', 'echarts', 'recharts'];

  for (const adapter of adapters) {
    console.log(`Building ${adapter} adapter...`);

    // ESM build
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [`src/adapters/${adapter}.ts`],
      format: 'esm',
      outfile: `dist/adapters/${adapter}.js`,
      platform: 'neutral',
    });

    // CJS build
    await esbuild.build({
      ...sharedConfig,
      entryPoints: [`src/adapters/${adapter}.ts`],
      format: 'cjs',
      outfile: `dist/adapters/${adapter}.cjs`,
      platform: 'node',
    });

    console.log(`✓ ${adapter} adapter built`);
  }

  console.log('\n✅ Build complete!');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
