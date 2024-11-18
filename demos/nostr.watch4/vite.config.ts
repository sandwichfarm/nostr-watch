import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ["@nostrwatch/worker-relay", "@nostrwatch/nip66-cacheadapter-nostrsqlite"], 
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
        '*'
      ],
    },
  },
});
