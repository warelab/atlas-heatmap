import URI from 'urijs'

// The data request, built exactly as upstream 5.7.2 built it (the `source` prop in Main.js and the react-refetch
// mapping in ContainerLoader.js). It has no JSX, so scripts/capture-fixtures.mjs can import it under plain Node.
//
// The body is deliberately NOT URL-encoded. The Warelab gramene-swagger /gxa/ backend splits the raw body
// `geneQuery=A B C` on spaces: it answers 500 to `+`, `%20` or any extra parameter, and 400 to a text/plain body.
// So never build the body with URLSearchParams (it encodes spaces as `+`), and always send the form Content-Type.

const resolveEndpoint = experiment => (
  !experiment ?
    `json/baseline_experiments` :
    experiment === `reference` ?
      `json/baseline_refexperiment` :
      `json/experiments/${experiment}`
)

// A string query is a relative endpoint. Otherwise the webapp wants "geneQuery" and "conditionQuery" as parameters,
// but in the API offering query.gene and query.condition felt nicer; any other key is passed through.
const buildSource = ({query, experiment}) => (
  typeof query === `string` ?
    {
      endpoint: query,
      params: {}
    } :
    {
      endpoint: resolveEndpoint(experiment),
      params:
        query ?
          Object.entries(query)
            .map(p => [`gene`, `condition`].includes(p[0]) ? [p[0]+`Query`, p[1]] : p)
            .reduce((acc,o)=>{ acc[o[0]]=o[1]; return acc}, {}) :
          {}
    }
)

const buildRequestBody = params =>
  Object.entries(params).map(p =>`${p[0]}=${typeof p[1] === `string` ? p[1] : JSON.stringify(p[1])}`).join(`&`)

const buildRequest = ({inProxy = ``, atlasUrl, source}) => ({
  url: inProxy + URI(source.endpoint, atlasUrl).toString(),
  method: `POST`, //the webapp also supports GET - we do POST in case the parameters get very large
  headers: {
    // react-refetch's default Accept header
    Accept: `application/json`,
    //the Atlas webapp is based on Spring; given this header it'll understand the body content to be equivalent to query parameters
    'Content-Type': `application/x-www-form-urlencoded`
  },
  body: buildRequestBody(source.params)
})

// Identifies a request: a new key means new data (and a fresh fetch).
const requestKey = ({method, url, body}) => `${method} ${url}\n${body || ``}`

export {resolveEndpoint, buildSource, buildRequestBody, buildRequest, requestKey}
