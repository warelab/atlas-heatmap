import { describe, expect, it } from 'vitest'

import {
  analyseFactors, buildFactorGrid, chooseAxis, layoutFactorGrid, MISSING, naturalCompare, resolveAxes, swapAxes
} from '../../src/grid/factorGrid.js'
import sb1 from '../fixtures/grid.JGI-SB-1.msd2.json'
import sb2 from '../fixtures/grid.JGI-SB-2.msd2.json'
import sb3 from '../fixtures/grid.JGI-SB-3.msd2.json'
import sb4 from '../fixtures/grid.JGI-SB-4.msd2.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import emtab5956 from '../fixtures/paralogs.E-MTAB-5956.sorghum_v11.json'

// The model of ExpressionFactorGrid, on the four JGI studies captured for msd2 (SORBI_3006G095600) on sorghum_v11
const MSD2 = `SORBI_3006G095600`
const labels = list => list.map(item => item.label)
const filledCells = grid => grid.cells.flat().filter(cell => cell.length > 0)
const cellAt = (grid, rowLabel, columnLabel) =>
  grid.cells[labels(grid.rows).indexOf(rowLabel)][labels(grid.columns).indexOf(columnLabel)]
const sampleIds = cell => cell.map(sample => sample.sampleId)

// Every assay group is in exactly one cell, and each cell's samples have its row's and column's values
const expectEverySampleOnce = grid => {
  const indices = grid.cells.flat(2).map(sample => sample.index)
  expect([...indices].sort((a, b) => a - b)).toEqual(grid.samples.map(sample => sample.index))
  grid.rows.forEach((row, r) => grid.columns.forEach((column, c) => grid.cells[r][c].forEach(sample => {
    Object.entries(row.values).forEach(([factor, value]) => expect(sample.factorValues[factor]).toBe(value))
    if (grid.columnFactor !== null) {
      expect(sample.factorValues[grid.columnFactor]).toBe(column.value)
    }
  })))
}

// A payload with only some of its assay groups (and their expressions)
const withGroups = (payload, keep) => {
  const indices = payload.columnHeaders.map((header, index) => index).filter(index => keep(payload.columnHeaders[index]))
  return {
    ...payload,
    columnHeaders: indices.map(index => payload.columnHeaders[index]),
    profiles: {
      ...payload.profiles,
      rows: payload.profiles.rows.map(row => ({...row, expressions: indices.map(index => row.expressions[index])}))
    }
  }
}
const factorOf = (header, name) =>
  header.assayGroupSummary.properties.find(p => p.contrastPropertyType === `FACTOR` && p.propertyName === name)

describe(`naturalCompare`, () => {
  it(`orders numbers by value and puts the missing value last`, () => {
    expect([`S10`, `T1`, `S2`, MISSING, `S1`, `T11`, `T2`].sort(naturalCompare))
      .toEqual([`S1`, `S2`, `S10`, `T1`, `T2`, `T11`, MISSING])
    expect([`internode9`, `internode10`, `internode2`].sort(naturalCompare)).toEqual([`internode2`, `internode9`, `internode10`])
    expect(naturalCompare(`a`, `a`)).toBe(0)
    expect(naturalCompare(`B`, `b`)).not.toBe(0)
  })
})

describe(`JGI-SB-1: organism part × developmental stage`, () => {
  const grid = buildFactorGrid(sb1.body, {gene: MSD2})

  it(`finds the two factors and nothing constant; organism part goes on the columns`, () => {
    expect(grid.factors.map(({name, count}) => [name, count])).toEqual([[`organism part`, 8], [`developmental stage`, 5]])
    expect(grid.varyingFactors).toEqual([`organism part`, `developmental stage`])
    expect(grid.constantFactors).toEqual([])
    expect(grid).toMatchObject({columnFactor: `organism part`, rowFactor: `developmental stage`, foldedFactors: [], unit: `TPM`})
    expect(grid.gene).toEqual({id: MSD2, name: MSD2})
  })

  it(`has 8 columns and 5 rows in natural order, 22 of 40 cells filled, up to 3 samples a cell`, () => {
    expect(labels(grid.columns)).toEqual([
      `leaf lamina`, `leaf sheath`, `panicle inflorescence`, `peduncle`, `root`, `root tip`, `shoot system`, `stem internode`])
    expect(labels(grid.rows)).toEqual([
      `inflorescence development stage`, `seedling development stage`, `sporophyte vegetative stage`,
      `whole plant flowering stage`, `whole plant fruit ripening stage`])
    expect(filledCells(grid)).toHaveLength(22)
    expect(grid.maxSamplesPerCell).toBe(3)
    expect(grid.samples).toHaveLength(31)
    expectEverySampleOnce(grid)
  })

  it(`splits a cell into its samples, ordered by sample id, each with its own value`, () => {
    const leaf = cellAt(grid, `inflorescence development stage`, `leaf lamina`)
    expect(sampleIds(leaf)).toEqual([`leaf_lower_growing.floral_initiation`, `leaf_upper_growing.floral_initiation`])
    expect(leaf.map(sample => sample.value)).toEqual([41.344, 10.795])
    expect(leaf[0]).toMatchObject({
      assayGroupId: `g9`, replicates: 2, ontologyTermId: `PO_0001083`,
      factorValues: {'organism part': `leaf lamina`, 'developmental stage': `inflorescence development stage`}
    })
    // in collation order, where _ comes before .
    expect(sampleIds(cellAt(grid, `inflorescence development stage`, `stem internode`))).toEqual([
      `growing_internode_upper.floral_initiation`, `growing_internode.floral_initiation`, `internode_mature.floral_initiation`])
    expect(cellAt(grid, `seedling development stage`, `panicle inflorescence`)).toEqual([])
  })

  it(`swaps rows and columns on request`, () => {
    const swapped = buildFactorGrid(sb1.body, {gene: MSD2, ...swapAxes(grid)})
    expect(swapped).toMatchObject({rowFactor: `organism part`, columnFactor: `developmental stage`})
    expect(labels(swapped.rows)).toEqual(labels(grid.columns))
    expect(labels(swapped.columns)).toEqual(labels(grid.rows))
    expect(filledCells(swapped)).toHaveLength(22)
    expectEverySampleOnce(swapped)
  })
})

describe(`JGI-SB-2: a constant factor, and factors some assay groups lack`, () => {
  const grid = buildFactorGrid(sb2.body, {gene: MSD2})

  it(`shows organism part as a constant, and counts missing values apart`, () => {
    expect(grid.constantFactors).toEqual([{name: `organism part`, value: `stem internode`}])
    expect(grid.varyingFactors).toEqual([`cultivar`, `sampling time point`, `sampling site`])
    const factor = name => grid.factors.find(f => f.name === name)
    expect(factor(`sampling time point`).values).toHaveLength(19)
    expect(factor(`sampling time point`).count).toBe(18)
    expect(factor(`sampling site`).values).toEqual([`epithelial tissue`, `inner core`, `middle core`, `outer core`, MISSING])
    expect(factor(`cultivar`).values).toEqual([`DDYM`, `Della`, `Keller`, `TX08001`])
  })

  it(`puts the factor with most values on the columns, and folds the third into the rows`, () => {
    // organism part does not vary; cultivar and sampling site tie on 4 values, and cultivar comes first
    expect(grid).toMatchObject({
      columnFactor: `sampling time point`, rowFactor: `cultivar`, foldedFactors: [`sampling site`]
    })
    expect(labels(grid.columns)).toEqual([
      `S1`, `S2`, `S3`, `S6`, `S7`, `S10`, `S11`,
      `T1`, `T2`, `T3`, `T4`, `T5`, `T6`, `T7`, `T8`, `T9`, `T10`, `T11`, MISSING])
    expect(labels(grid.rows)).toEqual([
      `DDYM`, `Della`, `Keller`,
      `TX08001 · epithelial tissue`, `TX08001 · inner core`, `TX08001 · middle core`, `TX08001 · outer core`])
    expect(grid.rows[4].values).toEqual({cultivar: `TX08001`, 'sampling site': `inner core`})
    expect(grid.rows[0].values).toEqual({cultivar: `DDYM`, 'sampling site': MISSING})
    expect(grid.samples).toHaveLength(46)
    expectEverySampleOnce(grid)
  })

  it(`keeps the assay groups that share every factor value apart, by sample id`, () => {
    const innerCore = cellAt(grid, `TX08001 · inner core`, MISSING)
    expect(sampleIds(innerCore)).toEqual([
      `TX08001.internode2.inner_core`, `TX08001.internode5.inner_core`, `TX08001.internode6.inner_core`,
      `TX08001.internode8.inner_core`, `TX08001.internode9.inner_core`])
    expect(innerCore.map(sample => sample.value)).toEqual([1.957, 3.524, 5.304, 7.344, 9.74])
    expect(grid.maxSamplesPerCell).toBe(5)
    expect(sampleIds(cellAt(grid, `Della`, `T10`))).toEqual([`Della.internode.T10`])
  })

  it(`folds whichever factors are left over into the rows`, () => {
    const bySite = buildFactorGrid(sb2.body, {gene: MSD2, rowFactor: `sampling site`, columnFactor: `cultivar`})
    expect(bySite).toMatchObject({rowFactor: `sampling site`, columnFactor: `cultivar`, foldedFactors: [`sampling time point`]})
    // a row whose sampling site is missing is labelled with its time point alone
    expect(labels(bySite.rows).slice(0, 4)).toEqual([
      `epithelial tissue`, `inner core`, `middle core`, `outer core`])
    expect(labels(bySite.rows).slice(4, 8)).toEqual([`S1`, `S2`, `S3`, `S6`])
    expect(bySite.rows).toHaveLength(4 + 18)
    expect(labels(bySite.columns)).toEqual([`DDYM`, `Della`, `Keller`, `TX08001`])
    expectEverySampleOnce(bySite)

    // T1 was sampled in Della and Keller
    const t1 = bySite.rows.findIndex(row => row.label === `T1`)
    expect(bySite.cells[t1].map(cell => sampleIds(cell))).toEqual([
      [], [`Della.internode.T1`], [`Keller.growing_internode.T1`], []])
  })
})

describe(`JGI-SB-3: organism part × growth condition, every cell measured`, () => {
  it(`fills all 10 cells with one sample each`, () => {
    const grid = buildFactorGrid(sb3.body, {gene: MSD2})
    expect(grid).toMatchObject({columnFactor: `organism part`, rowFactor: `growth condition`, foldedFactors: []})
    expect(labels(grid.columns)).toEqual([`root`, `shoot system`])
    expect(grid.rows).toHaveLength(5)
    expect(filledCells(grid)).toHaveLength(10)
    expect(grid.maxSamplesPerCell).toBe(1)
    expectEverySampleOnce(grid)
  })
})

describe(`JGI-SB-4: three factors`, () => {
  const grid = buildFactorGrid(sb4.body, {gene: MSD2})

  it(`puts organism part on the columns, developmental stage on the rows, and folds cultivar into them`, () => {
    expect(grid).toMatchObject({
      columnFactor: `organism part`, rowFactor: `developmental stage`, foldedFactors: [`cultivar`]
    })
    expect(labels(grid.columns)).toEqual([`leaf`, `leaf sheath`, `seed`, `stem`, `stem internode`])
    expect(labels(grid.rows)).toContain(`seedling development stage · BTx623`)
    expect(labels(grid.rows)).toContain(`young · TX08001`)
    expect(grid.rows).toHaveLength(7)
    expectEverySampleOnce(grid)
    expect(sampleIds(cellAt(grid, `whole plant fruit ripening stage · BTx623`, `seed`)))
      .toEqual([`seed_dry.grain_maturity`, `seed_imbibed.grain_maturity`])
  })

  it(`takes any two of the factors as rows and columns`, () => {
    const byCultivar = buildFactorGrid(sb4.body, {gene: MSD2, rowFactor: `cultivar`, columnFactor: `developmental stage`})
    expect(byCultivar).toMatchObject({rowFactor: `cultivar`, columnFactor: `developmental stage`, foldedFactors: [`organism part`]})
    expect(labels(byCultivar.rows)[0]).toBe(`BTx623 · seed`)
    expectEverySampleOnce(byCultivar)
  })
})

describe(`one factor, and none`, () => {
  it(`draws a single row, labelled with the gene id, for a study with one factor (E-CURD-25)`, () => {
    const grid = buildFactorGrid(curd25.body, {gene: `SORBI_3001G000400`})
    expect(grid.varyingFactors).toEqual([`organism part`])
    expect(grid).toMatchObject({rowFactor: null, columnFactor: `organism part`, foldedFactors: []})
    expect(grid.rows).toEqual([{key: `[]`, label: `SORBI_3001G000400`, values: {}}])
    expect(grid.columns).toHaveLength(4)
    expect(grid.profileIndex).toBe(1)
    expect(grid.cells[0].map(cell => cell.length)).toEqual([1, 1, 1, 1])
    expect(grid.cells[0].map(cell => cell[0].value))
      .toEqual(grid.columns.map(column => curd25.body.profiles.rows[1].expressions[
        curd25.body.columnHeaders.findIndex(header => header.factorValue === column.value)].value))
  })

  it(`ignores a row factor asked for when there is only one factor`, () => {
    const grid = buildFactorGrid(curd25.body, {rowFactor: `organism part`})
    expect(grid).toMatchObject({rowFactor: null, columnFactor: `organism part`})
    expect(grid.rows).toHaveLength(1)
  })

  it(`draws a single cell when no factor varies`, () => {
    const innerCore = withGroups(sb2.body, header => factorOf(header, `sampling site`)?.testValue === `inner core`)
    const grid = buildFactorGrid(innerCore, {gene: MSD2})
    expect(grid.varyingFactors).toEqual([])
    expect(grid.constantFactors).toEqual([
      {name: `organism part`, value: `stem internode`}, {name: `cultivar`, value: `TX08001`},
      {name: `sampling site`, value: `inner core`}])
    expect(grid).toMatchObject({rowFactor: null, columnFactor: null})
    expect(grid.rows).toEqual([{key: `[]`, label: MSD2, values: {}}])
    expect(grid.columns).toEqual([{key: ``, value: null, label: `stem internode · TX08001 · inner core`}])
    expect(sampleIds(grid.cells[0][0])).toHaveLength(5)
  })

  it(`uses the factorValue of column headers that have no FACTOR properties`, () => {
    const payload = {
      ...sb3.body,
      columnHeaders: sb3.body.columnHeaders.map(({assayGroupId, factorValue}) => ({assayGroupId, factorValue}))
    }
    const grid = buildFactorGrid(payload)
    expect(grid.varyingFactors).toEqual([`condition`])
    expect(grid.columns).toHaveLength(10)
    expect(grid.samples[0]).toMatchObject({sampleId: `g1`, replicates: null})
  })
})

describe(`the gene`, () => {
  it(`is the profile row with that id or name, whatever its case; else the first row`, () => {
    const genes = emtab5956.body.profiles.rows.map(row => row.id)
    expect(analyseFactors(emtab5956.body, {gene: MSD2}).profileIndex).toBe(genes.indexOf(MSD2))
    expect(analyseFactors(emtab5956.body, {gene: MSD2.toLowerCase()}).profileIndex).toBe(genes.indexOf(MSD2))
    expect(analyseFactors(emtab5956.body, {gene: `NOT_THERE`}).profileIndex).toBe(0)
    expect(analyseFactors(emtab5956.body).profileIndex).toBe(0)
  })

  it(`gives samples without an expression value the value null`, () => {
    const analysis = analyseFactors(emtab5956.body, {gene: emtab5956.body.profiles.rows[0].id})
    const expressions = emtab5956.body.profiles.rows[0].expressions
    expect(analysis.samples.map(sample => sample.value))
      .toEqual(expressions.map(expression => (typeof expression.value === `number` ? expression.value : null)))
    expect(analysis.samples.some(sample => sample.value === null)).toBe(true)
  })

  it(`has no samples' values and no profile when the payload has no rows`, () => {
    const analysis = analyseFactors({...sb3.body, profiles: {rows: []}}, {gene: MSD2})
    expect(analysis).toMatchObject({profileIndex: -1, unit: ``, gene: {id: MSD2, name: MSD2}})
    expect(analysis.samples.every(sample => sample.value === null)).toBe(true)
  })
})

describe(`choosing axes`, () => {
  const sb4Analysis = analyseFactors(sb4.body, {gene: MSD2})

  it(`resolveAxes keeps a requested factor that varies, and defaults the rest`, () => {
    expect(resolveAxes(sb4Analysis)).toEqual({rowFactor: `developmental stage`, columnFactor: `organism part`})
    expect(resolveAxes(sb4Analysis, {columnFactor: `cultivar`}))
      .toEqual({rowFactor: `developmental stage`, columnFactor: `cultivar`})
    // organism part is on the rows, so the column is the factor with most values among the others
    expect(resolveAxes(sb4Analysis, {rowFactor: `organism part`}))
      .toEqual({rowFactor: `organism part`, columnFactor: `developmental stage`})
    // the column wins a tie
    expect(resolveAxes(sb4Analysis, {rowFactor: `cultivar`, columnFactor: `cultivar`}))
      .toEqual({rowFactor: `developmental stage`, columnFactor: `cultivar`})
    // unknown or constant factors are ignored
    expect(resolveAxes(sb4Analysis, {rowFactor: `sample id`, columnFactor: `nope`}))
      .toEqual({rowFactor: `developmental stage`, columnFactor: `organism part`})
    const sb2Analysis = analyseFactors(sb2.body)
    expect(resolveAxes(sb2Analysis, {columnFactor: `organism part`}))
      .toEqual({rowFactor: `cultivar`, columnFactor: `sampling time point`})
  })

  it(`chooseAxis swaps with the other axis, or folds the factor it replaces`, () => {
    const axes = {rowFactor: `developmental stage`, columnFactor: `organism part`}
    expect(chooseAxis(axes, `row`, `organism part`)).toEqual({rowFactor: `organism part`, columnFactor: `developmental stage`})
    expect(chooseAxis(axes, `column`, `developmental stage`))
      .toEqual({rowFactor: `organism part`, columnFactor: `developmental stage`})
    expect(chooseAxis(axes, `row`, `cultivar`)).toEqual({rowFactor: `cultivar`, columnFactor: `organism part`})
    expect(chooseAxis(axes, `column`, `cultivar`)).toEqual({rowFactor: `developmental stage`, columnFactor: `cultivar`})
    expect(swapAxes(axes)).toEqual({rowFactor: `organism part`, columnFactor: `developmental stage`})

    const grid = layoutFactorGrid(sb4Analysis, chooseAxis(axes, `row`, `cultivar`))
    expect(grid.foldedFactors).toEqual([`developmental stage`])
  })
})
