const path = require('path')

module.exports = {
  mode: 'development',
  entry: './main.js',
  output: {
    path: __dirname,
    filename: 'out.js'
  },
  experiments: {asyncWebAssembly: true},
  resolve: {
    alias: {
      stream: 'readable-stream'
    },
    fallback: {
      buffer: 'buffer/index.js',
      stream: 'readable-stream/readable.js',
      crypto: false
    }
  }
}
