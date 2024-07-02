import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'docs'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      exclude: ['node_modules', 'dist', 'docs/**/*'],
      reporter: ['text', 'json', 'html'],
    },
  },
});
