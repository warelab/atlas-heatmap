import { describe, expect, it } from 'vitest'

import { computeLayout } from '../../src/show/HeatmapCanvas.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'

const heatmapDataOf = fixture => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: `https://data.sorghumbase.org/auth_testing/gxa/`,
  showAnatomogram: true, showControlMenu: true, isWidget: true
}).heatmapData

// Upstream's formulas (HeatmapCanvas 5.7.2), fed the chart's own column width
describe(`computeLayout`, () => {
  it(`rotates the All Studies column labels by 45° when the columns are narrow for them`, () => {
    const heatmapData = heatmapDataOf(allStudies)  // 9 rows, 24 columns; row labels up to 73 characters
    const rotated = {marginBottom: 10, marginRight: 80, height: 9 * 40 + 30 * 6 * Math.SQRT1_2 + 10, autoRotation: [-45]}
    expect(computeLayout(heatmapData, 800)).toEqual(rotated)
    expect(computeLayout(heatmapData, 1000)).toEqual(rotated)
    // the margin keeps the last label inside the chart; it narrows as the columns widen
    expect(computeLayout(heatmapData, 1200)).toEqual({...rotated, marginRight: 70})
    expect(computeLayout(heatmapData, 3000)).toEqual({...rotated, marginRight: 40})
  })

  it(`keeps upstream's unrotated layout when the row labels leave no room for columns`, () => {
    const heatmapData = heatmapDataOf(allStudies)   // 73 × 8.75 + 12 px of row labels > 600 px
    expect(computeLayout(heatmapData, 600)).toEqual({marginBottom: 10, marginRight: 20, height: 9 * 40 + 30 + 10, autoRotation: [-45]})
  })

  it(`rounds the right margin up to 10 px, so most width changes keep the layout`, () => {
    const heatmapData = heatmapDataOf(allStudies)
    const layouts = new Set()
    for (let width = 800; width <= 1100; width += 1) {
      const layout = computeLayout(heatmapData, width)
      expect(layout.marginRight % 10).toBe(0)
      layouts.add(JSON.stringify(layout))
    }
    expect(layouts.size).toBeLessThanOrEqual(2)
  })

  it(`leaves short column labels unrotated in a wide column`, () => {
    const heatmapData = heatmapDataOf(curd25)   // 3 rows × 4 columns
    expect(computeLayout(heatmapData, 1000)).toEqual({marginBottom: 10, marginRight: 20, height: 3 * 40 + 30 + 10, autoRotation: [-45]})
    expect(computeLayout(heatmapData, 400)).toEqual(
      {marginBottom: 10, marginRight: 50, height: 3 * 40 + 18 * 6 * Math.SQRT1_2 + 10, autoRotation: [-45]})
  })

  it(`stands long contrast labels up vertically, whatever the width`, () => {
    const heatmapData = heatmapDataOf(geod30249)   // contrast labels of up to 90 characters
    expect(computeLayout(heatmapData, 1000)).toEqual({marginBottom: 10, marginRight: 20, height: 2 * 40 + 90 * 6 + 10, autoRotation: [-90]})
    expect(computeLayout(heatmapData, 1600).autoRotation).toEqual([-90])
  })
})
