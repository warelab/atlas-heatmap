# Changelog

All notable changes to gramene-atlas-heatmap are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).
Versions before 6.0.0 are upstream's
[@ebi-gene-expression-group/expression-atlas-heatmap-highcharts](https://github.com/ebi-gene-expression-group/atlas-heatmap).

## [6.2.0] - 2026-09-24

### Added

- **`ExpressionFactorGrid`**, a new named export: one gene's expression in one baseline experiment, drawn as a grid of
  the experiment's factors, for studies with several (the JGI studies of sorghum_v11, such as JGI-SB-1's organism
  part × developmental stage). It is a plain HTML table, without Highcharts.
  - It fetches `json/experiments/<experiment>` with `geneQuery=<gene>`, as the heatmap does for one experiment. It
    shows the same spinner and error alert, and calls `fail` once per failed request.
  - A factor varies when the study's assay groups have more than one value of it. A group that lacks a factor has
    the value "—" for it. Factors that do not vary are shown above the grid, e.g. "organism part: stem internode".
  - By default, `organism part` goes on the columns when it varies. Otherwise the columns get the factor with the most
    values, and the rows get the factor with the most values among the others. Any other factors are folded into
    the rows: each combination is a row of its own, labelled e.g. "TX08001 · outer core". Values are in natural
    order (S1, S2, …, S10).
  - A study with two factors gets a "Swap rows and columns" button. A study with more gets "Rows" and "Columns"
    selects as well; choosing the other axis's factor swaps them. A study with one factor is drawn as a single row,
    labelled with the gene id.
  - The axes can be controlled with the `rowFactor` and `columnFactor` props, which are ignored unless they name a
    factor that varies. `onChangeFactors({rowFactor, columnFactor})` is called when the reader changes them.
  - A cell that holds several assay groups (groups that share every factor value and differ by `sample id`) is
    split into one band per sample, ordered by sample id. Each band has its own colour.
  - Every band has exactly the colour that ExpressionAtlasHeatmap gives that assay group for the same payload: the
    colour of its data series (Below cutoff, Low, …, High), checked in the tests against the point colours of a real
    ExpressionAtlasHeatmap drawn from the same payload. The legend is the single-experiment gradient legend of the
    Paralogs heatmap. Cells where nothing was measured are hatched.
  - The grid's table resets the borders that host pages' table rules give th and td (gramene-mdview's copy of
    Bootstrap's reboot gives them 2px).
  - Hovering or focusing a band (every band is in the tab order, with an `aria-label`) shows a tooltip. It lists
    the sample's factor values, sample id, replicates, and value with its unit. Escape hides it.
  - Long column labels are drawn vertically and cut short with an ellipsis; hovering one shows the whole label.
  - Props: `experiment` and `gene` (both required), `atlasUrl`, `rowFactor`, `columnFactor`, `onChangeFactors`, and
    the heatmap's `inProxy`, `linkTarget`, `resolveUrl`, `fail`, `className`, `style` and `injectStyles`.
- **`filterRows` prop** of ExpressionAtlasHeatmap: `(row) => boolean` over the payload's `profiles.rows`. It filters
  the payload after it is fetched, so a new function filters again without a new request.
  - Columns that no remaining row has a value in are dropped, and `searchResultTotal` loses the removed rows.
  - With no row left, the "no results" message shows.
  - A new function that keeps the same rows keeps the chart (zoom, ordering and filters) as it is.
  - gramene-search uses it to leave the JGI studies out of its EBI Studies tab.
- Fixtures `grid.JGI-SB-1.msd2` to `grid.JGI-SB-4.msd2` (sorghum_v11, `SORBI_3006G095600`), and a playground panel
  `?panel=grid` with a study select and a gene field.

## [6.1.0] - 2026-09-24

### Changed

- Column labels no longer push the heatmap off the screen. Studies with very long column names, such as the
  146-character differential contrasts of E-GEOD-128441, used to get a header about 700 px tall.
  - Text that every column label starts with (15 characters or more, ending at a whole word) is shown once as the
    column axis title, followed by "…". Each label shows only the rest. For example, "environmental stress: none vs
    drought environment" is shown once above E-GEOD-128441's columns.
  - Column labels may take about as much height as the heatmap's rows (40 px each), but always between 300 and
    450 px. Longer labels are cut short with an ellipsis, and the header is sized for that. Upstream showed
    experiments' labels in full.
  - Hovering a column label shows the whole label. The cell tooltip, the filters and the download still use whole labels.

## [6.0.1] - 2026-09-24

### Fixed

- Column labels no longer overlap when each column is 80 px wide or more (few columns on a wide screen, e.g.
  E-MTAB-5956's 11 columns on a desktop). Highcharts only auto-rotated labels in narrower columns and otherwise
  tried to word-wrap them, which the baseline labels' `white-space: nowrap` prevents. Labels wider than their
  column are now rotated at any width (`xAxis.labels.autoRotationLimit: Infinity`); labels that fit stay horizontal.

## [6.0.0] - 2026-09-23

The first release of the Gramene fork, from expression-atlas-heatmap-highcharts 5.7.2. It is drawn in the host page
instead of an iframe, so gramene-search can show the Expression Atlas heatmap in its Expression tab.

### Breaking

- Published as `gramene-atlas-heatmap`: ESM (`dist/gramene-atlas-heatmap.js`) and CommonJS
  (`dist/gramene-atlas-heatmap.cjs`), with hand-written TypeScript declarations. `"type": "module"`.
- React and ReactDOM `^18.2.0` and react-bootstrap `^2.7.0` are peer dependencies, instead of React 16 and
  react-bootstrap 0.33 dependencies. The controls are react-bootstrap 2 components: the host page must load
  Bootstrap 5 CSS. The EBI Bootstrap 3 stylesheet is no longer used and must not be loaded.
- The anatomogram is [gramene-anatomogram](https://github.com/warelab/anatomogram) 3, which bundles its SVGs.
  `atlasUrl` is no longer used to fetch images, and nothing is fetched from `resources/`.
- `render()` uses `createRoot`, keeps one root per target, accepts an element as well as an id, and returns
  `{unmount}`. Its `render` callback runs once per call.
- Every link, and every window the heatmap opens, goes to `linkTarget` (default `'_blank'`, a new tab with
  `rel="noopener noreferrer"`). Upstream's links relied on the iframe's `<base target=_parent>`.
- Google Analytics is gone. `disableGoogleAnalytics` is accepted and ignored.
- A global `window.Highcharts` is not used: Highcharts 6.2 is imported, and a second copy on the page (error 16)
  should be avoided.
- The CommonJS build `require`s gramene-anatomogram, which is ESM only: Node 20.19 or 22.12 and later, or a bundler.
  Jest's module loader cannot load it.

### Added

- `linkTarget` prop, default `'_blank'`. It is also passed to the anatomogram's licence link.
- `resolveUrl(kind, defaultUrl, context)` prop to rewrite (a string), drop (`null`) or keep (`undefined`) each link:
  `row`, `experiment`, `atlas`, `moreInformation`, `support`, `genomeBrowser` and `download`. `context` has
  `{query, experiment}` plus kind-specific fields, including the row's raw `uri`. It is read through a ref, so a new
  function does not redraw the chart.
- `className` and `style` props for the root `div.gxaHeatmapContainer`.
- `injectStyles` prop, default `true`: a small scoped stylesheet is injected once per document. With `false`, load
  `gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css` (also exported as `./style.css`). Exports
  `ensureStylesInjected`, `STYLE_ELEMENT_ID` and `HEATMAP_CSS`.
- Named export `ExpressionAtlasHeatmap` (also the default) and a frozen `DEFAULT_OPTIONS`.
- An error boundary: a rendering error shows an alert and calls `fail`, instead of unmounting the host page's React
  root.
- `LICENSE` (Apache-2.0) and `NOTICE`.
- A Vite playground (`npm run dev`, port 5175, with a mock API), a vitest suite that fails on any React warning and
  renders real Highcharts in jsdom, CI on Node 20.19 and 24, and release checks (`scripts/check-dist.mjs`,
  `scripts/check-release.mjs`, publint and attw).

### Changed

- **Colours**: baseline experiments use upstream 5.7.2's five log-range buckets (`Low`, `Low-Medium`, `Medium`,
  `Medium-High`, `High`). The widget Gramene deployed before was 5.7.1, with three proportional buckets.
- **The Paralogs anatomogram shows.** The gramene-swagger backend sends the species of a single experiment as its
  display name (`Sorghum bicolor`), which upstream compared with `sorghum_bicolor` and so never showed the
  anatomogram. The name is now normalised, so E-CURD-25 shows root, shoot and vascular system.
- **Row labels highlight tissues.** Hovering an All Studies row label highlights that experiment's tissues in the
  anatomogram. Upstream matched the label text, which never matched: the T/P badge is part of it. Labels now carry
  their row index (`data-gxa-y`).
- **The chart sizes to its own column**, per instance, and follows its container with a `ResizeObserver`. Upstream
  measured the first heatmap on the page. Fullscreen views and several heatmaps on one page now fit. A width change
  reflows the chart; one that changes the layout redraws it and keeps the zoom. Only new data resets the zoom, and
  the controls are then re-enabled.
- Changing the genome browser no longer redraws the chart or resets the zoom.
- Data is fetched with `fetch` and an `AbortController` instead of react-refetch. The request is built exactly as
  upstream built it (`geneQuery=A B C`, never URL-encoded, form Content-Type): the Warelab backend rejects `+`, `%20`
  and extra parameters. A request that is superseded (a new query, an unmount) is aborted.
- `fail({url, method, message})` is called once per failed request (and not twice under StrictMode). Upstream called
  it on every render.
- Loading shows a react-bootstrap spinner instead of `resources/images/loading.gif`. The error alert is a
  react-bootstrap `Alert` with new wording, and an empty result shows a "No results" message.
- The Filters and data-reuse dialogs are react-bootstrap 2 modals (`.gxa-heatmap-modal`) and are no longer
  translucent. Filter options that open are buttons.
- The coexpression slider is a `Form.Range`.
- Icons are Bootstrap Icons SVGs instead of Glyphicons and the EBI font.
- The outside tooltip gets `z-index: 1100`, above a fullscreen Bootstrap 5 modal, and is placed correctly after a
  scrolling container (such as a modal body) scrolls.
- The boxplot and transcripts charts (EBI experiments with gene-specific results) are a lazily loaded chunk, so
  highcharts-more is not in the host's main bundle.

### Removed

- Dependencies: the three `@ebi-gene-expression-group` packages (expression-atlas-number-format and
  expression-atlas-disclaimers are inlined), he, node `url`, object-hash, rc-slider, react-debounce-render,
  react-ga, react-highcharts, react-refetch, sanitize-html and styled-components. Every React 16-only package is
  gone.
- The error alert's link to a third-party website about clearing the browser cache.
- The import-time override of `window.oncontextmenu`: right-click is the page's again.
- Fixed element ids in the controls, which two heatmaps on a page would share.
- Function-component `defaultProps`, legacy lifecycles and `ReactDOM.render`, so React 18 logs no deprecation
  warnings.
- The webpack/Babel toolchain and the `html/` demo pages.

### Fixed

- Warelab payloads pass the payload propTypes: differential rows have no `designElement` or `contrastName`, and
  experiments without genome browsers have no current genome browser.
- The transcripts chart no longer renders a stray `0` when there are no rows.
- An `undefined` prop (for example `atlasUrl={config.atlasUrl}` when unset) keeps its default.

### Security

- Row labels and tooltips are no longer entity-decoded (he) after rendering: markup in a backend string, such as
  `<img onerror>` in a row name, shows as text instead of running.

[6.1.0]: https://github.com/warelab/atlas-heatmap/compare/v6.0.1...v6.1.0
[6.0.1]: https://github.com/warelab/atlas-heatmap/compare/v6.0.0...v6.0.1
[6.0.0]: https://github.com/warelab/atlas-heatmap/compare/v5.7.2...v6.0.0
