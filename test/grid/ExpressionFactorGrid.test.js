import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Highcharts from 'highcharts'
import { describe, expect, it, vi } from 'vitest'

import { ExpressionFactorGrid } from '../../src/Main.js'
import { allowConsole } from '../consoleGuard.js'
import { assayGroupColours } from '../../src/grid/colours.js'
import { chartDataOf } from '../helpers/canvas.js'
import { mockFetch } from '../helpers/fetch.js'
import sb1 from '../fixtures/grid.JGI-SB-1.msd2.json'
import sb2 from '../fixtures/grid.JGI-SB-2.msd2.json'
import sb4 from '../fixtures/grid.JGI-SB-4.msd2.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import unknownGene from '../fixtures/error.unknown-gene.json'

// ExpressionFactorGrid from fetch to table, on the captured JGI studies of msd2. The console guard fails a test on any
// React warning.
vi.mock(`gramene-anatomogram`, () => import(`../stubs/anatomogram.js`))

const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`
const MSD2 = `SORBI_3006G095600`
const FIXTURES = {'JGI-SB-1': sb1, 'JGI-SB-2': sb2, 'JGI-SB-4': sb4, 'E-CURD-25': curd25, 'E-GEOD-30249': geod30249}

// Answers json/experiments/<accession> with its fixture, for any gene; NOT_A_REAL_GENE gets the backend's 500
const answerWithFixtures = () => mockFetch((url, init) => {
  const accession = /json\/experiments\/([^/?]+)$/.exec(url)?.[1]
  return init.body.includes(`NOT_A_REAL_GENE`) || !FIXTURES[accession] ? unknownGene : FIXTURES[accession]
})

const grid = props => <ExpressionFactorGrid atlasUrl={SORGHUM_V11} experiment={`JGI-SB-1`} gene={MSD2} {...props} />
const findTable = () => screen.findByRole(`table`)
const columnLabels = table =>
  within(table).getAllByRole(`columnheader`).filter(th => th.classList.contains(`gxa-grid-col`)).map(th => th.textContent)
const rowLabels = table => within(table).getAllByRole(`rowheader`).map(th => th.textContent)
const bands = container => [...container.querySelectorAll(`.gxa-grid-band`)]
const cell = (table, rowLabel, columnLabel) => {
  const column = columnLabels(table).indexOf(columnLabel)
  const row = within(table).getAllByRole(`rowheader`).find(th => th.textContent === rowLabel).closest(`tr`)
  return row.querySelectorAll(`td`)[column]
}
// jsdom writes colours as rgb()
const cssColour = colour => {
  const element = document.createElement(`div`)
  element.style.background = colour
  return element.style.background
}
const liveCharts = () => Highcharts.charts.filter(Boolean)

describe(`ExpressionFactorGrid`, () => {
  it(`fetches one experiment for the gene, then draws a table (no Highcharts) with the flat heatmap's legend`, async () => {
    const fetchMock = answerWithFixtures()
    const {container} = render(grid({className: `my-grid`, style: {minHeight: `10px`}}))

    expect(container.firstChild).toHaveClass(`gxaHeatmapContainer`, `gxaFactorGrid`, `my-grid`)
    expect(container.firstChild.style.minHeight).toBe(`10px`)
    expect(screen.getByRole(`status`)).toHaveTextContent(`Loading expression data…`)

    const table = await findTable()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${SORGHUM_V11}json/experiments/JGI-SB-1`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: `POST`, body: `geneQuery=${MSD2}`, headers: {'Content-Type': `application/x-www-form-urlencoded`}
    })

    // organism part on the columns (drawn vertically: the labels are long), developmental stage on the rows
    expect(columnLabels(table)).toEqual([
      `leaf lamina`, `leaf sheath`, `panicle inflorescence`, `peduncle`, `root`, `root tip`, `shoot system`, `stem internode`])
    expect(table.querySelector(`.gxa-grid-col--vertical[title="panicle inflorescence"]`)).not.toBeNull()
    expect(rowLabels(table)).toEqual([
      `inflorescence development stage`, `seedling development stage`, `sporophyte vegetative stage`,
      `whole plant flowering stage`, `whole plant fruit ripening stage`])
    expect(within(table).getByRole(`columnheader`, {name: `developmental stage`})).toHaveClass(`gxa-grid-axis--rows`)
    expect(table.querySelector(`.gxa-grid-axis--columns`)).toHaveTextContent(`organism part`)
    expect(table.querySelector(`caption`)).toHaveTextContent(`Expression of ${MSD2} in JGI-SB-1, in TPM`)

    // one band per assay group; empty cells say so
    expect(bands(container)).toHaveLength(31)
    expect(container.querySelectorAll(`.gxa-grid-cell--empty`)).toHaveLength(40 - 22)
    expect(cell(table, `seedling development stage`, `panicle inflorescence`)).toHaveTextContent(`No data`)

    // the single-experiment gradient legend, in TPM, and the no-data key
    const legend = container.querySelector(`.gxa-grid-legend`)
    expect(legend).toHaveTextContent(`Expression level in TPM`)
    expect(within(legend).getByText(`No data`)).toBeInTheDocument()

    // two factors: a swap button and no selects
    expect(screen.getByRole(`button`, {name: `Swap rows and columns`})).toBeInTheDocument()
    expect(screen.queryByRole(`combobox`)).toBeNull()

    expect(liveCharts()).toHaveLength(0)
    expect(container.querySelector(`.highcharts-container, svg`)).toBeNull()
  })

  it(`splits a cell into one band per sample, ordered by sample id, coloured as the flat heatmap colours them`, async () => {
    answerWithFixtures()
    const {container} = render(grid())
    const table = await findTable()
    const colours = assayGroupColours(chartDataOf(sb1), 0)

    const leaf = cell(table, `inflorescence development stage`, `leaf lamina`)
    const leafBands = within(leaf).getAllByRole(`img`)
    expect(leafBands.map(band => band.getAttribute(`aria-label`))).toEqual([
      `inflorescence development stage, leaf lamina: sample leaf_lower_growing.floral_initiation, 41.344 TPM`,
      `inflorescence development stage, leaf lamina: sample leaf_upper_growing.floral_initiation, 10.795 TPM`])
    expect(leafBands.map(band => band.getAttribute(`data-assay-group`))).toEqual([`g9`, `g18`])
    expect(within(cell(table, `inflorescence development stage`, `stem internode`)).getAllByRole(`img`)).toHaveLength(3)

    // every band has the colour of its assay group; the higher value is darker
    for (const band of bands(container)) {
      const index = sb1.body.columnHeaders.findIndex(header => header.assayGroupId === band.getAttribute(`data-assay-group`))
      expect(band.style.background).toBe(cssColour(colours[index]))
      expect(band).toHaveAttribute(`tabindex`, `0`)
    }
    expect(leafBands[0].style.background).not.toBe(leafBands[1].style.background)
  })

  it(`shows a tooltip for the band under the mouse or in focus, and hides it after (or on Escape)`, async () => {
    const user = userEvent.setup()
    answerWithFixtures()
    render(grid())
    const table = await findTable()
    const [lower, upper] = within(cell(table, `inflorescence development stage`, `leaf lamina`)).getAllByRole(`img`)

    await user.hover(upper)
    const tooltip = screen.getByRole(`tooltip`)
    expect(upper).toHaveAttribute(`aria-describedby`, tooltip.id)
    expect(upper).toHaveClass(`gxa-grid-band--active`)
    const entries = [...tooltip.querySelectorAll(`dt`)].map(dt => [dt.textContent, dt.nextElementSibling.textContent])
    expect(entries).toEqual([
      [`organism part`, `leaf lamina`],
      [`developmental stage`, `inflorescence development stage`],
      [`sample id`, `leaf_upper_growing.floral_initiation`],
      [`replicates`, `2`],
      [`expression`, `10.795 TPM`]
    ])
    expect(tooltip.querySelector(`.gxa-grid-swatch`).style.background).toBe(upper.style.background)
    expect(tooltip.style.visibility).toBe(`visible`)

    await user.unhover(upper)
    expect(screen.queryByRole(`tooltip`)).toBeNull()

    // keyboard: the bands follow the swap button in the tab order
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole(`button`, {name: `Swap rows and columns`}))
    await user.tab()
    expect(document.activeElement).toBe(lower)
    expect(screen.getByRole(`tooltip`)).toHaveTextContent(`leaf_lower_growing.floral_initiation`)
    expect(lower).toHaveAttribute(`aria-describedby`, screen.getByRole(`tooltip`).id)
    await user.keyboard(`{Escape}`)
    expect(screen.queryByRole(`tooltip`)).toBeNull()
    await user.tab()
    expect(document.activeElement).toBe(upper)
    expect(screen.getByRole(`tooltip`)).toHaveTextContent(`leaf_upper_growing.floral_initiation`)
    await user.tab({shift: true})
    expect(screen.getByRole(`tooltip`)).toHaveTextContent(`leaf_lower_growing.floral_initiation`)
  })

  it(`swaps rows and columns, tells onChangeFactors, and does not fetch again`, async () => {
    const user = userEvent.setup()
    const fetchMock = answerWithFixtures()
    const onChangeFactors = vi.fn()
    const {container} = render(grid({onChangeFactors}))
    const table = await findTable()
    expect(onChangeFactors).not.toHaveBeenCalled()

    await user.click(screen.getByRole(`button`, {name: `Swap rows and columns`}))
    expect(onChangeFactors).toHaveBeenCalledTimes(1)
    expect(onChangeFactors).toHaveBeenCalledWith({rowFactor: `organism part`, columnFactor: `developmental stage`})
    expect(rowLabels(table)).toHaveLength(8)
    expect(rowLabels(table)[0]).toBe(`leaf lamina`)
    expect(columnLabels(table)).toHaveLength(5)
    expect(bands(container)).toHaveLength(31)

    await user.click(screen.getByRole(`button`, {name: `Swap rows and columns`}))
    expect(onChangeFactors).toHaveBeenLastCalledWith({rowFactor: `developmental stage`, columnFactor: `organism part`})
    expect(rowLabels(table)).toHaveLength(5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it(`offers Rows and Columns selects for a study with more than two factors, and folds the third into the rows`, async () => {
    const user = userEvent.setup()
    answerWithFixtures()
    const onChangeFactors = vi.fn()
    const {container} = render(grid({experiment: `JGI-SB-2`, onChangeFactors}))
    const table = await findTable()

    const rows = screen.getByRole(`combobox`, {name: `Rows`})
    const columns = screen.getByRole(`combobox`, {name: `Columns`})
    expect([...rows.options].map(option => option.value)).toEqual([`cultivar`, `sampling time point`, `sampling site`])
    expect(rows).toHaveValue(`cultivar`)
    expect(columns).toHaveValue(`sampling time point`)
    expect(screen.getByRole(`button`, {name: `Swap rows and columns`})).toBeInTheDocument()

    // the constant factor is the caption; the folded factor is in the row labels and the rows' title
    expect(table.querySelector(`caption`)).toHaveTextContent(`organism part: stem internode`)
    expect(within(table).getByRole(`columnheader`, {name: `cultivar · sampling site`})).toBeInTheDocument()
    expect(rowLabels(table)).toContain(`TX08001 · inner core`)
    expect(columnLabels(table).slice(0, 7)).toEqual([`S1`, `S2`, `S3`, `S6`, `S7`, `S10`, `S11`])
    expect(table.querySelector(`.gxa-grid-col--vertical`)).toBeNull()   // short labels stay horizontal
    // five TX08001 inner core samples share every factor value: five bands in one cell
    expect(within(cell(table, `TX08001 · inner core`, `—`)).getAllByRole(`img`)).toHaveLength(5)
    expect(bands(container)).toHaveLength(46)

    // a folded factor for the columns: the old column factor is folded into the rows
    await user.selectOptions(columns, `sampling site`)
    expect(onChangeFactors).toHaveBeenLastCalledWith({rowFactor: `cultivar`, columnFactor: `sampling site`})
    expect(columns).toHaveValue(`sampling site`)
    expect(columnLabels(table)).toEqual([`epithelial tissue`, `inner core`, `middle core`, `outer core`, `—`])
    expect(rowLabels(table)[0]).toBe(`DDYM · S1`)
    expect(bands(container)).toHaveLength(46)

    // the column's factor for the rows: they swap
    await user.selectOptions(rows, `sampling site`)
    expect(onChangeFactors).toHaveBeenLastCalledWith({rowFactor: `sampling site`, columnFactor: `cultivar`})
    expect(rows).toHaveValue(`sampling site`)
    expect(columns).toHaveValue(`cultivar`)
    expect(columnLabels(table)).toEqual([`DDYM`, `Della`, `Keller`, `TX08001`])
  })

  it(`follows rowFactor and columnFactor when they name varying factors, and ignores them otherwise`, async () => {
    answerWithFixtures()
    const {rerender} = render(grid({experiment: `JGI-SB-4`, rowFactor: `cultivar`, columnFactor: `developmental stage`}))
    const table = await findTable()
    expect(screen.getByRole(`combobox`, {name: `Rows`})).toHaveValue(`cultivar`)
    expect(rowLabels(table)).toContain(`BTx623 · seed`)

    rerender(grid({experiment: `JGI-SB-4`, rowFactor: `organism part`, columnFactor: `cultivar`}))
    expect(screen.getByRole(`combobox`, {name: `Columns`})).toHaveValue(`cultivar`)
    expect(columnLabels(table)).toEqual([`BTx623`, `TX08001`])

    // not factors of this study: the defaults
    rerender(grid({experiment: `JGI-SB-4`, rowFactor: `sampling site`, columnFactor: `growth condition`}))
    expect(screen.getByRole(`combobox`, {name: `Rows`})).toHaveValue(`developmental stage`)
    expect(screen.getByRole(`combobox`, {name: `Columns`})).toHaveValue(`organism part`)
  })

  it(`draws one row, labelled with the gene id, for a study with one factor`, async () => {
    answerWithFixtures()
    const {container} = render(grid({experiment: `E-CURD-25`, gene: `SORBI_3001G000400`, rowFactor: `organism part`}))
    const table = await findTable()
    expect(rowLabels(table)).toEqual([`SORBI_3001G000400`])
    expect(columnLabels(table)).toHaveLength(4)
    expect(bands(container)).toHaveLength(4)
    expect(screen.queryByRole(`button`, {name: `Swap rows and columns`})).toBeNull()
    expect(screen.queryByRole(`combobox`)).toBeNull()
    // the gene's own row of the payload
    const values = curd25.body.profiles.rows[1].expressions.map(expression => `${expression.value} TPM`)
    expect(bands(container).map(band => band.getAttribute(`aria-label`).split(`, `).pop()).sort())
      .toEqual([...values].sort())
  })

  describe.each([
    [`without StrictMode`, element => element],
    [`under StrictMode`, element => <StrictMode>{element}</StrictMode>]
  ])(`an unknown gene (%s)`, (_, wrap) => {
    it(`shows the error alert and calls fail exactly once`, async () => {
      answerWithFixtures()
      const fail = vi.fn()
      const resolveUrl = vi.fn(() => undefined)
      render(wrap(grid({gene: `NOT_A_REAL_GENE`, fail, linkTarget: `gxa`, resolveUrl})))

      const alert = await screen.findByRole(`alert`)
      expect(alert).toHaveClass(`alert-danger`)
      expect(alert.querySelector(`code`)).toHaveTextContent(`Error: Internal Server Error`)
      expect(within(alert).getByRole(`link`)).toHaveAttribute(`target`, `gxa`)
      expect(resolveUrl).toHaveBeenCalledWith(`support`, `https://www.ebi.ac.uk/support/gxa`,
        expect.objectContaining({experiment: `JGI-SB-1`, query: {gene: `NOT_A_REAL_GENE`}}))

      await waitFor(() => expect(fail).toHaveBeenCalled())
      await act(() => new Promise(resolve => setTimeout(resolve, 100)))
      expect(fail).toHaveBeenCalledTimes(1)
      expect(fail).toHaveBeenCalledWith({
        url: `${SORGHUM_V11}json/experiments/JGI-SB-1`, method: `POST`, message: `Internal Server Error`
      })
    })
  })

  it(`shows an alert and calls fail once when drawing the grid throws`, async () => {
    allowConsole()   // React reports the error it caught
    mockFetch(() => ({body: {...sb1.body, config: undefined}}))
    const fail = vi.fn()
    render(grid({fail}))
    const alert = await screen.findByRole(`alert`)
    expect(alert).toHaveTextContent(`There was a problem displaying the expression data.`)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({url: `${SORGHUM_V11}json/experiments/JGI-SB-1`, method: `POST`}))
  })

  it(`says there are no results for a payload without rows, and draws no differential experiment`, async () => {
    mockFetch(() => ({body: {...sb1.body, profiles: {rows: [], searchResultTotal: `0`}}}))
    const {unmount} = render(grid())
    expect(await screen.findByRole(`alert`)).toHaveTextContent(`Sorry, no results could be found matching your query.`)
    unmount()

    answerWithFixtures()
    render(grid({experiment: `E-GEOD-30249`, gene: `SORBI_3001G000200`}))
    expect(await screen.findByRole(`alert`)).toHaveTextContent(`The factor grid shows baseline experiments only.`)
    expect(screen.queryByRole(`table`)).toBeNull()
  })

  it(`fetches nothing without an experiment, and again for a new gene or experiment only`, async () => {
    const fetchMock = answerWithFixtures()
    const {container, rerender} = render(
      <ExpressionFactorGrid atlasUrl={SORGHUM_V11} experiment={``} gene={MSD2} />)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.firstChild).toBeEmptyDOMElement()

    rerender(grid())
    await findTable()
    rerender(grid({linkTarget: `_self`}))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    rerender(grid({experiment: `JGI-SB-4`}))
    await waitFor(() => expect(screen.getByRole(`combobox`, {name: `Rows`})).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(`${SORGHUM_V11}json/experiments/JGI-SB-4`)
  })
})
