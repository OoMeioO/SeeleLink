import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.cjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['electron/**/*.cjs'],
      exclude: ['node_modules/**', 'dist/**'],
    },
    testTimeout: 10000,
  },
});
