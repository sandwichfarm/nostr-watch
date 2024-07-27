const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src', 'index.ts'), // Ensures absolute path resolution
  output: {
    path: path.resolve(__dirname, 'dist'), // Explicitly resolves to your project's dist directory
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.json$/,
        type: 'json' // Handles JSON files correctly
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json']
  }
};
