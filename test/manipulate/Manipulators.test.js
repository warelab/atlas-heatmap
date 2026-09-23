import { describe, expect, it } from 'vitest'

import { filterHeatmapData, manipulate, orderHeatmapData } from '../../src/manipulate/Manipulators.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import geod167101 from '../fixtures/paralogs.E-GEOD-167101.baseline.json'

// A port of upstream's stale test/Manipulators.js (its fixture was missing and it passed booleans as predicates),
// run over heatmapData derived from a live payload.

const load = fixture => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: `https://data.sorghumbase.org/auth_testing/gxa/`,
  showAnatomogram: true, showControlMenu: true, isWidget: true
})

const {heatmapData: data, orderings} = load(allStudies)
const values = series => series.data.map(point => point.value)
const keepAll = () => true
const keepNone = () => false

describe(`filterHeatmapData`, () => {
  it(`changes nothing when everything is kept`, () => {
    const result = filterHeatmapData(keepAll, keepAll, keepAll, data)
    expect(result.xAxisCategories).toEqual(data.xAxisCategories)
    expect(result.yAxisCategories).toEqual(data.yAxisCategories)
    expect(result.dataSeries).toEqual(data.dataSeries)
  })

  it(`empties every series but the one kept`, () => {
    const chosenIndex = 1
    const result = filterHeatmapData(
      series => series.info.name === data.dataSeries[chosenIndex].info.name, keepAll, keepAll, data)
    result.dataSeries.forEach((series, i) => {
      expect(values(series)).toEqual(i === chosenIndex ? values(data.dataSeries[i]) : [])
    })
  })

  it(`keeps one row`, () => {
    const chosenIndex = 1
    const result = filterHeatmapData(
      keepAll, row => row.label === data.yAxisCategories[chosenIndex].label, keepAll, data)
    expect(result.yAxisCategories).toEqual([data.yAxisCategories[chosenIndex]])
    expect(result.dataSeries.flatMap(series => series.data).every(point => point.y === 0)).toBe(true)
  })

  it(`keeps one column`, () => {
    const chosenIndex = data.xAxisCategories.findIndex(column => column.label === `leaf`)
    const result = filterHeatmapData(
      keepAll, keepAll, column => column.label === data.xAxisCategories[chosenIndex].label, data)
    expect(result.xAxisCategories).toEqual([data.xAxisCategories[chosenIndex]])
    expect(result.dataSeries.flatMap(series => series.data).every(point => point.x === 0)).toBe(true)
  })

  it(`filters everything out but keeps the series`, () => {
    const result = filterHeatmapData(keepNone, keepNone, keepNone, data)
    expect(result.dataSeries).toHaveLength(data.dataSeries.length)
    result.dataSeries.forEach(series => expect(series.data).toEqual([]))
    expect(result.xAxisCategories).toEqual([])
    expect(result.yAxisCategories).toEqual([])
  })
})

describe(`orderHeatmapData`, () => {
  it(`permutes rows and points by the alphabetical ordering`, () => {
    const alphabetical = orderings.find(ordering => ordering.name === `Alphabetical order`)
    const result = orderHeatmapData(alphabetical, data)
    const labels = result.yAxisCategories.map(row => row.label)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))

    const cell = ({x, y}) => `${result.xAxisCategories[x].label} / ${result.yAxisCategories[y].label}`
    const originalCell = ({x, y}) => `${data.xAxisCategories[x].label} / ${data.yAxisCategories[y].label}`
    expect(result.dataSeries.flatMap(series => series.data.map(point => [cell(point), point.value])).sort())
      .toEqual(data.dataSeries.flatMap(series => series.data.map(point => [originalCell(point), point.value])).sort())
  })
})

describe(`manipulate`, () => {
  it(`keeps empty columns for a single experiment`, () => {
    // SORBI_3001G000200 has no value in the first E-GEOD-167101 column
    expect(geod167101.body.profiles.rows[0].expressions[0]).toEqual({})
    const {heatmapData, orderings: [defaultOrdering]} = load(geod167101)
    const args = {
      keepSeries: keepAll, keepRow: row => row.id === `SORBI_3001G000200`, keepColumn: keepAll, ordering: defaultOrdering
    }
    const withEmptyColumns = manipulate({...args, allowEmptyColumns: true}, heatmapData)
    expect(withEmptyColumns.xAxisCategories).toEqual(heatmapData.xAxisCategories)
    expect(withEmptyColumns.yAxisCategories.map(row => row.id)).toEqual([`SORBI_3001G000200`])
    expect(manipulate({...args, allowEmptyColumns: false}, heatmapData).xAxisCategories)
      .toEqual(heatmapData.xAxisCategories.slice(1))
  })

  it(`shows only the kept columns for All Studies`, () => {
    const hidden = data.xAxisCategories.filter(column => column.label !== `leaf`)
    const result = manipulate({
      keepSeries: keepAll, keepRow: keepAll, keepColumn: column => !hidden.includes(column),
      ordering: orderings[0], allowEmptyColumns: false
    }, data)
    expect(result.xAxisCategories.map(column => column.label)).toEqual([`leaf`])
  })
})
