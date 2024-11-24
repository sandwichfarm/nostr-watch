import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
  resolve: {
    mainFields: ['module', 'main'],
    preserveSymlinks: false,
  },
  worker: {
    plugins: [
      sveltekit()
    ]
  },
  build: {
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
            console.log('Build completed. Check output in the dist directory.');
          },
        }
      ]
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  plugins: [
    sveltekit(),
    {
      name: 'worker-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requestUrl = req.url;
          if (!requestUrl?.includes('livereload.js')) {
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          }
          next();
        });
      },
    },
  ],
});
