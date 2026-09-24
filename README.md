# gramene-atlas-heatmap

Gramene's fork of EMBL-EBI's [Expression Atlas heatmap](https://github.com/ebi-gene-expression-group/atlas-heatmap)
(`@ebi-gene-expression-group/expression-atlas-heatmap-highcharts` 5.7.2), published on npm as
**`gramene-atlas-heatmap`**. gramene-search uses it to draw the baseline and differential expression heatmaps of its
Expression tab (EBI Studies and Paralogs) in the page, with the anatomogram of
[gramene-anatomogram](https://github.com/warelab/anatomogram), and the factor grid of its JGI Studies tab
([ExpressionFactorGrid](#expressionfactorgrid)). The data comes from the Warelab gramene-swagger `/gxa/` API
(`https://data.sorghumbase.org/<db>/gxa/`), or from Expression Atlas itself.

What is different from 5.7.2 (details in [CHANGELOG.md](CHANGELOG.md)):

- **React 18 and react-bootstrap 2**, both peer dependencies, with no React deprecation warnings. The controls are
  Bootstrap 5 markup and use the host page's Bootstrap 5 CSS; the EBI Bootstrap 3 stylesheet is gone.
- **No iframe needed.** Styles are scoped and injected, the chart measures its own container (fullscreen views and
  several heatmaps on one page fit), links open in a new tab (`linkTarget`), and each link can be rewritten or
  dropped with `resolveUrl`.
- **The anatomogram shows for the Paralogs tab**: species names such as `Sorghum bicolor` are normalised. Hovering
  an All Studies row label highlights its tissues.
- Baseline colours are upstream 5.7.2's five log-range buckets.
- New: `ExpressionFactorGrid` draws one gene in one study by the study's factors, and `filterRows` leaves rows of
  the payload out.
- **Download dialog**: the heatmap's and the grid's Download button asks for a file name and a format (tab-delimited
  text, the default, or JSON) and saves what the widget shows. See [Downloads](#downloads).
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

Leaving rows out of the payload, e.g. the JGI studies of All Studies (their rows have the accession as `id`, or the
study name, possibly followed by ` - <value>`, as `id` and `name`):

```jsx
const jgiNames = jgiStudies.map(study => study.name)
const isJgiRow = row => jgiStudies.some(study => study._id === row.id) ||
  jgiNames.some(name => [row.id, row.name].some(label => label === name || label.startsWith(`${name} - `)))
const filterRows = useCallback(row => !isJgiRow(row), [jgiStudies])

<ExpressionAtlasHeatmap atlasUrl={atlasUrl} query={{gene}} experiment={false} filterRows={filterRows} />
```

The columns no remaining row has a value in go too, and with no row left the "no results" message shows. It works on
the fetched payload: a new `filterRows` filters again without a new request, and keeps the chart as it is (zoom,
ordering, filters) when it keeps the same rows. Memoize it all the same.

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
| `filterRows` | `(row) => boolean` | | Keeps the payload's `profiles.rows` it returns true for, and the columns they have values in (above) |
| `downloadFileName` | string | `expression-<accession or studies>-<first gene>` | The file name (without extension) the Download dialog suggests. See [Downloads](#downloads) |
| `showDownload` | boolean | `true` | The Download button, among the controls that `showControlMenu` shows |
| `disableGoogleAnalytics` | | | **Ignored**: there is no Google Analytics any more |

Exports: `ExpressionAtlasHeatmap` (also the default), `ExpressionFactorGrid`, `render`, `DEFAULT_OPTIONS`,
`ensureStylesInjected`, `STYLE_ELEMENT_ID` and `HEATMAP_CSS`. Types are in `dist/index.d.ts`.

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
| `download` | “Full experiment data on Expression Atlas” in the Download dialog; `null` leaves it out | |

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

### Downloads

The Download button (among the heatmap's controls, and in the factor grid's toolbar) opens a dialog titled
*Download*:

- **File name**, prefilled with `downloadFileName` (or the default), focused and selected so that typing replaces it.
  *Download* is disabled while it is blank. The name is sanitised: path separators (`/`, `\`), the characters
  Windows does not allow (`: * ? " < > |`) and control characters are removed, as are the spaces around it, leading
  dots and trailing dots; a name with nothing left is saved under the default name. The format's extension is added
  unless the name already ends with it (in any case). The dialog shows the name the file will be saved under.
- **Format**: *Tab-delimited text (.tsv)*, selected each time the dialog opens, or *JSON (.json)*.
- A line saying what is saved, e.g. `9 rows × 24 columns, as shown` or `31 samples of JGI-SB-1 for SORBI_3006G095600`.
- *Download* (or Enter) saves the file with downloadjs, as `text/tab-separated-values` or `application/json` in UTF-8,
  and closes the dialog. *Cancel*, the close button and Escape save nothing. The focus goes back to the Download
  button.
- For an experiment whose payload names a full download (`experiment.urls.download`, then `resolveUrl('download', …)`),
  a secondary link *Full experiment data on Expression Atlas* opens it in `linkTarget`, as the old menu's “All data”
  did. It is not the default action; `resolveUrl` returning `null` leaves it out.
- A payload with a `disclaimer` (`blueprint`, `lauderdale`, `pcawg`) shows its data reuse statement in the dialog, and
  *Download* and the full data link wait for the reader to tick *I agree to the data reuse statement above* (asked
  again each time the dialog opens).

**The heatmap** saves what it shows: the rows and columns after the filters, the ordering and the similarly expressed
genes, in the order shown; while the chart is zoomed in, only the columns in view (those whose centres are within the
zoomed axis, i.e. whose labels show). Labels are whole, not the shortened ones the chart draws.

- Tab-delimited text keeps upstream's layout: comment lines (`# Downloaded from: <page URL>`, `# Timestamp:`, the
  query or experiment description, the ordering, `# Unit: TPM` and `# Zoomed in: columns 3 to 6 of 24` when they
  apply), a header line with an empty first cell then the column labels, and one line per row: its label, then its
  values in column order. Differential experiments give the log2 fold changes. Cells with no data are empty in one
  experiment and `NA` across experiments (All Studies).

  ```
  # Downloaded from: https://www.sorghumbase.org/genes?idList=SORBI_3001G000200
  # Timestamp: 2026-09-24T12:00:00.000Z
  # Experiment accession: E-CURD-25
  # Gene Expression Regulation Associated with Vascularization in Sorghum bicolor
  # Gene query: SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100
  # Results as shown on page
  # Unit: TPM
  	nonvascular system	root	shoot	vascular system
  SORBI_3001G000200	45	74	63	30
  SORBI_3001G000400	9	25	19	9
  SORBI_3001G000100		0.7		
  ```

- JSON: `{source: "Expression Atlas", atlasUrl, experiment: {accession, description, type} | null (All Studies),
  query: {genes: [...]}, unit, zoom: null | {from, to, of} (1-based columns), columns: [{label, id}], rows: [{label,
  id, unit, values}], downloadedFrom, downloadedAt}`. `values` are aligned with `columns`, `null` where there is no
  data. A column's `id` is its ontology term (or the contrast id; `null` when there is none), and a baseline
  experiment's columns also have their `assayGroupId`. `unit` is the unit every row shares (`null` when they differ;
  each row has its own). Differential experiments' rows also have `pValues`, aligned with `values`.

  ```json
  {
    "source": "Expression Atlas",
    "atlasUrl": "https://data.sorghumbase.org/sorghum_v11/gxa/",
    "experiment": {"accession": "E-GEOD-30249", "description": "RNA-Seq of Sorghum bicolor 9d seedlings in response to osmotic stress and abscisic acid", "type": "rnaseq_mrna_differential"},
    "query": {"genes": ["SORBI_3001G000200", "SORBI_3001G000400", "SORBI_3001G000100"]},
    "unit": "Log2 fold change",
    "zoom": null,
    "columns": [
      {"label": "compound: sodium hydroxide 0.2 molar vs abscisic acid 20 micromolar in organism part: root", "id": "g5_g1"},
      {"label": "compound: water vs polyethylene glycol 20 percent in organism part: root", "id": "g7_g3"}
    ],
    "rows": [
      {"label": "SORBI_3001G000200", "id": "SORBI_3001G000200", "unit": "Log2 fold change", "values": [-0.3, null], "pValues": [0.023848945245277, null]},
      {"label": "SORBI_3001G000400", "id": "SORBI_3001G000400", "unit": "Log2 fold change", "values": [-1.7, 0.3], "pValues": [1.48769027960814e-26, 0.00251968357307113]}
    ],
    "downloadedFrom": "https://www.sorghumbase.org/genes?idList=SORBI_3001G000200",
    "downloadedAt": "2026-09-24T12:00:00.000Z"
  }
  ```

**The factor grid** saves every sample of the study for the gene, one per line (long format), whatever the axes:
ordered by the study's factors in its order, then by sample id.

- Tab-delimited text: a header line, `gene`, `study`, each factor of the study in its order (those that vary and
  those that do not), `sample id`, `replicates`, `expression (<unit>)`; then one line per sample. There are no comment
  lines. A factor the sample lacks (the grid's `—`) and a missing value are empty.

  ```
  gene	study	organism part	developmental stage	sample id	replicates	expression (TPM)
  SORBI_3006G095600	JGI-SB-1	leaf lamina	inflorescence development stage	leaf_lower_growing.floral_initiation	2	41.344
  SORBI_3006G095600	JGI-SB-1	leaf lamina	inflorescence development stage	leaf_upper_growing.floral_initiation	2	10.795
  SORBI_3006G095600	JGI-SB-1	leaf lamina	seedling development stage	leaf_blade.juvenile	2	21.535
  ```

- JSON: `{gene, study: {accession, description}, factors: [{name, values, varies}], rowFactor, columnFactor, unit,
  samples: [{factors: {<name>: value | null}, sampleId, assayGroupId, replicates, value}], downloadedFrom,
  downloadedAt}`. `rowFactor` and `columnFactor` are the axes shown (`null` when there is none).

  ```json
  {
    "gene": "SORBI_3006G095600",
    "study": {"accession": "JGI-SB-1", "description": "Sorghum bicolor developmental stages: 31 sample groups from 88 RNA-seq libraries (Phytozome Sbicolor v3.1.1). PI John Mullet, Texas A&M. Submitted via JGI; awaiting citation."},
    "factors": [
      {"name": "organism part", "values": ["leaf lamina", "leaf sheath", "panicle inflorescence", "peduncle", "root", "root tip", "shoot system", "stem internode"], "varies": true},
      {"name": "developmental stage", "values": ["inflorescence development stage", "seedling development stage", "sporophyte vegetative stage", "whole plant flowering stage", "whole plant fruit ripening stage"], "varies": true}
    ],
    "rowFactor": "developmental stage",
    "columnFactor": "organism part",
    "unit": "TPM",
    "samples": [
      {"factors": {"organism part": "leaf lamina", "developmental stage": "inflorescence development stage"}, "sampleId": "leaf_lower_growing.floral_initiation", "assayGroupId": "g9", "replicates": 2, "value": 41.344},
      …
    ],
    "downloadedFrom": "https://www.sorghumbase.org/genes?idList=SORBI_3006G095600",
    "downloadedAt": "2026-09-24T12:00:00.000Z"
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

## ExpressionFactorGrid

One gene's expression in one baseline experiment, drawn as a grid of the experiment's factors: for studies with
several factors, such as the JGI studies of sorghum_v11 (JGI-SB-1 is organism part × developmental stage). It is a
plain HTML table, without Highcharts or the anatomogram.

```jsx
import { ExpressionFactorGrid } from 'gramene-atlas-heatmap'

<ExpressionFactorGrid
  atlasUrl="https://data.sorghumbase.org/sorghum_v11/gxa/"
  experiment="JGI-SB-1"
  gene="SORBI_3006G095600"
  rowFactor={axes.rowFactor}
  columnFactor={axes.columnFactor}
  onChangeFactors={setAxes} />
```

It sends the request the heatmap sends for one experiment: `POST <atlasUrl>json/experiments/<experiment>` with the body
`geneQuery=<gene>`. It shows the same spinner, error alert (calling `fail` once per failed request) and "no results"
message. A differential experiment gets a message instead of a grid.

- **Factors.** Each assay group of the payload is a sample; its factor values are its `FACTOR` properties, and a group
  that lacks one of the study's factors has `—` for it. A factor with more than one value varies. Factors that do not
  vary are shown above the grid (`organism part: stem internode`).
- **Axes.** By default `organism part` goes on the columns when it varies. Otherwise the columns get the factor with
  the most values, and the rows the factor with the most values among the others. Values a group lacks do not count,
  and ties go to the factor the study lists first. Any other varying factors are folded into the rows: each
  combination of values that some sample has is its own row, labelled `TX08001 · outer core`. Rows and columns are
  in natural order (S1, S2, …, S10, then `—`).
  - Two varying factors: a *Swap rows and columns* button.
  - More than two: *Rows* and *Columns* selects as well. Choosing the other axis's factor swaps the axes; choosing a
    folded factor folds the one it replaces.
  - One: a single row, labelled with the gene id. None: a single cell.
- **Cells.** A cell holds every sample with its row's and column's values. Several samples (groups that share every
  factor value and differ by the `sample id` SAMPLE property) split the cell into equal bands, ordered by sample id.
  Each band has exactly the colour the flat heatmap (e.g. the Paralogs heatmap of the same study) gives that assay
  group for the same payload: the colour of the data series (Below cutoff, Low, …, High) its value falls in, without
  drawing a chart. Cells with nothing measured, and samples with no value, are hatched. The legend is the Paralogs
  heatmap's gradient legend, in the payload's unit (TPM), with a key for the hatching. The grid's table draws no
  borders of its own, even when the host page's table rules give cells some.
- **Tooltip.** Hovering or focusing a band shows its factor values, sample id (else the assay group id), replicates,
  and value with its unit. Every band is in the tab order and has an `aria-label`; Escape hides the tooltip. When the
  table scrolls sideways, the tooltip of the band in focus moves with it (tabbing to a band out of view scrolls it
  into view), and the tooltip of the band under the mouse goes.
- **Labels.** When any column label is longer than 8 characters, all the column labels are drawn vertically, cut
  short at 12rem with an ellipsis; hovering one shows the whole label. Row labels are cut at 20rem. The table scrolls
  sideways when it is wider than its container.
- **Download.** A *Download* button in the toolbar opens the [Download dialog](#downloads), which saves every sample
  of the study for the gene (not only the cells in view), as tab-delimited text or JSON. The default file name is
  `<gene>-<experiment>`.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `experiment` | string | | The accession (required). Nothing is fetched without it |
| `gene` | string | | One gene id, sent as `geneQuery` (required); the payload row with that id or name is drawn |
| `atlasUrl` | string | `'https://www.ebi.ac.uk/gxa/'` | As ExpressionAtlasHeatmap's |
| `rowFactor`, `columnFactor` | string | | The factors on the rows and the columns. Each is used when it names a factor that varies, and otherwise ignored; `columnFactor` wins when both name the same one. Without them the grid keeps its own choice |
| `onChangeFactors` | `({rowFactor, columnFactor}) => void` | | When the reader swaps or chooses the axes (not for the defaults). Store the axes and pass them back to keep them |
| `downloadFileName` | string | `<gene>-<experiment>` | The file name (without extension) the Download dialog suggests |
| `showDownload` | boolean | `true` | The Download button |
| `inProxy`, `linkTarget`, `resolveUrl`, `fail`, `className`, `style`, `injectStyles` | | | As ExpressionAtlasHeatmap's. `resolveUrl` gets `{query: {gene}, experiment}`; the only link is the error alert's support link. The root is `div.gxaHeatmapContainer.gxaFactorGrid` |

A new `experiment`, `gene` or `atlasUrl` fetches again, and the grid's own choice of axes starts afresh. gramene-search
also keys the grid on them, and keeps the axes per study in its saved view.

## Development

```bash
npm install
npm test               # vitest + jsdom; any console.error/warn fails the test unless it calls allowConsole()
npm run build          # dist/, then scripts/copy-dts.mjs and scripts/check-dist.mjs
npm run lint:pkg       # publint, then attw on a packed tarball
npm run pack:local     # scripts/check-release.mjs, build, then gramene-atlas-heatmap-<version>.tgz
npm run dev            # playground (examples/playground) on http://localhost:5175
npm run fixtures       # recapture test/fixtures from the live backend (read-only POSTs)
```

- **Tests** draw real Highcharts 6.2 in jsdom, with the layout shims in `test/shims.js`, from the backend responses
  captured in `test/fixtures/`. They use `test/stubs/anatomogram.js` for gramene-anatomogram: a stub that records its
  props. The exception is `test/anatomogram.integration.test.js`, which draws the heatmap with the installed package:
  the injected sorghum SVG, tissue and column highlighting both ways, and `normaliseSpecies`. `test/load/` holds golden
  snapshots of upstream's `src/load/` output. `test/grid/` tests ExpressionFactorGrid's model on the four JGI
  studies, and its colours against those Highcharts itself gives the points of the same payload's heatmap.
- **The playground** has an `atlasUrl` choice (auth_testing, sorghum_v11, EBI), genes, experiment, the boolean props
  (`showDownload` included), `linkTarget`, `downloadFileName`, a demo `resolveUrl` (which, like gramene-search's,
  leaves out the full data link of the JGI studies), and a switch that logs `window.open` instead of opening. Its panels show All
  Studies and Paralogs side by side, a resizable container, gramene-search's fullscreen modal, the `render()` API
  and ExpressionFactorGrid (a study select, JGI-SB-1 to 4 and two EBI studies, and a gene field; the axes are kept
  per study), with an event log of `fail` and `onChangeFactors` calls. URL parameters: `?api=mock` (answers from
  `test/fixtures`, offline), `?strict=1` (StrictMode) and `?panel=side-by-side|resizable|fullscreen|render-api|grid`
  (`grid` starts on sorghum_v11, where the JGI studies are). From a workstation: `ssh -L 5175:localhost:5175 <host>`.
- To try unreleased gramene-anatomogram changes, install its packed tarball over the registry version, without
  saving it: `npm install --no-save ../anatomogram/gramene-anatomogram-3.0.0.tgz`. The next `npm install` puts the
  registry version back.
- The dev server uses gramene-anatomogram from `node_modules`, and the stub only when it is not installed.

### Trying a build in gramene-search

Install tarballs rather than `npm link` (a symlink would load a second React), and never with a `file:` or `link:`
spec (`check-release` refuses to pack one):

```bash
npm run pack:local                       # gramene-atlas-heatmap-6.3.0.tgz
cd ../gramene-search
npm install --no-save ../atlas-heatmap/gramene-atlas-heatmap-6.3.0.tgz
rm -rf .parcel-cache*
```

The next `npm install` in gramene-search puts the registry versions back. `npm run lint:pkg` packs into a temporary
directory, so it never deletes the local tarball.

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
