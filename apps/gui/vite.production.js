import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import nodePolyfills from 'rollup-plugin-node-polyfills';

export default defineConfig({
  resolve: {
    mainFields: ['module', 'main'],
    preserveSymlinks: false,
  },
  worker: {
    plugins: [
      sveltekit(),
      nodePolyfills({ })
    ]
  },
  build: {
    minify: "terser", 
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.worker.js')) {
            return 'workers/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      },
      plugins: [
        {
          name: 'debug-build',
          writeBundle() {
            ////console.log('Build completed. Check output in the dist directory.');
          },
        }
      ]
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      bundle: true
    },
    exclude: [
      '@nostrwatch/worker-relay',
      "@sqlite.org/sqlite-wasm",
      "@nostrwatch/auditor",
      "@nostrwatch/nocap",
      "promise-deferred"
    ]
  },
  plugins: [
    sveltekit(),
    nodePolyfills()
  ],
});
