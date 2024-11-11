import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ["@surrealdb/wasm"],
    esbuildOptions: {
        target: "esnext",
    },
  },
  esbuild: {
    supported: {
        "top-level-await": true
    },
  },
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        '/Users/sandwich/Develop/nostr-watch/libraries/nip66/adapters/cache/SurrealDbAdapter/node_modules/@surrealdb/wasm/dist/surreal/index_bg.wasm'
      ],
    },
  },
});
