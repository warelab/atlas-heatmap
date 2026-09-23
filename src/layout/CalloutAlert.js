import React from 'react'
import PropTypes from 'prop-types'
import { Alert } from 'react-bootstrap'

import {keepDefaultUrl, linkAttrs, SUPPORT_URL} from './links.js'

// A react-bootstrap 2 Alert. Upstream's third-party "reload bypassing your browser cache" link is gone.
const CalloutAlert = ({error, variant = `danger`, linkTarget, urlFor = keepDefaultUrl}) => {
  if (variant !== `danger`) {
    return (
      <Alert variant={variant}>
        <Alert.Heading as={`h5`}>No results</Alert.Heading>
        <p className={`mb-0`}>{error.description}</p>
      </Alert>
    )
  }

  const supportUrl = urlFor(`support`, SUPPORT_URL, {})
  return (
    <Alert variant={variant}>
      <Alert.Heading as={`h5`}>Oops!</Alert.Heading>
      <p>
        {error.description}
      </p>
      <p>
        You may also try reloading the page.
      </p>
      {supportUrl &&
      <p>
        If the error persists, in order to help us debug the issue, please copy the URL from your browser and the error
        message below and send it to us via <a {...linkAttrs(linkTarget)} href={supportUrl}>the EBI Support & Feedback system</a>:
      </p>}
      <code className={`small`}>{`${error.name}: ${error.message}`}</code>
    </Alert>
  )
}

CalloutAlert.propTypes = {
  error: PropTypes.shape({
    description: PropTypes.string.isRequired,
    name: PropTypes.string,
    message: PropTypes.string
  }).isRequired,
  variant: PropTypes.string,
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func
}

export default CalloutAlert
