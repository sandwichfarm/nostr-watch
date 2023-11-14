import { defineConfig } from 'vitest/config';

export default defineConfig({
  testMatch: ['<rootDir>/src/**/*.test.js'],
  test: {
    exclude: [
      '**/node_modules/**', // Exclude all files in node_modules
      '**/*/node_modules/**', // Exclude node_modules in all subdirectories
      '**/packages/logger'
    ],
  },
}); 