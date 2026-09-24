import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { act, render, waitFor } from '@testing-library/react'
import Highcharts from 'highcharts'
import { describe, expect, it, vi } from 'vitest'

import * as anatomogram from 'gramene-anatomogram'
import * as stub from './stubs/anatomogram.js'
import { ExpressionAtlasHeatmap } from '../src/Main.js'
import { mockFetch } from './helpers/fetch.js'
import allStudies from './fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from './fixtures/paralogs.E-CURD-25.baseline.json'

// Everywhere else the tests use the anatomogram stub (vitest.config.js aliases gramene-anatomogram to it). This file
// renders the heatmap with the real package, so that a change on either side of the contract fails a test: the props
// (species, showIds, highlightIds, onMouseOver, onMouseOut, linkTarget) and the species helpers, which the stub copies.
// gramene-anatomogram is a dependency, so the file fails when it is not installed. Until 3.0.0 is on npm, install its
// tarball: npm install --no-save ../anatomogram/gramene-anatomogram-3.0.0.tgz
// The alias would also catch `import('gramene-anatomogram')` here, so the mock imports the installed entry by its path.
// (vi.mock is hoisted above the imports, so the factory resolves the entry itself.)
vi.mock(`gramene-anatomogram`, async () => {
  const {createRequire} = await import(`node:module`)
  return import(/* @vite-ignore */ createRequire(import.meta.url).resolve(`gramene-anatomogram`))
})
const ANATOMOGRAM_ENTRY = createRequire(import.meta.url).resolve(`gramene-anatomogram`)

// The tissue ids of the sorghum whole-plant SVG, read from the package's lazy chunk for it
const sorghumWholePlantIds = () => {
  const svgDir = join(dirname(ANATOMOGRAM_ENTRY), `svg`)
  const chunks = readdirSync(svgDir).filter(name => name.startsWith(`sorghum_bicolor.whole_plant-`))
  expect(chunks).toHaveLength(1)
  return new Set(readFileSync(join(svgDir, chunks[0]), `utf8`).match(/\bPO_\d{7}\b/g))
}

const AUTH_TESTING = `https://data.sorghumbase.org/auth_testing/gxa/`
const PARALOGS = `SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`
const LEAF = `PO_0025034`
const ROOT = `PO_0009005`

const FIXTURES = [allStudies, curd25]
const answerWithFixtures = () => mockFetch((url, init) =>
  FIXTURES.find(f => url === f.base + f.path && init.body === f.body_sent) ||
  {status: 404, body: {error: `no fixture for ${url} ${init.body}`}})

const onlyChart = () => {
  const charts = Highcharts.charts.filter(Boolean)
  expect(charts).toHaveLength(1)
  return charts[0]
}
const selectedColumnIds = chart =>
  [...new Set(chart.getSelectedPoints().map(point => chart.xAxis[0].categories[point.x].id))]

// The chart (debounced 50 ms), then the species' SVG, which gramene-anatomogram loads lazily and injects
const drawn = async container => {
  await waitFor(() => expect(container.querySelector(`.highcharts-container`)).not.toBeNull())
  await waitFor(() => expect(container.querySelector(`#LAYER_EFO`)).not.toBeNull(), {timeout: 10_000})
  return onlyChart()
}
const mouse = (element, type) => act(() => {
  element.dispatchEvent(new MouseEvent(type, {bubbles: true}))
})

describe(`with the real gramene-anatomogram`, () => {
  it(`exports what the heatmap imports, as the stub models it`, () => {
    // the real package, not the stub
    expect(Object.keys(anatomogram)).not.toContain(`resetAnatomogramStub`)
    expect(Object.keys(anatomogram)).toEqual(expect.arrayContaining([`default`, `anatomogramSpecies`, `normaliseSpecies`]))
    expect(anatomogram.anatomogramSpecies).toEqual(stub.anatomogramSpecies)
    // /\s+/g: every run of any whitespace becomes one `_`
    for (const species of [
      `Sorghum bicolor`, `Sorghum  bicolor`, `Sorghum\tbicolor`, `sorghum_bicolor`, `Zea mays`, `Oryza sativa Japonica Group`,
      ` Sorghum bicolor `, ``, undefined, null,
    ]) {
      expect(anatomogram.normaliseSpecies(species)).toBe(stub.normaliseSpecies(species))
    }
    expect(anatomogram.normaliseSpecies(`Sorghum bicolor`)).toBe(`sorghum_bicolor`)
    expect(anatomogram.normaliseSpecies(`Sorghum\tbicolor`)).toBe(`sorghum_bicolor`)
    expect(anatomogram.normaliseSpecies(`Oryza sativa Japonica Group`)).toBe(`oryza_sativa_japonica_group`)
  })

  it(`All Studies: the tissues and the columns highlight each other`, async () => {
    answerWithFixtures()
    const {container} = render(
      <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `SORBI_3001G000200`}} experiment={false} />)
    const chart = await drawn(container)

    // the real anatomogram, not the stub, has injected the sorghum whole-plant SVG
    expect(container.querySelector(`[data-testid="anatomogram-stub"]`)).toBeNull()
    const svg = container.querySelector(`.gxa-anatomogram svg.injected-svg`)
    expect(svg).not.toBeNull()
    expect(svg.querySelector(`#LAYER_EFO #${LEAF}`)).not.toBeNull()
    const injectedIds = new Set([...svg.querySelectorAll(`#LAYER_EFO [id^="PO_"]`)].map(element => element.id))
    expect(injectedIds).toEqual(sorghumWholePlantIds())
    expect(container.querySelector(`.gxa-anatomogram-switcher [aria-pressed="true"]`)).toHaveAttribute(`title`, `whole plant`)

    // the SVG's licence link follows linkTarget
    const svgLinks = [...container.querySelectorAll(`svg a`)]
    expect(svgLinks.length).toBeGreaterThan(0)
    for (const link of svgLinks) {
      expect(link).toHaveAttribute(`target`, `_blank`)
    }

    // anatomogram -> heatmap: the leaf selects the leaf column
    const leaf = container.querySelector(`#${LEAF}`)
    mouse(leaf, `mouseover`)
    await waitFor(() => expect(selectedColumnIds(chart)).toEqual([LEAF]))
    mouse(leaf, `mouseout`)
    await waitFor(() => expect(chart.getSelectedPoints()).toHaveLength(0))

    // heatmap -> anatomogram: a leaf cell paints the leaf in the highlight colour
    const leafColumn = chart.xAxis[0].categories.findIndex(category => category.id === LEAF)
    const leafCell = chart.series.flatMap(series => series.points).find(point => point.x === leafColumn)
    act(() => leafCell.firePointEvent(`mouseOver`))
    await waitFor(() => expect(container.querySelector(`#${LEAF}`).style.getPropertyValue(`fill`)).toBe(`red`))
    act(() => leafCell.firePointEvent(`mouseOut`))
    await waitFor(() => expect(container.querySelector(`#${LEAF}`).style.getPropertyValue(`fill`)).not.toBe(`red`))
  })

  it(`E-CURD-25: the display-name species reaches the anatomogram normalised, and its root selects the root column`, async () => {
    answerWithFixtures()
    const {container} = render(
      <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: PARALOGS}} experiment={`E-CURD-25`} />)
    const chart = await drawn(container)

    const root = container.querySelector(`#${ROOT}`)
    expect(root).not.toBeNull()
    mouse(root, `mouseover`)
    await waitFor(() => expect(selectedColumnIds(chart)).toEqual([ROOT]))
    mouse(root, `mouseout`)
    await waitFor(() => expect(chart.getSelectedPoints()).toHaveLength(0))
  })
})
