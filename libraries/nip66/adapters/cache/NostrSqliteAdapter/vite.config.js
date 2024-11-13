import { defineConfig } from 'vite';
import path from 'path';
import * as glob from 'glob';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import getPort from 'get-port';

const production = process.env.NODE_ENV === 'production';

export default defineConfig(async () => {
  const livereloadPort = await getPort({ port: 53100 });
  const inputFiles = glob.sync('src/**/index.ts');

  return {
    plugins: [
      nodePolyfills({
        polyfills: { module: true },
      }),
      !production &&
        require('@vitejs/plugin-react-refresh')({
          port: livereloadPort,
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        src: path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist/browser',
      sourcemap: true,
      minify: production,
      rollupOptions: {
        input: inputFiles,
        output: {
          format: 'esm',
          interop: 'esModule',
          entryFileNames: '[name].js',
        },
        external: ["@surrealdb/wasm"],
      },
      target: 'esnext',
      emptyOutDir: true,
    },
    worker: {
      format: 'es',
    },
    server: {
      watch: {
        usePolling: true,
      },
    },
    optimizeDeps: {
      exclude: ["@surrealdb/wasm"],
      esbuildOptions: {
        target: "esnext",
      },
    },
    esbuild: {
      supported: {
        "top-level-await": true,
      },
    },
  };
});
