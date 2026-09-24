import { describe, expect, it } from 'vitest'

import { computeLayout, maxColumnLabelPx } from '../../src/show/HeatmapCanvas.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import geod128441 from '../fixtures/paralogs.E-GEOD-128441.differential.sorghum_v11.json'
import emtab5956 from '../fixtures/paralogs.E-MTAB-5956.sorghum_v11.json'

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
    const heatmapData = heatmapDataOf(geod30249)   // 2 rows; contrast labels of up to 90 characters
    // upstream gave them 90 × 6 = 540 px; above 2 rows they get the least room, 300 px
    expect(maxColumnLabelPx(heatmapData)).toBe(300)
    expect(computeLayout(heatmapData, 1000)).toEqual(
      {marginBottom: 10, marginRight: 20, height: 2 * 40 + 300 + 10, autoRotation: [-90]})
    expect(computeLayout(heatmapData, 1600).autoRotation).toEqual([-90])
  })

  it(`sizes the header for the shortened labels, cut at about the rows' height, and the axis title`, () => {
    // 11 rows; 49 contrasts of up to 146 characters, of which the first 50 are the same in every column
    const heatmapData = heatmapDataOf(geod128441)
    expect(maxColumnLabelPx(heatmapData)).toBe(11 * 40)
    // the 96 characters left (576 px by the estimate) are cut at 440 px
    expect(computeLayout(heatmapData, 1300)).toEqual(
      {marginBottom: 10, marginRight: 20, height: 11 * 40 + 24 + 11 * 40 + 10, autoRotation: [-90]})
  })

  it(`gives labels that fit their room upstream's height`, () => {
    const heatmapData = heatmapDataOf(emtab5956)   // 11 rows; labels of up to 52 characters (312 px)
    expect(computeLayout(heatmapData, 1300)).toEqual(
      {marginBottom: 10, marginRight: 20, height: 11 * 40 + 52 * 6 + 10, autoRotation: [-90]})
  })

  it(`lets labels take between 300 and 450 px`, () => {
    const rows = n => ({xAxisCategories: [], yAxisCategories: Array(n).fill({label: `x`})})
    expect(maxColumnLabelPx(rows(1))).toBe(300)
    expect(maxColumnLabelPx(rows(9))).toBe(360)
    expect(maxColumnLabelPx(rows(58))).toBe(450)
  })
})
