import { describe, expect, it } from 'vitest'

import {
  heatmapDataInColumns, heatmapFileName, heatmapIsEmpty, heatmapJson, heatmapSources, heatmapSummary, heatmapTable,
  heatmapTsv, queryOfSource, withQueriedGenes
} from '../../src/manipulate/controls/download-button/Download.js'
import { manipulate } from '../../src/manipulate/Manipulators.js'
import { buildSource } from '../../src/layout/request.js'
import { chartDataOf } from '../helpers/canvas.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import allStudiesV11 from '../fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import geod128441 from '../fixtures/paralogs.E-GEOD-128441.differential.sorghum_v11.json'
import sb1 from '../fixtures/grid.JGI-SB-1.msd2.json'

// The Download dialog's content builders for the heatmap, as pure functions of the chart data shown
const CONTEXT = {downloadedFrom: `https://example.org/gene/SORBI_3001G000200`, downloadedAt: `2026-09-24T12:00:00.000Z`}
const PARALOGS = [`SORBI_3001G000200`, `SORBI_3001G000400`, `SORBI_3001G000100`]
const ATLAS_URL = `https://data.sorghumbase.org/sorghum_v11/gxa/`

const tableOf = tsv => tsv.trimEnd().split(`\n`).filter(line => !line.startsWith(`#`)).map(line => line.split(`\t`))
const commentsOf = tsv => tsv.trimEnd().split(`\n`).filter(line => line.startsWith(`#`))

// What HeatmapWithControls shows (heatmapDataToPresent): an ordering, and the columns the filters keep
const shown = (fixture, {ordering, keepColumn = () => true} = {}) => {
  const {heatmapData, orderings, heatmapConfig} = chartDataOf(fixture)
  return manipulate({
    keepSeries: () => true,
    keepRow: () => true,
    keepColumn,
    ordering: orderings.find(o => o.name === ordering) || orderings[0],
    allowEmptyColumns: Boolean(heatmapConfig.experiment)
  }, heatmapData)
}

describe(`the heatmap's tab-delimited file`, () => {
  it(`keeps upstream's layout: comment lines, a header of whole column labels, then a row label and its values per line`, () => {
    const {heatmapData, heatmapConfig} = chartDataOf(curd25)
    const tsv = heatmapTsv({
      heatmapData, descriptionLines: withQueriedGenes(heatmapConfig.description, PARALOGS).concat(`Results as shown on page`),
      isSingleExperiment: true, ...CONTEXT
    })
    expect(tsv).toBe([
      `# Downloaded from: https://example.org/gene/SORBI_3001G000200`,
      `# Timestamp: 2026-09-24T12:00:00.000Z`,
      `# Experiment accession: E-CURD-25`,
      `# Gene Expression Regulation Associated with Vascularization in Sorghum bicolor`,
      `# Gene query: SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`,
      `# Results as shown on page`,
      `# Unit: TPM`,
      `\tnonvascular system\troot\tshoot\tvascular system`,
      `SORBI_3001G000200\t45\t74\t63\t30`,
      `SORBI_3001G000400\t9\t25\t19\t9`,
      // one experiment: empty cells where there is no data
      `SORBI_3001G000100\t\t0.7\t\t`,
      ``
    ].join(`\n`))
  })

  it(`writes NA for no data across experiments, and follows the ordering and the filters`, () => {
    const all = chartDataOf(allStudies).heatmapData
    const keep = new Set(all.xAxisCategories.slice(0, 10).map(column => column.label))
    const heatmapData = shown(allStudies, {ordering: `Alphabetical order`, keepColumn: column => keep.has(column.label)})
    const tsv = heatmapTsv({heatmapData, descriptionLines: [`Ordering: Alphabetical order`], isSingleExperiment: false, ...CONTEXT})

    expect(commentsOf(tsv).slice(2)).toEqual([`# Ordering: Alphabetical order`, `# Unit: TPM`])
    const [header, ...rows] = tableOf(tsv)
    expect(header).toEqual([``, ...heatmapData.xAxisCategories.map(column => column.label)])
    expect(header.slice(1).every(label => keep.has(label))).toBe(true)
    expect(rows.map(row => row[0])).toEqual(heatmapData.yAxisCategories.map(row => row.label))
    expect(rows.map(row => row[0])).toEqual([...rows.map(row => row[0])].sort((a, b) => a.localeCompare(b)))
    expect(rows.every(row => row.length === header.length)).toBe(true)
    expect(rows.flat()).toContain(`NA`)
    expect(rows.flat()).not.toContain(``)
  })

  it(`writes a differential experiment's fold changes, and the whole column labels (not the shortened ones)`, () => {
    const {heatmapData} = chartDataOf(geod30249)
    const tsv = heatmapTsv({heatmapData, descriptionLines: [], isSingleExperiment: true, ...CONTEXT})
    expect(commentsOf(tsv).slice(2)).toEqual([`# Unit: Log2 fold change`])
    expect(tableOf(tsv)).toEqual([
      [``, `compound: sodium hydroxide 0.2 molar vs abscisic acid 20 micromolar in organism part: root`,
        `compound: water vs polyethylene glycol 20 percent in organism part: root`],
      [`SORBI_3001G000200`, `-0.3`, ``],
      [`SORBI_3001G000400`, `-1.7`, `0.3`]
    ])

    const long = chartDataOf(geod128441).heatmapData
    expect(long.xAxisCategories[0].shortLabel).toBeTruthy()
    expect(tableOf(heatmapTsv({heatmapData: long, isSingleExperiment: true, ...CONTEXT}))[0].slice(1))
      .toEqual(long.xAxisCategories.map(column => column.label))
  })

  it(`writes only the columns in view when zoomed in, and says so`, () => {
    const heatmapData = shown(allStudies)
    const tsv = heatmapTsv({heatmapData, range: {from: 2, to: 7}, isSingleExperiment: false, ...CONTEXT})
    expect(commentsOf(tsv)).toContain(`# Zoomed in: columns 3 to 8 of 24`)
    const [header, ...rows] = tableOf(tsv)
    expect(header).toEqual([``, ...heatmapData.xAxisCategories.slice(2, 8).map(column => column.label)])
    const full = tableOf(heatmapTsv({heatmapData, isSingleExperiment: false, ...CONTEXT}))
    expect(rows).toEqual(full.slice(1).map(row => [row[0], ...row.slice(3, 9)]))
  })

  it(`keeps a label's tabs and line breaks from starting another cell or line`, () => {
    const heatmapData = {
      xAxisCategories: [{label: `a\tb`, id: ``}],
      yAxisCategories: [{label: `row\none`, id: `r`}],
      dataSeries: [{info: {}, data: [{x: 0, y: 0, value: 1, info: {unit: `TPM`}}]}]
    }
    expect(tableOf(heatmapTsv({heatmapData, descriptionLines: [`two\nlines`], isSingleExperiment: true, ...CONTEXT})))
      .toEqual([[``, `a b`], [`row one`, `1`]])
  })
})

describe(`the heatmap's JSON file`, () => {
  it(`describes the experiment, the query and the unit, with values aligned with the columns and null for no data`, () => {
    const {heatmapData, heatmapConfig} = chartDataOf(curd25)
    const json = JSON.parse(heatmapJson({
      heatmapData, experiment: heatmapConfig.experiment, query: {genes: PARALOGS}, atlasUrl: ATLAS_URL,
      isDifferential: false, ...CONTEXT
    }))
    expect(json).toEqual({
      source: `Expression Atlas`,
      atlasUrl: ATLAS_URL,
      experiment: {
        accession: `E-CURD-25`,
        description: `Gene Expression Regulation Associated with Vascularization in Sorghum bicolor`,
        type: `rnaseq_mrna_baseline`
      },
      query: {genes: PARALOGS},
      unit: `TPM`,
      zoom: null,
      columns: [
        {label: `nonvascular system`, id: null, assayGroupId: `g1`},
        {label: `root`, id: `PO_0009005`, assayGroupId: `g2`},
        {label: `shoot`, id: `PO_0009006`, assayGroupId: `g3`},
        {label: `vascular system`, id: `PO_0000034`, assayGroupId: `g4`}
      ],
      rows: [
        {label: `SORBI_3001G000200`, id: `SORBI_3001G000200`, unit: `TPM`, values: [45, 74, 63, 30]},
        {label: `SORBI_3001G000400`, id: `SORBI_3001G000400`, unit: `TPM`, values: [9, 25, 19, 9]},
        {label: `SORBI_3001G000100`, id: `SORBI_3001G000100`, unit: `TPM`, values: [null, 0.7, null, null]}
      ],
      ...CONTEXT
    })
  })

  it(`adds the p-values of a differential experiment (E-GEOD-30249)`, () => {
    const {heatmapData, heatmapConfig} = chartDataOf(geod30249)
    const json = JSON.parse(heatmapJson({
      heatmapData, experiment: heatmapConfig.experiment, query: {genes: PARALOGS}, atlasUrl: ATLAS_URL,
      isDifferential: heatmapConfig.isDifferential, ...CONTEXT
    }))
    expect(json.experiment).toEqual({accession: `E-GEOD-30249`, description: expect.any(String), type: `rnaseq_mrna_differential`})
    expect(json.unit).toBe(`Log2 fold change`)
    expect(json.columns).toEqual([
      {label: `compound: sodium hydroxide 0.2 molar vs abscisic acid 20 micromolar in organism part: root`, id: `g5_g1`},
      {label: `compound: water vs polyethylene glycol 20 percent in organism part: root`, id: `g7_g3`}
    ])
    expect(json.rows).toEqual([
      {label: `SORBI_3001G000200`, id: `SORBI_3001G000200`, unit: `Log2 fold change`, values: [-0.3, null],
        pValues: [0.023848945245277, null]},
      {label: `SORBI_3001G000400`, id: `SORBI_3001G000400`, unit: `Log2 fold change`, values: [-1.7, 0.3],
        pValues: [1.48769027960814e-26, 0.00251968357307113]}
    ])
  })

  it(`has experiment null across experiments (All Studies), rows in the order shown, and the zoom`, () => {
    const heatmapData = shown(allStudies, {ordering: `Alphabetical order`})
    const json = JSON.parse(heatmapJson({
      heatmapData, range: {from: 20, to: 30}, experiment: null, query: queryOfSource(buildSource({query: {gene: `SORBI_3001G000200`}})),
      atlasUrl: ATLAS_URL, isDifferential: false, ...CONTEXT
    }))
    expect(json.experiment).toBeNull()
    expect(json.query).toEqual({genes: [`SORBI_3001G000200`]})
    expect(json.zoom).toEqual({from: 21, to: 24, of: 24})
    expect(json.columns.map(column => column.label)).toEqual(heatmapData.xAxisCategories.slice(20).map(column => column.label))
    expect(json.columns.every(column => !(`assayGroupId` in column))).toBe(true)
    expect(json.rows.map(row => row.label)).toEqual(heatmapData.yAxisCategories.map(row => row.label))
    expect(json.rows.map(row => row.id)).toContain(`E-CURD-25`)
    expect(json.rows.every(row => row.values.length === 4 && row.values.every(v => v === null || typeof v === `number`)))
      .toBe(true)
    expect(json.rows.every(row => !(`pValues` in row))).toBe(true)
    // every row an Expression Atlas experiment
    expect(json.source).toBe(`Expression Atlas`)
    expect(Object.keys(json.rows[0])).toEqual([`label`, `id`, `source`, `unit`, `values`])
    expect(json.rows.every(row => row.source === `Expression Atlas`)).toBe(true)
  })

  it(`credits a JGI study to its host, not to Expression Atlas (JGI-SB-1 drawn as a heatmap, in Paralogs)`, () => {
    const {heatmapData, heatmapConfig} = chartDataOf(sb1)
    const json = JSON.parse(heatmapJson({
      heatmapData, experiment: heatmapConfig.experiment, query: {genes: [`SORBI_3006G095600`]}, atlasUrl: ATLAS_URL,
      isDifferential: false, ...CONTEXT
    }))
    expect(json.source).toBe(`phytozome-next.jgi.doe.gov`)
    expect(json.experiment.accession).toBe(`JGI-SB-1`)
    expect(json.rows.every(row => !(`source` in row))).toBe(true)
  })

  it(`gives each row its source across experiments, and none overall when they differ (sorghum_v11 with JGI rows)`, () => {
    const heatmapData = shown(allStudiesV11)
    const json = JSON.parse(heatmapJson({
      heatmapData, experiment: null, query: {genes: [`SORBI_3001G000200`]}, atlasUrl: ATLAS_URL, isDifferential: false,
      ...CONTEXT
    }))
    expect(json.source).toBeNull()
    const sourceOf = id => json.rows.find(row => row.id === id).source
    expect(sourceOf(`E-CURD-25`)).toBe(`Expression Atlas`)
    expect(sourceOf(`JGI-SB-1`)).toBe(`phytozome-next.jgi.doe.gov`)
    expect(new Set(json.rows.map(row => row.source))).toEqual(new Set([`Expression Atlas`, `phytozome-next.jgi.doe.gov`]))

    // only the JGI rows: theirs
    const jgiOnly = {...heatmapData, yAxisCategories: heatmapData.yAxisCategories.filter(row => /jgi/.test(row.info.uri))}
    expect(jgiOnly.yAxisCategories.length).toBeGreaterThan(40)
    expect(heatmapSources(jgiOnly, {experiment: null, atlasUrl: ATLAS_URL}).source).toBe(`phytozome-next.jgi.doe.gov`)
  })

  it(`takes Expression Atlas, the atlas read, or no page at all for Expression Atlas`, () => {
    const empty = {xAxisCategories: [], yAxisCategories: [], dataSeries: []}
    const of = (experiment, atlasUrl = ATLAS_URL) => heatmapSources(empty, {experiment, atlasUrl}).source
    expect(of({accession: `E-X`})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {}})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {main_page: `https://www.ebi.ac.uk/gxa/experiments/E-X`}})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {download: `https://ebi.ac.uk/gxa/x`}})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {main_page: `experiments/E-X`}})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {main_page: `https://data.sorghumbase.org/other/gxa/E-X`}})).toBe(`Expression Atlas`)
    expect(of({accession: `E-X`, urls: {main_page: `experiments/E-X`}}, ``)).toBe(`Expression Atlas`)
    expect(of({accession: `X`, urls: {main_page: `https://Example.org/x`}})).toBe(`example.org`)
    expect(of({accession: `X`, urls: {main_page: `https://notebi.ac.uk.example.org/x`}})).toBe(`notebi.ac.uk.example.org`)
    expect(of(null)).toBe(`Expression Atlas`)
    const rows = {...empty, yAxisCategories: [{label: `a`, id: `a`, info: {uri: `experiments/a`, url: `https://proxy.example.org/x`}}]}
    expect(heatmapSources(rows, {experiment: null, atlasUrl: ATLAS_URL})).toEqual({source: `Expression Atlas`, rows: [`Expression Atlas`]})
  })
})

describe(`heatmapTable and heatmapDataInColumns`, () => {
  it(`keeps the columns of a range, renumbered, and all of them without one`, () => {
    const {heatmapData} = chartDataOf(curd25)
    expect(heatmapDataInColumns(heatmapData, null)).toBe(heatmapData)
    expect(heatmapDataInColumns(heatmapData, {from: 0, to: 3})).toBe(heatmapData)
    const middle = heatmapDataInColumns(heatmapData, {from: 1, to: 2})
    expect(middle.xAxisCategories.map(column => column.label)).toEqual([`root`, `shoot`])
    expect(middle.dataSeries.flatMap(series => series.data).every(point => point.x === 0 || point.x === 1)).toBe(true)
    expect(heatmapTable(heatmapData, {range: {from: 1, to: 2}}).rows.map(row => row.values))
      .toEqual([[74, 63], [25, 19], [0.7, null]])
    // out of bounds: clamped
    expect(heatmapTable(heatmapData, {range: {from: -3, to: 9}}).zoom).toBeNull()
  })

  it(`has no common unit when the rows differ`, () => {
    const heatmapData = {
      xAxisCategories: [{label: `a`, id: ``}],
      yAxisCategories: [{label: `r1`, id: `r1`}, {label: `r2`, id: `r2`}, {label: `r3`, id: `r3`}],
      dataSeries: [{info: {}, data: [
        {x: 0, y: 0, value: 1, info: {unit: `TPM`}}, {x: 0, y: 1, value: 2, info: {unit: `FPKM`}}
      ]}]
    }
    const {rows, unit} = heatmapTable(heatmapData)
    expect(unit).toBeNull()
    expect(rows.map(row => row.unit)).toEqual([`TPM`, `FPKM`, null])
  })
})

describe(`the summary, the default file name and the query`, () => {
  it(`says what is saved`, () => {
    const {heatmapData} = chartDataOf(allStudies)
    expect(heatmapSummary(heatmapData)).toBe(`9 rows × 24 columns, as shown`)
    expect(heatmapSummary(heatmapData, {from: 2, to: 7})).toBe(`9 rows × 6 of 24 columns (zoomed in), as shown`)
    expect(heatmapSummary(chartDataOf(geod30249).heatmapData)).toBe(`2 rows × 2 columns, as shown`)
  })

  // The heatmap then says "No data match your filtering criteria…" instead of drawing a chart
  it(`says there is nothing to download when no row (or no column) is shown`, () => {
    const {heatmapData} = chartDataOf(curd25)
    expect(heatmapIsEmpty(heatmapData)).toBe(false)
    const noRows = shown(curd25, {keepColumn: () => false})
    expect(noRows.yAxisCategories).toEqual([])
    expect(heatmapIsEmpty(noRows)).toBe(true)
    expect(heatmapSummary(noRows)).toBe(`Nothing to download: the heatmap shows no data.`)
    const noColumns = {...heatmapData, xAxisCategories: [], dataSeries: heatmapData.dataSeries.map(s => ({...s, data: []}))}
    expect(heatmapIsEmpty(noColumns)).toBe(true)
    expect(heatmapSummary(noColumns, {from: 0, to: 3})).toBe(`Nothing to download: the heatmap shows no data.`)
  })

  it(`names the file after the experiment (or studies) and the first gene`, () => {
    expect(heatmapFileName({experiment: {accession: `E-CURD-25`}, genes: PARALOGS})).toBe(`expression-E-CURD-25-SORBI_3001G000200`)
    expect(heatmapFileName({experiment: null, genes: [`SORBI_3001G000200`]})).toBe(`expression-studies-SORBI_3001G000200`)
    expect(heatmapFileName({experiment: undefined})).toBe(`expression-studies`)
  })

  it(`takes the genes from the request's source`, () => {
    expect(queryOfSource(buildSource({query: {gene: PARALOGS.join(` `)}, experiment: `E-CURD-25`}))).toEqual({genes: PARALOGS})
    expect(queryOfSource(buildSource({query: {gene: `A`, condition: `leaf`, species: `sorghum`}})))
      .toEqual({genes: [`A`], condition: `leaf`, species: `sorghum`})
    expect(queryOfSource({endpoint: `x`, params: {geneQuery: [{value: `ASPM`}, {value: `BRCA2`}]}})).toEqual({genes: [`ASPM`, `BRCA2`]})
    expect(queryOfSource(buildSource({query: `json/experiments/E-CURD-25`}))).toEqual({genes: []})
    expect(queryOfSource(undefined)).toEqual({genes: []})
  })

  it(`names the genes in the description where the backend echoes [null,…], and drops empty conditions`, () => {
    expect(withQueriedGenes([
      `Query results for: [null], in conditions [], in species Sorghum bicolor`, `Experiment accession: E-X`,
      `Gene query: [null,null,null]`, `Gene query: []`, `A description with [] in it`
    ], PARALOGS)).toEqual([
      `Query results for: SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100, in species Sorghum bicolor`,
      `Experiment accession: E-X`, `Gene query: ${PARALOGS.join(` `)}`, `Gene query: ${PARALOGS.join(` `)}`,
      `A description with [] in it`
    ])
    expect(withQueriedGenes([`Gene query: [null]`], [])).toEqual([`Gene query: [null]`])
  })
})
