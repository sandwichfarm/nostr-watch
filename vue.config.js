const { defineConfig } = require('@vue/cli-service')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const autoprefixer = require('autoprefixer');
const tailwindcss = require('tailwindcss'); 
const path = require('path');

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080
  },
  // css: {
  //   loaderOptions: {
  //     // sass: {
  //     //   data: '@import "./src/styles/main.scss";'
  //     // },
  //     postcss: {
  //       config: () => ({
  //         path: __dirname
  //       })
  //     }
  //   }
  // },
  configureWebpack: {
    resolve: {
      fallback: {
        "zlib": require.resolve("browserify-zlib"),
        "stream": require.resolve("stream-browserify"),

      }
    },
    module: {
      rules: [
        {
          test: /\.scss$/,
          use: [
            'vue-style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  config: path.resolve(__dirname, './postcss.config.js')
                }
              }
            },
            // 'sass-loader'
          ]
        }
      ]
    }
  },
  chainWebpack: config => {
    config.plugins.delete('prefetch')
    config.plugins.delete('preload')
  
    config.module
      .rule('scss')
        .test(/\.scss$/)
        .use('vue-style-loader')
          .loader('vue-style-loader')
          .end()
        .use('css-loader')
          .loader('css-loader')
          .end()
        .use('postcss-loader')
          .loader('postcss-loader')
          .options({
            postcssOptions: {
              config: {
                path: __dirname
              }
            }
          })
          .end()
        .use('sass-loader')
          .loader('sass-loader')
          .end()
    
    config.module
      .rule('yaml')
        .test(/\.ya?ml?$/)
        .use('yaml-loader')
          .loader('yaml-loader')
  }
})