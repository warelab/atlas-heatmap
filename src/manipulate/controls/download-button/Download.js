import _range from 'lodash/range.js'

import {jsonText, plural, tsvCell} from './downloadFile.js'

// What the heatmap's Download dialog saves: the heatmap data as it is shown (after the filters, the ordering and the
// similarly expressed genes; see heatmapDataToPresent in HeatmapWithControls.js), limited to the columns in view when
// the chart is zoomed in. Pure functions: DownloadButton.js passes where and when the download is made.

// Upstream's table: a header line with the column labels, then one line per row, the row label followed by its values
const heatmapDataIntoLinesOfData = (heatmapData, placeholder) => {

  const heatmapDataAsMatrix =
    _range(heatmapData.yAxisCategories.length)
      .map(() => _range(heatmapData.xAxisCategories.length).map(() => placeholder))

  heatmapData.dataSeries.forEach(series => {
    series.data.forEach(point => {heatmapDataAsMatrix[point.y][point.x] = point.value})
  })

  return (
    [[``].concat(heatmapData.xAxisCategories.map(header => header.label))].concat(
      heatmapData.yAxisCategories
        .map((rowLabel, ix) => [].concat.apply([rowLabel.label], heatmapDataAsMatrix[ix]))
    ).map(line => line.map(tsvCell).join(`\t`))
  )

}

/**
 * The columns of `range` ({from, to}: indexes of heatmapData.xAxisCategories, both included), as if they were the only
 * ones; heatmapData itself without a range (or with one that covers every column).
 */
const heatmapDataInColumns = (heatmapData, range) => {
  const count = heatmapData.xAxisCategories.length
  if (!range || count === 0) {
    return heatmapData
  }
  const from = Math.max(0, Math.min(count - 1, range.from))
  const to = Math.max(from, Math.min(count - 1, range.to))
  if (from === 0 && to === count - 1) {
    return heatmapData
  }
  return {
    ...heatmapData,
    xAxisCategories: heatmapData.xAxisCategories.slice(from, to + 1),
    dataSeries: heatmapData.dataSeries.map(series => ({
      ...series,
      data: series.data.filter(point => point.x >= from && point.x <= to).map(point => ({...point, x: point.x - from}))
    }))
  }
}

// The zoom as the download describes it (1-based, both included), or null
const zoomOf = (heatmapData, range) => {
  const shown = heatmapDataInColumns(heatmapData, range)
  if (shown === heatmapData) {
    return null
  }
  const from = Math.max(0, range.from) + 1
  return {from, to: from + shown.xAxisCategories.length - 1, of: heatmapData.xAxisCategories.length}
}

// The point of every cell, row by row (null where the heatmap has none)
const pointMatrix = heatmapData => {
  const matrix = heatmapData.yAxisCategories.map(() => heatmapData.xAxisCategories.map(() => null))
  heatmapData.dataSeries.forEach(series => series.data.forEach(point => {
    if (matrix[point.y] && point.x >= 0 && point.x < matrix[point.y].length) {
      matrix[point.y][point.x] = point
    }
  }))
  return matrix
}

const numberOrNull = value => (typeof value === `number` && Number.isFinite(value) ? value : null)

const unitOf = points => {
  const withUnit = points.find(point => point && point.info && point.info.unit)
  return withUnit ? withUnit.info.unit : null
}

// The unit every row with one shares, or null
const commonUnit = rows => {
  const units = [...new Set(rows.map(row => row.unit).filter(Boolean))]
  return units.length === 1 ? units[0] : null
}

/**
 * The heatmap's table (in the columns of `range`, all of them without one): columns [{label, id}] (plus assayGroupId
 * for a baseline experiment's assay groups), rows [{label, id, unit, values}] with a value (a number, or null for no
 * data) per column, and for differential experiments pValues aligned with values. Labels are whole (not the shortened
 * labels the chart shows).
 */
const heatmapTable = (heatmapData, {range, isDifferential = false} = {}) => {
  const shown = heatmapDataInColumns(heatmapData, range)
  const matrix = pointMatrix(shown)
  const columns = shown.xAxisCategories.map(category => {
    const trackId = category.info && category.info.trackId
    return {
      label: category.label,
      id: category.id || null,
      ...(trackId && trackId !== category.id ? {assayGroupId: trackId} : {})
    }
  })
  const rows = shown.yAxisCategories.map((category, y) => ({
    label: category.label,
    id: category.id || null,
    unit: unitOf(matrix[y]),
    values: matrix[y].map(point => (point ? numberOrNull(point.value) : null)),
    ...(isDifferential ? {pValues: matrix[y].map(point => (point && point.info ? numberOrNull(point.info.pValue) : null))} : {})
  }))
  return {columns, rows, unit: commonUnit(rows), zoom: zoomOf(heatmapData, range)}
}

/**
 * The tab-delimited file: upstream's comment lines (where and when, then descriptionLines), the unit and the zoom when
 * there is one, then upstream's table of the columns in view. Cells with no data are empty in one experiment and `NA`
 * across experiments, as upstream wrote them.
 */
const heatmapTsv = ({heatmapData, range, descriptionLines = [], isSingleExperiment, downloadedFrom, downloadedAt}) => {
  const {unit, zoom} = heatmapTable(heatmapData, {range})
  return [
    `# Downloaded from: ${downloadedFrom}`,
    `# Timestamp: ${downloadedAt}`,
    ...descriptionLines.map(line => `# ${line}`),
    ...(unit ? [`# Unit: ${unit}`] : []),
    ...(zoom ? [`# Zoomed in: columns ${zoom.from} to ${zoom.to} of ${zoom.of}`] : []),
    ...heatmapDataIntoLinesOfData(heatmapDataInColumns(heatmapData, range), isSingleExperiment ? `` : `NA`)
  ].map(line => `${line.replace(/[\r\n]+/g, ` `)}\n`).join(``)
}

/**
 * The JSON file: {source, atlasUrl, experiment: {accession, description, type} | null, query, unit, zoom, columns,
 * rows, downloadedFrom, downloadedAt}, with columns and rows as heatmapTable gives them.
 */
const heatmapJson = ({heatmapData, range, experiment, query, atlasUrl, isDifferential, downloadedFrom, downloadedAt}) => {
  const {columns, rows, unit, zoom} = heatmapTable(heatmapData, {range, isDifferential})
  return jsonText({
    source: `Expression Atlas`,
    atlasUrl: atlasUrl || null,
    experiment: experiment ?
      {accession: experiment.accession, description: experiment.description || null, type: experiment.type || null} :
      null,
    query: query || null,
    unit,
    zoom,
    columns,
    rows,
    downloadedFrom,
    downloadedAt
  })
}

/**
 * Whether the heatmap shows nothing to save: no rows (it then says "No data match your filtering criteria…" instead of
 * drawing a chart) or no columns.
 */
const heatmapIsEmpty = heatmapData =>
  heatmapData.yAxisCategories.length === 0 || heatmapData.xAxisCategories.length === 0

/**
 * What the dialog says it saves, e.g. `9 rows × 24 columns, as shown`, or that there is nothing to save when the heatmap
 * is empty.
 */
const heatmapSummary = (heatmapData, range) => {
  if (heatmapIsEmpty(heatmapData)) {
    return `Nothing to download: the heatmap shows no data.`
  }
  const zoom = zoomOf(heatmapData, range)
  const rows = plural(heatmapData.yAxisCategories.length, `row`)
  return zoom ?
    `${rows} × ${zoom.to - zoom.from + 1} of ${plural(zoom.of, `column`)} (zoomed in), as shown` :
    `${rows} × ${plural(heatmapData.xAxisCategories.length, `column`)}, as shown`
}

// The gene ids of a geneQuery parameter: `A B C`, or EBI's [{value: `A`}, …]
const genesOf = geneQuery => (
  typeof geneQuery === `string` ?
    geneQuery.split(/\s+/).filter(Boolean) :
    Array.isArray(geneQuery) ?
      geneQuery.map(gene => (gene && typeof gene === `object` ? gene.value : gene)).filter(Boolean).map(String) :
      []
)

/**
 * The query of the download, from the request's source (request.js buildSource): {genes: [...]}, plus the condition
 * and any other parameter. A string query (an endpoint) has no genes.
 */
const queryOfSource = source => {
  const {geneQuery, conditionQuery, ...others} = (source && source.params) || {}
  return {
    genes: genesOf(geneQuery),
    ...(conditionQuery ? {condition: conditionQuery} : {}),
    ...others
  }
}

/** The default file name (no extension): expression-<accession, or studies>-<first gene>. */
const heatmapFileName = ({experiment, genes = []}) =>
  [`expression`, experiment && experiment.accession ? experiment.accession : `studies`, genes[0]].filter(Boolean).join(`-`)

// Upstream's description of the query, for the file's comment lines. The Warelab backend echoes geneQuery as
// `[null,…]` (or `[]`) and an empty conditionQuery as `[]`: name the genes instead, and leave out the empty conditions.
const withQueriedGenes = (lines, genes) => lines.map(line => {
  const withoutConditions = line.replace(/, in conditions \[\]/, ``)
  return genes.length ?
    withoutConditions.replace(/^(Gene query: |Query results for: )\[(?:null,?)*\]/, (_, prefix) => `${prefix}${genes.join(` `)}`) :
    withoutConditions
})

export {
  heatmapDataIntoLinesOfData, heatmapDataInColumns, heatmapTable, heatmapTsv, heatmapJson, heatmapIsEmpty, heatmapSummary,
  queryOfSource, heatmapFileName, withQueriedGenes
}
