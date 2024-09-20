const path = require('path');
const nodeExternals = require('webpack-node-externals');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');


const alias = {
  '@adapters': path.resolve(__dirname, 'adapters'),
  '@core': path.resolve(__dirname, 'src/core'),
  '@base': path.resolve(__dirname, 'src'),
  '@models': path.resolve(__dirname, 'src/models'),
  '@interfaces': path.resolve(__dirname, 'src/interfaces'),
  '@services': path.resolve(__dirname, 'src/services'),
  '@workers': path.resolve(__dirname, 'src/workers'),
};

/** @type {import('webpack').Configuration[]} */
const config = (env) => {
  if (env && env.target === 'browser') {
    return {
      name: 'browser',
      target: 'web',
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, 'dist/browser'),
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].js', // Ensure unique chunk filenames
        library: {
          name: '@nostrwatch/nip66',
          type: 'umd',
        },
        clean: true,
      },
      stats: {
        all: false,
        modules: true,
        reasons: true,
        chunks: true,
        chunkModules: true,
        chunkOrigins: true,
      },
      resolve: {
        modules: [
          path.resolve(__dirname, 'node_modules'), // Local node_modules
          path.resolve(__dirname, '../../node_modules'), // Monorepo root node_modules
        ],
        extensions: ['.ts', '.tsx', '.js'],
        alias
      },
      module: {
        rules: [
          {
            test: /\.worker\.ts$/,
            use: [
              {
                loader: 'worker-loader',
                options: {
                  filename: '[name].js',
                },
              },
              'ts-loader',
            ],
          },
          {
            test: /\.ts$/,
            exclude: /\.worker\.ts$/,
            use: 'ts-loader',
          },
        ],
      },
      plugins: [
        new NodePolyfillPlugin(),
        new BundleAnalyzerPlugin({
          analyzerMode: 'static', // Generates a static HTML report
          openAnalyzer: true, // Open the report automatically
        })
      ],
      optimization: {
        splitChunks: {
          chunks: 'all', // Ensure all types of chunks (initial and async) are considered
          minSize: 20000, // Minimum size for a chunk to be generated
          maxSize: 240000, // Maximum size before a chunk is split further
          automaticNameDelimiter: '-', // Delimiter for generated chunk names
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2, // Minimum number of chunks that must share a module before splitting
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
        runtimeChunk: 'single', // Create a single runtime chunk for all chunks
        minimize: true,
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: true, 
                pure_funcs: ['console.log'],
              },
              output: {
                comments: false,
              },
            },
            extractComments: false,
          }),
        ],
      },
      devtool: 'cheap-source-map',
      mode: 'production',
    };
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
          type: 'commonjs2',
        },
        clean: true,
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
            exclude: /node_modules/,
          },
        ],
      },
      plugins: [],
      devtool: 'source-map',
      mode: 'production',
    };
  }

  return [
    {
      name: 'browser',
      target: 'web',
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, 'dist/browser'),
        filename: 'bundle.js',
        library: {
          name: 'NIP66Library',
          type: 'umd',
        },
        clean: true,
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js'],
        alias
      },
      module: {
        rules: [
          {
            test: /\.worker\.ts$/,
            use: [
              {
                loader: 'worker-loader',
                options: {
                  filename: '[name].js',
                },
              },
              'ts-loader',
            ],
          },
          {
            test: /\.ts$/,
            exclude: /\.worker\.ts$/,
            use: 'ts-loader',
          },
        ],
      },
      plugins: [],
      devtool: 'source-map',
      mode: 'production',
    },
    {
      name: 'server',
      target: 'node',
      entry: './src/index.ts',
      output: {
        path: path.resolve(__dirname, 'dist/server'),
        filename: 'bundle.js',
        library: {
          type: 'commonjs2',
        },
        clean: true,
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js'],
      },
      externals: [
        nodeExternals()
      ],
      module: {
        rules: [
          {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      plugins: [],
      devtool: 'source-map',
      mode: 'production',
    },
  ];
};

module.exports = config;
