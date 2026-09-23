import { vi } from 'vitest'

// A fetch Response for a captured fixture ({status, contentType, body}) or for an explicit {status, body, headers}.
export const responseFor = ({status = 200, statusText = ``, body, contentType = `application/json`, headers = {}}) =>
  new Response(
    status === 204 ? null : typeof body === `string` ? body : JSON.stringify(body),
    {status, statusText, headers: {'content-type': contentType, ...headers}})

// A promise with its resolve/reject exposed.
export const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return {promise, resolve, reject}
}

// Installs a fetch mock that answers every request with `answer(url, init)` (a Response, a fixture or a promise of
// either), and rejects with an AbortError when the request's signal aborts first, like browsers do.
export const mockFetch = answer => {
  const fetchMock = vi.fn((url, init = {}) => new Promise((resolve, reject) => {
    const {signal} = init
    const abort = () => reject(new DOMException(`The operation was aborted.`, `AbortError`))
    if (signal) {
      if (signal.aborted) {
        abort()
        return
      }
      signal.addEventListener(`abort`, abort)
    }
    Promise.resolve(answer(url, init))
      .then(result => resolve(result instanceof Response ? result : responseFor(result)), reject)
  }))
  vi.stubGlobal(`fetch`, fetchMock)
  return fetchMock
}
