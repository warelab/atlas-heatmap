import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Highcharts from 'highcharts'

import GeneSpecificResults from '../../src/manipulate/GeneSpecificResults.js'
import ChartContainer from '../../src/manipulate/ChartContainer.js'
import { mockFetch } from '../helpers/fetch.js'
import { chartDataOf } from '../helpers/canvas.js'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'

// The heatmap itself is out of scope here
vi.mock(`../../src/manipulate/HeatmapWithControls.js`, () => ({default: () => <div data-testid={`heatmap`} />}))

const URL = `https://www.ebi.ac.uk/gxa/json/experiments/E-MTAB-513/genes/ENSG00000000003`

// The shape of an EBI gene-specific results payload (the Gramene backend sends none)
const payload = {
  columnHeaders: [{id: `g1`, name: `adipose`}, {id: `g2`, name: `brain`}],
  config: {cutoff: 0.5},
  geneExpression: {
    rows: [{
      id: `ENSG00000000003`, name: `TSPAN6`, expressionUnit: `TPM`,
      expressions: [{quartiles: {min: 1, lower: 2, median: 3, upper: 4, max: 5}}, {value: 7}]
    }]
  },
  transcriptExpression: {
    rows: [{
      id: `ENST00000373020`,
      expressions: [
        {stats: {min: 1, lower_quartile: 2, median: 3, upper_quartile: 4, max: 5}, values: [{value: 3, id: `a`, assays: [`a1`]}]},
        {stats: {min: 2, lower_quartile: 3, median: 4, upper_quartile: 5, max: 6}, values: [{value: 4, id: `b`, assays: [`b1`]}]}
      ]
    }]
  }
}

const charts = () => Highcharts.charts.filter(Boolean)

describe(`GeneSpecificResults`, () => {
  it(`GETs its URL and draws the gene boxplot and the transcripts with HighchartsReact`, async () => {
    const fetchMock = mockFetch(() => ({body: payload}))
    const {unmount} = render(<GeneSpecificResults url={URL} keepOnlyTheseColumnIds={[`g1`, `g2`]} />)

    await waitFor(() => expect(charts()).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(URL)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({method: `GET`})

    const [boxplot, transcripts] = charts()
    expect(boxplot.options.chart.type).toBe(`boxplot`)
    expect(boxplot.title.textStr).toBe(`Gene expression – TSPAN6`)
    expect(boxplot.series.map(s => s.type)).toEqual([`boxplot`, `scatter`])
    expect(boxplot.yAxis[0].options.plotLines[0].value).toBe(0.5)
    expect(transcripts.title.textStr).toBe(`Expression per transcript – TSPAN6`)
    expect(transcripts.series.map(s => s.name)).toEqual([`ENST00000373020`])

    unmount()
    expect(charts()).toHaveLength(0)
  })

  it(`shows the error message of a failed request`, async () => {
    mockFetch(() => ({status: 500, body: {error: `Internal Server Error`}}))
    render(<GeneSpecificResults url={URL} keepOnlyTheseColumnIds={[]} />)
    expect(await screen.findByText(`Internal Server Error`)).toBeInTheDocument()
    expect(charts()).toHaveLength(0)
  })

  it(`says so when there is no expression data`, async () => {
    mockFetch(() => ({body: {columnHeaders: [], config: {cutoff: 0}}}))
    render(<GeneSpecificResults url={URL} keepOnlyTheseColumnIds={[]} />)
    expect(await screen.findByText(`No gene or transcript expression data`)).toBeInTheDocument()
  })
})

describe(`ChartContainer`, () => {
  it(`loads the gene-specific results lazily, only for payloads that have them`, async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(() => ({body: payload}))
    const chartData = chartDataOf(curd25)
    expect(chartData.geneSpecificResults).toBeNull()

    const {rerender} = render(<ChartContainer chartData={chartData} />)
    expect(screen.getByTestId(`heatmap`)).toBeInTheDocument()
    expect(screen.queryByRole(`link`)).toBeNull()

    rerender(<ChartContainer chartData={{...chartData, geneSpecificResults: {url: URL, keepOnlyTheseColumnIds: [`g1`]}}} />)
    await waitFor(() => expect(charts()).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const toggle = screen.getByRole(`link`, {name: `Show boxplot and transcripts view`})
    expect(screen.getByTestId(`heatmap`).parentElement).toHaveStyle({display: `block`})
    await user.click(toggle)
    expect(screen.getByRole(`link`, {name: `Show heatmap view`})).toBeInTheDocument()
    expect(screen.getByTestId(`heatmap`).parentElement).toHaveStyle({display: `none`})
  })
})
