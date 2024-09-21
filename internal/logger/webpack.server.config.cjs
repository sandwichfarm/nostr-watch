const path = require('path');

module.exports = {
  mode: 'development',
  target: 'node',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/server'),
    filename: 'index.js',
    libraryTarget: 'module',
    chunkFormat: 'module'
  },
  experiments: {
    outputModule: true
  },
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
            configFile: 'tsconfig.server.json'
          }
        },
        exclude: /node_modules/,
      }
    ]
  },
  devtool: 'source-map'
};
