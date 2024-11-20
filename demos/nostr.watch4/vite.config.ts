import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  optimizeDeps: {
    exclude: [
      "@nostrwatch/worker-relay",
      "@nostrwatch/nip66-cacheadapter-nostrsqlite"
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
    },
    fs: {
      strict: false,
    },
  },
  plugins: [
    sveltekit(),
    // compression({
    //   filter: /\.(wasm)$/ // Apply compression only to .wasm files
    // }),
    {
      name: 'worker-headers',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requestUrl = (req as { url?: string }).url;
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
