import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Container from '../../src/layout/Container.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'

// The chart is drawn elsewhere; ChartContainer records the chart data it is given.
const chartRenders = vi.hoisted(() => [])
vi.mock(`../../src/manipulate/ChartContainer.js`, () => ({
  default: ({chartData}) => {
    chartRenders.push(chartData)
    return <div data-testid={`chart`} />
  }
}))

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

const containerProps = (fixture, overrides = {}) => ({
  data: fixture.body,
  inProxy: ``,
  outProxy: ``,
  atlasUrl: ATLAS_URL,
  showAnatomogram: true,
  showControlMenu: true,
  isWidget: true,
  linkTarget: `_blank`,
  ...overrides
})

const lastChartData = () => chartRenders[chartRenders.length - 1]
const link = name => screen.getByRole(`link`, {name})

beforeEach(() => {
  chartRenders.length = 0
})

describe(`Container`, () => {
  describe(`a single experiment (Paralogs, E-CURD-25)`, () => {
    it(`links the description and the footer, in a new tab`, () => {
      render(<Container {...containerProps(curd25)} />)
      const mainPage = new URL(curd25.body.experiment.urls.main_page, ATLAS_URL).href

      const description = link(curd25.body.experiment.description)
      expect(description).toHaveAttribute(`href`, mainPage)
      expect(link(`Expression Atlas`)).toHaveAttribute(`href`, ATLAS_URL)
      expect(link(`here`)).toHaveAttribute(`href`, mainPage)
      expect(link(`the EBI Support & feedback form`)).toHaveAttribute(`href`, `https://www.ebi.ac.uk/support/gxa`)

      for (const a of screen.getAllByRole(`link`)) {
        expect(a).toHaveAttribute(`target`, `_blank`)
        expect(a).toHaveAttribute(`rel`, `noopener noreferrer`)
        expect(a.style.textDecoration).toBe(`none`)
      }
    })

    it(`asks urlFor about every link, with the experiment accession`, () => {
      const urlFor = vi.fn((kind, url) => (kind === `atlas` ? `https://www.ebi.ac.uk/gxa/` : undefined) || url)
      render(<Container {...containerProps(curd25, {urlFor, outProxy: `https://proxy.example/?`})} />)
      const mainPage = `https://proxy.example/?${new URL(curd25.body.experiment.urls.main_page, ATLAS_URL).href}`

      expect(urlFor).toHaveBeenCalledWith(`experiment`, mainPage, {experiment: `E-CURD-25`})
      expect(urlFor).toHaveBeenCalledWith(`atlas`, `https://proxy.example/?${ATLAS_URL}`, {experiment: `E-CURD-25`})
      expect(urlFor).toHaveBeenCalledWith(`moreInformation`, mainPage, {experiment: `E-CURD-25`, config: curd25.body.config})
      expect(urlFor).toHaveBeenCalledWith(`support`, `https://www.ebi.ac.uk/support/gxa`, {experiment: `E-CURD-25`})
      expect(link(`Expression Atlas`)).toHaveAttribute(`href`, `https://www.ebi.ac.uk/gxa/`)

      // the chart gets the same urlFor, which adds the accession to its context too
      const {heatmapConfig} = lastChartData()
      expect(heatmapConfig.linkTarget).toBe(`_blank`)
      heatmapConfig.urlFor(`genomeBrowser`, `u`, {geneId: `g`})
      expect(urlFor).toHaveBeenLastCalledWith(`genomeBrowser`, `u`, {experiment: `E-CURD-25`, geneId: `g`})
    })

    it(`renders plain text where urlFor suppresses a link`, () => {
      const {container} = render(<Container {...containerProps(curd25, {urlFor: () => null})} />)
      expect(screen.queryAllByRole(`link`)).toEqual([])
      expect(screen.getByText(curd25.body.experiment.description)).toBeInTheDocument()
      const footer = container.firstChild.lastChild
      expect(footer).toHaveTextContent(/^This page is a summary of the data held in Expression Atlas for this gene\.$/)
    })
  })

  describe(`All Studies`, () => {
    it(`has no description and points “here” at the atlas query page`, () => {
      const urlFor = vi.fn((kind, url) => url)
      render(<Container {...containerProps(allStudies, {urlFor})} />)
      expect(screen.getAllByRole(`link`)).toHaveLength(3)
      const {geneQuery, conditionQuery, species} = allStudies.body.config
      const here = link(`here`).getAttribute(`href`)
      expect(here.startsWith(`${ATLAS_URL}query?`)).toBe(true)
      expect(new URL(here).searchParams.get(`geneQuery`)).toBe(geneQuery)
      expect(new URL(here).searchParams.get(`conditionQuery`)).toBe(conditionQuery)
      expect(new URL(here).searchParams.get(`species`)).toBe(species)
      expect(urlFor).toHaveBeenCalledWith(`moreInformation`, here, {experiment: null, config: allStudies.body.config})
    })

    it(`hides the description and footer outside widgets`, () => {
      render(<Container {...containerProps(allStudies, {isWidget: false})} />)
      expect(screen.queryAllByRole(`link`)).toEqual([])
      expect(screen.getByTestId(`chart`)).toBeInTheDocument()
    })
  })

  it(`builds the chart data once per payload`, () => {
    const urlFor = (kind, url) => url
    const {rerender} = render(<Container {...containerProps(allStudies, {urlFor})} />)
    const first = lastChartData()
    expect(first.heatmapData.yAxisCategories).toHaveLength(9)

    rerender(<Container {...containerProps(allStudies, {urlFor})} />)
    expect(chartRenders).toHaveLength(2)
    expect(lastChartData()).toBe(first)

    rerender(<Container {...containerProps(curd25, {urlFor})} />)
    expect(lastChartData()).not.toBe(first)
  })

  it(`uses the link target it is given`, () => {
    render(<Container {...containerProps(curd25, {linkTarget: `_self`})} />)
    for (const a of within(document.body).getAllByRole(`link`)) {
      expect(a).toHaveAttribute(`target`, `_self`)
      expect(a).not.toHaveAttribute(`rel`)
    }
    expect(lastChartData().heatmapConfig.linkTarget).toBe(`_self`)
  })
})
