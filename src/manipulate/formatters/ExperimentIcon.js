import React from 'react'
import PropTypes from 'prop-types'

// The P (proteomics) and T (transcriptomics) badge of multi-experiment heatmaps. Inline styles, because the y-axis
// labels are HTML strings (renderToStaticMarkup) that Highcharts places outside React. `axis` is the badge in a row
// label, `legend` the one in the data series legend. Box sizing and line height are set here because, without the
// iframe, the host page's own (e.g. Bootstrap's body line-height of 1.5) would reach the badge.
const baseStyle = {
  boxSizing: `border-box`,
  color: `white`,
  borderRadius: `50%`,
  fontSize: `16px`,
  lineHeight: `18px`,
  height: `20px`,
  width: `20px`,
  textAlign: `center`,
  verticalAlign: `middle`,
  marginRight: `6px`,
  opacity: 0.4,
  display: `inline-block`
}

const variantStyles = {
  axis: {paddingTop: `1px`},
  legend: {paddingLeft: `1px`, marginLeft: `10px`}
}

const ExperimentIcon = ({background, variant = `axis`, title, children}) =>
  <span title={title} style={{...baseStyle, ...variantStyles[variant], backgroundColor: background}}>{children}</span>

ExperimentIcon.propTypes = {
  background: PropTypes.string.isRequired,
  variant: PropTypes.oneOf([`axis`, `legend`]),
  title: PropTypes.string,
  children: PropTypes.node
}

export default ExperimentIcon
