import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureStylesInjected, HEATMAP_CSS, STYLE_ELEMENT_ID } from '../../src/styles/inject.js'
import * as Main from '../../src/Main.js'
import { mockFetch } from '../helpers/fetch.js'

// The heatmap itself is out of scope here.
vi.mock(`../../src/layout/Container.js`, () => ({default: () => <div data-testid={`container`} />}))

const injected = () => document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)

afterEach(() => {
  injected().forEach(el => el.remove())
})

describe(`HEATMAP_CSS`, () => {
  it(`is the stylesheet, scoped under the root class, with the tooltip z-index rule`, () => {
    expect(HEATMAP_CSS).toContain(`.gxaHeatmapContainer .gxa-legend-item`)
    expect(HEATMAP_CSS).toContain(`.gxaHeatmapContainer a {`)
    expect(HEATMAP_CSS).toMatch(/body > \.highcharts-tooltip-container \{\s*z-index: 1100;/)

    // every selector is scoped, except the tooltip container's
    const selectors = HEATMAP_CSS.replace(/\/\*[\s\S]*?\*\//g, ``).match(/[^{}]+(?=\{)/g)
      .flatMap(list => list.split(`,`)).map(selector => selector.trim())
    expect(selectors.length).toBeGreaterThan(10)
    for (const selector of selectors) {
      expect(selector).toMatch(/^(\.gxaHeatmapContainer |\.gxa-heatmap-modal |body > \.highcharts-tooltip-container$)/)
    }
  })
})

describe(`ensureStylesInjected`, () => {
  it(`adds one <style> at the start of <head>, once`, () => {
    const hostStyle = document.createElement(`style`)
    document.head.appendChild(hostStyle)

    expect(ensureStylesInjected()).toBe(true)
    expect(ensureStylesInjected()).toBe(false)
    expect(injected()).toHaveLength(1)
    const style = injected()[0]
    expect(document.head.firstChild).toBe(style)
    expect(style.textContent).toBe(HEATMAP_CSS)
    expect(style.hasAttribute(`data-gramene-atlas-heatmap`)).toBe(true)
    hostStyle.remove()
  })

  it(`injects into a shadow root`, () => {
    const host = document.createElement(`div`)
    const shadow = host.attachShadow({mode: `open`})
    shadow.appendChild(document.createElement(`div`))
    expect(ensureStylesInjected(shadow)).toBe(true)
    expect(ensureStylesInjected(shadow)).toBe(false)
    expect(shadow.firstChild.id).toBe(STYLE_ELEMENT_ID)
    expect(injected()).toHaveLength(0)
  })
})

describe(`ExpressionAtlasHeatmap injectStyles`, () => {
  it(`injects the stylesheet by default, once for any number of heatmaps`, () => {
    mockFetch(() => new Promise(() => {}))
    render(<>
      <Main.ExpressionAtlasHeatmap query={{gene: `A`}} />
      <Main.ExpressionAtlasHeatmap query={{gene: `B`}} />
    </>)
    expect(injected()).toHaveLength(1)
  })

  it(`injects nothing with injectStyles={false}`, () => {
    mockFetch(() => new Promise(() => {}))
    render(<Main.ExpressionAtlasHeatmap query={{gene: `A`}} injectStyles={false} />)
    expect(injected()).toHaveLength(0)
  })

  it(`re-exports the style API`, () => {
    expect(Main.ensureStylesInjected).toBe(ensureStylesInjected)
    expect(Main.STYLE_ELEMENT_ID).toBe(`gramene-atlas-heatmap-styles`)
    expect(Main.HEATMAP_CSS).toBe(HEATMAP_CSS)
  })
})
