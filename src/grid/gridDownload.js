// What ExpressionFactorGrid's Download dialog saves: every sample of the study for the gene, one per line (long
// format), whatever the axes. Pure functions of the grid's model (factorGrid.js: analyseFactors or layoutFactorGrid);
// FactorGridView passes where and when the download is made.

import {jsonText, plural, tsvLines} from '../manipulate/controls/download-button/downloadFile.js'
import {MISSING, naturalCompare} from './factorGrid.js'

/** The samples by their factor values, in the study's factor order, then by sample id: an order no axis changes. */
const samplesInOrder = ({samples, factors}) => [...samples].sort((a, b) => {
  for (const {name} of factors) {
    const order = naturalCompare(a.factorValues[name], b.factorValues[name])
    if (order !== 0) {
      return order
    }
  }
  return naturalCompare(a.sampleId, b.sampleId) || a.index - b.index
})

// A factor value, null for one the sample lacks
const factorValue = (sample, name) => (sample.factorValues[name] === MISSING ? null : sample.factorValues[name])

/**
 * The tab-delimited file: a header line (gene, study, the study's factors in its order, sample id, replicates,
 * expression with its unit), then one line per sample. A factor the sample lacks and a missing value are empty.
 */
const gridTsv = (grid, {accession}) => {
  const {factors, gene, unit} = grid
  return tsvLines([
    [`gene`, `study`, ...factors.map(({name}) => name), `sample id`, `replicates`, unit ? `expression (${unit})` : `expression`],
    ...samplesInOrder(grid).map(sample => [
      gene.id, accession, ...factors.map(({name}) => factorValue(sample, name)), sample.sampleId, sample.replicates,
      sample.value
    ])
  ])
}

/**
 * The JSON file: {gene, study: {accession, description}, factors: [{name, values, varies}], rowFactor, columnFactor,
 * unit, samples: [{factors: {name: value | null}, sampleId, assayGroupId, replicates, value}], downloadedFrom,
 * downloadedAt}. rowFactor and columnFactor are the axes shown (null when there is none); the samples do not depend on
 * them.
 */
const gridJson = (grid, {experiment, accession, downloadedFrom, downloadedAt}) => {
  const {factors, varyingFactors, gene, unit} = grid
  return jsonText({
    gene: gene.id,
    study: {
      accession: (experiment && experiment.accession) || accession,
      description: (experiment && experiment.description) || null
    },
    factors: factors.map(({name, values}) => ({
      name,
      values: values.filter(value => value !== MISSING),
      varies: varyingFactors.includes(name)
    })),
    rowFactor: grid.rowFactor === undefined ? null : grid.rowFactor,
    columnFactor: grid.columnFactor === undefined ? null : grid.columnFactor,
    unit: unit || null,
    samples: samplesInOrder(grid).map(sample => ({
      factors: factors.reduce((byName, {name}) => ({...byName, [name]: factorValue(sample, name)}), {}),
      sampleId: sample.sampleId,
      assayGroupId: sample.assayGroupId,
      replicates: sample.replicates,
      value: sample.value
    })),
    downloadedFrom,
    downloadedAt
  })
}

/**
 * What the dialog says it saves, e.g. `31 samples of JGI-SB-1 for SORBI_3006G095600`, or that there is nothing to save
 * when the study has no samples.
 */
const gridSummary = (grid, {accession}) =>
  grid.samples.length === 0 ?
    `Nothing to download: the study has no samples.` :
    `${plural(grid.samples.length, `sample`)}${accession ? ` of ${accession}` : ``}${grid.gene.id ? ` for ${grid.gene.id}` : ``}`

/** The default file name (no extension): <gene>-<experiment>. */
const gridFileName = ({gene, accession}) => [gene, accession].filter(Boolean).join(`-`)

export {samplesInOrder, gridTsv, gridJson, gridSummary, gridFileName}
