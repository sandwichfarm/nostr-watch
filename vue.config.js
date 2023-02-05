const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin")
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const config = {
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
    mode: process.env.NODE_ENV,
    // mode: 'production',
    // entry: {
    //   relaysFind: ['@/components/relays/pages/RelaysFind.vue'],
    //   relaysStatistics: ['@/components/relays/pages/RelaysStatistics.vue'],
    //   relaysSingle: ['@/components/relays/pages/RelaysSingle.vue'],
    // },
    plugins: [
      new NodePolyfillPlugin(),
    ],
    optimization: {
      usedExports: true,
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
}

if(process.env.NODE_ENV == 'production') {
  config.configureWebpack.plugins.push(new CompressionPlugin)
}
else {
  config.configureWebpack.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = defineConfig(config)