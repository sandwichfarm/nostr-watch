const path = require('path')
const nodeExternals = require('webpack-node-externals')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const alias = {
  '@adapters': path.resolve(__dirname, 'adapters'),
  '@core': path.resolve(__dirname, 'src/core'),
  '@base': path.resolve(__dirname, 'src'),
  '@models': path.resolve(__dirname, 'src/models'),
  '@interfaces': path.resolve(__dirname, 'src/interfaces'),
  '@services': path.resolve(__dirname, 'src/services'),
  '@workers': path.resolve(__dirname, 'src/workers')
}

/** @type {import('webpack').Configuration[]} */
const config = (env) => {
  if (env && env.target === 'browser') {
    return {
      name: 'browser',
      target: 'web',
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, 'dist/browser'),
        filename: 'bundle.js',
        chunkFilename: '[name].[contenthash].js',
        library: {
          name: 'NIP66Library',
          type: 'umd'
        },
        clean: true
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias,
        modules: [
          path.resolve(__dirname, 'node_modules'),
          path.resolve(__dirname, '../../node_modules')
        ],
        fallback: {
          fs: false,
          tls: false,
          net: false,
          path: false,
          zlib: false,
          http: false,
          https: false,
          stream: require.resolve('stream-browserify'),
          // crypto: require.resolve('crypto-browserify')
        }
      },
      module: {
        rules: [
          {
            test: /\.worker\.ts$/,
            use: [
              {
                loader: 'worker-loader',
                options: {
                  filename: '[name].[contenthash].js'
                }
              },
              'ts-loader'
            ]
          },
          {
            test: /\.ts$/,
            exclude: /\.worker\.ts$/,
            use: 'ts-loader'
          }
        ]
      },
      plugins: [
        new NodePolyfillPlugin(),
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html'
        })
      ],
      optimization: {
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 240000,
          automaticNameDelimiter: '-',
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: -10,
              reuseExistingChunk: true
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            }
          }
        },
        // runtimeChunk: 'multiple',
        minimize: true,
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: true,
                pure_funcs: ['//console.log']
              },
              output: {
                comments: false
              }
            },
            extractComments: false
          })
        ]
      },
      devtool: 'cheap-source-map',
      mode: 'production',
      stats: {
        all: false,
        modules: true,
        reasons: true,
        chunks: true,
        chunkModules: true,
        chunkOrigins: true
      }
    }
  }

  if (env && env.target === 'server') {
    return {
      node: {
        __dirname: true
      },
      name: 'server',
      target: 'node',
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, 'dist/server'),
        filename: 'bundle.js',
        library: {
          type: 'commonjs2'
        },
        clean: true
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias
      },
      externals: [
        nodeExternals()
      ],
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/
          }
        ]
      },
      plugins: [],
      devtool: 'source-map',
      mode: 'production'
    }
  }
}

module.exports = config
