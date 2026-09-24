import {useCallback, useRef} from 'react'

import {applyResolveUrl} from './links.js'

// Shared by ExpressionAtlasHeatmap (Main.js) and ExpressionFactorGrid (grid/ExpressionFactorGrid.js).

const DEFAULT_ATLAS_URL = `https://www.ebi.ac.uk/gxa/`

// Unlike upstream, an explicit `undefined` (e.g. atlasUrl={config.atlasUrl} when it is not configured) keeps the default
const withDefaults = (defaults, props) => Object.entries(props).reduce(
  (options, [name, value]) => {
    if (value !== undefined) {
      options[name] = value
    }
    return options
  },
  {...defaults})

// Endpoints are resolved relative to atlasUrl, so without a trailing slash its last segment would be dropped
const withTrailingSlash = url => url && !url.endsWith(`/`) ? `${url}/` : url

// urlFor(kind, defaultUrl, context) asks the latest resolveUrl, with `baseContext` under the context the link adds. Its
// own identity never changes, so a new resolveUrl function alone does not rebuild the chart.
const useUrlFor = (resolveUrl, baseContext) => {
  const latest = useRef(null)
  latest.current = {resolveUrl, baseContext}
  return useCallback((kind, defaultUrl, context) => {
    const {resolveUrl, baseContext} = latest.current
    return applyResolveUrl(resolveUrl, kind, defaultUrl, {...baseContext, ...context})
  }, [])
}

export {DEFAULT_ATLAS_URL, withDefaults, withTrailingSlash, useUrlFor}
