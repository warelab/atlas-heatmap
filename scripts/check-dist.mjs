#!/usr/bin/env node
// Checks the library build (run by `npm run build` after vite build and copy-dts):
// - the published entry points exist, including the stylesheet and both declaration files;
// - nothing that must stay external or removed is in the bundles (React, Highcharts, the EBI assets and packages the
//   port dropped);
// - every import of another package names a dependency or peer, and deep imports are fully specified (`lodash/range.js`),
//   which webpack 5 and Node require of a "type": "module" package;
// - highcharts-more (boxplot) is imported only by the lazily loaded GeneSpecificResults chunk.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const problems = [];

const REQUIRED = [
  'gramene-atlas-heatmap.js',
  'gramene-atlas-heatmap.cjs',
  'gramene-atlas-heatmap.css',
  'index.d.ts',
  'index.d.cts',
];

// [text, why it must not be in dist/*.js or dist/*.cjs]
const BANNED = [
  ['react.production', 'React is a peer dependency'],
  ['react.development', 'React is a peer dependency'],
  ['Highcharts JS v6', 'Highcharts is a dependency, not bundled'],
  ['gxa/licence.html', 'the anatomogram SVGs belong to gramene-anatomogram'],
  ['topwallpaperpc', 'the third-party link was removed from the error alert'],
  ['oncontextmenu', 'the page context menu is left alone'],
  ['sanitize-html', 'removed'],
  ['styled-components', 'removed'],
  ['react-ga', 'Google Analytics was removed'],
  ['react-highcharts', 'replaced by highcharts-react-official'],
  ['object-hash', 'removed'],
  ['react-bootstrap/lib', 'react-bootstrap 0.33 paths'],
  ['rc-slider', 'replaced by Form.Range'],
  ['react-debounce-render', 'inlined'],
  ['loading.gif', 'replaced by a Spinner'],
];

// Subpaths that React publishes in its package.json "exports", so they need no extension.
const EXPORTED_SUBPATHS = new Set(['react/jsx-runtime', 'react-dom/client', 'react-dom/server']);
const ALLOWED_PACKAGES = new Set([
  'gramene-anatomogram', // joins `dependencies` once published (plan step H10)
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]);

const packageOf = (specifier) => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)"((?:@[a-z0-9~][\w.~-]*\/)?[a-z0-9~][\w.~-]*(?:\/[\w.@~-]+)*)"/g;
const importsOf = (code) => [...code.matchAll(SPECIFIER)].map((m) => m[1]);

for (const name of REQUIRED) {
  if (!existsSync(join(dist, name))) problems.push(`missing dist/${name}`);
}

const bundles = existsSync(dist) ? readdirSync(dist).filter((name) => /\.c?js$/.test(name)) : [];
if (bundles.length === 0) problems.push('no bundles in dist/');

for (const name of bundles) {
  const code = readFileSync(join(dist, name), 'utf8');
  for (const [text, why] of BANNED) {
    if (code.includes(text)) problems.push(`dist/${name} contains "${text}" (${why})`);
  }
  for (const specifier of importsOf(code)) {
    if (!ALLOWED_PACKAGES.has(packageOf(specifier))) {
      problems.push(`dist/${name} imports ${specifier}, which is not a dependency or peer`);
    } else if (specifier !== packageOf(specifier) && !EXPORTED_SUBPATHS.has(specifier) && !/\.c?js$/.test(specifier)) {
      problems.push(`dist/${name} imports ${specifier} without its file extension`);
    }
  }
  const importsBoxplot = importsOf(code).some((specifier) => specifier.startsWith('highcharts/highcharts-more'));
  if (importsBoxplot && !name.startsWith('GeneSpecificResults-')) {
    problems.push(`dist/${name} imports highcharts-more, which only the lazy GeneSpecificResults chunk should`);
  }
}
for (const extension of ['js', 'cjs']) {
  if (!bundles.some((name) => name.startsWith('GeneSpecificResults-') && name.endsWith(`.${extension}`))) {
    problems.push(`no lazy GeneSpecificResults-*.${extension} chunk`);
  }
}

const css = existsSync(join(dist, 'gramene-atlas-heatmap.css')) ? readFileSync(join(dist, 'gramene-atlas-heatmap.css'), 'utf8') : '';
if (!css.includes('.gxaHeatmapContainer') || !css.includes('body > .highcharts-tooltip-container')) {
  problems.push('dist/gramene-atlas-heatmap.css is not src/styles/heatmap.css');
}

if (problems.length > 0) {
  console.error(`check-dist: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-dist: ok (${bundles.length} bundles, ${REQUIRED.length} entry files)`);
