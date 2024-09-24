
const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  stats: 'minimal', 
  devtool: false,
  infrastructureLogging: {
    level: 'warn',
  },
  target: 'web',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/web'),
    filename: 'bundle.js',
    publicPath: '/',
    libraryTarget: 'umd',
  },
  experiments: {
    outputModule: true 
  },
  plugins: [
    new NodePolyfillPlugin(),
    new webpack.IgnorePlugin({
      resourceRegExp: /^node:(url|module)$/,  // Ignore node:url and node:module imports
    }),
    new webpack.DefinePlugin({
      'process.env.IP_API_KEY': JSON.stringify(process.env.IP_API_KEY || '')
    })
  ],
  resolve: {
    extensions: ['.ts', '.js'],
    fallback: {
      "url": false, 
      "module": false
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.web.json'
          }
        },
        exclude: /node_modules/,
      }
    ]
  }
};
