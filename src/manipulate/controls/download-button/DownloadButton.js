import React from 'react'
import PropTypes from 'prop-types'

import disclaimers from './disclaimers.js'
import {heatmapFileName, heatmapJson, heatmapSummary, heatmapTsv} from './Download.js'
import {DownloadDialogButton} from './DownloadDialog.js'
import {downloadContext} from './downloadFile.js'

import { heatmapDataPropTypes } from '../../../manipulate/chartDataPropTypes.js'

// The heatmap's Download button. It opens the Download dialog, which saves what the heatmap shows (heatmapData, and
// only the columns of `visibleColumns` when the chart is zoomed in) as tab-delimited text or JSON. An experiment's
// full data (fullDatasetUrl, final: resolveUrl applied) is a secondary link in the dialog; there is none without one.
// A disclaimer is shown in the dialog, and must be agreed to before either.
const DownloadButton = ({
  currentlyShownContent: {heatmapData, descriptionLines, visibleColumns = null},
  experiment = null,
  query = null,
  atlasUrl = ``,
  isDifferential = false,
  defaultFileName,
  fullDatasetUrl,
  disclaimer,
  linkTarget,
  isSingleExperiment = Boolean(experiment)
}) => {
  const buildContent = format => {
    const context = downloadContext()
    return format === `json` ?
      heatmapJson({heatmapData, range: visibleColumns, experiment, query, atlasUrl, isDifferential, ...context}) :
      heatmapTsv({heatmapData, range: visibleColumns, descriptionLines, isSingleExperiment, ...context})
  }

  return (
    <DownloadDialogButton
      defaultFileName={defaultFileName || heatmapFileName({experiment, genes: query ? query.genes : []})}
      summary={heatmapSummary(heatmapData, visibleColumns)}
      buildContent={buildContent}
      disclaimer={disclaimers[disclaimer]}
      fullDatasetUrl={fullDatasetUrl || undefined}
      linkTarget={linkTarget} />
  )
}

DownloadButton.propTypes = {
  currentlyShownContent: PropTypes.shape({
    descriptionLines : PropTypes.arrayOf(PropTypes.string).isRequired,
    heatmapData: heatmapDataPropTypes,
    // The columns in view when zoomed in: indexes of heatmapData.xAxisCategories, both included
    visibleColumns: PropTypes.shape({from: PropTypes.number.isRequired, to: PropTypes.number.isRequired})
  }).isRequired,
  experiment: PropTypes.shape({
    accession: PropTypes.string.isRequired,
    description: PropTypes.string,
    type: PropTypes.string
  }),
  query: PropTypes.shape({genes: PropTypes.arrayOf(PropTypes.string).isRequired}),
  atlasUrl: PropTypes.string,
  isDifferential: PropTypes.bool,
  defaultFileName: PropTypes.string,
  fullDatasetUrl: PropTypes.string.isRequired,
  disclaimer: PropTypes.string.isRequired,
  linkTarget: PropTypes.string,
  isSingleExperiment: PropTypes.bool
}

export default DownloadButton
