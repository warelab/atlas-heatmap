import { StrictMode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ContainerLoader from '../../src/layout/ContainerLoader.js'
import { buildSource } from '../../src/layout/request.js'
import { mockFetch, responseFor } from '../helpers/fetch.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import unknownGene from '../fixtures/error.unknown-gene.json'

// The chart itself is out of scope here: Container records its props.
const containerRenders = vi.hoisted(() => [])
vi.mock(`../../src/layout/Container.js`, () => ({
  default: props => {
    containerRenders.push(props)
    return <div data-testid={`container`}>{props.data.profiles.rows.length} rows</div>
  }
}))

const ATLAS_URL = `https://data.sorghumbase.org/auth_testing/gxa/`

const loaderProps = (overrides = {}) => ({
  inProxy: ``,
  outProxy: ``,
  atlasUrl: ATLAS_URL,
  showAnatomogram: true,
  isWidget: true,
  showControlMenu: true,
  linkTarget: `_blank`,
  source: buildSource({query: {gene: `SORBI_3001G000200`}, experiment: false}),
  ...overrides
})

beforeEach(() => {
  containerRenders.length = 0
})

describe(`ContainerLoader`, () => {
  it(`shows a spinner, then the Container with the payload`, async () => {
    const fetchMock = mockFetch(() => allStudies)
    const urlFor = vi.fn((kind, url) => url)
    render(<ContainerLoader {...loaderProps({urlFor})} />)

    const status = screen.getByRole(`status`)
    expect(status).toHaveTextContent(`Loading expression data…`)
    expect(status.querySelector(`.spinner-border`)).not.toBeNull()
    expect(document.querySelector(`img`)).toBeNull()   // no more loading.gif

    expect(await screen.findByTestId(`container`)).toHaveTextContent(`9 rows`)
    expect(screen.queryByRole(`status`)).toBeNull()
    const props = containerRenders[containerRenders.length - 1]
    expect(props.data).toEqual(allStudies.body)
    expect(props).toMatchObject({atlasUrl: ATLAS_URL, linkTarget: `_blank`, urlFor, isWidget: true})

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`${ATLAS_URL}json/baseline_experiments`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: `POST`,
      body: `geneQuery=SORBI_3001G000200`,
      headers: {'Content-Type': `application/x-www-form-urlencoded`}
    })
  })

  it(`does not refetch when re-rendered with an equal source`, async () => {
    const fetchMock = mockFetch(() => allStudies)
    const {rerender} = render(<ContainerLoader {...loaderProps()} />)
    await screen.findByTestId(`container`)
    rerender(<ContainerLoader {...loaderProps()} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId(`container`)).toBeInTheDocument()
  })

  describe(`on a failed request`, () => {
    it(`shows an RB2 danger alert without the third-party link, and calls fail once`, async () => {
      mockFetch(() => unknownGene)
      const fail = vi.fn()
      const {rerender} = render(<ContainerLoader {...loaderProps({fail, source: buildSource({query: {gene: `NOT_A_REAL_GENE`}})})} />)

      const alert = await screen.findByRole(`alert`)
      expect(alert).toHaveClass(`alert`, `alert-danger`)
      expect(within(alert).getByText(`Oops!`)).toBeInTheDocument()
      expect(alert).toHaveTextContent(`There was a problem contacting the Expression Atlas server.`)
      expect(alert).toHaveTextContent(`You may also try reloading the page.`)
      expect(alert.querySelector(`code`)).toHaveTextContent(`Error: Internal Server Error`)
      expect(alert.innerHTML).not.toMatch(/topwallpaperpc/)

      const support = within(alert).getByRole(`link`)
      expect(support).toHaveAttribute(`href`, `https://www.ebi.ac.uk/support/gxa`)
      expect(support).toHaveAttribute(`target`, `_blank`)
      expect(support).toHaveAttribute(`rel`, `noopener noreferrer`)

      expect(fail).toHaveBeenCalledTimes(1)
      expect(fail).toHaveBeenCalledWith({
        url: `${ATLAS_URL}json/baseline_experiments`,
        method: `POST`,
        message: `Internal Server Error`
      })

      // upstream called fail on every render
      rerender(<ContainerLoader {...loaderProps({fail, source: buildSource({query: {gene: `NOT_A_REAL_GENE`}})})} />)
      expect(fail).toHaveBeenCalledTimes(1)
    })

    it(`calls fail once under StrictMode too`, async () => {
      mockFetch(() => unknownGene)
      const fail = vi.fn()
      render(
        <StrictMode>
          <ContainerLoader {...loaderProps({fail})} />
        </StrictMode>)
      await screen.findByRole(`alert`)
      await waitFor(() => expect(fail).toHaveBeenCalled())
      expect(fail).toHaveBeenCalledTimes(1)
    })

    it(`reports an empty payload as a failed request (as upstream)`, async () => {
      mockFetch(() => responseFor({body: ``, headers: {'content-length': `0`}}))
      const fail = vi.fn()
      render(<ContainerLoader {...loaderProps({fail})} />)
      const alert = await screen.findByRole(`alert`)
      expect(alert.querySelector(`code`))
        .toHaveTextContent(`Error: request to ${ATLAS_URL}json/baseline_experiments failed`)
      expect(fail).toHaveBeenCalledWith(expect.objectContaining({
        message: `request to ${ATLAS_URL}json/baseline_experiments failed`
      }))
    })

    it(`reports a payload with an error field`, async () => {
      mockFetch(() => ({body: {error: `Experiment not found`}}))
      const fail = vi.fn()
      render(<ContainerLoader {...loaderProps({fail})} />)
      expect((await screen.findByRole(`alert`)).querySelector(`code`)).toHaveTextContent(`Error: Experiment not found`)
      expect(fail).toHaveBeenCalledTimes(1)
    })

    it(`drops the support sentence when resolveUrl suppresses it, and honours linkTarget`, async () => {
      mockFetch(() => unknownGene)
      const urlFor = (kind, url) => (kind === `support` ? null : url)
      const {unmount} = render(<ContainerLoader {...loaderProps({urlFor})} />)
      const alert = await screen.findByRole(`alert`)
      expect(within(alert).queryByRole(`link`)).toBeNull()
      expect(alert).not.toHaveTextContent(`EBI Support`)
      unmount()

      render(<ContainerLoader {...loaderProps({linkTarget: `gxa`})} />)
      const link = within(await screen.findByRole(`alert`)).getByRole(`link`)
      expect(link).toHaveAttribute(`target`, `gxa`)
      expect(link).not.toHaveAttribute(`rel`)
    })

    it(`goes back to the spinner and fetches again for a new query`, async () => {
      const fetchMock = mockFetch((url, init) => init.body.includes(`NOT_A_REAL_GENE`) ? unknownGene : allStudies)
      const fail = vi.fn()
      const {rerender} = render(<ContainerLoader {...loaderProps({fail, source: buildSource({query: {gene: `NOT_A_REAL_GENE`}})})} />)
      await screen.findByRole(`alert`)
      rerender(<ContainerLoader {...loaderProps({fail})} />)
      expect(screen.getByRole(`status`)).toBeInTheDocument()
      expect(await screen.findByTestId(`container`)).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fail).toHaveBeenCalledTimes(1)
    })
  })

  it(`shows an info alert, and does not call fail, when the payload has no profiles`, async () => {
    mockFetch(() => ({body: {config: {}}}))
    const fail = vi.fn()
    render(<ContainerLoader {...loaderProps({fail})} />)
    const alert = await screen.findByRole(`alert`)
    expect(alert).toHaveClass(`alert-info`)
    expect(alert).toHaveTextContent(`Sorry, no results could be found matching your query.`)
    expect(alert.querySelector(`code`)).toBeNull()
    expect(fail).not.toHaveBeenCalled()
  })
})
