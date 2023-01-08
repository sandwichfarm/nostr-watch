// const { VueLoaderPlugin } = require("vue-loader");
// const HtmlWebpackPlugin = require("html-webpack-plugin");
// const path = require("path");
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

// module.exports = {
//   entry: path.join(__dirname, "src/main.js"),
//   devtool: "source-map",
//   module: {
//     rules: [
//       {
//         test: /\.vue$/,
//         loader: "vue-loader",
//       },
//       {
//         test: /\.css$/,
//         use: [
//           "style-loader",
//           {
//             loader: MiniCssExtractPlugin.loader,
//             options: {
//               esModule: false,
//             },
//           },
//           {
//             loader: "css-loader",
//             options: {
//               // 0 => no loaders (default);
//               // 1 => postcss-loader;
//               // 2 => postcss-loader, sass-loader
//               importLoaders: 1,
//             },
//           },
//           "postcss-loader",
//         ],
//       },
//     ],
//   },
//   plugins: [
//     new VueLoaderPlugin(),
//     new HtmlWebpackPlugin({
//       template: path.resolve(__dirname, "public/index.html"),
//     }),
//     new MiniCssExtractPlugin(),
//   ],
//   devServer: {
//     open: true,
//     devMiddleware: {
//       writeToDisk: true,
//     },
//     static: {
//       watch: true,
//     },
//   },
//   optimization: {
//     minimizer: [
//       // For webpack@5 you can use the `...` syntax to extend existing minimizers (i.e. `terser-webpack-plugin`), uncomment the next line
//       "...",
//       new CssMinimizerPlugin(),
//     ],
//   },
// };