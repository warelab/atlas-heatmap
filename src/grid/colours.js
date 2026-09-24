// The colours of ExpressionFactorGrid's samples: exactly those the flat heatmap of the same payload gives its cells.
//
// The flat single-experiment heatmap draws every value as a point of one of its data series (Below cutoff, Low, …,
// High; load/heatmapDataSeries.js), each series with its own colour. HeatmapWithControls gives HeatmapCanvas no colour
// axis (heatmapExtraArgs leaves it out, as upstream has since 2017): the chart data's colourAxis only draws the
// gradient legend. So Highcharts colours every point with its series' colour, and so does the grid.

/**
 * The colour of each column (assay group) of profile row `profileIndex`, by column index, from the chart data
 * (loadChartData) of the payload: the colour of the data series that holds its point, undefined where the flat
 * heatmap has no point, i.e. no value.
 */
export const assayGroupColours = ({heatmapData}, profileIndex) => {
  const colours = []
  heatmapData.dataSeries.forEach(series => {
    series.data.forEach(point => {
      if (point.y === profileIndex) {
        colours[point.x] = series.info.colour
      }
    })
  })
  return colours
}
