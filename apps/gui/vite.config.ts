import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import fetch from 'node-fetch';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    build: {
      assetsInlineLimit: 0,
    },
    optimizeDeps: {
      exclude: [
        "@nostrwatch/worker-relay",
        "@sqlite.org/sqlite-wasm"
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

              const response = await fetch(remoteUrl, {
                method: 'GET',
                headers: {
                },
                redirect: 'follow',
              });

              if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
                const finalUrl = response.headers.get('location');
                const finalResponse = await fetch(finalUrl, {
                  method: 'GET',
                  headers: {
                  },
                  redirect: 'follow',
                });

                if (!finalResponse.ok) {
                  res.statusCode = finalResponse.status;
                  res.end(`Failed to fetch image: ${finalResponse.statusText}`);
                  return;
                }

                res.setHeader('Access-Control-Allow-Origin', '*');
                const contentType = finalResponse.headers.get('content-type') || 'image/jpeg';
                res.setHeader('Content-Type', contentType);

                finalResponse.body.pipe(res);
                return;
              }

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
