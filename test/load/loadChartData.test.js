import { describe, expect, it } from 'vitest'

import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import geod167101 from '../fixtures/paralogs.E-GEOD-167101.baseline.json'

// Golden snapshots of src/load/main.js over live Warelab payloads (scripts/capture-fixtures.mjs). They were first
// written against the pristine upstream 5.7.2 load/ code; every later snapshot change must be an intended one:
// - rows carry their raw `uri` next to the resolved `url` (urijs replaced node `url`, same URLs);
// - heatmapConfig: `linkTarget` and `urlFor`.

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

const load = (fixture, options = {}) => loadChartData({
  data: fixture.body,
  inProxy: ``,
  outProxy: ``,
  atlasUrl: ATLAS_URL,
  showAnatomogram: true,
  showControlMenu: true,
  isWidget: true,
  ...options
})

const seriesNames = chartData => chartData.heatmapData.dataSeries.map(series => series.info.name)
const isPermutation = (ordering, length) =>
  [...ordering].sort((a, b) => a - b).every((value, index) => value === index) && ordering.length === length

describe(`loadChartData`, () => {
  describe(`All Studies (json/baseline_experiments)`, () => {
    const chartData = load(allStudies)

    it(`matches the golden snapshot`, () => {
      expect(chartData).toMatchSnapshot()
    })

    it(`is a multi-experiment heatmap of 9 experiments with 3 threshold buckets`, () => {
      expect(chartData.heatmapConfig.isMultiExperiment).toBe(true)
      expect(chartData.heatmapConfig.introductoryMessage).toBe(`Showing 9 experiments:`)
      expect(chartData.heatmapConfig.shortDescription).toBe(`expression_atlas-sorghum_bicolor`)
      expect(seriesNames(chartData)).toEqual([`Below cutoff`, `Low`, `Medium`, `High`])
      expect(chartData.heatmapData.dataSeries.map(series => series.info.colour))
        .toEqual([`#eaeaea`, `#45affd`, `#1E74CA`, `#024990`])
      expect(chartData.heatmapData.yAxisCategories).toHaveLength(9)
      expect(chartData.heatmapData.xAxisCategories).toHaveLength(24)
    })

    it(`has three orderings, each a permutation of the rows and columns`, () => {
      expect(chartData.orderings.map(ordering => ordering.name))
        .toEqual([`By experiment type`, `Alphabetical order`, `Expression rank`])
      chartData.orderings.forEach(ordering => {
        expect(isPermutation(ordering.rows, 9)).toBe(true)
        expect(isPermutation(ordering.columns, 24)).toBe(true)
      })
    })

    it(`keeps absolute row URIs byte for byte`, () => {
      expect(chartData.heatmapData.yAxisCategories.map(category => category.info.url))
        .toEqual(allStudies.body.profiles.rows.map(row => row.uri))
    })

    it(`shows the sorghum anatomogram`, () => {
      expect(chartData.anatomogramConfig.show).toBe(true)
    })

    it(`keeps the raw row URI next to the resolved URL, for resolveUrl`, () => {
      expect(chartData.heatmapData.yAxisCategories.map(category => category.info.uri))
        .toEqual(allStudies.body.profiles.rows.map(row => row.uri))
    })

    it(`defaults the link target and URL resolver of the chart configuration`, () => {
      expect(chartData.heatmapConfig.linkTarget).toBe(`_blank`)
      expect(chartData.heatmapConfig.urlFor(`row`, `https://example.org/`, {})).toBe(`https://example.org/`)
      const urlFor = () => null
      const configured = load(allStudies, {linkTarget: `_self`, urlFor}).heatmapConfig
      expect(configured.linkTarget).toBe(`_self`)
      expect(configured.urlFor).toBe(urlFor)
    })
  })

  describe(`Paralogs baseline (E-CURD-25)`, () => {
    const chartData = load(curd25)

    it(`matches the golden snapshot`, () => {
      expect(chartData).toMatchSnapshot()
    })

    it(`buckets the expression values into the 5.7.2 log ranges`, () => {
      expect(chartData.heatmapConfig.isBaseline).toBe(true)
      // No value is 0, so bucketByLogRange drops the empty `Below cutoff` series
      expect(seriesNames(chartData)).toEqual([`Low`, `Low-Medium`, `Medium`, `Medium-High`, `High`])
      expect(chartData.heatmapConfig.shortDescription).toBe(`E-CURD-25`)
      expect(chartData.heatmapConfig.introductoryMessage).toBe(`Showing 3 genes:`)
    })

    it(`resolves the relative row URIs against the atlas URL`, () => {
      expect(chartData.heatmapData.yAxisCategories[0].info.url)
        .toBe(`https://data.sorghumbase.org/auth_testing/gxa/genes/SORBI_3001G000200`)
      expect(chartData.heatmapData.yAxisCategories[0].info.uri).toBe(`genes/SORBI_3001G000200`)
      expect(load(curd25, {atlasUrl: `https://www.ebi.ac.uk/gxa/`, inProxy: ``}).heatmapData.yAxisCategories[0].info.url)
        .toBe(`https://www.ebi.ac.uk/gxa/genes/SORBI_3001G000200`)
    })

    it(`hides the anatomogram: the backend sends the display species name 'Sorghum bicolor'`, () => {
      expect(curd25.body.anatomogram.species).toBe(`Sorghum bicolor`)
      expect(chartData.anatomogramConfig.show).toBe(false)
    })
  })

  describe(`Paralogs baseline without an anatomogram (E-GEOD-167101)`, () => {
    const chartData = load(geod167101)

    it(`matches the golden snapshot`, () => {
      expect(chartData).toMatchSnapshot()
    })

    it(`shows the 14 paralogs and no anatomogram`, () => {
      expect(chartData.heatmapData.yAxisCategories).toHaveLength(14)
      expect(chartData.heatmapConfig.introductoryMessage).toBe(`Showing 14 genes:`)
      expect(chartData.anatomogramConfig.show).toBe(false)
    })
  })

  describe(`Paralogs differential (E-GEOD-30249)`, () => {
    const chartData = load(geod30249)

    it(`matches the golden snapshot`, () => {
      expect(chartData).toMatchSnapshot()
    })

    it(`splits fold changes into down, below cutoff and up series with a colour axis`, () => {
      expect(chartData.heatmapConfig.isDifferential).toBe(true)
      expect(seriesNames(chartData)).toEqual([`High down`, `Down`, `Below cutoff`, `Up`, `High up`])
      expect(chartData.colourAxis).not.toBeNull()
      expect(chartData.heatmapConfig.genomeBrowsers).toEqual([`Ensembl Genomes`])
      expect(chartData.anatomogramConfig.show).toBe(false)
    })

    it(`keeps the column track ids for the genome browser links`, () => {
      expect(chartData.heatmapData.xAxisCategories.map(category => category.info.trackId))
        .toEqual(geod30249.body.columnHeaders.map(header => header.id))
    })
  })
})
