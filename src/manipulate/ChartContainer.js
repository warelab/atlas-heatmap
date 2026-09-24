import React, {Suspense} from 'react'
import PropTypes from 'prop-types'

import Heatmap from './HeatmapWithControls.js'
import {chartDataPropTypes} from './chartDataPropTypes.js'

// Loaded only for payloads with gene-specific results (EBI single-experiment pages, not the Gramene backend), so the
// boxplot charts and highcharts-more stay out of the main bundle
const GeneSpecificResults = React.lazy(() => import('./GeneSpecificResults.js'))

class ChartContainer extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      chartType: `heatmap`
    }

    this.handleClick = this._handleClick.bind(this)
  }

  _theOtherChartType() {
    return this.state.chartType === `heatmap` ? `boxplot and transcripts` : `heatmap`
  }

  _handleClick(e) {
    e.preventDefault()
    this.setState({ chartType: this._theOtherChartType() })
  }

  render() {
    return (
      <div style={{width: `100%`}}>
        {this.props.chartData.geneSpecificResults &&
        <a href="#" onClick={this.handleClick}>
          {`Show ${this._theOtherChartType()} view`}
        </a>
        }
        <div style={{display: this.state.chartType === `heatmap` ? `block` : `none`, width: `100%`}} >
          <Heatmap {...this.props.chartData} download={this.props.download} />
        </div>
        { this.props.chartData.geneSpecificResults &&
        <div style={{display: this.state.chartType === `boxplot and transcripts` ? `block` : `none`, width: `100%`}} >
          <Suspense fallback={null}>
            <GeneSpecificResults {...this.props.chartData.geneSpecificResults} />
          </Suspense>
        </div>
        }
      </div>
    )
  }
}

ChartContainer.propTypes = {
  chartData: chartDataPropTypes.isRequired,
  // The Download button's {query, fileName, show}
  download: PropTypes.object
}

export default ChartContainer
