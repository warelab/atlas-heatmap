import { describe, expect, it, vi } from 'vitest'

import { buildHeatmapOptions, computeLayout } from '../../src/show/HeatmapCanvas.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import { canvasProps } from '../helpers/canvas.js'

const LAYOUT = {marginBottom: 10, marginRight: 80, height: 497, autoRotation: [-45]}

describe(`buildHeatmapOptions`, () => {
  it(`is upstream's heatmap config, sized by the layout`, () => {
    const props = canvasProps(allStudies)
    const options = buildHeatmapOptions({current: props}, LAYOUT)

    expect(options.chart).toMatchObject({
      marginBottom: 10, marginRight: 80, height: 497, type: `heatmap`, plotBackgroundColor: `white`, spacingTop: 0,
      plotBorderWidth: 1, zoomType: `x`
    })
    expect(options.xAxis.labels.autoRotation).toEqual([-45])
    expect(options.xAxis).toMatchObject({min: 0, max: 23, opposite: `true`, categories: props.heatmapData.xAxisCategories})
    expect(options.yAxis).toMatchObject({reversed: true, useHTML: true, categories: props.heatmapData.yAxisCategories})
    expect(options.tooltip).toMatchObject({useHTML: true, outside: true, backgroundColor: `none`})
    expect(options.colorAxis).toBeNull()
    expect(options.credits.enabled).toBe(false)
    expect(options.title).toBeNull()
    // All Studies rows link out; cells do nothing on click
    expect(options.plotOptions.series.cursor).toBeUndefined()
  })

  it(`draws one series per data series, with copied points`, () => {
    const props = canvasProps(allStudies)
    const options = buildHeatmapOptions({current: props}, LAYOUT)

    expect(options.series.map(s => [s.name, s.color])).toEqual(
      props.heatmapData.dataSeries.map(s => [s.info.name, s.info.colour]))
    expect(options.series.map(s => s.name)).toEqual([`Below cutoff`, `Low`, `Medium`, `High`])
    options.series.forEach((series, ix) => {
      expect(series.borderWidth).toBe(1)
      expect(series.data).toEqual(props.heatmapData.dataSeries[ix].data)
      series.data.forEach((point, j) => expect(point).not.toBe(props.heatmapData.dataSeries[ix].data[j]))
    })
  })

  it(`makes differential cells clickable, with a colour axis`, () => {
    const props = canvasProps(geod30249, {currentGenomeBrowser: `ensemblgenomes`})
    const options = buildHeatmapOptions({current: props}, LAYOUT)
    expect(options.plotOptions.series.cursor).toBe(`pointer`)
    expect(options.colorAxis).toBe(props.colourAxis)
    expect(options.colorAxis.dataClasses.length).toBeGreaterThan(0)
    expect(options.chart.plotBackgroundColor).toBe(`rgb(235, 235, 235)`)
  })

  it(`calls the latest props' callbacks, so new callbacks need no new options`, () => {
    const first = canvasProps(geod30249, {events: {
      onHoverRowLabel: vi.fn(), onHoverColumnLabel: vi.fn(), onHoverPoint: vi.fn(), onHoverOff: vi.fn(), onClick: vi.fn()
    }})
    const latestRef = {current: first}
    const options = buildHeatmapOptions(latestRef, LAYOUT)

    const second = {
      ...first,
      currentGenomeBrowser: `ensemblgenomes`,
      onZoom: vi.fn(),
      events: {onHoverRowLabel: vi.fn(), onHoverColumnLabel: vi.fn(), onHoverPoint: vi.fn(), onHoverOff: vi.fn(), onClick: vi.fn()},
      xAxisFormatter: vi.fn(() => `x`),
      yAxisFormatter: vi.fn(() => `y`),
      cellTooltipFormatter: vi.fn(() => `tooltip`)
    }
    latestRef.current = second

    const pointEvents = options.plotOptions.series.point.events
    pointEvents.click.call({x: 1, y: 0})
    pointEvents.mouseOver.call({x: 1})
    pointEvents.mouseOut.call({})
    options.xAxis.labels.events.mouseover.call({value: `root`})
    options.yAxis.labels.events.mouseover.call({value: `<span data-gxa-y="0">G</span>`})
    expect(second.events.onClick).toHaveBeenCalledWith(1, 0, `ensemblgenomes`)
    expect(second.events.onHoverPoint).toHaveBeenCalledWith(1)
    expect(second.events.onHoverOff).toHaveBeenCalledTimes(1)
    expect(second.events.onHoverColumnLabel).toHaveBeenCalledWith(`root`)
    expect(second.events.onHoverRowLabel).toHaveBeenCalledWith(`<span data-gxa-y="0">G</span>`)
    expect(Object.values(first.events).every(f => f.mock.calls.length === 0)).toBe(true)

    // formatters get Highcharts' formatter context, the y-axis one with the tick position
    const row = first.heatmapData.yAxisCategories[1]
    expect(options.yAxis.labels.formatter.call({value: row, pos: 1})).toBe(`y`)
    expect(second.yAxisFormatter).toHaveBeenCalledWith(row, 1)
    expect(options.xAxis.labels.formatter.call({value: first.heatmapData.xAxisCategories[0]})).toBe(`x`)
    expect(options.tooltip.formatter.call({series: `s`, point: `p`})).toBe(`tooltip`)
    expect(second.cellTooltipFormatter).toHaveBeenCalledWith(`s`, `p`)
  })

  it(`reports zooms and zoom resets`, () => {
    const props = canvasProps(allStudies)
    const onSetExtremes = vi.fn()
    const options = buildHeatmapOptions({current: props}, LAYOUT, {onSetExtremes})

    options.xAxis.events.setExtremes({min: 2, max: 5})
    expect(onSetExtremes).toHaveBeenLastCalledWith({min: 2, max: 5})
    expect(props.onZoom).toHaveBeenLastCalledWith(true)

    options.xAxis.events.setExtremes({min: undefined, max: undefined})
    expect(onSetExtremes).toHaveBeenLastCalledWith(null)
    expect(props.onZoom).toHaveBeenLastCalledWith(false)
  })

  it(`uses computeLayout's output as is`, () => {
    const props = canvasProps(allStudies)
    const layout = computeLayout(props.heatmapData, 1000)
    const options = buildHeatmapOptions({current: props}, layout)
    expect(options.chart).toMatchObject({marginBottom: layout.marginBottom, marginRight: layout.marginRight, height: layout.height})
    expect(options.xAxis.labels.autoRotation).toBe(layout.autoRotation)
  })
})
