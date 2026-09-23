import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))
const ANATOMOGRAM_STUB = resolve(root, 'test/stubs/anatomogram.js')

export default defineConfig({
  // Same JSX-in-.js setup as vite.config.js (esbuild's default filter skips .js files).
  esbuild: {
    loader: 'jsx',
    jsx: 'automatic',
    include: ['src', 'examples', 'test'].map(dir => `${root}${dir}/**/*.{js,jsx}`),
    exclude: [],
  },
  resolve: {
    alias: {
      // Until gramene-anatomogram is published and installed (plan step H10), tests use a stub that records its props.
      'gramene-anatomogram': ANATOMOGRAM_STUB,
      // Temporary, for the golden snapshots of the pristine upstream src/load/ (test/load/loadChartData.test.js):
      // the upstream anatomogram import, and node `url` as the npm polyfill webpack 4 bundled in production.
      '@ebi-gene-expression-group/anatomogram': ANATOMOGRAM_STUB,
      url: resolve(root, 'node_modules/url/url.js'),
    },
  },
  test: {
    include: ['test/**/*.test.{js,jsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'jsdom',
    setupFiles: ['test/setup.js'],
    restoreMocks: true,
    testTimeout: 30_000,
    // Vitest replaces CSS (including ?inline imports) with '' unless it is listed here.
    css: { include: [/heatmap\.css$/] },
  },
})
