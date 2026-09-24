import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Highcharts from 'highcharts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App, { demoResolveUrl } from '../examples/playground/App.jsx'
import { installMockFetch, pickFixture } from '../examples/playground/mockFetch.js'
import allStudies from './fixtures/all-studies.SORBI_3001G000200.json'
import allStudiesV11 from './fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import curd25 from './fixtures/paralogs.E-CURD-25.baseline.json'
import unknownGene from './fixtures/error.unknown-gene.json'
import gridSb1 from './fixtures/grid.JGI-SB-1.msd2.json'

// The playground (npm run dev) in jsdom, on its own ?api=mock layer
vi.mock(`gramene-anatomogram`, () => import(`./stubs/anatomogram.js`))

const AUTH_TESTING = `https://data.sorghumbase.org/auth_testing/gxa/`
const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`

const liveCharts = () => Highcharts.charts.filter(Boolean)
const eventLines = () => [...document.querySelectorAll(`[data-testid=events] li`)].map(li => li.textContent)

let uninstall
beforeEach(() => {
  uninstall = installMockFetch({delay: 0, log: () => {}})
  vi.spyOn(console, `info`).mockImplementation(() => {})   // the playground's event log also goes to the console
})
afterEach(() => {
  uninstall()
})

describe(`the mock API`, () => {
  it(`answers with the fixture captured for the request, or the nearest one`, () => {
    expect(pickFixture(`${AUTH_TESTING}json/baseline_experiments`, `geneQuery=SORBI_3001G000200`)).toBe(allStudies)
    expect(pickFixture(`${SORGHUM_V11}json/baseline_experiments`, `geneQuery=SORBI_3001G000100`)).toBe(allStudiesV11)
    expect(pickFixture(`https://www.ebi.ac.uk/gxa/json/experiments/E-CURD-25`, `geneQuery=A B`)).toBe(curd25)
    expect(pickFixture(`${AUTH_TESTING}json/baseline_experiments`, `geneQuery=NOT_A_REAL_GENE`)).toBe(unknownGene)
    expect(pickFixture(`${AUTH_TESTING}json/experiments/E-GEOD-140928`, `geneQuery=A`)).toBe(unknownGene)
    expect(pickFixture(`/src/Main.js`)).toBeNull()
    expect(pickFixture(`${SORGHUM_V11}json/experiments/JGI-SB-1`, `geneQuery=SORBI_3006G095600`)).toBe(gridSb1)
  })

  it(`serves it as a fetch Response, and aborts like fetch`, async () => {
    const response = await fetch(`${AUTH_TESTING}json/experiments/E-CURD-25`, {method: `POST`, body: curd25.body_sent})
    expect(response.status).toBe(200)
    expect((await response.json()).experiment.accession).toBe(`E-CURD-25`)
    expect((await fetch(`${AUTH_TESTING}json/baseline_experiments`, {body: `geneQuery=NOT_A_REAL_GENE`})).status).toBe(500)

    const controller = new AbortController()
    const pending = fetch(`${AUTH_TESTING}json/baseline_experiments`, {body: ``, signal: controller.signal})
    controller.abort()
    await expect(pending).rejects.toMatchObject({name: `AbortError`})
  })
})

describe(`the playground`, () => {
  it(`draws All Studies and Paralogs side by side, and logs fail() for an unknown gene`, async () => {
    const user = userEvent.setup()
    render(<App api={`mock`} />)
    expect(screen.getByText(`mock API (test/fixtures)`)).toBeInTheDocument()
    expect(screen.getByText(/gramene-anatomogram is not installed/)).toBeInTheDocument()

    await waitFor(() => expect(document.querySelectorAll(`.highcharts-container`)).toHaveLength(2))
    const paralogs = screen.getByTestId(`panel-paralogs`)
    expect(within(paralogs).getByRole(`link`, {name: curd25.body.experiment.description})).toBeInTheDocument()
    expect(within(screen.getByTestId(`panel-all-studies`)).getByText(`Showing 9 experiments:`)).toBeInTheDocument()

    const genes = screen.getByLabelText(`Genes (All Studies uses the first)`)
    await user.clear(genes)
    await user.type(genes, `NOT_A_REAL_GENE`)
    await user.click(screen.getByRole(`button`, {name: `Apply`}))
    await waitFor(() => expect(screen.getAllByRole(`alert`).filter(a => a.classList.contains(`alert-danger`))).toHaveLength(2))
    expect(liveCharts()).toHaveLength(0)
    await waitFor(() => expect(eventLines().filter(line => line.includes(`fail`))).toHaveLength(2))
    expect(eventLines()[0]).toMatch(/fail POST https:\/\/data\.sorghumbase\.org\/auth_testing\/gxa\/json\/.*: Internal Server Error/)
  })

  it(`moves the heatmap into a fullscreen modal and back without fetching again`, async () => {
    const user = userEvent.setup()
    render(<App api={`mock`} initialPanel={`fullscreen`} />)
    await waitFor(() => expect(liveCharts()).toHaveLength(1))
    const chart = liveCharts()[0]
    const fetchSpy = vi.spyOn(globalThis, `fetch`)

    await user.click(screen.getByRole(`button`, {name: `View full screen`}))
    const dialog = await screen.findByRole(`dialog`)
    expect(dialog.querySelector(`.modal-body .highcharts-container`)).not.toBeNull()
    expect(liveCharts()).toEqual([chart])

    await user.keyboard(`{Escape}`)
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
    expect(document.querySelectorAll(`.highcharts-container`)).toHaveLength(1)
    expect(liveCharts()).toEqual([chart])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it(`mounts, updates and unmounts through render()`, async () => {
    const user = userEvent.setup()
    render(<App api={`mock`} initialPanel={`render-api`} />)
    const target = screen.getByTestId(`render-target`)
    expect(target).toBeEmptyDOMElement()

    await user.click(screen.getByRole(`button`, {name: `render()`}))
    await waitFor(() => expect(target.querySelector(`.highcharts-container`)).not.toBeNull())
    expect(eventLines().filter(line => line.includes(`render() callback`))).toHaveLength(1)

    await user.click(screen.getByRole(`button`, {name: `render() again`}))
    await waitFor(() => expect(eventLines().filter(line => line.includes(`render() callback`))).toHaveLength(2))
    expect(target.querySelectorAll(`.gxaHeatmapContainer`)).toHaveLength(1)

    await user.click(screen.getByRole(`button`, {name: `unmount()`}))
    expect(target).toBeEmptyDOMElement()
    expect(liveCharts()).toHaveLength(0)
  })

  it(`logs window.open instead of opening when asked`, async () => {
    const user = userEvent.setup()
    const open = window.open
    render(<App api={`mock`} initialPanel={`resizable`} />)
    await user.click(screen.getByLabelText(`log window.open instead of opening`))
    act(() => {
      window.open(`https://example.org/`, `_blank`)
    })
    expect(open).not.toHaveBeenCalled()
    expect(eventLines()[0]).toMatch(/window\.open "https:\/\/example\.org\/", "_blank"/)

    await user.click(screen.getByLabelText(`log window.open instead of opening`))
    expect(window.open).toBe(open)
  })
})

describe(`the factor grid panel`, () => {
  it(`draws a JGI study on sorghum_v11, keeps the axes chosen per study, and logs onChangeFactors`, async () => {
    const user = userEvent.setup()
    render(<App api={`mock`} initialPanel={`grid`} />)
    expect(screen.getByLabelText(`atlasUrl`)).toHaveValue(SORGHUM_V11)
    const panel = screen.getByTestId(`panel-grid`)
    const table = await within(panel).findByRole(`table`)
    expect(within(table).getAllByRole(`rowheader`)).toHaveLength(5)
    expect(liveCharts()).toHaveLength(0)

    await user.click(within(panel).getByRole(`button`, {name: `Swap rows and columns`}))
    expect(within(table).getAllByRole(`rowheader`)).toHaveLength(8)
    expect(eventLines()[0]).toMatch(/onChangeFactors JGI-SB-1: rows organism part, columns developmental stage/)

    // three factors: the selects
    await user.selectOptions(within(panel).getByLabelText(`Study`), `JGI-SB-2`)
    const rows = await within(panel).findByRole(`combobox`, {name: `Rows`})
    expect(rows).toHaveValue(`cultivar`)

    // back to JGI-SB-1: still swapped
    await user.selectOptions(within(panel).getByLabelText(`Study`), `JGI-SB-1`)
    await waitFor(() => expect(within(within(panel).getByRole(`table`)).getAllByRole(`rowheader`)).toHaveLength(8))
  })

  it(`offers sorghum_v11 when another atlasUrl is chosen`, async () => {
    const user = userEvent.setup()
    render(<App api={`mock`} />)
    await user.click(screen.getByRole(`tab`, {name: `Factor grid`}))
    const panel = screen.getByTestId(`panel-grid`)
    expect(within(panel).getByText(`The JGI studies are on sorghum_v11.`)).toBeInTheDocument()
    await user.click(within(panel).getByRole(`button`, {name: `Use sorghum_v11`}))
    expect(screen.getByLabelText(`atlasUrl`)).toHaveValue(SORGHUM_V11)
    expect(within(panel).queryByText(`The JGI studies are on sorghum_v11.`)).toBeNull()
    expect(await within(panel).findByRole(`table`)).toBeInTheDocument()
  })
})

describe(`the demo resolveUrl`, () => {
  const context = {query: {gene: `SORBI_3001G000200 SORBI_3001G000400`}, experiment: `E-CURD-25`}

  it(`points the Warelab backend's links at EBI`, () => {
    expect(demoResolveUrl(`row`, `x`, {...context, row: {uri: `genes/SORBI_3001G000200`}}))
      .toBe(`https://www.ebi.ac.uk/gxa/genes/SORBI_3001G000200`)
    expect(demoResolveUrl(`row`, `x`, {...context, row: {uri: `https://www.ebi.ac.uk/gxa/experiments/E-CURD-25`}}))
      .toBeUndefined()
    expect(demoResolveUrl(`atlas`, AUTH_TESTING, context)).toBe(`https://www.ebi.ac.uk/gxa/`)
    expect(decodeURIComponent(demoResolveUrl(`experiment`, curd25.body.experiment.urls.main_page, context)))
      .toBe(`https://www.ebi.ac.uk/gxa/experiments/E-CURD-25?geneQuery=[{"value":"SORBI_3001G000200"},{"value":"SORBI_3001G000400"}]`)
    expect(demoResolveUrl(`moreInformation`, `${AUTH_TESTING}query`, {...context, experiment: null}))
      .toBe(`https://www.ebi.ac.uk/gxa/genes/SORBI_3001G000200`)
    expect(demoResolveUrl(`download`, curd25.body.experiment.urls.download, context)).not.toMatch(/geneQuery/)
    expect(demoResolveUrl(`support`, `https://www.ebi.ac.uk/support/gxa`, context)).toBeUndefined()
  })
})
