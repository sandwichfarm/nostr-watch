import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { clean } from 'esbuild-plugin-clean';
import alias from 'esbuild-plugin-alias';
import esbuildPluginTsc from 'esbuild-plugin-tsc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = process.env.NODE_ENV === 'production';
const watchMode = process.argv.includes('--watch');

const commonPlugins = [
  clean({ patterns: ['./dist'] }),
  alias({
    entries: [
      { find: 'node:module', replacement: path.resolve(__dirname, 'src/shims/node-module-shim.js') },
    ],
  }),
  esbuildPluginTsc({ force: true }),
];

const browserBuildOptions = {
  entryPoints: ['src/index.ts', 'src/workers/nostrsqlite.worker.ts'],
  outdir: 'dist/browser',
  bundle: true,
  platform: 'browser',
  target: 'esnext',
  format: 'esm',
  sourcemap: !production,
  minify: production,
  plugins: commonPlugins,
  external: ['@nostrwatch/worker-relay'],
  loader: {
    '.ts': 'ts',
    '.js': 'js',
    '.wasm': 'file',
  },
  resolveExtensions: ['.ts', '.js'],
};

async function build() {
  try {
    if (watchMode) {
      const context = await esbuild.context(browserBuildOptions);
      await context.watch();
      console.log('🚀 Watching for changes...');
      process.on('SIGINT', async () => {
        console.log('👋 Exiting watch mode...');
        await context.dispose(); // Clean up resources
        process.exit(0);
      });
    } else {
      await esbuild.build(browserBuildOptions);
      console.log('✅ Build completed successfully.');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
