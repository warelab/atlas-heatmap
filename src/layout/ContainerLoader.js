import React, {useEffect, useMemo, useRef} from 'react'
import PropTypes from 'prop-types'
import { Spinner } from 'react-bootstrap'

import Container from './Container.js'
import CalloutAlert from './CalloutAlert.js'
import {buildRequest, requestKey} from './request.js'
import useAtlasFetch from './useAtlasFetch.js'

// A react-bootstrap 2 spinner replaces resources/images/loading.gif, which not every atlasUrl serves.
const Loading = () =>
  <div role={`status`} style={{padding: `1rem 0`}}>
    <Spinner animation={`border`} size={`sm`} aria-hidden={`true`} style={{marginRight: `0.5rem`, verticalAlign: `middle`}} />
    Loading expression data…
  </div>

const PROBLEM_CONTACTING_SERVER =
  `There was a problem contacting the Expression Atlas server. Please try again in a few seconds.`
const NO_RESULTS = `Sorry, no results could be found matching your query.`

// Upstream's three outcomes of the request, besides loading and success.
const outcome = sourceUrlFetch => {
  if (sourceUrlFetch.pending) {
    return {loading: true}
  } else if (sourceUrlFetch.value === null) {
    // sourceUrlFetch.value===null covers the case in which the promise is rejected and also when the JSON payload is
    // empty; the latter can happen when the web app fails to respond within the EBI time window of 30 seconds
    return {
      // It’s interesting to note that on an empty response Firefox reports the promise as rejected but Chrome does not
      failure: sourceUrlFetch.rejected ?
        sourceUrlFetch.reason.message :
        `request to ${sourceUrlFetch.meta.request.url} failed`
    }
  } else if (sourceUrlFetch.value.error) {
    return {failure: String(sourceUrlFetch.value.error)}
  } else if (!sourceUrlFetch.value.profiles) {
    return {noResults: true}
  } else {
    return {data: sourceUrlFetch.value}
  }
}

const ContainerLoader = (props) => {
  const {inProxy, atlasUrl, source, fail, linkTarget, urlFor} = props

  // A new `source` object with the same content is the same request.
  const nextRequest = buildRequest({inProxy, atlasUrl, source})
  const request = useMemo(() => nextRequest, [requestKey(nextRequest)])
  const sourceUrlFetch = useAtlasFetch(request)
  const result = outcome(sourceUrlFetch)

  // `fail` hears about a failed request once, not on every render as upstream (and not twice under StrictMode, whose
  // second effect run sees the ref the first one set).
  const reportedKey = useRef(null)
  useEffect(() => {
    if (result.failure === undefined || reportedKey.current === sourceUrlFetch.key) {
      return
    }
    reportedKey.current = sourceUrlFetch.key
    fail && fail({
      url: request.url,
      method: request.method,
      message: result.failure
    })
  }, [sourceUrlFetch.key, result.failure])

  if (result.loading) {
    return <Loading />
  } else if (result.failure !== undefined) {
    return (
      <CalloutAlert
        error={{
          description: PROBLEM_CONTACTING_SERVER,
          name: `Error`,
          message: result.failure
        }}
        linkTarget={linkTarget}
        urlFor={urlFor} />
    )
  } else if (result.noResults) {
    return <CalloutAlert variant={`info`} error={{description: NO_RESULTS}} />
  } else {
    // Keyed on the request, so the controls' state (ordering, filters, zoom) starts afresh with new data
    return <Container key={sourceUrlFetch.key} {...props} data={result.data} />
  }
}

ContainerLoader.propTypes = {
  inProxy: PropTypes.string.isRequired,
  atlasUrl: PropTypes.string.isRequired,
  source: PropTypes.shape({
    endpoint: PropTypes.string.isRequired,
    params: PropTypes.object.isRequired
  }).isRequired,
  fail: PropTypes.func,
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func
}

export default ContainerLoader
