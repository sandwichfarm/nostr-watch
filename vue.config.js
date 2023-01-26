const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
// const CompressionPlugin = require("compression-webpack-plugin")
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = defineConfig({
  transpileDependencies: true,
  
  devServer: {
    port: 8080,
    // https: true
  },
  configureWebpack: {
    // watch: true,
    output: {
      filename: '[name].[hash].bundle.js'
    },
    experiments: {
      topLevelAwait: true
    },
    plugins: [
      new NodePolyfillPlugin(),
        // new CompressionPlugin({
        //   test: /\.js(\?.*)?$/i,
        // }),
      // new BundleAnalyzerPlugin()
    ],
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
    resolve: {
      fallback: {
        "fs": false,
        "tls": false,
        "net": false,
        "utf-8-validate": false,
        "bufferutil": false,
      }
    },
  },
  chainWebpack: config => {
    config.module
      .rule('yaml')
        .test(/\.ya?ml?$/)
        .use('yaml-loader')
          .loader('yaml-loader')
  }
})