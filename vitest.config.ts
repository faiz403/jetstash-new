import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Truth Reset (July 2026): the first automated test setup in this repo.
 * Deliberately minimal — these tests exercise pure data/logic functions with
 * fixed inputs and fixed dates only (per the Truth Reset brief: no live
 * network access, no dependency on the running dev server). Path alias
 * mirrors tsconfig.json's `@/*` so test files can import the same way
 * application code does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  // tsconfig.json sets jsx: "preserve" (Next.js does its own JSX transform via
  // SWC) — Vitest 4's default transform (oxc) needs an explicit override here
  // or it refuses to parse any .tsx file pulled in transitively by a test
  // (e.g. importing a component to test its return value directly). An
  // esbuild.jsx equivalent was tried too, but oxc ignores it (and its type
  // isn't even valid on ESBuildOptions, which broke `tsc --noEmit`), so oxc
  // alone is both necessary and sufficient here.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
