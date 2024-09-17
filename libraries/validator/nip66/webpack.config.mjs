import path from 'path';
import { fileURLToPath } from 'url';

// Needed to get __dirname with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production', // Set the mode to 'production' or 'development'
  entry: './src/index.ts', // Point to the TypeScript source
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'umd',
      name: 'nip11'
    }
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.ya?ml$/,
        use: 'yaml-loader'
      }
    ]
  },
  externals: {
    ajv: 'Ajv',
    yaml: 'YAML',
    fs: 'commonjs fs' // Exclude 'fs' module from the bundle
  }
};
