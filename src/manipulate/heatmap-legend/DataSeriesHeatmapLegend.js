import React from 'react'
import PropTypes from 'prop-types'

import ExperimentIcon from '../formatters/ExperimentIcon.js'
import {InfoCircle} from '../controls/icons.js'

// Class names from src/styles/heatmap.css; the swatch colour is inline.
const DataSeriesHeatmapLegendBox = (props) =>
  <div className={props.on ? `gxa-legend-item` : `gxa-legend-item gxa-legend-item--off`}>
    <div className={`gxa-legend-swatch`} style={{background: props.colour}} />
    <span className={`gxa-va-middle`}>{props.name}</span>
  </div>

DataSeriesHeatmapLegendBox.propTypes = {
  name: PropTypes.string.isRequired,
  colour: PropTypes.string.isRequired,
  on: PropTypes.bool.isRequired
}

const DEFAULT_TITLE =
  `Baseline expression levels in RNA-seq experiments are in FPKM or TPM. ` +
  `Low: 0.5-10, Medium: 11-1,000, ` +
  `High: >1,000. ` +
  `Proteomics expression levels are mapped to low, medium, high per experiment basis.`

// The info icon's title sits on a <span>: an SVG title attribute shows no tooltip.
const DataSeriesHeatmapLegend = ({
  legendItems,
  title = DEFAULT_TITLE,
  missingValueColour = `white`,
  missingValueLabel = `No data available`
}) =>
  <div className={`gxa-legend`}>
    <ExperimentIcon variant={`legend`} background={`green`}>P</ExperimentIcon>Proteomics
    <ExperimentIcon variant={`legend`} background={`orangered`}>T</ExperimentIcon>Transcriptomics
    <br/>
    <div className={`gxa-legend-item`}>
      <span title={title}><InfoCircle className={`gxa-info-icon`} /></span>
    </div>
    {legendItems.map(({key, ...legendItemProps}) => <DataSeriesHeatmapLegendBox key={key} {...legendItemProps} />)}
    <DataSeriesHeatmapLegendBox
      key={missingValueLabel}
      name={missingValueLabel}
      colour={missingValueColour}
      on={true}
    />

  </div>

DataSeriesHeatmapLegend.propTypes = {
  legendItems: PropTypes.arrayOf(PropTypes.shape(DataSeriesHeatmapLegendBox.propTypes)).isRequired,
  title: PropTypes.string,
  missingValueColour: PropTypes.string,
  missingValueLabel: PropTypes.string
}

export default DataSeriesHeatmapLegend
