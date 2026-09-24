import React, { StrictMode } from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Highcharts from 'highcharts'

import HeatmapCanvas, { selectColumnsByOntologyIds } from '../../src/show/HeatmapCanvas.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import emtab5956 from '../fixtures/paralogs.E-MTAB-5956.sorghum_v11.json'
import { canvasProps } from '../helpers/canvas.js'
import { ResizeObserverStub } from '../shims.js'

const liveCharts = () => Highcharts.charts.filter(Boolean)
const onlyChart = () => {
  const charts = liveCharts()
  expect(charts).toHaveLength(1)
  return charts[0]
}

// Every element reports `width` (the shim's 1000 by default); resize() changes it and fires the ResizeObserver
const withWidth = initial => {
  let width = initial
  vi.spyOn(HTMLElement.prototype, `clientWidth`, `get`).mockImplementation(() => width)
  return async next => {
    width = next
    act(() => ResizeObserverStub.instances.forEach(observer => observer.trigger()))
    // useElementWidth debounces by 100 ms
    await act(() => new Promise(resolve => setTimeout(resolve, 150)))
  }
}

// Highcharts sizes a chart from Highcharts.getStyle(container, 'width'), which is NaN in jsdom (no layout), so every
// chart is 600 px wide. This gives the chart container (marked data-highcharts-chart before it is measured) a width.
const chartWidth = width => {
  const getStyle = Highcharts.getStyle
  vi.spyOn(Highcharts, `getStyle`).mockImplementation((element, property, toInt) =>
    property === `width` && element.hasAttribute(`data-highcharts-chart`) ? width : getStyle(element, property, toInt))
}

// The rotation each column label is drawn with
const labelRotations = xAxis => xAxis.tickPositions.map(position => xAxis.ticks[position].label.rotation || 0)

const LEAF = `PO_0025034`

describe(`HeatmapCanvas`, () => {
  it(`draws the heatmap in its own column with Highcharts 6 and removes it on unmount`, () => {
    const props = canvasProps(allStudies)
    const {container, unmount} = render(<HeatmapCanvas {...props} />)

    const chart = onlyChart()
    // HighchartsReact's div, in the div whose width HeatmapCanvas measures
    expect(chart.renderTo.parentElement.parentElement).toBe(container)
    expect(container.querySelectorAll(`.highcharts-container`)).toHaveLength(1)
    // row labels carry their index for the hover handler
    expect([...container.querySelectorAll(`[data-gxa-y]`)].map(label => label.getAttribute(`data-gxa-y`)))
      .toEqual([`0`, `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`])
    expect(container.querySelectorAll(`.highcharts-point`).length).toBeGreaterThan(0)
    // the shim's 1000 px column
    expect(chart.options.chart).toMatchObject({marginRight: 80, marginBottom: 10})
    expect(typeof chart.options.chart.events.handleGxaAnatomogramTissueMouseEnter).toBe(`function`)

    unmount()
    expect(liveCharts()).toHaveLength(0)
    expect(document.querySelectorAll(`.highcharts-tooltip-container`)).toHaveLength(0)
  })

  it(`waits for a width: nothing is drawn while its column is hidden`, async () => {
    const resize = withWidth(0)
    const props = canvasProps(allStudies)
    const {container} = render(<HeatmapCanvas {...props} />)
    expect(container.querySelector(`.highcharts-container`)).toBeNull()
    expect(liveCharts()).toHaveLength(0)

    await resize(900)
    expect(container.querySelectorAll(`.highcharts-container`)).toHaveLength(1)
    const chart = onlyChart()

    // hidden again: the chart stays as it is
    await resize(0)
    expect(onlyChart()).toBe(chart)
  })

  it(`reflows the same chart when a new width keeps the layout`, async () => {
    const resize = withWidth(800)
    const props = canvasProps(allStudies)
    render(<HeatmapCanvas {...props} />)
    const chart = onlyChart()
    const reflow = vi.spyOn(chart, `reflow`)

    await resize(1000)    // same layout (computeLayout.test.js)
    expect(onlyChart()).toBe(chart)
    expect(reflow).toHaveBeenCalled()
  })

  it(`redraws for a new layout and keeps the zoom; new data resets it`, async () => {
    const resize = withWidth(1000)
    const props = canvasProps(allStudies)
    const {rerender} = render(<HeatmapCanvas {...props} />)
    const chart = onlyChart()

    act(() => {
      chart.xAxis[0].zoom(2, 5)
      chart.showResetZoom()
      chart.redraw(false)
    })
    expect(props.onZoom).toHaveBeenLastCalledWith(true)

    await resize(600)   // the labels no longer rotate
    const redrawn = onlyChart()
    expect(redrawn).not.toBe(chart)
    expect(redrawn.options.chart.marginRight).toBe(20)
    expect(redrawn.xAxis[0].getExtremes()).toMatchObject({userMin: 2, userMax: 5})
    expect(redrawn.resetZoomButton).toBeTruthy()
    expect(props.onZoom).not.toHaveBeenCalledWith(false)

    // an equal payload with new callbacks is no new data
    const same = canvasProps(allStudies, {onZoom: props.onZoom})
    rerender(<HeatmapCanvas {...same} />)
    expect(onlyChart()).toBe(redrawn)

    // new data (a row fewer) starts unzoomed and tells the controls
    const fewerRows = {
      ...same.heatmapData,
      yAxisCategories: same.heatmapData.yAxisCategories.slice(0, -1),
      dataSeries: same.heatmapData.dataSeries.map(series => ({...series, data: series.data.filter(point => point.y < 8)}))
    }
    rerender(<HeatmapCanvas {...same} heatmapData={fewerRows} />)
    const fresh = onlyChart()
    expect(fresh).not.toBe(redrawn)
    expect(fresh.xAxis[0].getExtremes().userMin).toBeUndefined()
    expect(fresh.resetZoomButton).toBeUndefined()
    expect(props.onZoom).toHaveBeenLastCalledWith(false)
  })

  it(`redraws the labels for a new labelsKey, keeping the zoom`, () => {
    const props = canvasProps(allStudies, {labelsKey: `["_blank",""]`})
    const {rerender} = render(<HeatmapCanvas {...props} />)
    const chart = onlyChart()
    act(() => {
      chart.xAxis[0].zoom(2, 5)
      chart.showResetZoom()
      chart.redraw(false)
    })

    // new callbacks and an equal key: the same chart
    rerender(<HeatmapCanvas {...canvasProps(allStudies, {onZoom: props.onZoom, labelsKey: `["_blank",""]`})} />)
    expect(onlyChart()).toBe(chart)

    const yAxisFormatter = vi.fn(() => `<span>row</span>`)
    rerender(<HeatmapCanvas {...props} yAxisFormatter={yAxisFormatter} labelsKey={`["_self",""]`} />)
    const redrawn = onlyChart()
    expect(redrawn).not.toBe(chart)
    expect(yAxisFormatter).toHaveBeenCalled()
    expect(redrawn.xAxis[0].getExtremes()).toMatchObject({userMin: 2, userMax: 5})
    expect(redrawn.resetZoomButton).toBeTruthy()
    expect(props.onZoom).not.toHaveBeenCalledWith(false)
  })

  it(`selects the columns of the tissues the anatomogram highlights`, () => {
    const props = canvasProps(allStudies)
    const {rerender} = render(<HeatmapCanvas {...props} />)
    const chart = onlyChart()
    const leafColumn = props.heatmapData.xAxisCategories.findIndex(column => column.id === LEAF)
    expect(leafColumn).toBeGreaterThan(-1)

    rerender(<HeatmapCanvas {...props} ontologyIdsToHighlight={[LEAF]} />)
    expect(onlyChart()).toBe(chart)
    const selected = chart.getSelectedPoints()
    expect(selected.length).toBeGreaterThan(0)
    expect(selected.every(point => point.x === leafColumn)).toBe(true)
    // the options kept for the chart are copies: the payload is untouched
    expect(props.heatmapData.dataSeries.flatMap(series => series.data).some(point => `selected` in point)).toBe(false)

    rerender(<HeatmapCanvas {...props} ontologyIdsToHighlight={[]} />)
    expect(chart.getSelectedPoints()).toHaveLength(0)
  })

  it(`hands cell clicks the current genome browser without redrawing`, () => {
    const onClick = vi.fn()
    const props = canvasProps(geod30249)
    const events = {...props.events, onClick}
    const {rerender} = render(<HeatmapCanvas {...props} events={events} currentGenomeBrowser={`ensemblgenomes`} />)
    const chart = onlyChart()
    expect(chart.options.plotOptions.series.cursor).toBe(`pointer`)

    rerender(<HeatmapCanvas {...props} events={{...events}} currentGenomeBrowser={`none`} />)
    expect(onlyChart()).toBe(chart)
    const point = chart.series.flatMap(series => series.points)[0]
    act(() => point.firePointEvent(`click`))
    expect(onClick).toHaveBeenCalledWith(point.x, point.y, `none`)
  })

  it(`forgets the chart's page position when anything scrolls`, () => {
    const props = canvasProps(allStudies)
    const {unmount} = render(<div className={`modal-body`}><HeatmapCanvas {...props} /></div>)
    const chart = onlyChart()

    chart.pointer.chartPosition = {left: 10, top: 20}
    document.querySelector(`.modal-body`).dispatchEvent(new Event(`scroll`))   // does not bubble
    expect(chart.pointer.chartPosition).toBeNull()

    const removeEventListener = vi.spyOn(document, `removeEventListener`)
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith(`scroll`, expect.any(Function), {capture: true})
  })

  it(`draws one chart under StrictMode`, () => {
    const props = canvasProps(allStudies)
    const {container, unmount} = render(<StrictMode><HeatmapCanvas {...props} /></StrictMode>)
    expect(liveCharts()).toHaveLength(1)
    expect(container.querySelectorAll(`.highcharts-container`)).toHaveLength(1)
    unmount()
    expect(liveCharts()).toHaveLength(0)
  })

  // msd2's paralogs in E-MTAB-5956: 11 columns, labels of up to 52 characters that do not wrap (whiteSpace nowrap).
  // Highcharts 6 only auto-rotates labels while a column is under autoRotationLimit (80 px) wide, so on a desktop
  // screen they were left horizontal and ran into each other.
  it(`rotates column labels that are wider than their column, however wide the columns are`, () => {
    withWidth(1600)
    chartWidth(1600)
    const props = canvasProps(emtab5956)
    render(<HeatmapCanvas {...props} />)

    const xAxis = onlyChart().xAxis[0]
    expect(xAxis.categories).toHaveLength(11)
    expect(xAxis.len / xAxis.categories.length).toBeGreaterThan(80)
    expect(labelRotations(xAxis)).toEqual(Array(11).fill(-90))
  })

  it(`leaves column labels that fit their column horizontal`, () => {
    withWidth(1600)
    chartWidth(1600)
    const props = canvasProps(emtab5956)
    // one-word labels, about 36 px in the test's text metrics, in columns over 80 px wide
    const shortLabels = {
      ...props.heatmapData,
      xAxisCategories: props.heatmapData.xAxisCategories.map(category => ({...category, label: category.label.split(`;`)[0].slice(0, 6)}))
    }
    render(<HeatmapCanvas {...props} heatmapData={shortLabels} />)

    expect(labelRotations(onlyChart().xAxis[0])).toEqual(Array(11).fill(0))
  })

  it(`says so when the filters leave no rows`, () => {
    const props = canvasProps(allStudies)
    const empty = {...props.heatmapData, yAxisCategories: [], dataSeries: props.heatmapData.dataSeries.map(s => ({...s, data: []}))}
    const {container} = render(<HeatmapCanvas {...props} heatmapData={empty} />)
    expect(container).toHaveTextContent(`No data match your filtering criteria`)
    expect(liveCharts()).toHaveLength(0)
  })
})

describe(`selectColumnsByOntologyIds`, () => {
  it(`replaces the selection with the columns of the given ids`, () => {
    const props = canvasProps(allStudies)
    render(<HeatmapCanvas {...props} />)
    const chart = onlyChart()
    const idOf = point => props.heatmapData.xAxisCategories[point.x].id
    // anther, and the three inflorescence columns (they share PO_0009049)
    const ids = props.heatmapData.xAxisCategories.slice(0, 2).map(column => column.id)

    act(() => selectColumnsByOntologyIds(chart, ids))
    const selected = chart.getSelectedPoints()
    expect(new Set(selected.map(idOf))).toEqual(new Set(ids))
    expect(new Set(selected.map(point => point.x)).size).toBeGreaterThan(2)

    act(() => selectColumnsByOntologyIds(chart, [LEAF]))
    expect(chart.getSelectedPoints().length).toBeGreaterThan(0)
    expect(chart.getSelectedPoints().every(point => idOf(point) === LEAF)).toBe(true)

    act(() => selectColumnsByOntologyIds(chart))
    expect(chart.getSelectedPoints()).toHaveLength(0)
  })
})
