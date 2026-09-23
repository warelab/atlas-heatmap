import React from 'react'
import PropTypes from 'prop-types'

import {linkAttrs} from './links.js'

// The URLs are final (outProxy and resolveUrl applied). A null URL drops its link: the “Expression Atlas” text stays,
// the “full record” clause and the support sentence go.
const Footer = props => {
  const link = (url, text) =>
    url ? <a {...linkAttrs(props.linkTarget)} href={url} style={{textDecoration: `none`}}>{text}</a> : text

  return (
    <div style={{marginBottom: `2rem`, clear: `both`, width: `100%`}}>
      This page is a summary of the data held in {link(props.atlasUrl, `Expression Atlas`)} for this
      gene{props.moreInformationUrl ? <>; click {link(props.moreInformationUrl, `here`)} for the full record.</> : `.`}
      {props.supportUrl && <>
        <br/>
        Please send any queries or feedback via {link(props.supportUrl, `the EBI Support & feedback form`)}.
      </>}
    </div>
  )
}

Footer.propTypes = {
  atlasUrl: PropTypes.string,
  moreInformationUrl: PropTypes.string,
  supportUrl: PropTypes.string,
  linkTarget: PropTypes.string
}

export default Footer
