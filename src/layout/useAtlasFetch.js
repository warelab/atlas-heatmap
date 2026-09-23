import {useEffect, useState} from 'react'

import {requestKey} from './request.js'

// Replaces react-refetch 3.0.1's connect(). useAtlasFetch(request) fetches `request` ({url, method, headers, body})
// whenever its URL, method or body change (a new object with the same content does not refetch), and aborts the
// fetch on cleanup: unmount, a new request, or StrictMode's second effect run. It returns a PromiseState-like object:
//   {pending, fulfilled, rejected, settled, value, reason, key, meta: {request, response}}
// While the latest request is in flight it reports pending, never the data of a previous request.

// react-refetch's fetch defaults.
const FETCH_DEFAULTS = Object.freeze({credentials: `same-origin`, mode: `cors`, redirect: `follow`})

// react-refetch's handleResponse and errors.js: no content gives null, a 2xx gives the JSON body, anything else
// rejects with an Error whose message is the JSON body's `error` or `message`.
// Deviation: an error response whose body is not JSON rejects with `<status> <statusText>` (react-refetch rejected
// with the JSON parser's SyntaxError).
const handleResponse = response => {
  if (response.headers.get(`content-length`) === `0` || response.status === 204) {
    return Promise.resolve(null)
  }
  if (response.status >= 200 && response.status < 300) {
    return response.json()
  }
  return response.json().then(
    cause => {
      throw new Error((cause && (cause.error || cause.message)) || ``)
    },
    () => {
      throw new Error(`${response.status} ${response.statusText || ``}`.trim())
    })
}

const pendingState = (key, request) => ({
  pending: true,
  fulfilled: false,
  rejected: false,
  settled: false,
  value: null,
  reason: null,
  key,
  meta: {request}
})

const isAbort = reason => Boolean(reason) && reason.name === `AbortError`

const useAtlasFetch = request => {
  const key = request ? requestKey(request) : null
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!request) {
      return undefined
    }
    let active = true
    const controller = typeof AbortController === `function` ? new AbortController() : null

    fetch(request.url, {
      ...FETCH_DEFAULTS,
      method: request.method || `GET`,
      headers: request.headers,
      body: request.body,
      signal: controller ? controller.signal : undefined
    })
      .then(response => handleResponse(response).then(value => ({response, value})))
      .then(
        ({response, value}) => {
          active && setState({
            pending: false,
            fulfilled: true,
            rejected: false,
            settled: true,
            value,
            reason: null,
            key,
            meta: {request, response}
          })
        },
        reason => {
          active && !isAbort(reason) && setState({
            pending: false,
            fulfilled: false,
            rejected: true,
            settled: true,
            value: null,
            reason,
            key,
            meta: {request}
          })
        })

    return () => {
      active = false
      controller && controller.abort()
    }
    // `key` stands for the request's URL, method and body
  }, [key])

  return state && state.key === key ? state : pendingState(key, request)
}

export {handleResponse, FETCH_DEFAULTS}
export default useAtlasFetch
