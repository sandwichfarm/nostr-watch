const path = require('path');
const nodeExternals = require('webpack-node-externals');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const TerserPlugin = require('terser-webpack-plugin');

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
        filename: 'bundle.[name].js',
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
      plugins: [
        new NodePolyfillPlugin()
      ],
      optimization: {
        splitChunks: {
          chunks: 'all',  // Split all types of chunks
          minSize: 20000,
          maxSize: 240000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          automaticNameDelimiter: '~',
          cacheGroups: {
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name(module, chunks, cacheGroupKey) {
                const moduleFileName = module.identifier().split('/').reduceRight(item => item);
                return `${cacheGroupKey}-${moduleFileName}`;
              },
              priority: -10,
            },
          },
        },
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
      externals: [nodeExternals()],
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
      externals: [nodeExternals()],
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
