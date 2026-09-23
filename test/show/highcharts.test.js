import { describe, expect, it, vi } from 'vitest'
import Highcharts from 'highcharts'

import getHeatmapHighcharts from '../../src/show/highcharts.js'
import getBoxplotHighcharts from '../../src/show/boxplotHighcharts.js'
import heatmapModule from 'highcharts/modules/heatmap.js'
import customEvents from 'highcharts-custom-events'
import highchartsMore from 'highcharts/highcharts-more.js'

// Count the module registrations, still running the real modules
vi.mock(`highcharts/modules/heatmap.js`, async importOriginal => {
  const {default: factory} = await importOriginal()
  return {default: vi.fn(H => factory(H))}
})
vi.mock(`highcharts-custom-events`, async importOriginal => {
  const {default: factory} = await importOriginal()
  return {default: vi.fn(H => factory(H))}
})
vi.mock(`highcharts/highcharts-more.js`, async importOriginal => {
  const {default: factory} = await importOriginal()
  return {default: vi.fn(H => factory(H))}
})

describe(`Highcharts set-up`, () => {
  // restoreMocks does not reset these module mocks' call counts, so the tests read them in order
  it(`does nothing when imported`, () => {
    expect(heatmapModule).not.toHaveBeenCalled()
    expect(customEvents).not.toHaveBeenCalled()
    expect(highchartsMore).not.toHaveBeenCalled()
    expect(window.Highcharts).toBeUndefined()
  })

  it(`registers the heatmap modules once, on the Highcharts object`, () => {
    // a Highcharts shared with an earlier test file may be set up already; it must then not be set up again
    const preset = Highcharts.__gxaHeatmapInit === true
    const H = getHeatmapHighcharts()
    expect(H).toBe(Highcharts)
    expect(getHeatmapHighcharts()).toBe(H)
    expect(heatmapModule).toHaveBeenCalledTimes(preset ? 0 : 1)
    expect(customEvents).toHaveBeenCalledTimes(preset ? 0 : 1)
    expect(H.__gxaHeatmapInit).toBe(true)
    expect(typeof H.seriesTypes.heatmap).toBe(`function`)
    expect(highchartsMore).not.toHaveBeenCalled()
  })

  it(`adds highcharts-more and negative logarithmic axes for the boxplots, once`, () => {
    const preset = Highcharts.__gxaBoxplotInit === true
    const H = getBoxplotHighcharts()
    expect(H).toBe(Highcharts)
    getBoxplotHighcharts()
    expect(highchartsMore).toHaveBeenCalledTimes(preset ? 0 : 1)
    expect(typeof H.seriesTypes.boxplot).toBe(`function`)
    expect(H.Axis.prototype.allowNegativeLog).toBe(true)
  })
})
