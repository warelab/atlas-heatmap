import { vi } from 'vitest'

import loadChartData from '../../src/load/main.js'
import makeEventCallbacks from '../../src/manipulate/Events.js'
import axesFormatters from '../../src/manipulate/formatters/axesFormatters.js'
import cellTooltipFormatter from '../../src/manipulate/formatters/heatmapCellTooltipFormatter.js'

export const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

// The chart data of a captured fixture, as Container loads it
export const chartDataOf = (fixture, options = {}) => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: ATLAS_URL,
  showAnatomogram: true, showControlMenu: true, isWidget: true, ...options
})

// The props HeatmapWithControls gives HeatmapCanvas for a fixture (heatmapExtraArgs), with spies for its callbacks,
// plus the chart data's colourAxis, which HeatmapWithControls gives only to the legend: pass {colourAxis: undefined}
// for exactly the canvas it draws
export const canvasProps = (fixture, overrides = {}) => {
  const {heatmapData, heatmapConfig, colourAxis} = chartDataOf(fixture)
  return {
    heatmapData,
    colourAxis,
    noDataCellsColour: heatmapConfig.isMultiExperiment ? `white` : `rgb(235, 235, 235)`,
    ontologyIdsToHighlight: [],
    onZoom: vi.fn(),
    events: makeEventCallbacks({heatmapData, onSelectOntologyIds: vi.fn(), heatmapConfig}),
    cellTooltipFormatter: cellTooltipFormatter(heatmapConfig),
    ...axesFormatters(heatmapConfig),
    withAnatomogram: true,
    currentGenomeBrowser: null,
    ...overrides
  }
}
