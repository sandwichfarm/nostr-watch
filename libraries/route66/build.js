import esbuild from 'esbuild';
import alias from 'esbuild-plugin-alias';
import clean from 'esbuild-plugin-clean';

// Common plugins
const plugins = [
  clean({ patterns: ['./dist'] }),
  alias({
    '@adapters': './adapters',
    '@core': './src/core',
    '@base': './src',
    '@models': './src/models',
    '@interfaces': './src/interfaces',
    '@services': './src/services',
    '@workers': './src/workers',
  }),
];

// Build configurations
const buildConfigs = [
  // Browser build
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outdir: 'dist/browser',
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    external: ['@nostrwatch/route66', '@nostrwatch/utils'],
    plugins,
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    minify: true,
  },
  // Server build
  {
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: 'dist/server',
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    external: ['@nostrwatch/route66', '@nostrwatch/utils'],
    plugins,
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    minify: true,
  },
];

// Build process
(async () => {
  try {
    await Promise.all(
      buildConfigs.map((config) => esbuild.build(config))
    );
    ////console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
