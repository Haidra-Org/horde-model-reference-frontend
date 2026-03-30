/**
 * Vitest configuration for IDE integration (e.g. Vitest VS Code extension).
 *
 * Angular's @angular/build:unit-test builder bypasses this file entirely
 * (it passes `config: false` to vitest). This config exists solely so the
 * Vitest VS Code extension can discover and run tests with the correct
 * environment settings.
 *
 * `ng test` (npm test) remains the canonical way to run the full suite;
 * this file only approximates that pipeline for IDE convenience.
 */
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

export default defineConfig({
  plugins: [angular()],
  resolve: {
    alias: {
      '@haidra/design-system': resolve(__dirname, 'src/shared/design-system/components'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/init-testbed.ts', 'src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
