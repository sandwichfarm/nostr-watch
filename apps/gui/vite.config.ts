import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    exclude: [
      "@nostrwatch/worker-relay",
      // "@nostrwatch/nip66-cacheadapter-nostrsqlite",
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
      // '@nostrwatch/nip66-cacheadapter-nostrsqlite': path.resolve(__dirname, 'node_modules/@nostrwatch/nip66-cacheadapter-nostrsqlite/dist/browser'),
    },
  },
  plugins: [
    sveltekit(),
    // Uncomment if you need to compress .wasm files
    // compression({
    //   filter: /\.(wasm)$/
    // }),
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
