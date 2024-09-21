// adapters/nostr-tools/webpack.config.js
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

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
  optimization: {
    usedExports: false,
    minimize: false,
  },
};

const browserConfig = {
  ...baseConfig,
  plugins: [new NodePolyfillPlugin()],
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist', 'browser'),
    filename: 'index.js',
    library: {
      name: 'WsAdapter',
      type: 'umd',
    },
    globalObject: 'this',
  },
  externals: {
    'nostr-tools': 'nostr-tools',
  },
};

const nodeConfig = {
  ...baseConfig,
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist', 'node'),
    filename: 'index.js',
    library: {
      type: 'commonjs2',
    },
  },
  externals: {
    'nostr-tools': 'nostr-tools',
  },
};

module.exports = [browserConfig, nodeConfig];
