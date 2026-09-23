import { describe, expect, it } from 'vitest'

import { buildRequest, buildRequestBody, buildSource, requestKey, resolveEndpoint } from '../src/layout/request.js'

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`
const GENES = [`SORBI_3001G000200`, `SORBI_3001G000400`, `SORBI_3001G000100`]

const requestFor = ({query, experiment, atlasUrl = ATLAS_URL, inProxy = ``}) =>
  buildRequest({inProxy, atlasUrl, source: buildSource({query, experiment})})

describe(`resolveEndpoint`, () => {
  it(`maps the experiment prop to the JSON endpoint`, () => {
    expect(resolveEndpoint(false)).toBe(`json/baseline_experiments`)
    expect(resolveEndpoint(``)).toBe(`json/baseline_experiments`)
    expect(resolveEndpoint(undefined)).toBe(`json/baseline_experiments`)
    expect(resolveEndpoint(`reference`)).toBe(`json/baseline_refexperiment`)
    expect(resolveEndpoint(`E-CURD-25`)).toBe(`json/experiments/E-CURD-25`)
  })
})

describe(`buildSource`, () => {
  it(`renames gene and condition and passes other keys through`, () => {
    expect(buildSource({query: {gene: `A`, condition: `leaf`, species: `sorghum bicolor`}, experiment: `E-CURD-25`}))
      .toEqual({
        endpoint: `json/experiments/E-CURD-25`,
        params: {geneQuery: `A`, conditionQuery: `leaf`, species: `sorghum bicolor`}
      })
  })

  it(`treats a string query as a relative endpoint with no parameters`, () => {
    expect(buildSource({query: `json/genes/SORBI_3001G000200`, experiment: `E-CURD-25`}))
      .toEqual({endpoint: `json/genes/SORBI_3001G000200`, params: {}})
  })

  it(`sends no parameters without a query`, () => {
    expect(buildSource({experiment: false})).toEqual({endpoint: `json/baseline_experiments`, params: {}})
  })
})

describe(`buildRequestBody`, () => {
  it(`joins the genes with raw spaces: no +, no %20, no extra parameters`, () => {
    const body = buildRequestBody({geneQuery: GENES.join(` `)})
    expect(body).toBe(`geneQuery=SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`)
    expect(body).not.toMatch(/\+|%20|&/)
  })

  it(`never encodes values`, () => {
    expect(buildRequestBody({geneQuery: `A+B C/D`})).toBe(`geneQuery=A+B C/D`)
  })

  it(`JSON-stringifies non-string values and joins parameters with &`, () => {
    expect(buildRequestBody({geneQuery: [{value: `ASPM`}], species: `homo sapiens`}))
      .toBe(`geneQuery=[{"value":"ASPM"}]&species=homo sapiens`)
  })
})

describe(`buildRequest`, () => {
  it(`POSTs the raw form body with explicit Accept and form Content-Type headers`, () => {
    expect(requestFor({query: {gene: GENES.join(` `)}, experiment: `E-CURD-25`})).toEqual({
      url: `https://data.sorghumbase.org/auth_testing/gxa/json/experiments/E-CURD-25`,
      method: `POST`,
      headers: {Accept: `application/json`, 'Content-Type': `application/x-www-form-urlencoded`},
      body: `geneQuery=SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`
    })
  })

  it(`resolves All Studies against the atlas URL`, () => {
    const request = requestFor({query: {gene: `SORBI_3001G000200`}, experiment: false})
    expect(request.url).toBe(`https://data.sorghumbase.org/auth_testing/gxa/json/baseline_experiments`)
    expect(request.body).toBe(`geneQuery=SORBI_3001G000200`)
  })

  it(`prefixes the inbound proxy`, () => {
    expect(requestFor({query: {gene: `A`}, experiment: false, inProxy: `/proxy?`}).url)
      .toBe(`/proxy?https://data.sorghumbase.org/auth_testing/gxa/json/baseline_experiments`)
  })

  it(`resolves relative to the parent of an atlas URL without a trailing slash (as upstream)`, () => {
    expect(requestFor({query: {gene: `A`}, experiment: false, atlasUrl: `https://data.sorghumbase.org/auth_testing/gxa`}).url)
      .toBe(`https://data.sorghumbase.org/auth_testing/json/baseline_experiments`)
  })
})

describe(`requestKey`, () => {
  it(`changes with the URL or the body, not with the query object identity`, () => {
    const a = requestFor({query: {gene: `A`}, experiment: `E-CURD-25`})
    expect(requestKey(a)).toBe(requestKey(requestFor({query: {gene: `A`}, experiment: `E-CURD-25`})))
    expect(requestKey(a)).not.toBe(requestKey(requestFor({query: {gene: `B`}, experiment: `E-CURD-25`})))
    expect(requestKey(a)).not.toBe(requestKey(requestFor({query: {gene: `A`}, experiment: `E-GEOD-30249`})))
  })
})
