import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import axesFormatters from '../../src/manipulate/formatters/axesFormatters.js'
import cellTooltipFormatter from '../../src/manipulate/formatters/heatmapCellTooltipFormatter.js'
import ScientificNotationNumber from '../../src/manipulate/formatters/ScientificNotationNumber.js'
import ExperimentIcon from '../../src/manipulate/formatters/ExperimentIcon.js'
import trimEllipsify from '../../src/manipulate/formatters/trimEllipsify.js'
import { rowIndexFromLabel } from '../../src/manipulate/Events.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

const load = (fixture, options = {}) => loadChartData({
  data: fixture.body, inProxy: ``, outProxy: ``, atlasUrl: ATLAS_URL,
  showAnatomogram: true, showControlMenu: true, isWidget: true, ...options
})

// Highcharts inserts label HTML with innerHTML; parse it the same way.
const asElement = html => {
  const container = document.createElement(`div`)
  container.innerHTML = html
  return container.firstElementChild
}

describe(`yAxisFormatter`, () => {
  it(`renders an All Studies row as a new-tab link with the T badge, tagged with its row index`, () => {
    const {heatmapData, heatmapConfig} = load(allStudies)
    const row = heatmapData.yAxisCategories[3]
    const html = axesFormatters(heatmapConfig).yAxisFormatter(row, 3)
    const label = asElement(html)

    expect(label.tagName).toBe(`SPAN`)
    expect(label.getAttribute(`data-gxa-y`)).toBe(`3`)
    const a = label.querySelector(`a`)
    expect(a.getAttribute(`href`)).toBe(row.info.url)
    expect(a.getAttribute(`target`)).toBe(`_blank`)
    expect(a.getAttribute(`rel`)).toBe(`noopener noreferrer`)
    expect(a.style.textDecoration).toBe(`none`)
    expect(a.style.color).toBe(`rgb(20, 143, 243)`)

    const badge = a.querySelector(`span[title="Transcriptomics experiment"]`)
    expect(badge.textContent).toBe(`T`)
    expect(badge.style.backgroundColor).toBe(`orangered`)
    expect(badge.style.borderRadius).toBe(`50%`)
    expect(badge.style.paddingTop).toBe(`1px`)
    expect(badge.hasAttribute(`data-toggle`)).toBe(false)
    expect(a.textContent).toBe(`T${trimEllipsify(row.label, 40)}`)

    // Events.js finds the row again from this HTML (upstream's text match never did: the badge is in the text)
    expect(rowIndexFromLabel(html, heatmapData.yAxisCategories)).toBe(3)
  })

  it(`trims long labels to 40 characters and titles them with the full text`, () => {
    const {heatmapData, heatmapConfig} = load(allStudies)
    const long = heatmapData.yAxisCategories.find(row => row.label.length > 40)
    expect(long).toBeDefined()
    const label = asElement(axesFormatters(heatmapConfig).yAxisFormatter(long, 0))
    expect(label.getAttribute(`title`)).toBe(long.label)
    expect(label.querySelector(`a`).textContent.endsWith(`…`)).toBe(true)
  })

  it(`asks urlFor for the row link, with the row's raw uri and index`, () => {
    const urlFor = vi.fn(() => `https://www.ebi.ac.uk/gxa/genes/SORBI_3001G000200`)
    const {heatmapData, heatmapConfig} = load(curd25, {urlFor, outProxy: `https://proxy.example/?`})
    const row = heatmapData.yAxisCategories[0]
    const label = asElement(axesFormatters(heatmapConfig).yAxisFormatter(row, 0))

    expect(urlFor).toHaveBeenCalledWith(`row`, `https://proxy.example/?${row.info.url}`, {
      row: {id: row.id, label: row.label, uri: row.info.uri, experimentType: row.info.experimentType, index: 0}
    })
    expect(row.info.uri).toMatch(/^genes\//)
    expect(label.querySelector(`a`).getAttribute(`href`)).toBe(`https://www.ebi.ac.uk/gxa/genes/SORBI_3001G000200`)
    // gene rows have no experiment badge
    expect(label.querySelector(`a span`)).toBeNull()
    expect(label.textContent).toBe(row.label)
  })

  it(`renders a label without a link when urlFor returns null`, () => {
    const {heatmapData, heatmapConfig} = load(curd25, {urlFor: () => null})
    const label = asElement(axesFormatters(heatmapConfig).yAxisFormatter(heatmapData.yAxisCategories[1], 1))
    expect(label.querySelector(`a`)).toBeNull()
    expect(label.querySelector(`span`).textContent).toBe(heatmapData.yAxisCategories[1].label)
    expect(label.getAttribute(`data-gxa-y`)).toBe(`1`)
  })

  it(`honours linkTarget`, () => {
    const {heatmapData, heatmapConfig} = load(curd25, {linkTarget: `_self`})
    const a = asElement(axesFormatters(heatmapConfig).yAxisFormatter(heatmapData.yAxisCategories[0], 0)).querySelector(`a`)
    expect(a.getAttribute(`target`)).toBe(`_self`)
    expect(a.hasAttribute(`rel`)).toBe(false)
  })

  it(`keeps markup in backend strings escaped (no entity decoding)`, () => {
    const {heatmapConfig} = load(allStudies)
    const hostile = {
      label: `<img src=x onerror="window.pwned=1">"quoted" & <b>bold</b>`,
      id: `E-X-1`,
      info: {url: `https://example.org/?a=1&b="2"`, uri: `x`, experimentType: `RNASEQ_MRNA_BASELINE`, designElement: `<i>de</i>`}
    }
    const html = axesFormatters(heatmapConfig).yAxisFormatter(hostile, 0)
    expect(html).toContain(`&lt;img`)
    expect(html).toContain(`&amp; &lt;b&gt;`)
    const label = asElement(html)
    expect(label.querySelector(`img`)).toBeNull()
    expect(label.querySelector(`b`)).toBeNull()
    expect(label.querySelector(`em i`)).toBeNull()
    expect(label.querySelector(`em`).textContent).toBe(`\t<i>de</i>`)
    expect(label.querySelector(`a`).getAttribute(`href`)).toBe(`https://example.org/?a=1&b="2"`)
    expect(label.getAttribute(`title`)).toBe(hostile.label)
  })

  it(`leaves data-gxa-y out when Highcharts gives no position`, () => {
    const {heatmapData, heatmapConfig} = load(curd25)
    expect(asElement(axesFormatters(heatmapConfig).yAxisFormatter(heatmapData.yAxisCategories[0])).hasAttribute(`data-gxa-y`))
      .toBe(false)
  })

  it(`labels a proteomics experiment with the P badge`, () => {
    const {heatmapConfig} = load(allStudies)
    const row = {label: `PXD000001`, id: `E-PROT-1`, info: {url: `u`, uri: `u`, experimentType: `PROTEOMICS_BASELINE`}}
    const badge = asElement(axesFormatters(heatmapConfig).yAxisFormatter(row, 0)).querySelector(`span[title="Proteomics experiment"]`)
    expect(badge.textContent).toBe(`P`)
    expect(badge.style.backgroundColor).toBe(`green`)
  })
})

describe(`xAxisFormatter`, () => {
  it(`is the column label`, () => {
    const {heatmapData, heatmapConfig} = load(allStudies)
    expect(axesFormatters(heatmapConfig).xAxisFormatter(heatmapData.xAxisCategories[0])).toBe(heatmapData.xAxisCategories[0].label)
  })
})

describe(`cellTooltipFormatter`, () => {
  const tooltipFor = (fixture, pick) => {
    const {heatmapData, heatmapConfig} = load(fixture)
    const point = heatmapData.dataSeries.flatMap(series => series.data).find(pick)
    const series = {xAxis: {categories: heatmapData.xAxisCategories}, yAxis: {categories: heatmapData.yAxisCategories}}
    return asElement(cellTooltipFormatter(heatmapConfig)(series, {x: point.x, y: point.y, value: point.value, color: `#ff0000`, options: point}))
  }

  it(`shows a differential cell with its p-value in scientific notation, in Highcharts' font`, () => {
    const tooltip = tooltipFor(geod30249, point => point.info.pValue < 1e-20)
    expect(tooltip.style.fontFamily).toMatch(/Lucida Grande/)
    expect(tooltip.textContent).toContain(`Adjusted p-value: 1.4877 × 10-26`)
    expect(tooltip.querySelector(`span[style*="vertical-align:super"], span[style*="vertical-align: super"]`).textContent).toBe(`-26`)
    expect(tooltip.textContent).toContain(`Gene name: SORBI_3001G000400`)
  })

  it(`shows a baseline cell's expression level`, () => {
    const tooltip = tooltipFor(allStudies, point => point.value === 45)
    expect(tooltip.textContent).toContain(`Expression level: 45 TPM`)
  })
})

describe(`ScientificNotationNumber`, () => {
  it(`writes small and large numbers as a power of ten, others as they are`, () => {
    const {container, rerender} = render(<ScientificNotationNumber value={0.0000123456789} />)
    expect(container.textContent).toBe(`1.2346 × 10-5`)
    rerender(<ScientificNotationNumber value={1e-7} style={{fontWeight: `bold`}} />)
    expect(container.textContent).toBe(`10-7`)
    expect(container.firstChild.style.fontWeight).toBe(`bold`)
    rerender(<ScientificNotationNumber value={0.5} />)
    expect(container.textContent).toBe(`0.5`)
    rerender(<ScientificNotationNumber value={0} />)
    expect(container.textContent).toBe(`0`)
    rerender(<ScientificNotationNumber value={123456} accuracy={2} />)
    expect(container.textContent).toBe(`1.23 × 105`)
  })
})

describe(`ExperimentIcon`, () => {
  it(`has an axis and a legend variant`, () => {
    const {container} = render(<>
      <ExperimentIcon background={`green`}>P</ExperimentIcon>
      <ExperimentIcon variant={`legend`} background={`orangered`}>T</ExperimentIcon>
    </>)
    const [axis, legend] = container.children
    expect(axis.style.paddingTop).toBe(`1px`)
    expect(axis.style.marginLeft).toBe(``)
    expect(legend.style.paddingLeft).toBe(`1px`)
    expect(legend.style.marginLeft).toBe(`10px`)
    expect(legend.style.backgroundColor).toBe(`orangered`)
  })
})
