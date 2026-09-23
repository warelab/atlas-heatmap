import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import GradientHeatmapLegend from '../src/manipulate/heatmap-legend/GradientHeatmapLegend.js'
import Anatomogram, { isSupportedSpecies, lastProps, normaliseSpecies } from 'gramene-anatomogram'
import { allowConsole } from './consoleGuard.js'
import { ResizeObserverStub } from './shims.js'

describe(`toolchain`, () => {
  it(`compiles JSX in src/**/*.js`, () => {
    render(
      <GradientHeatmapLegend
        unit={`Log2 fold change`}
        gradients={[{ fromValue: 1, toValue: 2500, colours: [`#fff`, `#00f`] }]} />)
    expect(screen.getByText(`2,500`)).toBeInTheDocument()
    expect(screen.getByText(/-fold change/)).toBeInTheDocument()
  })

  it(`aliases gramene-anatomogram to the recording stub`, () => {
    const onMouseOver = vi.fn()
    render(<Anatomogram species={`sorghum_bicolor`} onMouseOver={onMouseOver} />)
    expect(screen.getByTestId(`anatomogram-stub`)).toHaveAttribute(`data-species`, `sorghum_bicolor`)
    lastProps().onMouseOver([`PO_0025034`])
    expect(onMouseOver).toHaveBeenCalledWith([`PO_0025034`])
    expect(normaliseSpecies(`Sorghum  bicolor`)).toBe(`sorghum_bicolor`)
    expect(isSupportedSpecies(`Sorghum bicolor`)).toBe(true)
    expect(isSupportedSpecies(`Vitis vinifera`)).toBe(false)
  })

  it(`records console output that a test allows`, () => {
    allowConsole()
    render(<GradientHeatmapLegend gradients={[]} />)  // unit is required
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`Failed %s type`), `prop`, expect.stringContaining(`unit`), expect.anything())
  })

  it(`shims the layout APIs Highcharts and the width hooks need`, () => {
    const svg = document.createElementNS(`http://www.w3.org/2000/svg`, `svg`)
    expect(typeof svg.createSVGRect).toBe(`function`)
    expect(document.createElement(`div`).clientWidth).toBe(1000)

    const callback = vi.fn()
    const observer = new ResizeObserver(callback)
    const el = document.createElement(`div`)
    observer.observe(el)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0][0]).toMatchObject({ target: el, contentRect: { width: 1000 } })
    expect(ResizeObserverStub.instances).toContain(observer)
  })
})
