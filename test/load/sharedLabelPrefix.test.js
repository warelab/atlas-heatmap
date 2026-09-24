import { describe, expect, it } from 'vitest'

import { sharedLabelPrefix, withShortLabels, sharedLabelOf, displayedLabel } from '../../src/load/sharedLabelPrefix.js'
import loadChartData from '../../src/load/main.js'
import { filterHeatmapData, orderHeatmapData } from '../../src/manipulate/Manipulators.js'
import geod128441 from '../fixtures/paralogs.E-GEOD-128441.differential.sorghum_v11.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import emtab5956 from '../fixtures/paralogs.E-MTAB-5956.sorghum_v11.json'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'

const heatmapDataOf = fixture => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: `https://data.sorghumbase.org/sorghum_v11/gxa/`,
  showAnatomogram: true, showControlMenu: true, isWidget: true
}).heatmapData

describe(`sharedLabelPrefix`, () => {
  it(`is the text every label starts with, up to the last whole word`, () => {
    expect(sharedLabelPrefix([
      `environmental stress: none vs drought environment after flowering and age: 91 day`,
      `environmental stress: none vs drought environment before flowering and age: 21 day`
    ])).toBe(`environmental stress: none vs drought environment `)
    // the labels part in the middle of a word: that word stays in the labels
    expect(sharedLabelPrefix([`treatment with sodium chloride 100 mM`, `treatment with sodium chlorate 100 mM`]))
      .toBe(`treatment with sodium `)
    // one label is the start of another: it keeps its last word
    expect(sharedLabelPrefix([`organism part: leaf blade`, `organism part: leaf blade and sheath`]))
      .toBe(`organism part: leaf `)
  })

  it(`is empty when the shared text is short, a label would be left empty, or there is one column`, () => {
    expect(sharedLabelPrefix([`compound: water vs PEG`, `compound: NaOH vs ABA`])).toBe(``)
    expect(sharedLabelPrefix([`drought environment before flowering `, `drought environment before flowering then`])).toBe(``)
    expect(sharedLabelPrefix([`a single column with a long label`])).toBe(``)
    expect(sharedLabelPrefix([])).toBe(``)
  })
})

describe(`short column labels`, () => {
  it(`drop the 50 characters every E-GEOD-128441 contrast starts with`, () => {
    const {xAxisCategories} = heatmapDataOf(geod128441)
    expect(xAxisCategories).toHaveLength(49)
    expect(sharedLabelOf(xAxisCategories)).toBe(`environmental stress: none vs drought environment`)
    expect(xAxisCategories[0].label).toBe(
      `environmental stress: none vs drought environment after flowering and plot: 2 vs 21 in organism part: leaf ` +
      `and cultivar: BTX642 and age: 91 day`)
    expect(displayedLabel(xAxisCategories[0])).toBe(
      `after flowering and plot: 2 vs 21 in organism part: leaf and cultivar: BTX642 and age: 91 day`)
    xAxisCategories.forEach(category =>
      expect(`${sharedLabelOf(xAxisCategories)} ${category.shortLabel}`).toBe(category.label))
  })

  it(`leave labels without a long shared start alone`, () => {
    for (const fixture of [geod30249, emtab5956, allStudies]) {
      const {xAxisCategories} = heatmapDataOf(fixture)
      expect(sharedLabelOf(xAxisCategories)).toBe(``)
      xAxisCategories.forEach(category => {
        expect(category).not.toHaveProperty(`shortLabel`)
        expect(displayedLabel(category)).toBe(category.label)
      })
    }
  })

  it(`survive filtering and ordering`, () => {
    const heatmapData = heatmapDataOf(geod128441)
    const ordered = orderHeatmapData({columns: [...heatmapData.xAxisCategories.keys()].reverse(), rows: [...heatmapData.yAxisCategories.keys()]}, heatmapData)
    expect(sharedLabelOf(ordered.xAxisCategories)).toBe(`environmental stress: none vs drought environment`)
    const leafOnly = filterHeatmapData(() => true, () => true, category => category.label.includes(`in organism part: leaf`), heatmapData)
    expect(leafOnly.xAxisCategories.length).toBeLessThan(49)
    expect(sharedLabelOf(leafOnly.xAxisCategories)).toBe(`environmental stress: none vs drought environment`)
  })

  it(`withShortLabels copies the categories it shortens`, () => {
    const categories = [{label: `the same long text at the start, then one`}, {label: `the same long text at the start, then two`}]
    const shortened = withShortLabels(categories)
    expect(shortened.map(c => c.shortLabel)).toEqual([`one`, `two`])
    expect(categories[0]).not.toHaveProperty(`shortLabel`)
  })
})
