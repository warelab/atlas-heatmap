import URI from 'urijs'

import {keepDefaultUrl, openUrl} from '../layout/links.js'

// The text of a label's HTML, entities decoded. DOMParser builds an inert document: nothing in it loads or runs.
const htmlToText = html => (
  typeof DOMParser === `function` ?
    new DOMParser().parseFromString(String(html), `text/html`).body.textContent :
    String(html).replace(/<[^>]*>/g, ``)
      .replace(/&lt;/g, `<`).replace(/&gt;/g, `>`).replace(/&quot;/g, `"`).replace(/&#x27;|&#39;/g, `'`)
      .replace(/&amp;/g, `&`)
)

// The y-axis formatter tags each label with data-gxa-y, the tick position Highcharts passes it, which indexes the
// heatmapData the chart was drawn from. Upstream matched the label text instead, which never matched All Studies rows
// (the T/P badge is part of the text), trimmed labels or rows with a design element; it is kept as the fallback.
const rowIndexFromLabel = (html, yAxisCategories) => {
  const tagged = /\bdata-gxa-y="(\d+)"/.exec(String(html))
  const index = tagged ? Number(tagged[1]) : -1
  if (index >= 0 && index < yAxisCategories.length) {
    return index
  }
  const text = htmlToText(html)
  return yAxisCategories.findIndex((cat) => cat.label === text)
}

const onlyUnique = (e, i, arr) => arr.indexOf(e) === i

const _ontologyIdsForColumnIndex = (heatmapData, x) => [heatmapData.xAxisCategories[x].id]

const _ontologyIdsForRowIndex = (heatmapData, y) => (
  [].concat.apply([],
    [].concat.apply([],
      heatmapData
        .dataSeries
        .map(series => series.data)
    )
      .filter(point => point.y === y && !!point.value)
      .map(point => _ontologyIdsForColumnIndex(heatmapData, point.x))
      .map(e => Array.isArray(e) ? e : [e])
  )
    .filter(onlyUnique)
)

const onClickUseGenomeBrowser = ({heatmapData, heatmapConfig: {experiment, atlasUrl, outProxy, linkTarget, urlFor = keepDefaultUrl}}) => (
  experiment ?
    (x, y, genomeBrowser) => {
      const geneId = heatmapData.yAxisCategories[y].info.trackId
      const trackId = heatmapData.xAxisCategories[x].info.trackId
      const url = urlFor(`genomeBrowser`, outProxy + URI(experiment.urls.genome_browsers, atlasUrl).addSearch({
        experimentAccession: experiment.accession,
        name: genomeBrowser,
        geneId,
        trackId
      }).toString(), {genomeBrowser, geneId, trackId})
      url && openUrl(url, linkTarget)
    }
    : undefined
)

const makeEventCallbacks = ({heatmapData, onSelectOntologyIds, heatmapConfig}) => {
  return {
    onHoverRowLabel: (yAxisLabel) => {
      const rowIndex = rowIndexFromLabel(yAxisLabel, heatmapData.yAxisCategories)
      onSelectOntologyIds(_ontologyIdsForRowIndex(heatmapData, rowIndex))
    },

    onHoverColumnLabel: (xAxisLabel) => {
      const columnIndex = heatmapData.xAxisCategories.findIndex((cat) => cat.label === xAxisLabel)
      onSelectOntologyIds(_ontologyIdsForColumnIndex(heatmapData, columnIndex))
    },

    onHoverPoint: (x) => {
      onSelectOntologyIds(_ontologyIdsForColumnIndex(heatmapData, x))
    },

    onHoverOff: () => {
      onSelectOntologyIds([])
    },

    onClick: onClickUseGenomeBrowser({heatmapData, heatmapConfig})
  }
}

export {htmlToText, rowIndexFromLabel}
export default makeEventCallbacks
