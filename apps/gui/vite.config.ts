import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import fs from 'fs';
import fetch from 'node-fetch';
import url from 'url';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  // Plugin to patch 'frozen' -> 'raw' in svelte-speedometer
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
            //console.log('Patched svelte-speedometer: replaced "$state.frozen" with "$state.raw"');
          }
        }
      },
    };
  }

  return {
    build: {
      minify: isProd? 'terser': false, 
      assetsInlineLimit: 0,
      mangle: {
        keep_classnames: /@nostrwatch\/nocap/
      },
    },
    optimizeDeps: {
      exclude: [
        "@nostrwatch/worker-relay",
        "@sqlite.org/sqlite-wasm",
        "@nostrwatch/auditor",
        "@nostrwatch/nocap"
      ],
      esbuildOptions: {
        target: "esnext",
      },
    },
    esbuild: {
      supported: {
        "top-level-await": true,
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      },
      fs: {
        strict: false,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@dist': path.resolve(__dirname, './dist'),
        '@components': path.resolve(__dirname, './src/components'),
      },
    },
    plugins: [
      sveltekit(),
      patchSvelteSpeedometer(), // Add the patch plugin
      {
        name: 'image-proxy-middleware',
        configureServer(server) {
          server.middlewares.use('/images', async (req, res, next) => {
            try {
              const imagePath = req.url;
              if (!imagePath) {
                res.statusCode = 400;
                res.end('Bad Request: Image path is missing.');
                return;
              }

              const remoteUrl = `https://m.primal.net${imagePath}`;
              const response = await fetch(remoteUrl, { method: 'GET', redirect: 'follow' });

              if (!response.ok) {
                res.statusCode = response.status;
                res.end(`Failed to fetch image: ${response.statusText}`);
                return;
              }

              res.setHeader('Access-Control-Allow-Origin', '*');
              const contentType = response.headers.get('content-type') || 'image/jpeg';
              res.setHeader('Content-Type', contentType);
              response.body.pipe(res);
            } catch (error) {
              console.error('Error in image proxy middleware:', error);
              res.statusCode = 500;
              res.end('Internal Server Error');
            }
          });
        },
      },
      isProd
        ? {
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
          }
        : null,
    ].filter(Boolean),
  };
});
