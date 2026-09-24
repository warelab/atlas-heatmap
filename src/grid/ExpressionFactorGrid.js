import React, {useMemo} from 'react'
import PropTypes from 'prop-types'

import CalloutAlert from '../layout/CalloutAlert.js'
import {FailureAlert, Loading, NoResultsAlert, outcome, useReportFailure} from '../layout/ContainerLoader.js'
import HeatmapErrorBoundary from '../layout/HeatmapErrorBoundary.js'
import {DEFAULT_ATLAS_URL, useUrlFor, withDefaults, withTrailingSlash} from '../layout/options.js'
import {buildRequest, buildSource, requestKey} from '../layout/request.js'
import useAtlasFetch from '../layout/useAtlasFetch.js'
import {isBaseline} from '../load/experimentTypeUtils.js'
import {useStyleInjection} from '../styles/inject.js'
import FactorGridView from './FactorGridView.js'

/**
 * One gene's expression in one baseline experiment, as a grid of the experiment's factors (e.g. organism part ×
 * developmental stage), drawn as a table: no Highcharts. It fetches json/experiments/<experiment> with
 * geneQuery=<gene>, as ExpressionAtlasHeatmap does for one experiment, and colours every assay group exactly as that
 * heatmap would. See grid/factorGrid.js for how the factors are laid out.
 *
 * @param {Object}   props
 * @param {string}   props.experiment - The accession, e.g. JGI-SB-1 (required)
 * @param {string}   props.gene - The gene id, sent as geneQuery (required)
 * @param {string}   props.atlasUrl - As ExpressionAtlasHeatmap's (default https://www.ebi.ac.uk/gxa/)
 * @param {string}   props.rowFactor, props.columnFactor - The factors on the rows and the columns; ignored unless the
 *                       experiment's assay groups have more than one value of them. Otherwise the grid's own choice
 * @param {function} props.onChangeFactors - ({rowFactor, columnFactor}) => void, when the reader swaps or chooses axes
 * @param {string}   props.inProxy, props.linkTarget, props.resolveUrl, props.fail, props.className, props.style,
 *                       props.injectStyles - As ExpressionAtlasHeatmap's
 */
const GRID_DEFAULTS = Object.freeze({
  atlasUrl: DEFAULT_ATLAS_URL,
  inProxy: ``,
  linkTarget: `_blank`,
  injectStyles: true
})

const NOT_BASELINE = `The factor grid shows baseline experiments only.`

// outcome() of ContainerLoader, plus: a payload with no gene row is no result, and one that is not baseline unsupported
const gridOutcome = fetched => {
  const result = outcome(fetched)
  if (!result.data) {
    return result
  }
  const {profiles, columnHeaders, experiment} = result.data
  if (!Array.isArray(profiles.rows) || profiles.rows.length === 0 || !Array.isArray(columnHeaders) || columnHeaders.length === 0) {
    return {noResults: true}
  }
  if (experiment && !isBaseline(experiment)) {
    return {unsupported: true}
  }
  return result
}

const FactorGridLoader = ({request: nextRequest, fail, linkTarget, urlFor, ...gridProps}) => {
  // A new request object with the same content is the same request
  const request = useMemo(() => nextRequest, [requestKey(nextRequest)])
  const fetched = useAtlasFetch(request)
  const result = gridOutcome(fetched)
  useReportFailure({fail, request, key: fetched.key, failure: result.failure})

  if (result.loading) {
    return <Loading />
  } else if (result.failure !== undefined) {
    return <FailureAlert failure={result.failure} linkTarget={linkTarget} urlFor={urlFor} />
  } else if (result.noResults) {
    return <NoResultsAlert />
  } else if (result.unsupported) {
    return <CalloutAlert variant={`info`} error={{description: NOT_BASELINE}} />
  }
  // Keyed on the request: the axes chosen here and the tooltip start afresh with new data
  return <FactorGridView key={fetched.key} {...gridProps} linkTarget={linkTarget} urlFor={urlFor} payload={result.data} />
}

FactorGridLoader.propTypes = {
  request: PropTypes.shape({url: PropTypes.string.isRequired, method: PropTypes.string}).isRequired,
  fail: PropTypes.func,
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func.isRequired
}

const ExpressionFactorGrid = props => {
  const options = withDefaults(GRID_DEFAULTS, props)
  const {experiment, gene, inProxy, fail, linkTarget, className, style, rowFactor, columnFactor, onChangeFactors} = options
  const atlasUrl = withTrailingSlash(options.atlasUrl)
  useStyleInjection(options.injectStyles !== false)

  const query = useMemo(() => ({gene}), [gene])
  const urlFor = useUrlFor(options.resolveUrl, {query, experiment: experiment || null})

  // Without both there is nothing to ask for (an empty experiment would ask for every experiment)
  const request = experiment && gene ? buildRequest({inProxy, atlasUrl, source: buildSource({query, experiment})}) : null

  return (
    <div className={[`gxaHeatmapContainer`, `gxaFactorGrid`, className].filter(Boolean).join(` `)} style={style}>
      {request &&
        <HeatmapErrorBoundary
          key={requestKey(request)}
          request={request}
          fail={fail}
          linkTarget={linkTarget}
          urlFor={urlFor}>
          <FactorGridLoader
            request={request}
            gene={gene}
            inProxy={inProxy}
            atlasUrl={atlasUrl}
            fail={fail}
            linkTarget={linkTarget}
            urlFor={urlFor}
            rowFactor={rowFactor}
            columnFactor={columnFactor}
            onChangeFactors={onChangeFactors} />
        </HeatmapErrorBoundary>}
    </div>
  )
}

ExpressionFactorGrid.propTypes = {
  experiment: PropTypes.string.isRequired,
  gene: PropTypes.string.isRequired,
  atlasUrl: PropTypes.string,
  rowFactor: PropTypes.string,
  columnFactor: PropTypes.string,
  onChangeFactors: PropTypes.func,
  inProxy: PropTypes.string,
  linkTarget: PropTypes.string,
  resolveUrl: PropTypes.func,
  fail: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  injectStyles: PropTypes.bool
}

export {GRID_DEFAULTS}
export default ExpressionFactorGrid
