import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Highcharts from 'highcharts'
import download from 'downloadjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpressionAtlasHeatmap, render as renderHeatmap } from '../src/Main.js'
import { mockFetch } from './helpers/fetch.js'
import { lastProps, renders as anatomogramRenders, resetAnatomogramStub } from './stubs/anatomogram.js'
import allStudies from './fixtures/all-studies.SORBI_3001G000200.json'
import allStudiesV11 from './fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import curd25 from './fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from './fixtures/paralogs.E-GEOD-30249.differential.json'
import geod167101 from './fixtures/paralogs.E-GEOD-167101.baseline.json'
import unknownGene from './fixtures/error.unknown-gene.json'

// The whole component, from fetch to chart: the captured Warelab GXA responses, real Highcharts 6.2 in jsdom (with the
// shims of test/shims.js) and the anatomogram stub, which records its props. The console guard fails a test on any
// React warning.
vi.mock(`gramene-anatomogram`, () => import(`./stubs/anatomogram.js`))
vi.mock(`downloadjs`, () => ({default: vi.fn()}))

const AUTH_TESTING = `https://data.sorghumbase.org/auth_testing/gxa/`
const PARALOGS = `SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`
const LEAF = `PO_0025034`
const ROOT = `PO_0009005`
const SHOOT = `PO_0009006`

// Answers a request with the fixture captured for exactly that URL and body, so a changed body fails the test
const FIXTURES = [allStudies, allStudiesV11, curd25, geod30249, geod167101, unknownGene]
const answerWithFixtures = () => mockFetch((url, init) =>
  FIXTURES.find(f => url === f.base + f.path && init.body === f.body_sent) ||
  {status: 404, body: {error: `no fixture for ${url} ${init.body}`}})

const liveCharts = () => Highcharts.charts.filter(Boolean)
const onlyChart = () => {
  const charts = liveCharts()
  expect(charts).toHaveLength(1)
  return charts[0]
}
const allPoints = chart => chart.series.flatMap(series => series.points)
const tooltipContainers = () => document.querySelectorAll(`.highcharts-tooltip-container`)

// HeatmapWithControls debounces the chart by 50 ms: wait for it
const findChart = async container => {
  await waitFor(() => expect(container.querySelector(`.highcharts-container`)).not.toBeNull())
  return onlyChart()
}
// The mouse moves into the chart and over a cell, as Highcharts hears it: it shows the tooltip and fires the point
// events. (jsdom lays nothing out, so the chart is at the top left of the page.)
const hover = point => {
  const {chart} = point.series
  const position = {bubbles: true, clientX: chart.plotLeft + point.plotX, clientY: chart.plotTop + point.plotY}
  chart.container.dispatchEvent(new MouseEvent(`mousemove`, position))
  point.graphic.element.dispatchEvent(new MouseEvent(`mouseover`, position))
}
// Heatmap series track stickily: a hovered cell is let go when the mouse leaves the chart
const leave = point =>
  point.series.chart.container.dispatchEvent(new MouseEvent(`mouseleave`, {relatedTarget: document.body}))
const rowLabels = container => [...container.querySelectorAll(`[data-gxa-y]`)]
const controls = container => container.querySelector(`.gxa-controls`)
const toggles = container => [...controls(container).querySelectorAll(`.dropdown-toggle, .btn`)]

const allStudiesHeatmap = props =>
  <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `SORBI_3001G000200`}} experiment={false} {...props} />
const paralogsHeatmap = (experiment, props) =>
  <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: PARALOGS}} experiment={experiment} {...props} />

beforeEach(() => {
  resetAnatomogramStub()
  download.mockClear()
})

describe(`All Studies (SORBI_3001G000200)`, () => {
  it(`loads, then draws the heatmap, legend, controls, anatomogram and footer`, async () => {
    const fetchMock = answerWithFixtures()
    const {container} = render(allStudiesHeatmap())

    expect(screen.getByRole(`status`)).toHaveTextContent(`Loading expression data…`)
    expect(await screen.findByText(`Showing 9 experiments:`)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${AUTH_TESTING}json/baseline_experiments`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: `POST`, body: `geneQuery=SORBI_3001G000200`})

    const chart = await findChart(container)
    expect(container.querySelectorAll(`.highcharts-container`)).toHaveLength(1)
    expect(chart.series.map(series => series.name)).toEqual([`Below cutoff`, `Low`, `Medium`, `High`])
    expect(rowLabels(container)).toHaveLength(9)
    expect(chart.xAxis[0].categories).toHaveLength(24)

    // multi-experiment legend and controls
    expect([...container.querySelectorAll(`.gxa-legend-item`)].map(item => item.textContent.trim()))
      .toEqual(expect.arrayContaining([`Below cutoff`, `Low`, `Medium`, `High`]))
    expect(toggles(container).map(toggle => toggle.textContent.trim()))
      .toEqual([`By experiment type`, `Filters`, `Download`, `More download options`])

    // the anatomogram: the payload's species, every column's tissue, and the link target for its licence link
    expect(screen.getByTestId(`anatomogram-stub`)).toBeInTheDocument()
    expect(lastProps()).toMatchObject({species: `sorghum_bicolor`, linkTarget: `_blank`, selectIds: []})
    expect(lastProps().showIds).toEqual(chart.xAxis[0].categories.map(column => column.id))
    expect(lastProps().showIds).toContain(LEAF)

    // every link (row labels, footer) opens in a new tab
    const links = [...container.querySelectorAll(`a[href]`)]
    expect(links.length).toBeGreaterThanOrEqual(9 + 3)
    for (const a of links) {
      expect(a).toHaveAttribute(`target`, `_blank`)
      expect(a).toHaveAttribute(`rel`, `noopener noreferrer`)
    }
    expect(within(rowLabels(container)[0]).getByRole(`link`).getAttribute(`href`))
      .toMatch(/^https:\/\/www\.ebi\.ac\.uk\/gxa\/experiments\/E-CURD-25\?geneQuery=/)
    expect(screen.getByRole(`link`, {name: `Expression Atlas`})).toHaveAttribute(`href`, AUTH_TESTING)
  })

  it(`re-orders the rows, opens and closes the filters, and downloads the table`, async () => {
    const user = userEvent.setup()
    answerWithFixtures()
    const {container} = render(allStudiesHeatmap())
    await findChart(container)
    const labelTexts = () => rowLabels(container).map(label => label.textContent.replace(/^[TP]/, ``))
    const byExperimentType = labelTexts()

    await user.click(within(controls(container)).getByRole(`button`, {name: `By experiment type`}))
    await user.click(within(controls(container)).getByRole(`button`, {name: `Alphabetical order`}))
    await waitFor(() => expect(labelTexts()).not.toEqual(byExperimentType))
    const alphabetical = labelTexts()
    expect(alphabetical).toEqual([...byExperimentType].sort((a, b) => a.localeCompare(b)))
    expect(controls(container).querySelector(`.dropdown-toggle`)).toHaveTextContent(`Alphabetical order`)

    await user.click(within(controls(container)).getByRole(`button`, {name: `Filters`}))
    const dialog = await screen.findByRole(`dialog`)
    expect(dialog).toHaveClass(`gxa-heatmap-modal`)
    await user.keyboard(`{Escape}`)
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())

    // All Studies has no full dataset: the main button downloads what is shown
    await user.click(within(controls(container)).getByRole(`button`, {name: `Download`}))
    expect(download).toHaveBeenCalledTimes(1)
    expect(download.mock.calls[0].slice(1)).toEqual([`expression_atlas-sorghum_bicolor.tsv`, `text/tsv`])
    expect(window.open).not.toHaveBeenCalled()
  })

  describe(`anatomogram and heatmap highlight each other`, () => {
    it(`selects the columns of a tissue under the mouse in the anatomogram, and clears them after`, async () => {
      answerWithFixtures()
      const {container} = render(allStudiesHeatmap())
      const chart = await findChart(container)
      const leafColumn = chart.xAxis[0].categories.findIndex(column => column.id === LEAF)

      act(() => lastProps().onMouseOver([LEAF]))
      await waitFor(() => expect(chart.getSelectedPoints().length).toBeGreaterThan(0))
      const selected = chart.getSelectedPoints()
      expect(selected.every(point => point.x === leafColumn)).toBe(true)
      expect(selected).toHaveLength(allPoints(chart).filter(point => point.x === leafColumn).length)
      expect(onlyChart()).toBe(chart)   // selected in place, not redrawn

      act(() => lastProps().onMouseOut([LEAF]))
      await waitFor(() => expect(chart.getSelectedPoints()).toHaveLength(0))
    })

    it(`highlights the tissue of a hovered cell or column label`, async () => {
      answerWithFixtures()
      const {container} = render(allStudiesHeatmap())
      const chart = await findChart(container)
      const leafColumn = chart.xAxis[0].categories.findIndex(column => column.id === LEAF)
      const leafPoint = allPoints(chart).find(point => point.x === leafColumn)

      act(() => hover(leafPoint))
      await waitFor(() => expect(lastProps().highlightIds).toEqual([LEAF]))
      expect(tooltipContainers()).toHaveLength(1)
      act(() => leave(leafPoint))
      await waitFor(() => expect(lastProps().highlightIds).toEqual([]))

      const rootColumn = chart.xAxis[0].categories.findIndex(column => column.id === ROOT)
      act(() => {
        chart.xAxis[0].ticks[rootColumn].label.element.dispatchEvent(new MouseEvent(`mouseover`, {bubbles: true}))
      })
      await waitFor(() => expect(lastProps().highlightIds).toEqual([ROOT]))
    })

    it(`highlights the tissues of a hovered row label (new: upstream never matched All Studies rows)`, async () => {
      answerWithFixtures()
      const {container} = render(allStudiesHeatmap())
      const chart = await findChart(container)
      const row = 1
      const tissuesOfRow = [...new Set(allPoints(chart)
        .filter(point => point.y === row && point.value)
        .map(point => chart.xAxis[0].categories[point.x].id))]
      expect(tissuesOfRow.length).toBeGreaterThan(1)

      // the label starts with the T badge, which upstream's text match tripped over
      const label = container.querySelector(`[data-gxa-y="${row}"]`)
      expect(label.textContent).toMatch(/^T/)
      act(() => {
        label.dispatchEvent(new MouseEvent(`mouseover`, {bubbles: true}))
      })
      await waitFor(() => expect(lastProps().highlightIds.length).toBeGreaterThan(0))
      // columns without an ontology term have the id '' (as upstream); the anatomogram has no such tissue
      expect(new Set(lastProps().highlightIds)).toEqual(new Set(tissuesOfRow))

      act(() => {
        label.dispatchEvent(new MouseEvent(`mouseout`, {bubbles: true}))
      })
      await waitFor(() => expect(lastProps().highlightIds).toEqual([]))
    })
  })

  it(`renders under StrictMode without warnings, and leaves no chart or tooltip behind on unmount`, async () => {
    answerWithFixtures()
    const {container, unmount} = render(<StrictMode>{allStudiesHeatmap()}</StrictMode>)
    const chart = await findChart(container)
    expect(rowLabels(container)).toHaveLength(9)

    // the tooltip lives outside the chart, in a container appended to <body>
    act(() => hover(allPoints(chart).find(point => point.value)))
    expect(tooltipContainers()).toHaveLength(1)
    expect(tooltipContainers()[0]).toHaveTextContent(`Expression level`)
    expect(tooltipContainers()[0].parentElement).toBe(document.body)

    unmount()
    expect(liveCharts()).toHaveLength(0)
    expect(tooltipContainers()).toHaveLength(0)
  })

  it(`sends a new linkTarget or outProxy to the row labels as well, and keeps the zoom`, async () => {
    const fetchMock = answerWithFixtures()
    const {container, rerender} = render(allStudiesHeatmap())
    const chart = await findChart(container)
    act(() => {
      chart.xAxis[0].zoom(2, 5)
      chart.showResetZoom()
      chart.redraw(false)
    })
    const orderings = () => controls(container).querySelector(`.dropdown-toggle`)
    expect(orderings()).toBeDisabled()
    const rowLinks = () => rowLabels(container).map(label => label.querySelector(`a[href]`))
    const otherLinks = () => [...container.querySelectorAll(`a[href]`)].filter(link => !link.closest(`[data-gxa-y]`))
    expect(rowLinks().map(link => link.getAttribute(`target`))).toEqual(Array(9).fill(`_blank`))

    // Upstream's labels are formatted as the chart is drawn: a chart kept for equal data kept the old targets
    rerender(allStudiesHeatmap({linkTarget: `_self`}))
    await waitFor(() => expect(rowLinks()[0]).toHaveAttribute(`target`, `_self`))
    for (const link of [...rowLinks(), ...otherLinks()]) {
      expect(link).toHaveAttribute(`target`, `_self`)
      expect(link).not.toHaveAttribute(`rel`)
    }
    expect(rowLinks()).toHaveLength(9)
    expect(onlyChart().xAxis[0].getExtremes()).toMatchObject({userMin: 2, userMax: 5})
    expect(onlyChart().resetZoomButton).toBeTruthy()
    // the controls still know the chart is zoomed
    expect(orderings()).toBeDisabled()

    const PROXY = `https://proxy.example/?u=`
    rerender(allStudiesHeatmap({linkTarget: `_self`, outProxy: PROXY}))
    await waitFor(() => expect(rowLinks()[0].getAttribute(`href`).startsWith(PROXY)).toBe(true))
    expect(rowLinks().every(link => link.getAttribute(`href`).startsWith(`${PROXY}https://www.ebi.ac.uk/gxa/`))).toBe(true)
    expect(otherLinks().some(link => link.getAttribute(`href`).startsWith(PROXY))).toBe(true)
    expect(onlyChart().xAxis[0].getExtremes()).toMatchObject({userMin: 2, userMax: 5})
    expect(orderings()).toBeDisabled()
    // the same payload: no new request
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it(`sizes two heatmaps on one page to their own panels`, async () => {
    answerWithFixtures()
    // the narrow panel is 600 px wide, everything else the shim's 1000 px
    vi.spyOn(HTMLElement.prototype, `clientWidth`, `get`).mockImplementation(function () {
      return this.closest(`.narrow`) ? 600 : 1000
    })
    const {container} = render(
      <div>
        {allStudiesHeatmap({className: `wide`})}
        {allStudiesHeatmap({className: `narrow`})}
      </div>)

    await waitFor(() => expect(container.querySelectorAll(`.highcharts-container`)).toHaveLength(2))
    const chartIn = selector => liveCharts().find(chart => chart.renderTo.closest(selector))
    // computeLayout.test.js: at 1000 px the column labels are rotated and need a wider right margin
    expect(chartIn(`.wide`).options.chart.marginRight).toBeGreaterThan(chartIn(`.narrow`).options.chart.marginRight)
    expect(chartIn(`.narrow`).options.chart.marginRight).toBe(20)

    // no two elements share an id
    const ids = [...document.querySelectorAll(`[id]`)].map(element => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe(`All Studies with filterRows (SORBI_3001G000200 on sorghum_v11)`, () => {
  const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`
  const isJgiRow = row => row.id.startsWith(`JGI-`) || row.name.startsWith(`Mullet lab - `)

  it(`draws the rows filterRows keeps, and only the columns they have values in`, async () => {
    const fetchMock = answerWithFixtures()
    const filterRows = row => !isJgiRow(row)
    const {container, rerender} = render(
      <ExpressionAtlasHeatmap atlasUrl={SORGHUM_V11} query={{gene: `SORBI_3001G000200`}} filterRows={filterRows} />)
    const chart = await findChart(container)

    expect(await screen.findByText(`Showing 9 experiments:`)).toBeInTheDocument()
    expect(rowLabels(container)).toHaveLength(9)
    expect(rowLabels(container).map(label => label.textContent).join(` `)).not.toMatch(/Mullet lab/)
    const columns = chart.xAxis[0].categories.map(category => category.label)
    expect(columns).toHaveLength(24)
    expect(columns).not.toContain(`peduncle`)
    // the anatomogram shows the tissues of the columns drawn
    expect(lastProps().showIds).toEqual(chart.xAxis[0].categories.map(category => category.id))

    // the same filter again: the chart stays as it is
    rerender(<ExpressionAtlasHeatmap atlasUrl={SORGHUM_V11} query={{gene: `SORBI_3001G000200`}} filterRows={filterRows} />)
    expect(onlyChart()).toBe(chart)

    // no filter: every row, and no new request
    rerender(<ExpressionAtlasHeatmap atlasUrl={SORGHUM_V11} query={{gene: `SORBI_3001G000200`}} />)
    await waitFor(() => expect(rowLabels(container)).toHaveLength(58))
    expect(onlyChart().xAxis[0].categories).toHaveLength(31)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe(`Paralogs, baseline (E-CURD-25)`, () => {
  it(`draws the experiment with a Download button only, and a description linked in a new tab`, async () => {
    const fetchMock = answerWithFixtures()
    const {container} = render(paralogsHeatmap(`E-CURD-25`))
    const chart = await findChart(container)

    expect(fetchMock.mock.calls[0][0]).toBe(`${AUTH_TESTING}json/experiments/E-CURD-25`)
    expect(fetchMock.mock.calls[0][1].body).toBe(`geneQuery=${PARALOGS}`)
    expect(rowLabels(container).map(label => label.textContent)).toEqual(PARALOGS.split(` `))
    // upstream 5.7.2's five log-range buckets (no cell is below the cutoff)
    expect(chart.series.map(series => series.name)).toEqual([`Low`, `Low-Medium`, `Medium`, `Medium-High`, `High`])
    expect(toggles(container).map(toggle => toggle.textContent.trim())).toEqual([`Download`, `More download options`])

    const description = screen.getByRole(`link`, {name: curd25.body.experiment.description})
    expect(description).toHaveAttribute(`href`, curd25.body.experiment.urls.main_page)
    for (const a of container.querySelectorAll(`a[href]`)) {
      expect(a).toHaveAttribute(`target`, `_blank`)
    }
  })

  it(`shows the anatomogram for the display-name species the backend sends (normalised), and highlights with it`, async () => {
    answerWithFixtures()
    const {container} = render(paralogsHeatmap(`E-CURD-25`))
    const chart = await findChart(container)

    expect(curd25.body.anatomogram.species).toBe(`Sorghum bicolor`)
    expect(screen.getByTestId(`anatomogram-stub`)).toHaveAttribute(`data-species`, `sorghum_bicolor`)
    expect(lastProps().showIds).toEqual(expect.arrayContaining([ROOT, SHOOT]))

    const rootColumn = chart.xAxis[0].categories.findIndex(column => column.id === ROOT)
    act(() => lastProps().onMouseOver([ROOT]))
    await waitFor(() => expect(chart.getSelectedPoints().length).toBeGreaterThan(0))
    expect(chart.getSelectedPoints().every(point => point.x === rootColumn)).toBe(true)
  })

  it(`hides the anatomogram with showAnatomogram={false}, and when the payload has none (E-GEOD-167101)`, async () => {
    answerWithFixtures()
    const {container, unmount} = render(paralogsHeatmap(`E-CURD-25`, {showAnatomogram: false}))
    await findChart(container)
    expect(screen.queryByTestId(`anatomogram-stub`)).toBeNull()
    unmount()

    const genes = geod167101.body_sent.replace(`geneQuery=`, ``)
    const second = render(
      <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: genes}} experiment={`E-GEOD-167101`} />)
    await findChart(second.container)
    expect(rowLabels(second.container)).toHaveLength(14)
    expect(screen.queryByTestId(`anatomogram-stub`)).toBeNull()
    expect(anatomogramRenders).toHaveLength(0)
  })
})

describe(`Paralogs, differential (E-GEOD-30249)`, () => {
  it(`draws the fold-change legend and the genome browser choice`, async () => {
    answerWithFixtures()
    const {container} = render(paralogsHeatmap(`E-GEOD-30249`))
    const chart = await findChart(container)

    expect(chart.series.map(series => series.name)).toEqual([`High down`, `Down`, `Below cutoff`, `Up`, `High up`])
    expect(container.querySelector(`.gxaHeatmapContainer`)).toHaveTextContent(`Log2-fold change`)
    expect(toggles(container).map(toggle => toggle.textContent.trim()))
      .toEqual([`Ensembl Genomes genome browser`, `Download`, `More download options`])
    expect(container).toHaveTextContent(`Click on a cell to open the selected genome browser`)
    expect(screen.queryByTestId(`anatomogram-stub`)).toBeNull()
  })

  it(`opens the EBI genome browser redirect for a clicked cell in a new tab`, async () => {
    answerWithFixtures()
    const {container} = render(paralogsHeatmap(`E-GEOD-30249`))
    const chart = await findChart(container)
    const point = allPoints(chart)[0]
    const geneId = chart.yAxis[0].categories[point.y].info.trackId
    const trackId = chart.xAxis[0].categories[point.x].info.trackId
    expect(geneId).toMatch(/^SORBI_3001G000[24]00$/)

    act(() => point.firePointEvent(`click`))
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(
      `https://www.ebi.ac.uk/gxa/experiments/E-GEOD-30249/redirect/genome-browsers` +
      `?experimentAccession=E-GEOD-30249&name=ensemblgenomes&geneId=${geneId}&trackId=${trackId}`,
      `_blank`, `noopener,noreferrer`)
  })

  it(`lets resolveUrl rewrite or suppress the genome browser link`, async () => {
    answerWithFixtures()
    const resolveUrl = vi.fn((kind, url, context) =>
      kind === `genomeBrowser` ? (context.geneId === `SORBI_3001G000200` ? null : `https://example.org/gb`) : undefined)
    const {container} = render(paralogsHeatmap(`E-GEOD-30249`, {resolveUrl, linkTarget: `gxa`}))
    const chart = await findChart(container)

    for (const point of allPoints(chart)) {
      act(() => point.firePointEvent(`click`))
    }
    const clicked = allPoints(chart).map(point => chart.yAxis[0].categories[point.y].info.trackId)
    const opened = clicked.filter(id => id !== `SORBI_3001G000200`).length
    expect(opened).toBeGreaterThan(0)
    expect(window.open).toHaveBeenCalledTimes(opened)
    expect(window.open).toHaveBeenCalledWith(`https://example.org/gb`, `gxa`, undefined)
    expect(resolveUrl).toHaveBeenCalledWith(`genomeBrowser`, expect.stringContaining(`/redirect/genome-browsers?`),
      expect.objectContaining({experiment: `E-GEOD-30249`, genomeBrowser: `ensemblgenomes`}))
  })
})

describe(`an unknown gene`, () => {
  it.each([
    [`without StrictMode`, element => element],
    [`under StrictMode`, element => <StrictMode>{element}</StrictMode>]
  ])(`shows the error alert and calls fail exactly once (%s)`, async (_, wrap) => {
    answerWithFixtures()
    const fail = vi.fn()
    const {container} = render(wrap(
      <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `NOT_A_REAL_GENE`}} fail={fail} />))

    const alert = await screen.findByRole(`alert`)
    expect(alert).toHaveClass(`alert-danger`)
    expect(alert).toHaveTextContent(`Oops!`)
    expect(alert.querySelector(`code`)).toHaveTextContent(`Error: Internal Server Error`)
    expect(container.innerHTML).not.toMatch(/topwallpaperpc/)
    for (const a of alert.querySelectorAll(`a[href]`)) {
      expect(a).toHaveAttribute(`target`, `_blank`)
    }

    await waitFor(() => expect(fail).toHaveBeenCalled())
    // give a second (StrictMode) effect or render the chance to call it again
    await act(() => new Promise(resolve => setTimeout(resolve, 100)))
    expect(fail).toHaveBeenCalledTimes(1)
    expect(fail).toHaveBeenCalledWith({
      url: `${AUTH_TESTING}json/baseline_experiments`, method: `POST`, message: `Internal Server Error`
    })
    expect(liveCharts()).toHaveLength(0)
  })
})

describe(`render()`, () => {
  it(`draws into a plain element and cleans up on unmount`, async () => {
    answerWithFixtures()
    const target = document.createElement(`div`)
    document.body.appendChild(target)
    const afterRender = vi.fn()

    let handle
    await act(async () => {
      handle = renderHeatmap({target, render: afterRender, atlasUrl: AUTH_TESTING, query: {gene: `SORBI_3001G000200`}})
    })
    await waitFor(() => expect(target.querySelector(`.highcharts-container`)).not.toBeNull())
    expect(afterRender).toHaveBeenCalledTimes(1)
    expect(liveCharts()).toHaveLength(1)

    act(() => handle.unmount())
    expect(target.innerHTML).toBe(``)
    expect(liveCharts()).toHaveLength(0)
    expect(tooltipContainers()).toHaveLength(0)
    target.remove()
  })
})

