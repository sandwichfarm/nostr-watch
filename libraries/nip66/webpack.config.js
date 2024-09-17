const path = require('path');
const nodeExternals = require('webpack-node-externals');

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
        library: {
          name: 'NIP66Library',
          type: 'umd',
        },
        clean: true,
      },
      resolve: {
        extensions: ['.ts', '.tsx', '.js'],
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
    };
  }

  if (env && env.target === 'server') {
    return {
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
