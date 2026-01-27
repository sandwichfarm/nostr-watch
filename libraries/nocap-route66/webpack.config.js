const path = require('path');

/**
 * Base configuration shared between both targets.
 */
const baseConfig = {
  entry: './src/index.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    'nostr-tools': 'nostr-tools',
    'nostr-geotags': 'nostr-geotags',
    '@nostrwatch/logger': '@nostrwatch/logger',
  },
  optimization: {
    usedExports: false,
    minimize: false,
  },
};


/**
 * Configuration for the umd build.
 */
const umdConfig = {
  ...baseConfig,
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist', 'umd'),
    filename: 'index.js',
    library: {
      name: '@nostrwatch/nocap-route66',
      type: 'umd',
    },
    globalObject: 'this',
  },
};

/**
 * Configuration for the cjs build.
 */
const cjsConfig = {
  ...baseConfig,
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist', 'cjs'),
    filename: 'index.js',
    library: {
      type: 'commonjs2',
    },
  },
};

module.exports = [umdConfig, cjsConfig];
