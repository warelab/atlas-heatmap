import { describe, expect, it, vi } from 'vitest'

import makeEventCallbacks, { htmlToText, rowIndexFromLabel } from '../../src/manipulate/Events.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

const load = (fixture, options = {}) => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: ATLAS_URL,
  showAnatomogram: true, showControlMenu: true, isWidget: true, ...options
})

const callbacksFor = (fixture, options) => {
  const {heatmapData, heatmapConfig} = load(fixture, options)
  const onSelectOntologyIds = vi.fn()
  return {heatmapData, onSelectOntologyIds, events: makeEventCallbacks({heatmapData, heatmapConfig, onSelectOntologyIds})}
}

// What the upstream y-axis formatter renders for an All Studies row: the T badge is part of the label's text.
const badgedLabel = (label, pos) =>
  `<span title=""${pos === undefined ? `` : ` data-gxa-y="${pos}"`}><a href="https://www.ebi.ac.uk/gxa/experiments/E-CURD-25" ` +
  `style="border:none;color:#148ff3"><div title="Transcriptomics experiment">T</div>${label}</a></span>`

describe(`htmlToText`, () => {
  it(`returns the text of a label with entities decoded`, () => {
    expect(htmlToText(`<span title="x &quot;y&quot;"><a href="#">A &amp; B &lt;C&gt;</a><em>\tD</em></span>`))
      .toBe(`A & B <C>\tD`)
  })

  it(`parses into an inert document`, () => {
    window.__gxaInjected = undefined
    expect(htmlToText(`<img src="x" onerror="window.__gxaInjected = true">text`)).toBe(`text`)
    expect(window.__gxaInjected).toBeUndefined()
  })
})

describe(`rowIndexFromLabel`, () => {
  const rows = [{label: `SORBI_3001G000200`}, {label: `Tissues - Olson et al`}, {label: `x`.repeat(60)}]

  it(`reads the row from data-gxa-y, whatever the label text`, () => {
    expect(rowIndexFromLabel(badgedLabel(`Tissues - Olson et al`, 1), rows)).toBe(1)
    expect(rowIndexFromLabel(badgedLabel(`${`x`.repeat(39)}…`, 2), rows)).toBe(2)
  })

  it(`falls back to an exact text match without a usable data-gxa-y`, () => {
    expect(rowIndexFromLabel(`<span><a href="#">SORBI_3001G000200</a></span>`, rows)).toBe(0)
    expect(rowIndexFromLabel(`<span data-gxa-y="7"><a href="#">SORBI_3001G000200</a></span>`, rows)).toBe(0)
    // The upstream text match: a badge (or a trimmed label) never matches
    expect(rowIndexFromLabel(badgedLabel(`Tissues - Olson et al`), rows)).toBe(-1)
  })

  it(`ignores data-gxa-y inside the label text`, () => {
    expect(rowIndexFromLabel(`<span><a href="#">data-gxa-y=&quot;1&quot;</a></span>`, rows)).toBe(-1)
  })
})

describe(`makeEventCallbacks`, () => {
  describe(`All Studies`, () => {
    const {heatmapData, onSelectOntologyIds, events} = callbacksFor(allStudies)
    const {columnHeaders, profiles: {rows}} = allStudies.body
    const idsOfExpressedColumns = row =>
      [...new Set(row.expressions
        .map((expression, x) => expression.value ? columnHeaders[x].factorValueOntologyTermId || `` : null)
        .filter(id => id !== null))]

    it(`selects the tissues of a hovered row label, even with the experiment badge`, () => {
      const y = rows.findIndex(row => row.name === `Tissues - Olson et al`)
      events.onHoverRowLabel(badgedLabel(heatmapData.yAxisCategories[y].label, y))
      const [ids] = onSelectOntologyIds.mock.lastCall
      expect([...ids].sort()).toEqual(idsOfExpressedColumns(rows[y]).sort())
      expect(ids).toContain(`PO_0009005`)  // root
    })

    it(`selects the tissue of a hovered column label or cell`, () => {
      events.onHoverColumnLabel(`leaf`)
      expect(onSelectOntologyIds).toHaveBeenLastCalledWith([`PO_0025034`])
      events.onHoverPoint(heatmapData.xAxisCategories.findIndex(category => category.label === `root`))
      expect(onSelectOntologyIds).toHaveBeenLastCalledWith([`PO_0009005`])
      events.onHoverOff()
      expect(onSelectOntologyIds).toHaveBeenLastCalledWith([])
    })

    it(`has no cell click without an experiment`, () => {
      expect(events.onClick).toBeUndefined()
    })
  })

  describe(`differential cell click`, () => {
    const redirect =
      `https://www.ebi.ac.uk/gxa/experiments/E-GEOD-30249/redirect/genome-browsers` +
      `?experimentAccession=E-GEOD-30249&name=ensemblgenomes&geneId=SORBI_3001G000200&trackId=g5_g1`

    it(`opens the genome browser redirect in a new tab`, () => {
      callbacksFor(geod30249).events.onClick(0, 0, `ensemblgenomes`)
      expect(window.open).toHaveBeenCalledTimes(1)
      expect(window.open).toHaveBeenCalledWith(redirect, `_blank`, `noopener,noreferrer`)
    })

    it(`prefixes the outbound proxy and honours linkTarget`, () => {
      callbacksFor(geod30249, {outProxy: `/out?`, linkTarget: `_self`}).events.onClick(0, 0, `ensemblgenomes`)
      expect(window.open).toHaveBeenCalledWith(`/out?${redirect}`, `_self`, undefined)
    })

    it(`lets urlFor replace or suppress the link`, () => {
      const urlFor = vi.fn(() => `https://example.org/browser`)
      callbacksFor(geod30249, {urlFor}).events.onClick(1, 1, `ensemblgenomes`)
      expect(urlFor).toHaveBeenCalledWith(`genomeBrowser`, expect.stringContaining(`geneId=SORBI_3001G000400`),
        {genomeBrowser: `ensemblgenomes`, geneId: `SORBI_3001G000400`, trackId: `g7_g3`})
      expect(window.open).toHaveBeenCalledWith(`https://example.org/browser`, `_blank`, `noopener,noreferrer`)

      window.open.mockClear()
      callbacksFor(geod30249, {urlFor: () => null}).events.onClick(0, 0, `ensemblgenomes`)
      expect(window.open).not.toHaveBeenCalled()
    })
  })
})
