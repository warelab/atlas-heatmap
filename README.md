# gramene-atlas-heatmap

Gramene's fork of EMBL-EBI's [Expression Atlas heatmap](https://github.com/ebi-gene-expression-group/atlas-heatmap)
(`@ebi-gene-expression-group/expression-atlas-heatmap-highcharts` 5.7.2), published on npm as
**`gramene-atlas-heatmap`**. gramene-search uses it to draw the baseline and differential expression heatmaps of its
Expression tab (All Studies and Paralogs) in the page, with the anatomogram of
[gramene-anatomogram](https://github.com/warelab/anatomogram). The data comes from the Warelab gramene-swagger
`/gxa/` API (`https://data.sorghumbase.org/<db>/gxa/`), or from Expression Atlas itself.

What is different from 5.7.2 (details in [CHANGELOG.md](CHANGELOG.md)):

- **React 18 and react-bootstrap 2**, both peer dependencies, with no React deprecation warnings. The controls are
  Bootstrap 5 markup and use the host page's Bootstrap 5 CSS; the EBI Bootstrap 3 stylesheet is gone.
- **No iframe needed.** Styles are scoped and injected, the chart measures its own container (fullscreen views and
  several heatmaps on one page fit), links open in a new tab (`linkTarget`), and each link can be rewritten or
  dropped with `resolveUrl`.
- **The anatomogram shows for the Paralogs tab**: species names such as `Sorghum bicolor` are normalised. Hovering
  an All Studies row label highlights its tissues.
- Baseline colours are upstream 5.7.2's five log-range buckets.
- react-refetch, react-highcharts, styled-components, react-ga and every other React 16-only package are gone.
  Highcharts stays at 6.2.
- ESM and CommonJS builds with TypeScript declarations. The code keeps upstream's module layout; see
  [Fork maintenance](#fork-maintenance).

## Install

```bash
npm install gramene-atlas-heatmap react@^18.2 react-dom@^18.2 react-bootstrap@^2.7
```

gramene-anatomogram and Highcharts 6.2 come as dependencies.

### Host requirements

- React and ReactDOM 18, and react-bootstrap 2 (peer dependencies).
- **Bootstrap 5 CSS**, loaded by the page. The package never loads it.
- **One Highcharts.** The heatmap imports Highcharts 6.2 and never uses a global `window.Highcharts`. A page that
  loads another copy may see Highcharts error 16. Highcharts is not open source: Highsoft licenses it free of charge
  for non-commercial use (see [NOTICE](NOTICE)).
- A bundler that understands ESM and dynamic `import()` (Parcel 2, Vite, webpack 5). The CommonJS build `require`s
  gramene-anatomogram, which is ESM only, so it needs Node 20.19 or 22.12 and later; Jest's module loader cannot load
  it.
- Content-Security-Policy: the injected `<style>` needs `style-src 'unsafe-inline'`, unless you pass
  `injectStyles={false}` and load the stylesheet (see [Styles](#styles)). The anatomogram's view icons are `data:`
  URLs, so `img-src` needs `data:`.
- The backend is reached with `fetch`: `POST <atlasUrl>json/baseline_experiments` (All Studies) or
  `json/experiments/<accession>`, with the body `geneQuery=A B C`. The body is deliberately not URL-encoded (the
  gramene-swagger backend answers 500 to `+` or `%20`) and is sent as `application/x-www-form-urlencoded`, which
  needs no CORS preflight.

## Usage

```jsx
import { ExpressionAtlasHeatmap } from 'gramene-atlas-heatmap'

// All Studies for one gene
<ExpressionAtlasHeatmap
  atlasUrl="https://data.sorghumbase.org/sorghum_v11/gxa/"
  query={{gene: 'SORBI_3001G000200'}}
  experiment={false}
  resolveUrl={resolveUrl}
  fail={({url, method, message}) => console.warn(`${method} ${url}: ${message}`)} />

// One experiment for several genes (e.g. paralogs), separated by single spaces
<ExpressionAtlasHeatmap
  atlasUrl="https://data.sorghumbase.org/sorghum_v11/gxa/"
  query={{gene: 'SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100'}}
  experiment="E-CURD-25" />
```

A new `query`, `experiment` or `atlasUrl` fetches again and starts afresh (ordering, filters, zoom). A new `query`
object with the same content does not refetch. gramene-search also keys each heatmap on its query.

Without React in the page (upstream's widget API):

```js
import { render } from 'gramene-atlas-heatmap'

const handle = render({target: 'heatmap', atlasUrl, query: {gene: 'SORBI_3001G000200'}, render: () => {}})
render({target: 'heatmap', atlasUrl, query: {gene: 'SORBI_3001G000100'}})   // updates the same root
handle.unmount()
```

`target` is an element or its id. React and react-bootstrap must still be installed; they are peer dependencies.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `query` | object \| string | | `{gene, condition, …}`: `gene` is sent as `geneQuery`, `condition` as `conditionQuery`, other keys as they are. String values are sent unencoded, others as JSON. A string is an endpoint relative to `atlasUrl` |
| `experiment` | string \| `false` | `''` | Falsy: every baseline experiment (All Studies). `'reference'`: the reference experiment. Otherwise an accession |
| `atlasUrl` | string | `'https://www.ebi.ac.uk/gxa/'` | A trailing `/` is added. `undefined` keeps the default |
| `inProxy`, `outProxy` | string | `''` | Prefixes for requests and for links |
| `showAnatomogram` | boolean | `true` | Shown when the payload names a species gramene-anatomogram has (`Sorghum bicolor` is normalised to `sorghum_bicolor`) |
| `isWidget` | boolean | `true` | The experiment description and the attribution footer |
| `showControlMenu` | boolean | `true` | Ordering, filters, genome browser and download controls |
| `fail` | `({url, method, message}) => void` | | Once per failed request (also under StrictMode), and when drawing the heatmap throws. An alert is shown either way |
| `linkTarget` | string | `'_blank'` | Target of every link and `window.open`, including the anatomogram's licence link. `_blank` adds `rel="noopener noreferrer"`; `''` sets no target |
| `resolveUrl` | `(kind, defaultUrl, context) => string \| null \| undefined` | | Rewrites links; see below |
| `className`, `style` | | | On the root `div.gxaHeatmapContainer` |
| `injectStyles` | boolean | `true` | See [Styles](#styles) |
| `disableGoogleAnalytics` | | | **Ignored**: there is no Google Analytics any more |

Exports: `ExpressionAtlasHeatmap` (also the default), `render`, `DEFAULT_OPTIONS`, `ensureStylesInjected`,
`STYLE_ELEMENT_ID` and `HEATMAP_CSS`. Types are in `dist/index.d.ts`.

### resolveUrl

`resolveUrl(kind, defaultUrl, context)` returns a string to use instead of `defaultUrl`, `null` to drop the link (or
the menu option, or the genome browser click), or `undefined` to keep the default. `defaultUrl` already includes
`outProxy`. `context` always has `query` and `experiment` (the accession, or `null` for All Studies). The function is
read through a ref, so passing a new one does not redraw the chart.

| `kind` | Link | More `context` |
|---|---|---|
| `row` | A y-axis label: an experiment (All Studies) or a gene | `row: {id, label, uri, experimentType, index}`; `uri` is the payload's, possibly relative |
| `experiment` | The experiment description | |
| `atlas` | “Expression Atlas” in the footer | |
| `moreInformation` | “here” (the full record) in the footer | `config`: the payload's |
| `support` | The EBI support links in the footer and the error alert | |
| `genomeBrowser` | A differential cell click, opened with `window.open` | `genomeBrowser`, `geneId`, `trackId` |
| `download` | “All data” in the Download menu | |

gramene-search points the Warelab backend's links at EBI, since the backend answers with relative row URIs and
`geneQuery=[null]`:

```js
const EBI_GXA = 'https://www.ebi.ac.uk/gxa/'
const resolveUrl = (kind, url, {query, experiment, row}) => {
  const genes = query.gene.split(' ')
  const withGenes = u => { const p = new URL(u); p.searchParams.set('geneQuery', JSON.stringify(genes.map(value => ({value})))); return p.href }
  switch (kind) {
    case 'row': return row.uri && !/^https?:/.test(row.uri) ? new URL(row.uri, EBI_GXA).href : undefined
    case 'atlas': return EBI_GXA
    case 'experiment': return withGenes(url)
    case 'moreInformation': return experiment ? withGenes(url) : `${EBI_GXA}genes/${genes[0]}`
    case 'download': { const p = new URL(url); p.searchParams.delete('geneQuery'); return p.href }
    default: return undefined
  }
}
```

### Styles

- Bootstrap 5 styles the controls and dialogs; it comes from the host page.
- The heatmap's own rules are injected once per document as `<style id="gramene-atlas-heatmap-styles">` at the start
  of `<head>`, so host rules of equal specificity win. They are scoped under `.gxaHeatmapContainer` and
  `.gxa-heatmap-modal`. The one global rule, `body > .highcharts-tooltip-container {z-index: 1100}`, keeps the
  tooltip (which Highcharts appends to `<body>`) above a fullscreen Bootstrap modal (1055).
- For CSP-strict pages, pass `injectStyles={false}` and load the file instead:
  ```js
  import 'gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css'   // or 'gramene-atlas-heatmap/style.css'
  ```
  Parcel ignores package `exports` by default, so it needs the `dist/` path.
- `ensureStylesInjected(target?)` injects into `document` or a `ShadowRoot`.
- Without the iframe, host CSS reaches the heatmap. Links are not underlined; the tooltip sets its font inline and
  otherwise inherits the page's.

### What is in the package

- `dist/gramene-atlas-heatmap.js` (ESM) and `.cjs`: small entry files over a shared `Main-[hash]` chunk. Every
  dependency stays external.
- `GeneSpecificResults-[hash]`: the box plot and transcripts charts (with highcharts-more), loaded only for
  experiments that have gene-specific results. EBI experiments do; the Warelab backend sends none.
- `dist/gramene-atlas-heatmap.css`, `dist/index.d.ts` and `dist/index.d.cts`, and source maps.

## Development

```bash
npm install
npm test               # vitest + jsdom; any console.error/warn fails the test unless it calls allowConsole()
npm run build          # dist/, then scripts/copy-dts.mjs and scripts/check-dist.mjs
npm run lint:pkg       # publint, then attw on a packed tarball
npm run pack:local     # scripts/check-release.mjs, build, then gramene-atlas-heatmap-6.0.0.tgz
npm run dev            # playground (examples/playground) on http://localhost:5175
npm run fixtures       # recapture test/fixtures from the live backend (read-only POSTs)
```

- **Tests** draw real Highcharts 6.2 in jsdom, with the layout shims in `test/shims.js`, from the backend responses
  captured in `test/fixtures/`. They use `test/stubs/anatomogram.js` for gramene-anatomogram: a stub that records its
  props. The exception is `test/anatomogram.integration.test.js`, which draws the heatmap with the real package whenever
  it is installed and is skipped otherwise. `test/load/` holds golden snapshots of upstream's `src/load/` output.
- **The playground** has an `atlasUrl` choice (auth_testing, sorghum_v11, EBI), genes, experiment, the boolean props,
  `linkTarget`, a demo `resolveUrl`, and a switch that logs `window.open` instead of opening. Its panels show All
  Studies and Paralogs side by side, a resizable container, gramene-search's fullscreen modal and the `render()` API,
  with an event log of `fail` calls. URL parameters: `?api=mock` (answers from `test/fixtures`, offline),
  `?strict=1` (StrictMode) and `?panel=side-by-side|resizable|fullscreen|render-api`. From a workstation:
  `ssh -L 5175:localhost:5175 <host>`.
- The dev server uses gramene-anatomogram from `node_modules` when it is installed, and the stub otherwise. Until
  gramene-anatomogram 3.0.0 is on npm, install its tarball without saving it:
  `npm install --no-save ../anatomogram/gramene-anatomogram-3.0.0.tgz` (repeat it after every plain `npm install`).

### Trying a build in gramene-search

Install tarballs rather than `npm link` (a symlink would load a second React), and never with a `file:` or `link:`
spec (`check-release` refuses to pack one):

```bash
npm run pack:local                       # gramene-atlas-heatmap-6.0.0.tgz
cd ../gramene-search
npm install --no-save ../anatomogram/gramene-anatomogram-3.0.0.tgz ../atlas-heatmap/gramene-atlas-heatmap-6.0.0.tgz
rm -rf .parcel-cache*
```

Until the packages are published, every `npm install` in gramene-search must repeat both tarballs; otherwise npm
fails with E404 or prunes them. `npm run lint:pkg` packs into a temporary directory, so it never deletes the local
tarball.

## Fork maintenance

- Remotes: `origin` is `warelab/atlas-heatmap`, `upstream` is `ebi-gene-expression-group/atlas-heatmap`.
- Branches: `master` mirrors upstream and is never committed to. `gramene` is the default branch, cut from upstream's
  `v5.7.2` tag; releases are tagged `vX.Y.Z` on it.
- Edit upstream files in place without reformatting them, keep JSX in the upstream `.js` files, and make focused
  commits. Upstream's README is kept below.
- Review what the fork changes:

  ```bash
  git fetch upstream --tags
  git diff -M --stat upstream/master...gramene -- . ':(exclude)package-lock.json'
  git diff -M upstream/master...gramene -- src
  ```

- Taking upstream changes: `git merge upstream/master` (or cherry-pick) into `gramene`, then `npm test` (the
  `test/load/` snapshots show any change to the chart data) and `npm run build`.
- Releasing: bump `version`, add a `## [x.y.z]` entry to `CHANGELOG.md`, run `npm run pack:local` and try the
  tarball in gramene-search, then tag and `npm publish`. `prepublishOnly` runs check-release, the build with
  check-dist, the tests and lint:pkg.

# Upstream README (5.7.2)

# Expression Atlas Heatmap

Visualization of baseline, proteomics baseline and differential gene expression experiments for [Expression
Atlas](https://www.ebi.ac.uk/gxa).

It has four basic visualizations:
* Multiexperiment: collapses several baseline tissue experiments into a single table
* Baseline: displays a single RNA-seq baseline expression experiment
* Proteomics baseline: displays a single proteomics baseline expression experiment
* Differential: displays a single differential expression experiment

Visualizations optionally include, where available, an anatomogram to the left of the table.

## Atlas Widget

The heatmap can be included as a widget in your website.
Please visit the [demo showcase page](https://www.ebi.ac.uk/gxa/resources/test/widget/showcase/index.html).

### What you need
You must add the following to your environment:

```html
<link rel="stylesheet" type="text/css"
href="https://www.ebi.ac.uk/gxa/resources/css/customized-bootstrap-3.3.5.css"/>
```

If you already use your own flavour of Bootstrap, then you
can remove the styles link tags and the widget will integrate smoothly
in your environment.

Are you targetting ES5, IE11 or Safari? Include these polyfills for babel-polyfill and whatwg-fetch:
```html
<script language="JavaScript" type="text/javascript"
src="https://www.ebi.ac.uk/gxa/resources/js/lib/babel-polyfill.min.js"></script>
<script language="JavaScript" type="text/javascript"
src="https://www.ebi.ac.uk/gxa/resources/js/lib/fetch-polyfill.min.js"></script>
```

Then include our widget and the vendor bundle:
```html
<script language="JavaScript" type="text/javascript"
src="https://www.ebi.ac.uk/gxa/resources/js-bundles/vendorCommons.bundle.js"></script>
<script language="JavaScript" type="text/javascript"
src="https://www.ebi.ac.uk/gxa/resources/js-bundles/expressionAtlasHeatmapHighcharts.bundle.js"></script>
```

### Invoking the widget

You need to call the render method on the exposed global variable:
```javascript
expressionAtlasHeatmapHighcharts.render({
    query: {
      gene: "ASPM"
    },
    isMultiExperiment: true,
    target: "heatmapContainer"
});
```

Tell us about any problems by raising an issue in this repository.

## Building from source
```bash
npm install @ebi-gene-expression-group/expression-atlas-heatmap-highcharts --save
```
You can use it as a React component:
```javascript
import ExpressionAtlasHeatmap from '@ebi-gene-expression-group/expression-atlas-heatmap-highcharts'
...
ReactDom.render(<ExpressionAtlasHeatmap .../>, 'id-of-dom-element')
```

Or mount it on a DOM node if you’re not using the React framework:
```javascript
import { render as expressionAtlasHeatmapRender } from '@ebi-gene-expression-group/expression-atlas-heatmap-highcharts'
...
expressionAtlasHeatmapRender({...})
```

For all the options available visit the [examples showcase](http://www.ebi.ac.uk/gxa/resources/test/widget/showcase/index.html).

### Notes for developers
The authoritative docs are the code itself, here is the main function: [here](https://github.com/gxa/atlas-heatmap/blob/master/src/Main.js)

## Stay in touch
Besides raising an issue in GitHub, another means of communication with the Expression Atlas development team is the following mailing list:
https://listserver.ebi.ac.uk/mailman/listinfo/atlas-widget

It is intended for all developers who integrate the heatmap (we  informally refer to it as “the widget”) in their services.

The mailing list is the best way to be informed of official releases of Expression Atlas which are always accompanied by a new supported release of the widget. We also announce new features and (sometimes breaking) changes. We use it also as a channel to make pre-release versions available so that third party services can test the heatmap prior to an Expression Atlas release.


---

**Licence**

Source code is licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0). This does not include the dependencies used by this package, which can be found in the file `package.json`, and they are covered by the license specified by the corresponding author. This licence extends also to transpiled code as produced by Webpack, Babel or similar tools.

When including the widget on your website, please keep the attribution footer linking to the results in Expression Atlas.

All copyrightable material is licensed under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) as detailed in [Expression Atlas licence page](https://www.ebi.ac.uk/gxa/licence.html).

<small>Last updated on 23rd of November, 2017.</small>
