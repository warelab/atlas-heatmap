// The model of ExpressionFactorGrid: one gene's expression in one baseline experiment, laid out as a grid with one
// study factor on the rows and another on the columns. Pure functions of the json/experiments/<accession> payload, with
// no React and no chart, so they are easy to test and to reuse.
//
// Every assay group (column header of the payload) is a sample of the grid. Its factor values are its FACTOR properties;
// a group that lacks one of the study's factors has MISSING for it. Factors with more than one value across the groups
// vary; the others are constant (shown as a caption). One varying factor goes on the columns, another on the rows, and
// the ones left over are folded into the rows: each combination of the row factor's value and theirs is a row of its
// own. A cell holds every sample with its row's and column's values, ordered by sample id: groups can share every
// factor value and differ only by the SAMPLE property `sample id`.

/** The value of a factor that an assay group does not have. */
export const MISSING = `—`
/** The SAMPLE property that names a sample. */
export const SAMPLE_ID = `sample id`
/** The factor that goes on the columns when it varies. */
export const ORGANISM_PART = `organism part`
/** Joins the values of a row's factors in its label. */
export const LABEL_SEPARATOR = ` · `

const FACTOR = `FACTOR`
const SAMPLE = `SAMPLE`
// For column headers without FACTOR properties (not seen in Warelab or EBI baseline payloads): their factorValue
const FALLBACK_FACTOR = `condition`

const collator = new Intl.Collator(`en`, {numeric: true})

/**
 * Natural order, numbers by value (S1, S2, …, S10), with MISSING last.
 */
export const naturalCompare = (a, b) => {
  if (a === b) {
    return 0
  } else if (a === MISSING) {
    return 1
  } else if (b === MISSING) {
    return -1
  }
  const left = String(a)
  const right = String(b)
  return collator.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0)
}

const compareTuples = (a, b) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const order = naturalCompare(a[i], b[i])
    if (order !== 0) {
      return order
    }
  }
  return a.length - b.length
}

const propertiesOf = header => (
  header && header.assayGroupSummary && Array.isArray(header.assayGroupSummary.properties) ?
    header.assayGroupSummary.properties :
    []
)

// FACTOR property names in the order they first appear
const factorNamesOf = columnHeaders => columnHeaders.reduce(
  (names, header) => propertiesOf(header).reduce(
    (known, {propertyName, contrastPropertyType}) =>
      contrastPropertyType === FACTOR && propertyName && !known.includes(propertyName) ? known.concat(propertyName) : known,
    names),
  [])

const isGiven = value => value !== undefined && value !== null && String(value) !== ``

// The profile row of `gene` (by id or name, then ignoring case), else the first one; -1 when there is none
const profileIndexOf = (rows, gene) => {
  if (rows.length === 0) {
    return -1
  }
  if (gene) {
    const wanted = String(gene)
    const exact = rows.findIndex(row => row.id === wanted || row.name === wanted)
    if (exact >= 0) {
      return exact
    }
    const lower = wanted.toLowerCase()
    const loose = rows.findIndex(row =>
      String(row.id || ``).toLowerCase() === lower || String(row.name || ``).toLowerCase() === lower)
    if (loose >= 0) {
      return loose
    }
  }
  return 0
}

/**
 * The samples and factors of a payload, for one gene: everything that does not depend on the choice of axes.
 *
 * @param {Object} payload - a json/experiments/<accession> baseline payload
 * @param {Object} [options]
 * @param {string} [options.gene] - the gene whose profile row to use (by id or name); the first row otherwise
 * @returns {{
 *   gene: {id: string, name: string}, profileIndex: number, unit: string,
 *   samples: {index: number, assayGroupId: string, sampleId: string, replicates: ?number,
 *             factorValues: Object<string, string>, value: ?number, ontologyTermId: ?string}[],
 *   factors: {name: string, values: string[], count: number}[],
 *   varyingFactors: string[], constantFactors: {name: string, value: string}[]
 * }}
 */
export const analyseFactors = (payload, {gene} = {}) => {
  const columnHeaders = (payload && Array.isArray(payload.columnHeaders)) ? payload.columnHeaders : []
  const profileRows = (payload && payload.profiles && Array.isArray(payload.profiles.rows)) ? payload.profiles.rows : []
  const profileIndex = profileIndexOf(profileRows, gene)
  const profile = profileIndex >= 0 ? profileRows[profileIndex] : null

  const factorNames = factorNamesOf(columnHeaders)
  const fromFactorValue = factorNames.length === 0 && columnHeaders.some(header => isGiven(header.factorValue))
  const names = fromFactorValue ? [FALLBACK_FACTOR] : factorNames

  const samples = columnHeaders.map((header, index) => {
    const properties = propertiesOf(header)
    const factorValues = {}
    names.forEach(name => {
      if (fromFactorValue) {
        factorValues[name] = isGiven(header.factorValue) ? String(header.factorValue) : MISSING
      } else {
        const property = properties.find(p => p.contrastPropertyType === FACTOR && p.propertyName === name)
        factorValues[name] = property && isGiven(property.testValue) ? String(property.testValue) : MISSING
      }
    })
    const sampleId = properties.find(p => p.contrastPropertyType === SAMPLE && p.propertyName === SAMPLE_ID)
    const expression = profile && Array.isArray(profile.expressions) ? profile.expressions[index] : undefined
    const replicates = header && header.assayGroupSummary ? header.assayGroupSummary.replicates : undefined
    const assayGroupId = header && isGiven(header.assayGroupId) ? String(header.assayGroupId) : String(index)
    return {
      index,
      assayGroupId,
      sampleId: sampleId && isGiven(sampleId.testValue) ? String(sampleId.testValue) : assayGroupId,
      replicates: typeof replicates === `number` ? replicates : null,
      factorValues,
      value: expression && typeof expression.value === `number` ? expression.value : null,
      ontologyTermId: (header && header.factorValueOntologyTermId) || null
    }
  })

  const factors = names.map(name => {
    const values = [...new Set(samples.map(sample => sample.factorValues[name]))].sort(naturalCompare)
    return {name, values, count: values.filter(value => value !== MISSING).length}
  })

  return {
    gene: {
      id: profile && isGiven(profile.id) ? String(profile.id) : String(gene || ``),
      name: profile && isGiven(profile.name) ? String(profile.name) : String(gene || ``)
    },
    profileIndex,
    unit: (profile && profile.expressionUnit) || ``,
    samples,
    factors,
    varyingFactors: factors.filter(factor => factor.values.length > 1).map(factor => factor.name),
    constantFactors: factors
      .filter(factor => factor.values.length === 1 && factor.values[0] !== MISSING)
      .map(factor => ({name: factor.name, value: factor.values[0]}))
  }
}

/**
 * The row and column factors: the requested ones when they vary (the column wins when both name the same factor), and
 * otherwise the defaults. The default column is `organism part` when it varies, else the factor with the most values;
 * the default row is the factor with the most values among the others (values an assay group lacks do not count; ties
 * go to the factor the study lists first). One varying factor is the column, with no row factor; none leaves both null.
 */
export const resolveAxes = ({factors, varyingFactors}, {rowFactor, columnFactor} = {}) => {
  if (varyingFactors.length === 0) {
    return {rowFactor: null, columnFactor: null}
  }
  if (varyingFactors.length === 1) {
    return {rowFactor: null, columnFactor: varyingFactors[0]}
  }
  const count = name => factors.find(factor => factor.name === name).count
  const mostValues = candidates => candidates.reduce((best, name) => (best === null || count(name) > count(best) ? name : best), null)
  const varies = name => typeof name === `string` && varyingFactors.includes(name)

  let column = varies(columnFactor) ? columnFactor : null
  let row = varies(rowFactor) && rowFactor !== column ? rowFactor : null
  if (column === null) {
    const candidates = varyingFactors.filter(name => name !== row)
    column = candidates.includes(ORGANISM_PART) ? ORGANISM_PART : mostValues(candidates)
  }
  if (row === null) {
    row = mostValues(varyingFactors.filter(name => name !== column))
  }
  return {rowFactor: row, columnFactor: column}
}

/** Rows become columns and columns rows. */
export const swapAxes = ({rowFactor, columnFactor}) => ({rowFactor: columnFactor, columnFactor: rowFactor})

/**
 * Puts `factor` on `axis` (`row` or `column`). The factor of the other axis swaps places; a folded one takes the
 * axis's place and the factor it replaces is folded into the rows.
 */
export const chooseAxis = ({rowFactor, columnFactor}, axis, factor) => (
  axis === `row` ?
    (factor === columnFactor ? {rowFactor: factor, columnFactor: rowFactor} : {rowFactor: factor, columnFactor}) :
    (factor === rowFactor ? {rowFactor: columnFactor, columnFactor: factor} : {rowFactor, columnFactor: factor})
)

const rowLabelOf = values => values.filter(value => value !== MISSING).join(LABEL_SEPARATOR) || MISSING

const bySampleId = (a, b) => naturalCompare(a.sampleId, b.sampleId) || a.index - b.index

/**
 * Lays out an analysis (analyseFactors) on the requested axes (see resolveAxes).
 *
 * @returns the analysis, plus {rowFactor, columnFactor, foldedFactors, rows, columns, cells, maxSamplesPerCell}:
 *   rows: {key, label, values: Object<factor, value>}[] - the combinations of the row factor and the folded factors
 *     that some sample has, in natural order; with no row factor, one row labelled with the gene id
 *   columns: {key, value, label}[] - the column factor's values in natural order; with no column factor, one column
 *     (value null) labelled with the constant factors' values
 *   cells[row][column]: the samples of that cell, ordered by sample id (empty when nothing was measured there)
 */
export const layoutFactorGrid = (analysis, requested = {}) => {
  const {factors, varyingFactors, constantFactors, samples, gene} = analysis
  const {rowFactor, columnFactor} = resolveAxes(analysis, requested)
  const foldedFactors = varyingFactors.filter(name => name !== rowFactor && name !== columnFactor)
  const rowFactors = rowFactor === null ? [] : [rowFactor, ...foldedFactors]

  const columnValues = columnFactor === null ? [null] : factors.find(factor => factor.name === columnFactor).values
  const columns = columnValues.map(value => ({
    key: value === null ? `` : value,
    value,
    label: value === null ? (constantFactors.map(factor => factor.value).join(LABEL_SEPARATOR) || `all samples`) : value
  }))

  const rowKeyOf = sample => JSON.stringify(rowFactors.map(name => sample.factorValues[name]))
  const rowValues = new Map()
  samples.forEach(sample => {
    const key = rowKeyOf(sample)
    if (!rowValues.has(key)) {
      rowValues.set(key, rowFactors.map(name => sample.factorValues[name]))
    }
  })
  const rows = [...rowValues.entries()]
    .sort(([, a], [, b]) => compareTuples(a, b))
    .map(([key, values]) => ({
      key,
      label: rowFactors.length === 0 ? (gene.id || gene.name) : rowLabelOf(values),
      values: rowFactors.reduce((byName, name, index) => ({...byName, [name]: values[index]}), {})
    }))

  const rowIndex = new Map(rows.map((row, index) => [row.key, index]))
  const columnIndex = new Map(columns.map((column, index) => [column.value, index]))
  const cells = rows.map(() => columns.map(() => []))
  samples.forEach(sample => {
    const column = columnFactor === null ? 0 : columnIndex.get(sample.factorValues[columnFactor])
    cells[rowIndex.get(rowKeyOf(sample))][column].push(sample)
  })
  cells.forEach(cellsOfRow => cellsOfRow.forEach(cell => cell.sort(bySampleId)))

  return {
    ...analysis,
    rowFactor,
    columnFactor,
    foldedFactors,
    rows,
    columns,
    cells,
    maxSamplesPerCell: cells.reduce((most, cellsOfRow) => Math.max(most, ...cellsOfRow.map(cell => cell.length)), 0)
  }
}

/**
 * The whole model in one call: layoutFactorGrid(analyseFactors(payload, {gene}), {rowFactor, columnFactor}).
 */
export const buildFactorGrid = (payload, {rowFactor, columnFactor, gene} = {}) =>
  layoutFactorGrid(analyseFactors(payload, {gene}), {rowFactor, columnFactor})

export default buildFactorGrid
