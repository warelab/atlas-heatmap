import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ExpressionAtlasHeatmapDefault, {
  DEFAULT_OPTIONS, ExpressionAtlasHeatmap, ExpressionFactorGrid, render as renderHeatmap
} from '../src/Main.js'
import GridComponent, { GRID_DEFAULTS } from '../src/grid/ExpressionFactorGrid.js'
import { allowConsole } from './consoleGuard.js'
import { mockFetch } from './helpers/fetch.js'
import allStudies from './fixtures/all-studies.SORBI_3001G000200.json'
import curd25 from './fixtures/paralogs.E-CURD-25.baseline.json'
import unknownGene from './fixtures/error.unknown-gene.json'

// Container (and so the chart) is replaced by a recorder; `crash` makes it throw to exercise the error boundary.
const recorded = vi.hoisted(() => ({renders: [], crash: null}))
vi.mock(`./../src/layout/Container.js`, () => ({
  default: props => {
    recorded.renders.push(props)
    if (recorded.crash) {
      throw recorded.crash
    }
    return <div data-testid={`container`}>{props.data.profiles.rows.length} rows</div>
  }
}))

const AUTH_TESTING = `https://data.sorghumbase.org/auth_testing/gxa/`
const lastContainerProps = () => recorded.renders[recorded.renders.length - 1]
const answerWithFixtures = () => mockFetch((url, init) =>
  url.endsWith(`json/experiments/E-CURD-25`) ? curd25 : init.body.includes(`NOT_A_REAL_GENE`) ? unknownGene : allStudies)

beforeEach(() => {
  recorded.renders.length = 0
  recorded.crash = null
})

describe(`ExpressionAtlasHeatmap`, () => {
  it(`is both the default and a named export; DEFAULT_OPTIONS is frozen`, () => {
    expect(ExpressionAtlasHeatmapDefault).toBe(ExpressionAtlasHeatmap)
    expect(Object.isFrozen(DEFAULT_OPTIONS)).toBe(true)
    expect(DEFAULT_OPTIONS).toEqual({
      showAnatomogram: true,
      isWidget: true,
      showControlMenu: true,
      atlasUrl: `https://www.ebi.ac.uk/gxa/`,
      inProxy: ``,
      outProxy: ``,
      experiment: ``,
      linkTarget: `_blank`,
      injectStyles: true
    })
  })

  it(`exports ExpressionFactorGrid, whose defaults are the heatmap's`, () => {
    expect(ExpressionFactorGrid).toBe(GridComponent)
    expect(GRID_DEFAULTS).toEqual({
      atlasUrl: DEFAULT_OPTIONS.atlasUrl, inProxy: ``, linkTarget: DEFAULT_OPTIONS.linkTarget, injectStyles: true
    })
    expect(Object.isFrozen(GRID_DEFAULTS)).toBe(true)
  })

  it(`fetches All Studies and hands the Container the payload and the defaults`, async () => {
    const fetchMock = answerWithFixtures()
    const {container} = render(
      <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `SORBI_3001G000200`}} experiment={false}
        className={`my-heatmap`} style={{minHeight: `100px`}} disableGoogleAnalytics />)

    const root = container.firstChild
    expect(root).toHaveClass(`gxaHeatmapContainer`, `my-heatmap`)
    expect(root.style.minHeight).toBe(`100px`)

    expect(await screen.findByTestId(`container`)).toHaveTextContent(`9 rows`)
    expect(fetchMock).toHaveBeenCalledWith(`${AUTH_TESTING}json/baseline_experiments`,
      expect.objectContaining({method: `POST`, body: `geneQuery=SORBI_3001G000200`}))
    expect(lastContainerProps()).toMatchObject({
      atlasUrl: AUTH_TESTING, inProxy: ``, outProxy: ``,
      showAnatomogram: true, isWidget: true, showControlMenu: true, linkTarget: `_blank`
    })
  })

  it(`adds a trailing slash to atlasUrl, and keeps the default for an undefined one`, async () => {
    const fetchMock = answerWithFixtures()
    const {unmount} = render(<ExpressionAtlasHeatmap atlasUrl={`https://data.sorghumbase.org/sorghum_v11/gxa`} query={{gene: `A`}} />)
    await screen.findByTestId(`container`)
    expect(fetchMock.mock.calls[0][0]).toBe(`https://data.sorghumbase.org/sorghum_v11/gxa/json/baseline_experiments`)
    expect(lastContainerProps().atlasUrl).toBe(`https://data.sorghumbase.org/sorghum_v11/gxa/`)
    unmount()

    render(<ExpressionAtlasHeatmap atlasUrl={undefined} linkTarget={undefined} query={{gene: `A`}} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1][0]).toBe(`https://www.ebi.ac.uk/gxa/json/baseline_experiments`)
    await screen.findByTestId(`container`)
    expect(lastContainerProps().linkTarget).toBe(`_blank`)
  })

  it(`fetches a single experiment`, async () => {
    const fetchMock = answerWithFixtures()
    const genes = `SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`
    render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: genes}} experiment={`E-CURD-25`} />)
    expect(await screen.findByTestId(`container`)).toHaveTextContent(`3 rows`)
    expect(fetchMock.mock.calls[0]).toEqual([`${AUTH_TESTING}json/experiments/E-CURD-25`, expect.objectContaining({
      body: `geneQuery=${genes}`
    })])
  })

  describe(`resolveUrl`, () => {
    it(`overrides (string), suppresses (null) or keeps (undefined) each link, with {query, experiment}`, async () => {
      answerWithFixtures()
      const query = {gene: `SORBI_3001G000200`}
      const resolveUrl = vi.fn(kind => ({row: `https://example.org/row`, atlas: null})[kind])
      render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={query} experiment={false} resolveUrl={resolveUrl} />)
      await screen.findByTestId(`container`)
      const {urlFor} = lastContainerProps()

      expect(urlFor(`row`, `default`, {row: {id: `E-CURD-25`}})).toBe(`https://example.org/row`)
      expect(resolveUrl).toHaveBeenLastCalledWith(`row`, `default`, {query, experiment: null, row: {id: `E-CURD-25`}})
      expect(urlFor(`atlas`, `default`, {})).toBeNull()
      expect(urlFor(`support`, `default`, {})).toBe(`default`)
    })

    it(`is read through a ref: a new function keeps urlFor (and so the chart) and is used from then on`, async () => {
      answerWithFixtures()
      const first = vi.fn(() => `first`)
      const second = vi.fn(() => `second`)
      const {rerender} = render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `A`}} resolveUrl={first} />)
      await screen.findByTestId(`container`)
      const {urlFor, data} = lastContainerProps()

      rerender(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `A`}} resolveUrl={second} />)
      expect(lastContainerProps().urlFor).toBe(urlFor)
      expect(lastContainerProps().data).toBe(data)
      expect(urlFor(`row`, `default`, {})).toBe(`second`)
      expect(first).not.toHaveBeenCalled()
    })

    it(`keeps every default without a resolveUrl`, async () => {
      answerWithFixtures()
      render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `A`}} />)
      await screen.findByTestId(`container`)
      expect(lastContainerProps().urlFor(`download`, `https://x/`, {})).toBe(`https://x/`)
    })
  })

  describe(`a render error`, () => {
    // jsdom would print the error React rethrows in development; handling the window error event keeps the run quiet
    const quiet = event => event.preventDefault()
    beforeEach(() => window.addEventListener(`error`, quiet))
    afterEach(() => window.removeEventListener(`error`, quiet))

    it(`shows an alert instead of unmounting the page, and calls fail once`, async () => {
      allowConsole()   // React logs the caught error
      answerWithFixtures()
      recorded.crash = new TypeError(`Cannot read properties of undefined`)
      const fail = vi.fn()
      render(
        <StrictMode>
          <p>host page</p>
          <ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `A`}} fail={fail} />
        </StrictMode>)

      const alert = await screen.findByRole(`alert`)
      expect(alert).toHaveTextContent(`Oops!`)
      expect(alert).toHaveTextContent(`There was a problem displaying the expression data.`)
      expect(alert.querySelector(`code`)).toHaveTextContent(`TypeError: Cannot read properties of undefined`)
      expect(screen.getByText(`host page`)).toBeInTheDocument()
      expect(fail).toHaveBeenCalledTimes(1)
      expect(fail).toHaveBeenCalledWith({
        url: `${AUTH_TESTING}json/baseline_experiments`,
        method: `POST`,
        message: `Cannot read properties of undefined`
      })
    })

    it(`recovers with a new query`, async () => {
      allowConsole()
      answerWithFixtures()
      recorded.crash = new Error(`boom`)
      const {rerender} = render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `A`}} />)
      await screen.findByRole(`alert`)
      recorded.crash = null
      rerender(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `B`}} />)
      expect(await screen.findByTestId(`container`)).toBeInTheDocument()
      expect(screen.queryByRole(`alert`)).toBeNull()
    })
  })

  it(`reports a failed request through fail, once`, async () => {
    answerWithFixtures()
    const fail = vi.fn()
    render(<ExpressionAtlasHeatmap atlasUrl={AUTH_TESTING} query={{gene: `NOT_A_REAL_GENE`}} fail={fail} />)
    await screen.findByRole(`alert`)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(fail.mock.calls[0][0]).toEqual({
      url: `${AUTH_TESTING}json/baseline_experiments`, method: `POST`, message: `Internal Server Error`
    })
  })
})

describe(`render()`, () => {
  it(`mounts into an element id with createRoot, reuses the root, fires the callback per call and unmounts`, async () => {
    answerWithFixtures()
    const target = document.createElement(`div`)
    target.id = `heatmap-target`
    document.body.appendChild(target)
    const afterRender = vi.fn()

    let handle
    await act(async () => {
      handle = renderHeatmap({target: `heatmap-target`, render: afterRender, disableGoogleAnalytics: false,
        atlasUrl: AUTH_TESTING, query: {gene: `SORBI_3001G000200`}})
    })
    expect(afterRender).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(target.querySelector(`[data-testid=container]`)).not.toBeNull())
    expect(afterRender).toHaveBeenCalledTimes(1)   // not on the Container's own updates
    expect(target.querySelectorAll(`.gxaHeatmapContainer`)).toHaveLength(1)

    await act(async () => {
      renderHeatmap({target, render: afterRender, atlasUrl: AUTH_TESTING, query: {gene: `SORBI_3001G000200`}, className: `again`})
    })
    expect(afterRender).toHaveBeenCalledTimes(2)
    expect(target.querySelectorAll(`.gxaHeatmapContainer`)).toHaveLength(1)
    expect(target.querySelector(`.gxaHeatmapContainer`)).toHaveClass(`again`)

    await act(async () => handle.unmount())
    expect(target.innerHTML).toBe(``)
    target.remove()
  })

  it(`throws a clear error for a missing target`, () => {
    expect(() => renderHeatmap({target: `no-such-element`})).toThrow(/#no-such-element is not an element/)
    expect(() => renderHeatmap({})).toThrow(/not an element/)
  })
})
