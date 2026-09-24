import { describe, expect, it } from 'vitest'

import { analyseFactors, buildFactorGrid, layoutFactorGrid, swapAxes } from '../../src/grid/factorGrid.js'
import { gridFileName, gridJson, gridSummary, gridTsv, samplesInOrder } from '../../src/grid/gridDownload.js'
import sb1 from '../fixtures/grid.JGI-SB-1.msd2.json'
import sb2 from '../fixtures/grid.JGI-SB-2.msd2.json'
import sb3 from '../fixtures/grid.JGI-SB-3.msd2.json'
import sb4 from '../fixtures/grid.JGI-SB-4.msd2.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'

// The factor grid's download: every sample of the study for the gene, one per line, whatever the axes
const MSD2 = `SORBI_3006G095600`
const CONTEXT = {downloadedFrom: `https://example.org/?idList=${MSD2}`, downloadedAt: `2026-09-24T12:00:00.000Z`}
const gridOf = (fixture, axes = {}) => buildFactorGrid(fixture.body, {gene: MSD2, ...axes})
const tableOf = tsv => tsv.trimEnd().split(`\n`).map(line => line.split(`\t`))
const optionsOf = fixture => ({experiment: fixture.body.experiment, accession: fixture.body.experiment.accession, ...CONTEXT})

describe(`the factor grid's tab-delimited file`, () => {
  it(`has a header line, then one line per sample (JGI-SB-1: 31), split cells included`, () => {
    const grid = gridOf(sb1)
    const [header, ...rows] = tableOf(gridTsv(grid, {accession: `JGI-SB-1`}))
    expect(header).toEqual([
      `gene`, `study`, `organism part`, `developmental stage`, `sample id`, `replicates`, `expression (TPM)`])
    expect(rows).toHaveLength(31)
    expect(rows.slice(0, 3)).toEqual([
      [MSD2, `JGI-SB-1`, `leaf lamina`, `inflorescence development stage`, `leaf_lower_growing.floral_initiation`, `2`, `41.344`],
      [MSD2, `JGI-SB-1`, `leaf lamina`, `inflorescence development stage`, `leaf_upper_growing.floral_initiation`, `2`, `10.795`],
      [MSD2, `JGI-SB-1`, `leaf lamina`, `seedling development stage`, `leaf_blade.juvenile`, `2`, `21.535`]
    ])
    // the three samples of one cell each have a line
    const stem = rows.filter(row => row[2] === `stem internode` && row[3] === `inflorescence development stage`)
    expect(stem).toHaveLength(3)
    expect(new Set(stem.map(row => row[4])).size).toBe(3)
    // every sample once
    expect(new Set(rows.map(row => row[4])).size).toBe(31)
  })

  it(`does not depend on the axes`, () => {
    const grid = gridOf(sb1)
    const swapped = layoutFactorGrid(analyseFactors(sb1.body, {gene: MSD2}), swapAxes(grid))
    expect(swapped.rowFactor).toBe(`organism part`)
    expect(gridTsv(swapped, {accession: `JGI-SB-1`})).toBe(gridTsv(grid, {accession: `JGI-SB-1`}))
    // the analysis alone (no axes) is enough
    expect(gridTsv(analyseFactors(sb1.body, {gene: MSD2}), {accession: `JGI-SB-1`})).toBe(gridTsv(grid, {accession: `JGI-SB-1`}))
  })

  it(`lists every factor in the study's order, constant ones too, and leaves the ones a sample lacks empty (JGI-SB-2)`, () => {
    const grid = gridOf(sb2)
    expect(grid.constantFactors).toEqual([{name: `organism part`, value: `stem internode`}])
    const [header, ...rows] = tableOf(gridTsv(grid, {accession: `JGI-SB-2`}))
    expect(header).toEqual([
      `gene`, `study`, `organism part`, `cultivar`, `sampling time point`, `sampling site`, `sample id`, `replicates`,
      `expression (TPM)`])
    expect(rows).toHaveLength(46)
    expect(rows.every(row => row.length === header.length && row[2] === `stem internode`)).toBe(true)
    expect(rows[0]).toEqual([MSD2, `JGI-SB-2`, `stem internode`, `DDYM`, `S1`, ``, `DDYM.elongating_internode.S1`, `2`, `4.171`])
    // (the grid shows these as —)
    expect(rows.some(row => row[4] === `` && row[5] !== ``)).toBe(true)
    expect(rows.flat()).not.toContain(`—`)
    // in natural order: S2 before S10
    const ddym = rows.filter(row => row[3] === `DDYM`).map(row => row[4])
    expect(ddym.indexOf(`S2`)).toBeLessThan(ddym.indexOf(`S10`))
  })

  it(`leaves a missing value empty, and writes no unit without one`, () => {
    const payload = structuredClone(sb3.body)
    delete payload.profiles.rows[0].expressions[0].value
    delete payload.profiles.rows[0].expressionUnit
    const grid = buildFactorGrid(payload, {gene: MSD2})
    const [header, ...rows] = tableOf(gridTsv(grid, {accession: `JGI-SB-3`}))
    expect(header[header.length - 1]).toBe(`expression`)
    const sampleId = grid.samples[0].sampleId
    expect(rows.find(row => row[header.indexOf(`sample id`)] === sampleId).at(-1)).toBe(``)
    expect(rows).toHaveLength(10)
  })
})

describe(`the factor grid's JSON file`, () => {
  it(`has the gene, the study, its factors, the axes shown, the unit and every sample`, () => {
    const grid = gridOf(sb1)
    const json = JSON.parse(gridJson(grid, optionsOf(sb1)))
    expect(Object.keys(json)).toEqual([
      `gene`, `study`, `factors`, `rowFactor`, `columnFactor`, `unit`, `samples`, `downloadedFrom`, `downloadedAt`])
    expect(json).toMatchObject({
      gene: MSD2,
      study: {accession: `JGI-SB-1`, description: sb1.body.experiment.description},
      rowFactor: `developmental stage`,
      columnFactor: `organism part`,
      unit: `TPM`,
      ...CONTEXT
    })
    expect(json.factors.map(({name, values, varies}) => [name, values.length, varies]))
      .toEqual([[`organism part`, 8, true], [`developmental stage`, 5, true]])
    expect(json.samples).toHaveLength(31)
    expect(json.samples[0]).toEqual({
      factors: {'organism part': `leaf lamina`, 'developmental stage': `inflorescence development stage`},
      sampleId: `leaf_lower_growing.floral_initiation`,
      assayGroupId: `g9`,
      replicates: 2,
      value: 41.344
    })

    // the axes shown change, the samples do not
    const swapped = JSON.parse(gridJson(layoutFactorGrid(analyseFactors(sb1.body, {gene: MSD2}), swapAxes(grid)), optionsOf(sb1)))
    expect([swapped.rowFactor, swapped.columnFactor]).toEqual([`organism part`, `developmental stage`])
    expect(swapped.samples).toEqual(json.samples)
  })

  it(`has null for a factor a sample lacks and for a missing value; constant factors do not vary`, () => {
    const payload = structuredClone(sb2.body)
    delete payload.profiles.rows[0].expressions[0].value
    const grid = buildFactorGrid(payload, {gene: MSD2})
    const json = JSON.parse(gridJson(grid, optionsOf(sb2)))
    expect(json.factors.map(({name, varies}) => [name, varies])).toEqual([
      [`organism part`, false], [`cultivar`, true], [`sampling time point`, true], [`sampling site`, true]])
    expect(json.factors.every(factor => !factor.values.includes(`—`))).toBe(true)
    expect(json.samples.find(sample => sample.assayGroupId === `g1`)).toMatchObject({
      factors: {'organism part': `stem internode`, cultivar: `DDYM`, 'sampling time point': `S1`, 'sampling site': null},
      value: null
    })
    expect(json.samples.some(sample => sample.factors[`sampling time point`] === null)).toBe(true)
  })

  it(`has null axes for a study with one factor (E-CURD-25), and one sample per assay group (JGI-SB-4)`, () => {
    const curd = JSON.parse(gridJson(buildFactorGrid(curd25.body, {gene: `SORBI_3001G000200`}), optionsOf(curd25)))
    expect([curd.gene, curd.rowFactor, curd.columnFactor]).toEqual([`SORBI_3001G000200`, null, `organism part`])
    expect(curd.samples).toHaveLength(4)

    const json = JSON.parse(gridJson(gridOf(sb4), optionsOf(sb4)))
    expect(json.samples.map(sample => sample.assayGroupId).sort())
      .toEqual(sb4.body.columnHeaders.map(header => header.assayGroupId).sort())
  })
})

describe(`the factor grid's summary, file name and order`, () => {
  it(`counts the samples`, () => {
    expect(gridSummary(gridOf(sb1), {accession: `JGI-SB-1`})).toBe(`31 samples of JGI-SB-1 for ${MSD2}`)
    expect(gridSummary(gridOf(sb3), {accession: ``})).toBe(`10 samples for ${MSD2}`)
  })

  it(`names the file <gene>-<experiment>`, () => {
    expect(gridFileName({gene: MSD2, accession: `JGI-SB-1`})).toBe(`${MSD2}-JGI-SB-1`)
    expect(gridFileName({gene: MSD2, accession: ``})).toBe(MSD2)
  })

  it(`orders the samples by their factors in the study's order, then by sample id`, () => {
    const ordered = samplesInOrder(analyseFactors(sb1.body, {gene: MSD2}))
    const keys = ordered.map(sample => [sample.factorValues[`organism part`], sample.factorValues[`developmental stage`]])
    expect(keys[0]).toEqual([`leaf lamina`, `inflorescence development stage`])
    expect(keys.at(-1)[0]).toBe(`stem internode`)
  })
})
