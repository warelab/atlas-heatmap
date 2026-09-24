import React, {useEffect} from 'react'
import PropTypes from 'prop-types'
import {createRoot} from 'react-dom/client'

import ExpressionFactorGrid from './grid/ExpressionFactorGrid.js'
import ContainerLoader from './layout/ContainerLoader.js'
import HeatmapErrorBoundary from './layout/HeatmapErrorBoundary.js'
import {DEFAULT_ATLAS_URL, useUrlFor, withDefaults, withTrailingSlash} from './layout/options.js'
import {buildRequest, buildSource, requestKey} from './layout/request.js'
import {ensureStylesInjected, HEATMAP_CSS, STYLE_ELEMENT_ID, useStyleInjection} from './styles/inject.js'

/**
 * @param {Object}          options
 * @param {string | Object} options.target - (render() only) a <div> id or a DOM element
 * @param {boolean}         options.disableGoogleAnalytics - Accepted and ignored: there is no Google Analytics any more
 * @param {boolean}         options.showControlMenu - Show menu with sorting, filtering and download options
 * @param {function}        options.fail - Called with {url, method, message} once per failed request, and when
 *                              drawing the heatmap throws
 * @param {function}        options.render - (render() only) Callback to run after each render() call
 * @param {boolean}         options.showAnatomogram - optionally hide the anatomogram
 * @param {boolean}         options.isWidget
 * @param {string}          options.atlasUrl - Atlas host and path with protocol and port; a trailing / is added
 * @param {string}          options.inProxy - Inbound proxy to pull assets from outside your domain
 * @param {string}          options.outProxy - Outbound proxy for links that take you outside the current domain
 * @param {string}          options.experiment
 * @param {Object|string}   options.query - Query object or relative URL endpoint to source data from:
 *                              e.g. json/experiments/E-PROT-1, /json/genes/ENSG00000005801, /json/genesets/GO:0000001
 *                                   json/baseline_refexperiment?geneQuery=…, /json/baseline_experiments?geneQuery=…
 * @param {string}                              options.query.species
 * @param {{value: string, category: string}[]} options.query.gene
 * @param {{value: string, category: string}[]} options.query.condition
 * @param {string}                              options.query.source
 * @param {string}          options.linkTarget - Where links and window.open go (default `_blank`)
 * @param {function}        options.resolveUrl - (kind, defaultUrl, context) => a string to override a link, null to
 *                              suppress it, undefined to keep the default. kind is one of row, experiment, atlas,
 *                              moreInformation, support, genomeBrowser, download; context has {query, experiment}.
 *                              It is read through a ref: a new function alone does not redraw the chart.
 * @param {string}          options.className - Added to the root div.gxaHeatmapContainer
 * @param {Object}          options.style - Style of the root div
 * @param {boolean}         options.injectStyles - Inject the stylesheet (default true); with false, import
 *                              gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css instead
 * @param {function}        options.filterRows - (row) => boolean: drops the payload's profiles.rows for which it is false,
 *                              and the columns left without a value. It filters the fetched payload: a new function
 *                              filters again without a new request (memoize it to keep the chart as it is).
 * @param {string}          options.downloadFileName - The file name (without extension) the Download dialog suggests;
 *                              default expression-<experiment accession, or studies>-<first gene>
 * @param {boolean}         options.showDownload - Show the Download button among the controls (default true)
 */
const DEFAULT_OPTIONS = Object.freeze({
  showAnatomogram: true,
  isWidget: true,
  showControlMenu: true,
  atlasUrl: DEFAULT_ATLAS_URL,
  inProxy: ``,
  outProxy: ``,
  experiment: ``,
  linkTarget: `_blank`,
  injectStyles: true,
  showDownload: true
})

const ExpressionAtlasHeatmap = props => {
  const options = withDefaults(DEFAULT_OPTIONS, props)
  const {
    query, experiment, inProxy, outProxy, showAnatomogram, isWidget, showControlMenu, fail, linkTarget, className, style,
    filterRows, downloadFileName, showDownload
  } = options
  const atlasUrl = withTrailingSlash(options.atlasUrl)
  useStyleInjection(options.injectStyles !== false)

  // urlFor(kind, defaultUrl, context) asks the latest resolveUrl, so its own identity never changes and a new
  // resolveUrl function alone does not rebuild the chart
  const urlFor = useUrlFor(options.resolveUrl, {query, experiment: experiment || null})

  const source = buildSource({query, experiment})
  const request = buildRequest({inProxy, atlasUrl, source})

  return (
    // The wrapping div is important to determine the width of the heatmap and know if the labels are going to be
    // rotated, so that we can set sensible margin sizes. See HeatmapCanvas.js
    <div className={[`gxaHeatmapContainer`, className].filter(Boolean).join(` `)} style={style}>
      <HeatmapErrorBoundary
        key={requestKey(request)}
        request={request}
        fail={fail}
        linkTarget={linkTarget}
        urlFor={urlFor}>
        <ContainerLoader
          inProxy={inProxy}
          outProxy={outProxy}
          atlasUrl={atlasUrl}
          showAnatomogram={showAnatomogram}
          isWidget={isWidget}
          showControlMenu={showControlMenu}
          fail={fail}
          linkTarget={linkTarget}
          urlFor={urlFor}
          filterRows={filterRows}
          downloadFileName={downloadFileName}
          showDownload={showDownload}
          source={source} />
      </HeatmapErrorBoundary>
    </div>
  )
}

ExpressionAtlasHeatmap.propTypes = {
  query: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  experiment: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  atlasUrl: PropTypes.string,
  inProxy: PropTypes.string,
  outProxy: PropTypes.string,
  showAnatomogram: PropTypes.bool,
  isWidget: PropTypes.bool,
  showControlMenu: PropTypes.bool,
  fail: PropTypes.func,
  linkTarget: PropTypes.string,
  resolveUrl: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  injectStyles: PropTypes.bool,
  filterRows: PropTypes.func,
  downloadFileName: PropTypes.string,
  showDownload: PropTypes.bool,
  disableGoogleAnalytics: PropTypes.bool
}

// Fires `callback` after every commit of its element, i.e. once per render() call (like ReactDOM.render's callback)
const AfterRender = ({callback, children}) => {
  useEffect(() => {
    typeof callback === `function` && callback()
  })
  return children
}

// One React root per target element, reused by later render() calls on the same element
const roots = new WeakMap()

const render = (options = {}) => {
  const {target, render: afterRender, disableGoogleAnalytics, ...props} = options
  const element = typeof target === `string` ? document.getElementById(target) : target
  if (!element || element.nodeType !== 1) {
    throw new Error(
      `gramene-atlas-heatmap render(): target ${typeof target === `string` ? `#${target}` : String(target)} ` +
      `is not an element or the id of one`)
  }

  let root = roots.get(element)
  if (!root) {
    root = createRoot(element)
    roots.set(element, root)
  }
  root.render(
    <AfterRender callback={afterRender}>
      <ExpressionAtlasHeatmap {...props} />
    </AfterRender>)

  return {
    unmount() {
      if (roots.get(element) === root) {
        roots.delete(element)
        root.unmount()
      }
    }
  }
}

export {
  ExpressionAtlasHeatmap as default,
  ExpressionAtlasHeatmap,
  ExpressionFactorGrid,
  render,
  DEFAULT_OPTIONS,
  ensureStylesInjected,
  STYLE_ELEMENT_ID,
  HEATMAP_CSS
}
