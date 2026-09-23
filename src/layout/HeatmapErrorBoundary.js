import React from 'react'
import PropTypes from 'prop-types'

import CalloutAlert from './CalloutAlert.js'

// Without the iframe, an error thrown while rendering the heatmap would unmount the host page's whole React root.
// This boundary shows an alert instead and reports the error through `fail`, once. Main.js keys it on the request, so a
// new query gets a fresh boundary.
class HeatmapErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {error: null}
    this.reported = false
  }

  static getDerivedStateFromError(error) {
    return {error}
  }

  componentDidCatch(error) {
    if (this.reported) {
      return
    }
    this.reported = true
    const {fail, request} = this.props
    fail && fail({
      url: request ? request.url : ``,
      method: request ? request.method : ``,
      message: error && error.message !== undefined ? error.message : String(error)
    })
  }

  render() {
    const {error} = this.state
    if (!error) {
      return this.props.children
    }
    return (
      <CalloutAlert
        error={{
          description: `There was a problem displaying the expression data.`,
          name: (error && error.name) || `Error`,
          message: error && error.message !== undefined ? error.message : String(error)
        }}
        linkTarget={this.props.linkTarget}
        urlFor={this.props.urlFor} />
    )
  }
}

HeatmapErrorBoundary.propTypes = {
  fail: PropTypes.func,
  request: PropTypes.shape({
    url: PropTypes.string,
    method: PropTypes.string
  }),
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func,
  children: PropTypes.node
}

export default HeatmapErrorBoundary
