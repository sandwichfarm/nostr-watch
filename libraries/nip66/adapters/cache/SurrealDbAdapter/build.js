import esbuild from 'esbuild';
import * as glob from 'glob';
import { clean } from 'esbuild-plugin-clean';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import { livereloadPlugin } from '@jgoz/esbuild-plugin-livereload';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import getPort from 'get-port';
import { copy } from 'esbuild-plugin-copy';

const production = process.env.NODE_ENV === 'production';

const input = glob.sync('src/**/index.ts');

export async function buildWithWatch() {
  const watch = !production;

  const livereloadPort = await getPort({ port: 53100 });

  const commonPlugins = [
    clean({
      patterns: ['./dist'],
    }),
    copy({
      resolveFrom: '.',
      assets: {
        from: ['./node_modules/@surrealdb/wasm/dist/surreal/index_bg.wasm'],
        to: ['./dist/browser/index_bg.wasm'],
      },
      watch: true,
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

  const mainBuildOptions = {
    entryPoints: input,
    outdir: 'dist/browser',
    bundle: true,
    platform: 'browser',
    conditions: ['browser'],
    format: 'esm',
    sourcemap: true,
    minify: false,
    splitting: true,
    target: ['esnext'],
    plugins: commonPlugins,
    // external: ["@surrealdb/wasm"],
    loader: {
      '.ts': 'ts',
      '.js': 'js',
      '.wasm': 'file'
    },
  };

  try {
    if (watch) {
      const mainContext = await esbuild.context(mainBuildOptions);
      await mainContext.watch();
    } else {
      await esbuild.build(mainBuildOptions);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildWithWatch();
