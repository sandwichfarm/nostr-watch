import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';
import glob from 'glob';
import { clean } from 'esbuild-plugin-clean';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import { livereloadPlugin } from '@jgoz/esbuild-plugin-livereload';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import getPort from 'get-port'; // To dynamically find an available port

// Path setup
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const production = process.env.NODE_ENV === 'production';

// Input files
const input = glob.sync('src/**/index.ts');
// const workers = glob.sync('src/**/*.worker.ts');

// Function to handle building with optional watching
export async function buildWithWatch() {
  const watch = !production;

  // Dynamically find an available port
  const livereloadPort = await getPort({ port: 53100 }); // Start at 53100 but find next available if occupied

  // Common plugins
  const commonPlugins = [
    clean({
      patterns: ['./dist'],
    }),
    esbuildPluginTsc({
      force: true,
    }),
    polyfillNode({
      polyfills: {
        module: true
      },
    }),
    inlineWorkerPlugin(),
    !production &&
      livereloadPlugin({
        port: livereloadPort,
        watch: 'dist',
      }),
  ].filter(Boolean);

  // Main build options
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
    loader: {
      '.ts': 'ts',
      '.js': 'js',
    },
  };

  try {
    if (watch) {
      // Using context for watch mode
      const mainContext = await esbuild.context(mainBuildOptions);
      await mainContext.watch();
      //console.log(`Watching for changes... Livereload on port ${livereloadPort}`);
    } else {
      // Regular build for production
      await esbuild.build(mainBuildOptions);
      //console.log('Build completed.');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildWithWatch();
