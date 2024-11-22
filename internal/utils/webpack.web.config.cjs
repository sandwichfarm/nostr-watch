  const path = require('path');
  const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
  const webpack = require('webpack');

  module.exports = {
    mode: 'development',
    target: 'web',
    entry: './src/index.ts',
    output: {
      path: path.resolve(__dirname, 'dist/web'),
      filename: 'bundle.js',
      publicPath: '/',
      libraryTarget: 'module'
    },
    experiments: {
      outputModule: true 
    },
    plugins: [
      // new webpack.IgnorePlugin({
      //   resourceRegExp: /^node:(url|module)$/, 
      // }),
      // new NodePolyfillPlugin()
    ],
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        "node:module": "module",
      },
      fallback: {
        "node:module": require.resolve("module"),
        "os": false,
        "fs": false
      },
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
    },
    devtool: 'source-map'
  };
