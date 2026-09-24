import { afterEach, describe, expect, it } from 'vitest'

import { assayGroupColours } from '../../src/grid/colours.js'
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
// of the heatmap that HeatmapCanvas draws for the same payload, with the props HeatmapWithControls gives it: no colour
// axis (heatmapExtraArgs leaves it out; the colour axis only draws the legend). ExpressionFactorGrid.test.js checks the
// same against a whole ExpressionAtlasHeatmap.
const LAYOUT = {marginBottom: 10, marginRight: 20, height: 400, autoRotation: [-45]}

const charts = []
const drawFlatHeatmap = fixture => {
  const element = document.createElement(`div`)
  document.body.appendChild(element)
  const props = canvasProps(fixture, {colourAxis: undefined})
  const chart = getHeatmapHighcharts().chart(element, buildHeatmapOptions({current: props}, LAYOUT))
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

describe.each([
  [`JGI-SB-1`, sb1],
  [`JGI-SB-2`, sb2],
  [`JGI-SB-3`, sb3],
  [`JGI-SB-4`, sb4],
  [`E-CURD-25 (3 genes)`, curd25],
  [`E-GEOD-167101 (14 genes)`, geod167101],
  [`E-MTAB-5956 (11 genes, some values missing)`, emtab5956]
])(`the flat heatmap of %s`, (_, fixture) => {
  it(`has no colour axis, so its points have their series' colours`, () => {
    const chart = drawFlatHeatmap(fixture)
    expect(chart.colorAxis || []).toHaveLength(0)
    chart.series.forEach(series => series.points.forEach(point => expect(point.color).toBe(series.color)))
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

describe(`assayGroupColours`, () => {
  it(`never gives a higher value a lighter series' colour than a lower one`, () => {
    const chartData = chartDataOf(sb1)
    const colours = assayGroupColours(chartData, 0)
    const seriesColours = chartData.heatmapData.dataSeries.map(series => series.info.colour)
    const values = sb1.body.profiles.rows[0].expressions.map(expression => expression.value)
    const rank = x => seriesColours.indexOf(colours[x])
    const highest = values.indexOf(Math.max(...values))
    const lowest = values.indexOf(Math.min(...values))
    expect(rank(highest)).toBe(seriesColours.length - 1)
    expect(rank(lowest)).toBeLessThan(rank(highest))
    values.forEach((value, x) => values.forEach((other, y) => {
      if (value < other) {
        expect(rank(x)).toBeLessThanOrEqual(rank(y))
      }
    }))
  })
})
