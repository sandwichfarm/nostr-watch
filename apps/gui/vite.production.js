import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import viteCompression from 'vite-plugin-compression';

const debug = process.env.DEBUG === 'true';

function globalHack() {
  return {
    name: 'replace-global',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
        console.log('Checking file:', fileName);
        if (chunkOrAsset.type === 'chunk' && fileName.includes('.worker')) {
          console.log('Replacing global in:', fileName);
          chunkOrAsset.code = chunkOrAsset.code.replace(
            /\bglobal\./g,
            'self.'
          );
          chunkOrAsset.code = chunkOrAsset.code.replace(/\bglobal\./g, 'self.');
          chunkOrAsset.code = chunkOrAsset.code.replace(/typeof global/g, 'typeof self');
        }
      }
    },
  };
}

export default defineConfig({
  mode: "production",
  server: {
    hmr: false
  },
  resolve: {
    mainFields: ['module', 'main'],
    preserveSymlinks: false,
  },
  worker: {
    minify: false,
    sourcemap: true,
    format: 'es',
    optimizeDeps: {
      exclude: [  
        '@nostrwatch/nocap', 
        '@nostrwatch/nocap-websocket-adapter-default', 
        '@nostrwatch/websocket' 
      ]
    },
    rollupOptions: {
      inlineDynamicImports: true
    },
    // define: {
    //   global: 'self'
    // },
    plugins: [
      sveltekit(),
      nodePolyfills(),
      globalHack(),
    ]
  },
  build: {
    minify: "terser", 
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.length && assetInfo.names.filter(name => name.endsWith('.worker.js'))) {
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
    nodePolyfills(),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      apply: 'build',
    }),
    // viteCompression({
    //   algorithm: 'gzip',
    //   ext: '.gz',
    //   apply: 'build',
    // }),
  ],
});
