import React from 'react'
import PropTypes from 'prop-types'
import ReactDOMServer from 'react-dom/server'

import trimEllipsify from './trimEllipsify'
import ExperimentIcon from './ExperimentIcon.js'
import {keepDefaultUrl, linkAttrs} from '../../layout/links.js'

// Highcharts puts useHTML labels in the page with innerHTML, so the escaped markup shows backend strings as text.
// Upstream decoded the entities again (he), which let markup in a row name (e.g. <img onerror>) run.
const reactToHtml = component => ReactDOMServer.renderToStaticMarkup(component)

// url is final (outProxy and resolveUrl applied); null renders the label without a link. data-gxa-y carries the tick
// position Highcharts passes the formatter, which Events.js reads back to find the hovered row.
const YAxisLabel = (props) => {
  const experimentIcon = props.experimentType===`PROTEOMICS_BASELINE` || props.experimentType===`PROTEOMICS_BASELINE_DIA` ?
    <ExperimentIcon variant={`axis`} background={`green`} title={`Proteomics experiment`}>P</ExperimentIcon> :
    props.experimentType && <ExperimentIcon variant={`axis`} background={`orangered`} title={`Transcriptomics experiment`}>T</ExperimentIcon>
  const labelContent = <>{experimentIcon}{trimEllipsify(props.labelText, 40)}</>
  const geneNameWithLink =
    props.url ?
      <a {...linkAttrs(props.config.linkTarget)} href={props.url} style={{border: `none`, color: `#148ff3`, textDecoration: `none`}}>
        {labelContent}
      </a> :
      <span style={{color: `#148ff3`}}>
        {labelContent}
      </span>

  return (
    props.extra ?
      <span data-gxa-y={props.pos} title={props.labelText.length > 40 ? props.labelText : ``}>
        {geneNameWithLink}<em style={{color:`black`}}>{`\t${props.extra}`}</em>
      </span> :
      <span data-gxa-y={props.pos} title={props.labelText.length > 40 ? props.labelText : ``}>
        {geneNameWithLink}
      </span>
  )
}

YAxisLabel.propTypes = {
  config: PropTypes.shape({
    atlasUrl: PropTypes.string.isRequired,
    outProxy: PropTypes.string.isRequired,
    linkTarget: PropTypes.string,
    isMultiExperiment: PropTypes.bool.isRequired,
    isDifferential: PropTypes.bool.isRequired,
    experiment: PropTypes.shape({
      accession: PropTypes.string.isRequired,
      type: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      species: PropTypes.string.isRequired
    })
  }).isRequired,
  labelText: PropTypes.string.isRequired,
  resourceId: PropTypes.string.isRequired,
  url: PropTypes.string,
  pos: PropTypes.number,
  extra: PropTypes.string,
  experimentType: PropTypes.string
}

export default config => ({
  xAxisFormatter: value => value.label,
  xAxisStyle: {
    fontSize: config.isDifferential ? `9px`: `smaller`,
    cursor: `default`,
    textOverflow: config.experiment ? `none` : `ellipsis`,
    whiteSpace: config.isDifferential ? `normal` : `nowrap`
  },

  // pos: the label's tick position (`this.pos` in a Highcharts label formatter), i.e. its row index
  yAxisFormatter: (value, pos) => reactToHtml(
    <YAxisLabel config={config}
      labelText={value.label}
      resourceId={value.id}
      url={(config.urlFor || keepDefaultUrl)(`row`, config.outProxy + value.info.url, {
        row: {
          id: value.id,
          label: value.label,
          uri: value.info.uri,
          experimentType: value.info.experimentType,
          index: pos
        }
      })}
      pos={pos}
      experimentType={value.info.experimentType}
      extra={value.info.designElement || ``}
    />
  ),
  yAxisStyle: {
    fontSize: config.isMultiExperiment ? `smaller` : `small`,
    color: `#148ff3`
  }
})
