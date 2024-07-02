import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    sveltekit(),
    nodePolyfills({
      include: ['crypto']
    }),
  ],
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, 'src'),
        path.resolve(__dirname, 'src/monitors')
      ]
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        format: 'esm'
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
      supported: { 'top-level-await': true }
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        format: 'esm'
      }
    }
  }
});