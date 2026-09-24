import { afterEach, describe, expect, it } from 'vitest'

import { assayGroupColours, colourForValue } from '../../src/grid/colours.js'
import getHeatmapHighcharts from '../../src/show/highcharts.js'
import { buildHeatmapOptions } from '../../src/show/HeatmapCanvas.js'
import { canvasProps, chartDataOf } from '../helpers/canvas.js'
import sb1 from '../fixtures/grid.JGI-SB-1.msd2.json'
import sb2 from '../fixtures/grid.JGI-SB-2.msd2.json'
import sb3 from '../fixtures/grid.JGI-SB-3.msd2.json'
import sb4 from '../fixtures/grid.JGI-SB-4.msd2.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod167101 from '../fixtures/paralogs.E-GEOD-167101.baseline.json'
import emtab5956 from '../fixtures/paralogs.E-MTAB-5956.sorghum_v11.json'

// The grid's colours must be the flat heatmap's: compared here with the colours Highcharts 6.2 itself gives the points
// of the heatmap that HeatmapCanvas draws for the same payload.
const LAYOUT = {marginBottom: 10, marginRight: 20, height: 400, autoRotation: [-45]}

const charts = []
const drawFlatHeatmap = fixture => {
  const element = document.createElement(`div`)
  document.body.appendChild(element)
  const chart = getHeatmapHighcharts().chart(element, buildHeatmapOptions({current: canvasProps(fixture)}, LAYOUT))
  charts.push(chart)
  return chart
}

afterEach(() => {
  charts.splice(0).forEach(chart => {
    const element = chart.renderTo
    chart.destroy()
    element.remove()
  })
})

describe(`colourForValue`, () => {
  const colourAxis = {
    dataClasses: [
      {from: 0, to: 0, color: `#000000`},
      {from: 1, to: 5, color: `#111111`},
      {from: 5, to: 10, color: `#222222`},
      {from: 20, color: `#333333`}
    ]
  }

  it(`is the colour of the last class that holds the value, as Highcharts' toColor`, () => {
    expect(colourForValue(colourAxis, 0)).toBe(`#000000`)
    expect(colourForValue(colourAxis, 3)).toBe(`#111111`)
    // 5 is in two classes: the last one wins
    expect(colourForValue(colourAxis, 5)).toBe(`#222222`)
    expect(colourForValue(colourAxis, 1e9)).toBe(`#333333`)
  })

  it(`falls back when no class holds the value, when there are no classes and when there is no value`, () => {
    expect(colourForValue(colourAxis, 15, `grey`)).toBe(`grey`)
    expect(colourForValue(colourAxis, -1, `grey`)).toBe(`grey`)
    expect(colourForValue(colourAxis, 15)).toBeUndefined()
    expect(colourForValue(null, 3, `grey`)).toBe(`grey`)
    expect(colourForValue({dataClasses: []}, 3, `grey`)).toBe(`grey`)
    expect(colourForValue(colourAxis, null, `grey`)).toBe(`grey`)
    expect(colourForValue({dataClasses: [{from: 0, to: 9}]}, 3, `grey`)).toBe(`grey`)
  })
})

describe.each([
  [`JGI-SB-1`, sb1],
  [`JGI-SB-2`, sb2],
  [`JGI-SB-3`, sb3],
  [`JGI-SB-4`, sb4],
  [`E-CURD-25 (3 genes)`, curd25],
  [`E-GEOD-167101 (14 genes)`, geod167101],
  [`E-MTAB-5956 (11 genes, some values missing)`, emtab5956]
])(`the flat heatmap of %s`, (_, fixture) => {
  it(`has a colour axis whose toColor colourForValue matches, at and around every class boundary`, () => {
    const {colourAxis} = chartDataOf(fixture)
    expect(colourAxis.dataClasses.length).toBeGreaterThan(1)
    const axis = drawFlatHeatmap(fixture).colorAxis[0]
    expect(axis.dataClasses).toHaveLength(colourAxis.dataClasses.length)

    const values = [-1, 0, 1e-9, 0.5, 1e6].concat(...colourAxis.dataClasses.map(({from, to}) =>
      [from, to, (from + to) / 2, from - 1e-6, to + 1e-6]))
    for (const value of values) {
      expect(colourForValue(colourAxis, value)).toBe(axis.toColor(value))
    }
  })

  it(`gives every assay group of every gene the colour of its point in the chart`, () => {
    const chartData = chartDataOf(fixture)
    const chart = drawFlatHeatmap(fixture)
    const points = chart.series.flatMap(series => series.points)
    expect(points.length).toBeGreaterThan(0)

    fixture.body.profiles.rows.forEach((row, profileIndex) => {
      const colours = assayGroupColours(chartData, profileIndex)
      const pointsOfRow = points.filter(point => point.y === profileIndex)
      pointsOfRow.forEach(point => expect(colours[point.x]).toBe(point.color))
      // and no colour where the chart has no point (no value)
      row.expressions.forEach((expression, x) => {
        expect(colours[x] === undefined).toBe(!pointsOfRow.some(point => point.x === x))
        expect(colours[x] === undefined).toBe(typeof expression.value !== `number`)
      })
    })
  })
})
