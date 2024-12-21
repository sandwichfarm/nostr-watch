import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

function patchSvelteSpeedometer() {
  return {
    name: 'patch-svelte-speedometer',
    enforce: 'pre',
    buildStart() {
      const modulePath = path.resolve(
        'node_modules/svelte-speedometer/dist/Speedometer.svelte'
      );

      if (fs.existsSync(modulePath)) {
        let code = fs.readFileSync(modulePath, 'utf-8');
        if (code.includes('$state.frozen')) {
          code = code.replace(/\$state\.frozen/g, '$state.raw');
          fs.writeFileSync(modulePath, code, 'utf-8');
          console.log('Patched svelte-speedometer: replaced "$state.frozen" with "$state.raw"');
        }
      }
    },
  };
}

export default defineConfig({
  resolve: {
    mainFields: ['module', 'main'],
    preserveSymlinks: false,
  },
  worker: {
    plugins: [
      sveltekit(),
      patchSvelteSpeedometer()
    ]
  },
  build: {
    minify: 'terser', 
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
    exclude: [
      'svelte-speedometer'
    ]
  },
  plugins: [
    sveltekit(),
    patchSvelteSpeedometer(),
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
