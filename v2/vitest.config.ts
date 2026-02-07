import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@systems': resolve(__dirname, 'src/systems'),
      '@rendering': resolve(__dirname, 'src/rendering'),
      '@data': resolve(__dirname, 'src/data'),
      '@spawners': resolve(__dirname, 'src/spawners'),
    },
  },
  test: {
    globals: true,
  },
});
