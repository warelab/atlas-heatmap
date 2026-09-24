import getHeatmapDataSeries from './heatmapDataSeries.js'
import {getHeatmapXAxisCategories, getHeatmapYAxisCategories} from './heatmapAxisCategories'
import {withShortLabels} from './sharedLabelPrefix.js'

export default ({allRows, geneQuery, columnHeaders, experiment, inProxy, atlasUrl}) =>
  ({
    xAxisCategories:
      withShortLabels(getHeatmapXAxisCategories({columnHeaders, experiment, inProxy, atlasUrl})),
    yAxisCategories: getHeatmapYAxisCategories({rows: allRows, geneQuery, experiment, inProxy, atlasUrl}),
    dataSeries: getHeatmapDataSeries(allRows, experiment)
  })
