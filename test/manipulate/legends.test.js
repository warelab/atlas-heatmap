import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import DataSeriesHeatmapLegend from '../../src/manipulate/heatmap-legend/DataSeriesHeatmapLegend.js'
import { DataSeriesLegend } from '../../src/manipulate/heatmap-legend/Main.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

describe(`DataSeriesHeatmapLegend`, () => {
  it(`renders the All Studies series with class names and no React warnings`, () => {
    const {heatmapData} = loadChartData({
      data: allStudies.body, inProxy: ``, outProxy: ``, atlasUrl: ATLAS_URL,
      showAnatomogram: true, showControlMenu: true, isWidget: true
    })
    const {container} = render(<DataSeriesLegend dataSeries={heatmapData.dataSeries} />)

    const legend = container.firstChild
    expect(legend).toHaveClass(`gxa-legend`)
    const names = [...legend.querySelectorAll(`.gxa-legend-item .gxa-va-middle`)].map(el => el.textContent)
    expect(names).toEqual([...heatmapData.dataSeries.map(series => series.info.name)].reverse().concat(`No data available`))

    heatmapData.dataSeries.forEach(series => {
      const item = screen.getByText(series.info.name).parentElement
      expect(item.classList.contains(`gxa-legend-item--off`)).toBe(series.data.length === 0)
      expect(item.querySelector(`.gxa-legend-swatch`).style.background).not.toBe(``)
    })

    // the P and T badges, and the info icon with its explanation on a span (an SVG title shows no tooltip)
    expect(screen.getByText(`P`).style.backgroundColor).toBe(`green`)
    expect(screen.getByText(`T`).style.backgroundColor).toBe(`orangered`)
    const icon = legend.querySelector(`svg.gxa-info-icon`)
    expect(icon).toHaveAttribute(`aria-hidden`, `true`)
    expect(icon.parentElement.getAttribute(`title`)).toMatch(/^Baseline expression levels in RNA-seq experiments/)
  })

  it(`takes its defaults as parameters`, () => {
    render(<DataSeriesHeatmapLegend legendItems={[]} title={`t`} missingValueLabel={`n/a`} missingValueColour={`black`} />)
    const item = screen.getByText(`n/a`).parentElement
    expect(item.querySelector(`.gxa-legend-swatch`).style.background).toBe(`black`)
    expect(item).not.toHaveClass(`gxa-legend-item--off`)
    expect(document.querySelector(`[title="t"]`)).not.toBeNull()
  })
})
