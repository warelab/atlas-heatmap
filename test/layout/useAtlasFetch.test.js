import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import useAtlasFetch, { FETCH_DEFAULTS } from '../../src/layout/useAtlasFetch.js'
import { buildRequest, buildSource, requestKey } from '../../src/layout/request.js'
import { deferred, mockFetch, responseFor } from '../helpers/fetch.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import unknownGene from '../fixtures/error.unknown-gene.json'

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`
const requestFor = (gene, experiment = false) =>
  buildRequest({inProxy: ``, atlasUrl: ATLAS_URL, source: buildSource({query: {gene}, experiment})})

const renderFetch = (request, options) =>
  renderHook(({request}) => useAtlasFetch(request), {initialProps: {request}, ...options})

describe(`useAtlasFetch`, () => {
  it(`reports pending, then the JSON payload, and fetches with react-refetch's options`, async () => {
    const fetchMock = mockFetch(() => allStudies)
    const request = requestFor(`SORBI_3001G000200`)
    const {result} = renderFetch(request)

    expect(result.current).toMatchObject({pending: true, fulfilled: false, rejected: false, value: null})
    expect(result.current.meta.request).toBe(request)

    await waitFor(() => expect(result.current.fulfilled).toBe(true))
    expect(result.current).toMatchObject({pending: false, rejected: false, settled: true, key: requestKey(request)})
    expect(result.current.value).toEqual(allStudies.body)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ATLAS_URL}json/baseline_experiments`)
    expect(init).toMatchObject({
      method: `POST`,
      body: `geneQuery=SORBI_3001G000200`,
      headers: {Accept: `application/json`, 'Content-Type': `application/x-www-form-urlencoded`},
      credentials: `same-origin`,
      mode: `cors`,
      redirect: `follow`
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(FETCH_DEFAULTS).toEqual({credentials: `same-origin`, mode: `cors`, redirect: `follow`})
  })

  it(`rejects a 500 with the message of its JSON body`, async () => {
    mockFetch(() => unknownGene)
    const {result} = renderFetch(requestFor(`NOT_A_REAL_GENE`))
    await waitFor(() => expect(result.current.rejected).toBe(true))
    expect(result.current.value).toBeNull()
    expect(result.current.reason).toBeInstanceOf(Error)
    expect(result.current.reason.message).toBe(`Internal Server Error`)
  })

  it(`uses the body's message when there is no error field, and '' when there is neither`, async () => {
    mockFetch((url, init) => ({status: 400, body: init.body.includes(`A`) ? {message: `Bad gene`} : {}}))
    const a = renderFetch(requestFor(`A`))
    const b = renderFetch(requestFor(`B`))
    await waitFor(() => expect(a.result.current.rejected && b.result.current.rejected).toBe(true))
    expect(a.result.current.reason.message).toBe(`Bad gene`)
    expect(b.result.current.reason.message).toBe(``)
  })

  it(`rejects an error response whose body is not JSON with its status (a documented deviation)`, async () => {
    mockFetch(() => responseFor({status: 502, statusText: `Bad Gateway`, body: `<html>proxy error</html>`, contentType: `text/html`}))
    const {result} = renderFetch(requestFor(`A`))
    await waitFor(() => expect(result.current.rejected).toBe(true))
    expect(result.current.reason.message).toBe(`502 Bad Gateway`)
  })

  it(`gives a null value for an empty body (content-length 0) or a 204`, async () => {
    mockFetch((url, init) => init.body.includes(`A`) ?
      responseFor({body: ``, headers: {'content-length': `0`}}) :
      responseFor({status: 204}))
    const a = renderFetch(requestFor(`A`))
    const b = renderFetch(requestFor(`B`))
    await waitFor(() => expect(a.result.current.fulfilled && b.result.current.fulfilled).toBe(true))
    expect(a.result.current.value).toBeNull()
    expect(b.result.current.value).toBeNull()
  })

  it(`reports a network failure as rejected`, async () => {
    mockFetch(() => Promise.reject(new TypeError(`Failed to fetch`)))
    const {result} = renderFetch(requestFor(`A`))
    await waitFor(() => expect(result.current.rejected).toBe(true))
    expect(result.current.reason.message).toBe(`Failed to fetch`)
  })

  it(`shows pending at once for a new request, never the previous data`, async () => {
    const answers = {A: deferred(), B: deferred()}
    mockFetch((url, init) => answers[init.body.slice(-1)].promise)
    const {result, rerender} = renderFetch(requestFor(`A`))

    await act(async () => answers.A.resolve({body: {gene: `A`}}))
    expect(result.current.value).toEqual({gene: `A`})

    rerender({request: requestFor(`B`)})
    expect(result.current.pending).toBe(true)
    expect(result.current.value).toBeNull()
    expect(result.current.meta.request.body).toBe(`geneQuery=B`)

    await act(async () => answers.B.resolve({body: {gene: `B`}}))
    expect(result.current.value).toEqual({gene: `B`})
  })

  it(`does not refetch for a new request object with the same URL, method and body`, async () => {
    const fetchMock = mockFetch(() => allStudies)
    const {result, rerender} = renderFetch(requestFor(`SORBI_3001G000200`))
    await waitFor(() => expect(result.current.fulfilled).toBe(true))
    const settled = result.current

    rerender({request: {...requestFor(`SORBI_3001G000200`), headers: {Accept: `application/json`}}})
    expect(result.current).toBe(settled)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it(`aborts on unmount and ignores the answer`, async () => {
    const answer = deferred()
    const fetchMock = mockFetch(() => answer.promise)
    const {result, unmount} = renderFetch(requestFor(`A`))
    const {signal} = fetchMock.mock.calls[0][1]
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => answer.resolve(allStudies))
    expect(result.current.pending).toBe(true)
  })

  it(`aborts the superseded fetch when the request changes`, async () => {
    const fetchMock = mockFetch(() => new Promise(() => {}))
    const {rerender} = renderFetch(requestFor(`A`))
    rerender({request: requestFor(`B`)})
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false)
  })

  it(`settles once under StrictMode: the first effect's fetch is aborted`, async () => {
    const fetchMock = mockFetch(() => allStudies)
    const {result} = renderFetch(requestFor(`SORBI_3001G000200`), {wrapper: StrictMode})
    await waitFor(() => expect(result.current.fulfilled).toBe(true))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false)
    expect(result.current.value).toEqual(allStudies.body)
  })

  it(`sends a GET without a body`, async () => {
    const fetchMock = mockFetch(() => ({body: {geneExpression: null}}))
    const request = {url: `${ATLAS_URL}json/genes/X`, method: `GET`, headers: {Accept: `application/json`}}
    const {result} = renderFetch(request)
    await waitFor(() => expect(result.current.fulfilled).toBe(true))
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: `GET`, body: undefined})
  })
})
