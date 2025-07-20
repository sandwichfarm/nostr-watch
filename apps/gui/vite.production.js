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
        if (chunkOrAsset.type === 'chunk' && fileName.includes('.worker')) {
          console.log('Replacing global in:', fileName);
          chunkOrAsset.code = chunkOrAsset.code.replace(/\bglobal\./g, 'self.');
          chunkOrAsset.code = chunkOrAsset.code.replace(/typeof global/g, 'typeof self');
        }
      }
    },
  };
}

// SPA fallback middleware for preview server
function spaFallbackMiddleware() {
  return {
    name: 'spa-fallback',
    configurePreviewServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          // Skip if it's a file request or vite internal route
          if (req.url?.includes('.') || req.url?.startsWith('/@') || req.url?.startsWith('/_')) {
            return next();
          }
          
          // For all other routes, serve the root index.html
          req.url = '/';
          next();
        });
      };
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Fix relative paths in preview mode
        return html.replace(/(\s)(href|src)="\.\/(.+?)"/g, '$1$2="/$3"');
      }
    }
  };
}

export default defineConfig({
  mode: "production",
  base: '/',
  server: {
    hmr: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  },
  preview: {
    port: 4173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
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
    plugins: [
      sveltekit(),
      nodePolyfills(),
      globalHack(),
    ]
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      ignoreDynamicRequires: true
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 1
      },
      mangle: {
        reserved: ['$', '$$', '_', '__', 'global', 'process', 'derived', 'writable', 'readable', 'get'],
        keep_classnames: true,
        keep_fnames: true,
        properties: false
      },
      format: {
        comments: false
      }
    },
    sourcemap: false,
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    cssMinify: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // More granular chunking for better caching
            if (id.includes('@sveltejs') || id.includes('svelte')) {
              return 'svelte';
            }
            if (id.includes('nostr-tools') || id.includes('@nostrwatch')) {
              return 'nostr';
            }
            // Let @unovis be code-split naturally when dynamically imported
            // if (id.includes('@unovis')) {
            //   return 'visualization';
            // }
            if (id.includes('dexie') || id.includes('sqlite')) {
              return 'database';
            }
            if (id.includes('bits-ui') || id.includes('lucide')) {
              return 'ui';
            }
            return 'vendor';
          }
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.names?.[0] || assetInfo.name || '';
          if (info.includes('.worker')) {
            return 'workers/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      },
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
  },
  optimizeDeps: {
    include: ['svelte', 'svelte/animate', 'svelte/easing', 'svelte/internal', 'svelte/motion', 'svelte/store', 'svelte/transition'],
    esbuildOptions: {
      target: "es2020",
      supported: { 
        bigint: true,
        'top-level-await': true 
      },
      keepNames: true // Keep function names for Svelte reactivity
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
    spaFallbackMiddleware(),
    sveltekit({
      compilerOptions: {
        dev: false,
        hydratable: true,
        css: 'external'
      }
    }),
    nodePolyfills(),
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      compressionOptions: {
        level: 6,
      },
      filter: /\.(js|css|html|svg|json)$/i,
      threshold: 1024
    }),
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      compressionOptions: {
        level: 11,
      },
      filter: /\.(js|css|html|svg|json)$/i,
      threshold: 1024
    })
  ],
});