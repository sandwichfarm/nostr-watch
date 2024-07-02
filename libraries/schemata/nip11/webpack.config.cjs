const path = require('path');

module.exports = {
  mode: 'development',  // Or 'production' based on your needs
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.yaml$/,
        type: 'json',  // Ensures the YAML is imported as a JSON object
        use: 'yaml-loader'
      }
    ]
  }
};