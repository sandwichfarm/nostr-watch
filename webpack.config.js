const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: './main.js',
  output: {
    path: `${__dirname}/dist`,
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
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html'
    })
  ],
}
