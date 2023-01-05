const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080
  },
  configureWebpack: {
    plugins: [new NodePolyfillPlugin()],
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
    externals: {
      vue: 'Vue'
    }
    resolve: {
      fallback: {
        "fs": false,
        "tls": false,
        "net": false,
        "utf-8-validate": false,
        "bufferutil": false
      }
    },
    experiments: {
      topLevelAwait: true
    },
  },
  chainWebpack: config => {
    config.plugins.delete('prefetch')
    config.plugins.delete('preload')
    
    config.module
      .rule('yaml')
        .test(/\.ya?ml?$/)
        .use('yaml-loader')
          .loader('yaml-loader')
  }
})