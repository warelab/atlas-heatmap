import React from 'react'
import PropTypes from 'prop-types'

import {linkAttrs} from './links.js'

// experimentUrl is final (outProxy and resolveUrl applied); null shows the description as plain text
const ExperimentDescription = ({experimentUrl, description, linkTarget}) =>
  <div style={{marginBottom: `1rem`, clear: `both`, width: `100%`}}>
    <div>
      {experimentUrl ?
        <a {...linkAttrs(linkTarget)} href={experimentUrl} style={{textDecoration: `none`}}>{description}</a> :
        description}
    </div>
  </div>

ExperimentDescription.propTypes = {
  experimentUrl: PropTypes.string,
  description: PropTypes.string.isRequired,
  linkTarget: PropTypes.string
}

export default ExperimentDescription
