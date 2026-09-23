import React from 'react'
import ReactDOMServer from 'react-dom/server'

import HeatmapCellTooltip from './HeatmapCellTooltip.js'

// Highcharts puts the useHTML tooltip in the page with innerHTML, so escaped text shows as text (upstream decoded the
// entities again, which let markup in backend strings run).
const reactToHtml = component => ReactDOMServer.renderToStaticMarkup(component)

// The tooltip lives in its own container in <body> (tooltip.outside), where it would take the host page's font; this
// is Highcharts' default chart font.
const TOOLTIP_FONT_FAMILY = `"Lucida Grande", "Lucida Sans Unicode", Arial, Helvetica, sans-serif`

export default config => {
  return function(series, point) {
    const o = {
      colour: point.color,
      xLabel: point.options.info.xLabel || series.xAxis.categories[point.x].label,
      xProperties: series.xAxis.categories[point.x].info.tooltip.properties,
      yLabel: series.yAxis.categories[point.y].label,
      value:  point.value,
      replicates: series.xAxis.categories[point.x].info.tooltip.replicates || undefined,
    }

    Object.keys(point.options.info).forEach(key => o[key] = point.options.info[key])

    return reactToHtml(<div style={{fontFamily: TOOLTIP_FONT_FAMILY}}><HeatmapCellTooltip {...o} config={config}/></div>)
  }
}
