import React, {useCallback, useEffect, useRef} from 'react'
import PropTypes from 'prop-types'
import {createRoot} from 'react-dom/client'

import ContainerLoader from './layout/ContainerLoader.js'
import HeatmapErrorBoundary from './layout/HeatmapErrorBoundary.js'
import {applyResolveUrl} from './layout/links.js'
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
 */
const DEFAULT_OPTIONS = Object.freeze({
  showAnatomogram: true,
  isWidget: true,
  showControlMenu: true,
  atlasUrl: `https://www.ebi.ac.uk/gxa/`,
  inProxy: ``,
  outProxy: ``,
  experiment: ``,
  linkTarget: `_blank`,
  injectStyles: true
})

// Unlike upstream, an explicit `undefined` (e.g. atlasUrl={config.atlasUrl} when it is not configured) keeps the default
const withDefaults = props => Object.entries(props).reduce(
  (options, [name, value]) => {
    if (value !== undefined) {
      options[name] = value
    }
    return options
  },
  {...DEFAULT_OPTIONS})

// Endpoints are resolved relative to atlasUrl, so without a trailing slash its last segment would be dropped
const withTrailingSlash = url => url && !url.endsWith(`/`) ? `${url}/` : url

const ExpressionAtlasHeatmap = props => {
  const options = withDefaults(props)
  const {
    query, experiment, inProxy, outProxy, showAnatomogram, isWidget, showControlMenu, fail, linkTarget, className, style
  } = options
  const atlasUrl = withTrailingSlash(options.atlasUrl)
  useStyleInjection(options.injectStyles !== false)

  // urlFor(kind, defaultUrl, context) asks the latest resolveUrl, so its own identity never changes and a new
  // resolveUrl function alone does not rebuild the chart
  const latest = useRef(null)
  latest.current = {resolveUrl: options.resolveUrl, query, experiment}
  const urlFor = useCallback((kind, defaultUrl, context) => {
    const {resolveUrl, query, experiment} = latest.current
    return applyResolveUrl(resolveUrl, kind, defaultUrl, {query, experiment: experiment || null, ...context})
  }, [])

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
  render,
  DEFAULT_OPTIONS,
  ensureStylesInjected,
  STYLE_ELEMENT_ID,
  HEATMAP_CSS
}
