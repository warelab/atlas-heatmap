// The colours of ExpressionFactorGrid's samples: exactly those the flat heatmap of the same payload gives its cells.
//
// The flat single-experiment heatmap draws every value as a point of one of its data series (Below cutoff, Low, …,
// High; load/heatmapDataSeries.js) on a Highcharts colour axis whose dataClasses come from those series
// (load/heatmapColourAxis.js). Highcharts 6.2 colours a heatmap point with colorAxis.toColor(value) and, when no class
// holds the value, keeps the colour of the point's series (seriesTypes.heatmap#translateColors, Point#init).

/**
 * The colour Highcharts 6.2's ColorAxis#toColor gives `value` with `colourAxis.dataClasses`: the colour of the LAST
 * class whose from/to (either may be undefined) hold the value. `fallback` when none does, or when there are no
 * classes or no value.
 */
export const colourForValue = (colourAxis, value, fallback) => {
  const dataClasses = (colourAxis && colourAxis.dataClasses) || []
  if (value === undefined || value === null) {
    return fallback
  }
  for (let i = dataClasses.length - 1; i >= 0; i--) {
    const {from, to, color} = dataClasses[i]
    if ((from === undefined || value >= from) && (to === undefined || value <= to)) {
      return color || fallback
    }
  }
  return fallback
}

/**
 * The colour of each column (assay group) of profile row `profileIndex`, by column index, from the chart data
 * (loadChartData) of the payload: undefined where the flat heatmap has no point, i.e. no value.
 */
export const assayGroupColours = ({heatmapData, colourAxis}, profileIndex) => {
  const colours = []
  heatmapData.dataSeries.forEach(series => {
    series.data.forEach(point => {
      if (point.y === profileIndex) {
        colours[point.x] = colourForValue(colourAxis, point.value, series.info.colour)
      }
    })
  })
  return colours
}
