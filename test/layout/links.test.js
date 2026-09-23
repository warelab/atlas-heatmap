import { describe, expect, it, vi } from 'vitest'

import {
  applyResolveUrl, keepDefaultUrl, linkAttrs, openUrl, SUPPORT_URL, URL_KINDS
} from '../../src/layout/links.js'

describe(`linkAttrs`, () => {
  it(`opens in a new tab that cannot reach back into the page by default`, () => {
    expect(linkAttrs()).toEqual({target: `_blank`, rel: `noopener noreferrer`})
    expect(linkAttrs(`_blank`)).toEqual({target: `_blank`, rel: `noopener noreferrer`})
  })

  it(`uses any other target as is, without rel`, () => {
    expect(linkAttrs(`_self`)).toEqual({target: `_self`, rel: undefined})
    expect(linkAttrs(`gxa`)).toEqual({target: `gxa`, rel: undefined})
  })

  it(`sets no target for a falsy one`, () => {
    expect(linkAttrs(null)).toEqual({})
    expect(linkAttrs(``)).toEqual({})
  })
})

describe(`openUrl`, () => {
  it(`opens a new tab with noopener by default`, () => {
    openUrl(`https://example.org/`)
    expect(window.open).toHaveBeenCalledWith(`https://example.org/`, `_blank`, `noopener,noreferrer`)
  })

  it(`opens other targets without window features, and a falsy one in this tab`, () => {
    openUrl(`https://example.org/`, `gxa`)
    expect(window.open).toHaveBeenLastCalledWith(`https://example.org/`, `gxa`, undefined)
    openUrl(`https://example.org/`, null)
    expect(window.open).toHaveBeenLastCalledWith(`https://example.org/`, `_self`, undefined)
  })
})

describe(`applyResolveUrl`, () => {
  const context = {query: {gene: `A`}, experiment: null}

  it(`keeps the default without a resolveUrl`, () => {
    expect(applyResolveUrl(undefined, `row`, `https://d/`, context)).toBe(`https://d/`)
    expect(keepDefaultUrl(`row`, `https://d/`, context)).toBe(`https://d/`)
  })

  it(`overrides with a string, suppresses with null, keeps the default with undefined`, () => {
    const resolveUrl = vi.fn((kind, url) => ({row: `https://o/`, atlas: null})[kind])
    expect(applyResolveUrl(resolveUrl, `row`, `https://d/`, context)).toBe(`https://o/`)
    expect(resolveUrl).toHaveBeenCalledWith(`row`, `https://d/`, context)
    expect(applyResolveUrl(resolveUrl, `atlas`, `https://d/`, context)).toBeNull()
    expect(applyResolveUrl(resolveUrl, `support`, `https://d/`, context)).toBe(`https://d/`)
  })

  it(`turns a URL object into its string`, () => {
    expect(applyResolveUrl(() => new URL(`https://o/x`), `row`, `https://d/`, context)).toBe(`https://o/x`)
  })
})

describe(`constants`, () => {
  it(`lists the kinds of link resolveUrl is asked about`, () => {
    expect(URL_KINDS).toEqual([`row`, `experiment`, `atlas`, `moreInformation`, `support`, `genomeBrowser`, `download`])
    expect(Object.isFrozen(URL_KINDS)).toBe(true)
    expect(SUPPORT_URL).toBe(`https://www.ebi.ac.uk/support/gxa`)
  })
})
