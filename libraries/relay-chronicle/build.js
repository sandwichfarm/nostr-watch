#!/usr/bin/env node

/**
 * Build script for relay-chronicle
 *
 * Creates multiple bundles:
 * - ESM for modern bundlers and Node.js
 * - CJS for Node.js compatibility
 * - Browser bundle (minified)
 */

import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const sharedConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: 'es2020',
  external: [],
  banner: {
    js: `/**
 * ${pkg.name} v${pkg.version}
 * ${pkg.description}
 * @license ${pkg.license}
 */`,
  },
};

async function build() {
  try {
    console.log('Building relay-chronicle...\n');

    // ESM build (for modern bundlers and Node.js)
    console.log('→ Building ESM bundle...');
    await esbuild.build({
      ...sharedConfig,
      format: 'esm',
      outfile: 'dist/index.js',
      platform: 'neutral',
    });
    console.log('✓ ESM bundle created: dist/index.js\n');

    // CJS build (for Node.js require())
    console.log('→ Building CommonJS bundle...');
    await esbuild.build({
      ...sharedConfig,
      format: 'cjs',
      outfile: 'dist/index.cjs',
      platform: 'node',
    });
    console.log('✓ CommonJS bundle created: dist/index.cjs\n');

    // Browser build (minified)
    console.log('→ Building browser bundle...');
    await esbuild.build({
      ...sharedConfig,
      format: 'esm',
      outfile: 'dist/browser.js',
      platform: 'browser',
      minify: true,
    });
    console.log('✓ Browser bundle created: dist/browser.js\n');

    console.log('✓ All bundles built successfully!');
    console.log('\nNext: Run `npm run build:types` to generate TypeScript declarations');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
