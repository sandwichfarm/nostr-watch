const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

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
    new NodePolyfillPlugin()
  ],
  resolve: {
    extensions: ['.ts', '.js']
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
