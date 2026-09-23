import React, {useMemo} from 'react'

import useAtlasFetch from '../layout/useAtlasFetch.js'

import Boxplot from '../show/BoxplotCanvas.js'
import Transcripts from '../show/TranscriptsCanvas.js'


const tryCreateBoxplotData = ({dataRow, columnHeaders}) => {
  const boxplotSeries =
    [].concat.apply([],
      dataRow.expressions
        .map((expression, ix) => (
          expression.quartiles
            ? [{
              x: ix,
              low: expression.quartiles.min,
              q1: expression.quartiles.lower,
              median: expression.quartiles.median,
              q3: expression.quartiles.upper,
              high: expression.quartiles.max
            }]
            : []
        ))
    )

  const loosePointsSeries =
    [].concat.apply([],
      dataRow.expressions
        .map((expression, ix) => (
          expression.quartiles
            ? []
            : [{x:ix, y: expression.value}]
        ))
    )

  if(boxplotSeries.length || loosePointsSeries.length){
    return {
      boxplotSeries,
      loosePointsSeries,
      xAxisCategories: columnHeaders.map((header) => header.name),
      unit: dataRow.expressionUnit
    }
  } else {
    return null
  }
}

const noData = (msg) => <span>{msg}</span>

const makeBoxplot = (geneNameOrId, data, config) => (
  data && config && <Boxplot {...data} config={config} titleSuffix={geneNameOrId} />
)

const getGeneNameOrId = ({name, id}) => name ? name : id

// Upstream rendered the fetch state or the payload object itself (a React error) where these show a message
const QuietLoader = ({sourceUrlFetch, keepOnlyTheseColumnIds}) => (
  sourceUrlFetch.pending
    ? noData()
    : sourceUrlFetch.rejected
      ? noData(sourceUrlFetch.reason.message)
      : !sourceUrlFetch.fulfilled || !sourceUrlFetch.value
        ? noData(`No data`)
        : sourceUrlFetch.value.error
          ? noData(String(sourceUrlFetch.value.error))
          : (!sourceUrlFetch.value.geneExpression && !sourceUrlFetch.value.transcriptExpression)
            ? noData(`No gene or transcript expression data`)
            : (
              <div>
                { sourceUrlFetch.value.geneExpression &&
              makeBoxplot(
                getGeneNameOrId(sourceUrlFetch.value.geneExpression.rows[0]),
                tryCreateBoxplotData(
                  {
                    dataRow: sourceUrlFetch.value.geneExpression.rows[0],
                    columnHeaders: sourceUrlFetch.value.columnHeaders
                  }),
                sourceUrlFetch.value.config)
                }
                { sourceUrlFetch.value.transcriptExpression &&
              <Transcripts {... sourceUrlFetch.value.transcriptExpression}
                keepOnlyTheseColumnIds = {keepOnlyTheseColumnIds}
                columnHeaders = {sourceUrlFetch.value.columnHeaders}
                config = {sourceUrlFetch.value.config}
                titleSuffix = {getGeneNameOrId(sourceUrlFetch.value.geneExpression.rows[0])} />
                }
              </div>
            )
)

// Replaces react-refetch's connect(): a GET of props.url (react-refetch also sent Content-Type: application/json,
// which only forces a CORS preflight)
const GeneSpecificResults = ({url, keepOnlyTheseColumnIds}) => {
  const request = useMemo(() => ({url, method: `GET`, headers: {Accept: `application/json`}}), [url])
  const sourceUrlFetch = useAtlasFetch(request)
  return <QuietLoader sourceUrlFetch={sourceUrlFetch} keepOnlyTheseColumnIds={keepOnlyTheseColumnIds} />
}

export default GeneSpecificResults
