import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const STYLE_SOURCE = resolve(root, 'src/styles/heatmap.css')
const ANATOMOGRAM_STUB = resolve(root, 'test/stubs/anatomogram.js')

/**
 * Upstream keeps JSX in plain .js files; keeping those names keeps `git diff upstream/master` readable.
 * esbuild's default filter excludes .js, so replace it with globs anchored to this project (a bare
 * /src\/.../ regex would also match every path under the parent directories).
 */
const jsxInJs = {
  loader: 'jsx',
  jsx: 'automatic',
  include: ['src', 'examples', 'test'].map(dir => `${root}${dir}/**/*.{js,jsx}`),
  exclude: [],
}

/**
 * Temporary: bare imports of upstream packages that the port removes step by step (H3-H7 in the plan).
 * Treating them as external lets `vite build` run on the half-ported tree without installing React 16
 * packages. Delete each entry in the commit that drops its import; the list must be empty by H9.
 */
const UPSTREAM_IMPORTS_PENDING_REMOVAL = [
  '@ebi-gene-expression-group/expression-atlas-disclaimers',
  '@ebi-gene-expression-group/expression-atlas-number-format',
  'he',
  'object-hash',
  'rc-slider',
  'react-debounce-render',
  'react-ga',
  'react-highcharts',
  'styled-components',
]

// Every dependency and peer stays external (react/jsx-runtime, react-dom/client, highcharts/modules/…, lodash/…).
// gramene-anatomogram is named explicitly: it only joins `dependencies` once it is published (plan step H10).
const EXTERNAL_PACKAGES = [
  'gramene-anatomogram',
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...UPSTREAM_IMPORTS_PENDING_REMOVAL,
]
const isExternal = id => EXTERNAL_PACKAGES.some(name => id === name || id.startsWith(`${name}/`))

/**
 * Ships the stylesheet for CSP-strict hosts (`gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css`).
 * The same file is imported with `?inline` for runtime injection, which does not emit a CSS asset on its own.
 */
function emitStylesheet() {
  return {
    name: 'gramene-atlas-heatmap-emit-css',
    apply: 'build',
    generateBundle() {
      const source = existsSync(STYLE_SOURCE) ? readFileSync(STYLE_SOURCE, 'utf8') : ''
      this.emitFile({ type: 'asset', fileName: 'gramene-atlas-heatmap.css', source })
    },
  }
}

/**
 * - `npm run build` -> library build into ./dist (ESM + CJS + css), every dependency external.
 * - `npm run dev`   -> playground (examples/playground) on :5175; `gramene-atlas-heatmap` resolves to src/,
 *                      and `gramene-anatomogram` to the test stub until the real package is installed.
 */
export default defineConfig(({ command }) => {
  if (command === 'build') {
    return {
      esbuild: jsxInJs,
      plugins: [emitStylesheet()],
      build: {
        target: 'es2020',
        sourcemap: true,
        emptyOutDir: true,
        copyPublicDir: false,
        lib: {
          entry: resolve(root, 'src/Main.js'),
          formats: ['es', 'cjs'],
          fileName: format => `gramene-atlas-heatmap.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
          external: isExternal,
          output: { exports: 'named' },
        },
      },
    }
  }

  const anatomogramInstalled = existsSync(resolve(root, 'node_modules/gramene-anatomogram/package.json'))
  return {
    root: resolve(root, 'examples/playground'),
    esbuild: jsxInJs,
    resolve: {
      alias: {
        'gramene-atlas-heatmap': resolve(root, 'src/Main.js'),
        ...(anatomogramInstalled ? {} : { 'gramene-anatomogram': ANATOMOGRAM_STUB }),
      },
    },
    optimizeDeps: {
      // The dependency scanner parses src/ too, so it needs the same JSX-in-.js loader.
      esbuildOptions: { loader: { '.js': 'jsx' } },
      // Served as-is so its lazy SVG chunks keep their relative dynamic imports.
      exclude: ['gramene-anatomogram'],
      // prop-types for the excluded anatomogram; the JSX runtime because esbuild injects it after the scan.
      include: ['prop-types', 'react/jsx-dev-runtime'],
    },
    server: {
      port: 5175,
      strictPort: true,
      fs: { allow: [root] },
    },
  }
})
