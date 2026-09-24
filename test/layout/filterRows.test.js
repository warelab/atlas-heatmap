import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpressionAtlasHeatmap } from '../../src/Main.js'
import ContainerLoader from '../../src/layout/ContainerLoader.js'
import { applySelection, selectRows } from '../../src/layout/filterRows.js'
import { buildSource } from '../../src/layout/request.js'
import { mockFetch } from '../helpers/fetch.js'
import allStudiesV11 from '../fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'

// filterRows: rows of the fetched payload are dropped, and the columns they leave empty; nothing is fetched again.
// The chart is out of scope here: Container records its props and how often it mounts.
const recorded = vi.hoisted(() => ({renders: [], mounts: 0}))
vi.mock(`../../src/layout/Container.js`, async () => {
  const {useEffect} = await import(`react`)
  return {
    default: props => {
      recorded.renders.push(props)
      useEffect(() => {
        recorded.mounts++
      }, [])
      return <div data-testid={`container`}>{props.data.profiles.rows.length} rows</div>
    }
  }
})

const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`
const payload = allStudiesV11.body
// The JGI studies' rows of the All Studies payload: by accession, by study name, or by study name and slice
const JGI_NAMES = [`Mullet lab - developmental stages`, `Mullet lab - internode time course`, `Mullet lab - nitrogen source`,
  `Mullet lab - standard tissue panel`]
const isJgiRow = row => /^JGI-/.test(row.id) || JGI_NAMES.some(name => row.name === name || row.name.startsWith(`${name} - `))
const notJgi = row => !isJgiRow(row)
const lastData = () => recorded.renders[recorded.renders.length - 1].data
const hasValue = expression => typeof expression.value === `number`

beforeEach(() => {
  recorded.renders.length = 0
  recorded.mounts = 0
})

describe(`selectRows and applySelection`, () => {
  it(`drop the rows filterRows rejects, and the columns no row left has a value in`, () => {
    expect(payload.profiles.rows).toHaveLength(58)
    expect(payload.profiles.rows.filter(isJgiRow)).toHaveLength(49)
    const selection = selectRows(payload, notJgi)
    expect(selection.rows).toHaveLength(9)
    expect(selection.columns).toHaveLength(24)

    const filtered = applySelection(payload, selection)
    expect(filtered.profiles.rows.map(row => row.id)).toEqual(payload.profiles.rows.filter(notJgi).map(row => row.id))
    // the organism parts only JGI studies have are gone
    const labels = filtered.columnHeaders.map(header => header.factorValue)
    expect(labels).not.toContain(`leaf lamina`)
    expect(labels).not.toContain(`peduncle`)
    expect(labels).toContain(`leaf`)
    // every column keeps its values: the expressions stay aligned with the column headers
    filtered.profiles.rows.forEach(row => {
      const original = payload.profiles.rows.find(r => r.id === row.id && r.name === row.name)
      expect(row.expressions).toHaveLength(filtered.columnHeaders.length)
      row.expressions.forEach((expression, index) => {
        const originalIndex = payload.columnHeaders.indexOf(filtered.columnHeaders[index])
        expect(expression).toBe(original.expressions[originalIndex])
      })
    })
    filtered.columnHeaders.forEach((header, index) =>
      expect(filtered.profiles.rows.some(row => hasValue(row.expressions[index]))).toBe(true))
    // the total loses the rows removed, and stays a string
    expect(filtered.profiles.searchResultTotal).toBe(`9`)
    // the payload itself is untouched
    expect(payload.profiles.rows).toHaveLength(58)
    expect(payload.columnHeaders).toHaveLength(31)
    expect(filtered.config).toBe(payload.config)
    expect(filtered.anatomogram).toBe(payload.anatomogram)
  })

  it(`select nothing when every row is kept, or there is no function`, () => {
    expect(selectRows(payload, () => true)).toBeNull()
    expect(selectRows(payload, undefined)).toBeNull()
    expect(selectRows(null, notJgi)).toBeNull()
    expect(selectRows({config: {}}, notJgi)).toBeNull()
  })

  it(`keep every column when the rows left use them all, and numeric totals numeric`, () => {
    const rows = geod30249.body.profiles.rows
    const selection = selectRows(geod30249.body, row => row.id === rows[0].id)
    const filtered = applySelection(geod30249.body, selection)
    expect(filtered.profiles.rows).toHaveLength(1)
    // the differential payload's fold changes count as values
    expect(filtered.columnHeaders).toHaveLength(
      geod30249.body.columnHeaders.filter((header, index) => typeof rows[0].expressions[index].foldChange === `number`).length)
    const total = geod30249.body.profiles.searchResultTotal
    expect(filtered.profiles.searchResultTotal).toBe(typeof total === `number` ? total - (rows.length - 1) : total)

    const none = applySelection(payload, {rows: [], columns: []})
    expect(none.profiles.rows).toEqual([])
    expect(none.columnHeaders).toEqual([])
    expect(none.profiles.searchResultTotal).toBe(`0`)
  })
})

const loaderProps = overrides => ({
  inProxy: ``,
  outProxy: ``,
  atlasUrl: SORGHUM_V11,
  showAnatomogram: true,
  isWidget: true,
  showControlMenu: true,
  linkTarget: `_blank`,
  source: buildSource({query: {gene: `SORBI_3001G000200`}, experiment: false}),
  ...overrides
})

describe(`ContainerLoader filterRows`, () => {
  it(`hands the Container the filtered payload, and filters again without fetching when filterRows changes`, async () => {
    const fetchMock = mockFetch(() => allStudiesV11)
    const {rerender} = render(<ContainerLoader {...loaderProps({filterRows: notJgi})} />)
    expect(await screen.findByTestId(`container`)).toHaveTextContent(`9 rows`)
    expect(lastData().columnHeaders).toHaveLength(24)
    expect(recorded.renders[recorded.renders.length - 1]).not.toHaveProperty(`filterRows`)

    // a new function that keeps the same rows: the same payload object, the same Container
    const first = lastData()
    rerender(<ContainerLoader {...loaderProps({filterRows: row => notJgi(row)})} />)
    expect(lastData()).toBe(first)
    expect(recorded.mounts).toBe(1)

    // other rows: a new payload and a fresh Container (its controls start afresh)
    rerender(<ContainerLoader {...loaderProps({filterRows: isJgiRow})} />)
    expect(screen.getByTestId(`container`)).toHaveTextContent(`49 rows`)
    expect(lastData().columnHeaders).toHaveLength(11)
    expect(recorded.mounts).toBe(2)

    // no filter: the payload as fetched
    rerender(<ContainerLoader {...loaderProps({filterRows: undefined})} />)
    expect(lastData()).toEqual(allStudiesV11.body)
    expect(screen.getByTestId(`container`)).toHaveTextContent(`58 rows`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it(`shows the no-results alert when filterRows leaves no row`, async () => {
    mockFetch(() => allStudiesV11)
    render(<ContainerLoader {...loaderProps({filterRows: () => false})} />)
    const alert = await screen.findByRole(`alert`)
    expect(alert).toHaveClass(`alert-info`)
    expect(alert).toHaveTextContent(`Sorry, no results could be found matching your query.`)
    expect(screen.queryByTestId(`container`)).toBeNull()
  })
})

describe(`ExpressionAtlasHeatmap filterRows`, () => {
  it(`is passed through to the loader (under StrictMode too)`, async () => {
    const fetchMock = mockFetch(() => allStudiesV11)
    render(
      <StrictMode>
        <ExpressionAtlasHeatmap atlasUrl={SORGHUM_V11} query={{gene: `SORBI_3001G000200`}} filterRows={notJgi} />
      </StrictMode>)
    expect(await screen.findByTestId(`container`)).toHaveTextContent(`9 rows`)
    // (StrictMode's first effect run fetches too, and aborts)
    expect(fetchMock.mock.calls.every(([url, init]) =>
      url === `${SORGHUM_V11}json/baseline_experiments` && init.body === `geneQuery=SORBI_3001G000200`)).toBe(true)
  })
})
