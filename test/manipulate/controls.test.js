import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import download from 'downloadjs'
import OrderingsDropdown from '../../src/manipulate/controls/OrderingsDropdown.js'
import GenomeBrowsersDropdown from '../../src/manipulate/controls/GenomeBrowsersDropdown.js'
import DownloadButton from '../../src/manipulate/controls/download-button/DownloadButton.js'
import { heatmapDataIntoLinesOfData } from '../../src/manipulate/controls/download-button/Download.js'
import FiltersButton from '../../src/manipulate/controls/filter/FiltersButton.js'
import CategoryCheckboxes from '../../src/manipulate/controls/filter/CategoryCheckboxes.js'
import CoexpressionOption from '../../src/manipulate/coexpression/CoexpressionOption.js'
import loadChartData from '../../src/load/main.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import { lastDownload } from '../helpers/download.js'

vi.mock(`downloadjs`, () => ({default: vi.fn()}))

const ORDERINGS = [`By experiment type`, `Alphabetical order`, `Expression rank`]

const chartData = () => loadChartData({
  data: allStudies.body, inProxy: ``, outProxy: ``, atlasUrl: `https://data.sorghumbase.org/auth_testing/gxa/`,
  showAnatomogram: true, showControlMenu: true, isWidget: true
})

beforeEach(() => {
  download.mockClear()
})

describe(`OrderingsDropdown`, () => {
  it(`lists the orderings as buttons and selects one by its eventKey`, async () => {
    const user = userEvent.setup()
    const onChangeCurrentOption = vi.fn()
    render(
      <OrderingsDropdown allOptions={ORDERINGS} currentOption={ORDERINGS[0]} onChangeCurrentOption={onChangeCurrentOption}
        title={``} disabled={false} />)

    const toggle = screen.getByRole(`button`, {name: /By experiment type/})
    expect(toggle).toHaveClass(`btn-outline-secondary`, `btn-sm`, `dropdown-toggle`)
    expect(toggle.querySelector(`svg.gxa-icon-sort-numeric-down`)).not.toBeNull()
    expect(toggle.closest(`[title]`)).toBeNull()

    await user.click(toggle)
    const items = screen.getAllByRole(`button`).filter(b => b.classList.contains(`dropdown-item`))
    expect(items.map(item => item.textContent)).toEqual(ORDERINGS)
    expect(items.every(item => item.tagName === `BUTTON` && item.type === `button`)).toBe(true)
    expect(items[0]).toHaveClass(`active`)

    await user.click(screen.getByRole(`button`, {name: `Alphabetical order`}))
    expect(onChangeCurrentOption).toHaveBeenCalledTimes(1)
    expect(onChangeCurrentOption).toHaveBeenCalledWith(`Alphabetical order`)
  })

  it(`is disabled while zoomed, with its title on a wrapper`, () => {
    render(
      <OrderingsDropdown allOptions={ORDERINGS} currentOption={`Alphabetical order`} onChangeCurrentOption={vi.fn()}
        title={`Reset zoom to enable sorting options`} disabled={true} />)
    const toggle = screen.getByRole(`button`, {name: /Alphabetical order/})
    expect(toggle).toBeDisabled()
    expect(toggle.closest(`[title]`)).toHaveAttribute(`title`, `Reset zoom to enable sorting options`)
    expect(toggle.querySelector(`svg.gxa-icon-sort-alpha-down`)).not.toBeNull()
  })
})

describe(`GenomeBrowsersDropdown`, () => {
  it(`shows the selected genome browser and selects another by id`, async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<GenomeBrowsersDropdown genomeBrowsers={[`Ensembl Genomes`, `none`]} selected={`ensemblgenomes`} onSelect={onSelect} />)

    const toggle = screen.getByRole(`button`, {name: /Ensembl Genomes genome browser/})
    expect(toggle.querySelector(`svg.gxa-icon-eye`)).not.toBeNull()
    await user.click(toggle)
    await user.click(screen.getByRole(`button`, {name: `none genome browser`}))
    expect(onSelect).toHaveBeenCalledWith(`none`)
  })

  it(`does not throw when the selection is not one of the genome browsers`, () => {
    render(<GenomeBrowsersDropdown genomeBrowsers={[`Ensembl Genomes`]} selected={null} />)
    expect(screen.getByRole(`button`, {name: /Choose genome browser/})).toBeInTheDocument()
  })
})

describe(`DownloadButton`, () => {
  const content = () => {
    const {heatmapData} = chartData()
    return {descriptionLines: [`Ordering: By experiment type`], heatmapData}
  }
  const openDialog = async user => {
    await user.click(screen.getByRole(`button`, {name: `Download`}))
    return screen.findByRole(`dialog`)
  }

  it(`is a plain button that opens the Download dialog, which saves what is shown as tab-delimited text by default`, async () => {
    const user = userEvent.setup()
    render(<DownloadButton currentlyShownContent={content()} disclaimer={``} fullDatasetUrl={``}
      query={{genes: [`SORBI_3001G000200`]}} />)

    const button = screen.getByRole(`button`, {name: `Download`})
    expect(button).toHaveClass(`btn-sm`, `btn-outline-secondary`)
    expect(button).not.toHaveClass(`dropdown-toggle`)
    expect(screen.queryByRole(`button`, {name: `More download options`})).toBeNull()

    const dialog = await openDialog(user)
    expect(dialog).toHaveTextContent(`9 rows × 24 columns, as shown`)
    expect(within(dialog).getByRole(`textbox`, {name: `File name`})).toHaveValue(`expression-studies-SORBI_3001G000200`)
    expect(within(dialog).getByRole(`radio`, {name: `Tab-delimited text (.tsv)`})).toBeChecked()
    // no full dataset: no link to it
    expect(within(dialog).queryByRole(`button`, {name: /Full experiment data/})).toBeNull()

    await user.click(within(dialog).getByRole(`button`, {name: `Download`}))
    expect(download).toHaveBeenCalledTimes(1)
    const {content: text, fileName, mimeType} = await lastDownload()
    expect([fileName, mimeType]).toEqual([`expression-studies-SORBI_3001G000200.tsv`, `text/tab-separated-values`])
    expect(text).toMatch(/^# Downloaded from: http.*\n# Timestamp: .*\n# Ordering: By experiment type\n# Unit: TPM\n\t/)
    expect(window.open).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
  })

  it(`saves JSON when asked, under the default name given`, async () => {
    const user = userEvent.setup()
    render(<DownloadButton currentlyShownContent={content()} disclaimer={``} fullDatasetUrl={``}
      query={{genes: [`SORBI_3001G000200`]}} atlasUrl={`https://data.sorghumbase.org/auth_testing/gxa/`}
      defaultFileName={`SORBI_3001G000200-ebi-studies`} />)
    const dialog = await openDialog(user)
    expect(within(dialog).getByRole(`textbox`, {name: `File name`})).toHaveValue(`SORBI_3001G000200-ebi-studies`)
    await user.click(within(dialog).getByRole(`radio`, {name: `JSON (.json)`}))
    await user.click(within(dialog).getByRole(`button`, {name: `Download`}))

    const {content: text, fileName, mimeType} = await lastDownload()
    expect([fileName, mimeType]).toEqual([`SORBI_3001G000200-ebi-studies.json`, `application/json`])
    const json = JSON.parse(text)
    expect(json).toMatchObject({
      source: `Expression Atlas`, atlasUrl: `https://data.sorghumbase.org/auth_testing/gxa/`, experiment: null,
      query: {genes: [`SORBI_3001G000200`]}, unit: `TPM`, zoom: null
    })
    expect(json.columns).toHaveLength(24)
    expect(json.rows).toHaveLength(9)
  })

  it(`offers the full experiment data only as a secondary link, opened in linkTarget`, async () => {
    const user = userEvent.setup()
    const url = `https://www.ebi.ac.uk/gxa/experiments-content/E-CURD-25/download/RNASEQ_MRNA_BASELINE?cutoff=0.0`
    render(<DownloadButton currentlyShownContent={content()} disclaimer={``} linkTarget={`_blank`} isSingleExperiment={true}
      fullDatasetUrl={url} />)

    const dialog = await openDialog(user)
    // Download (the default action) saves what is shown; the full data is a link in the body
    expect(within(dialog).getByRole(`button`, {name: `Download`}).closest(`.modal-footer`)).not.toBeNull()
    await user.click(within(dialog).getByRole(`button`, {name: `Full experiment data on Expression Atlas`}))
    expect(window.open).toHaveBeenCalledWith(url, `_blank`, `noopener,noreferrer`)
    expect(download).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
  })

  it(`shows the data reuse statement in the dialog and waits for the reader to agree to it`, async () => {
    const user = userEvent.setup()
    render(
      <DownloadButton currentlyShownContent={content()} disclaimer={`blueprint`} fullDatasetUrl={`https://example.org/all.tsv`}
        linkTarget={`_self`} />)

    const dialog = await openDialog(user)
    expect(dialog).toHaveClass(`gxa-heatmap-modal`)
    expect(within(dialog).getByText(`The Blueprint Project Data Reuse Statement`)).toBeInTheDocument()
    // the modal is in a portal, outside .gxaHeatmapContainer, and its links follow linkTarget too
    const link = within(dialog).getByRole(`link`, {name: `www.blueprint-epigenome.eu`})
    expect(link).toHaveAttribute(`target`, `_self`)
    expect(link).not.toHaveAttribute(`rel`)

    const full = within(dialog).getByRole(`button`, {name: `Full experiment data on Expression Atlas`})
    expect(within(dialog).getByRole(`button`, {name: `Download`})).toBeDisabled()
    expect(full).toBeDisabled()
    await user.click(within(dialog).getByRole(`checkbox`, {name: `I agree to the data reuse statement above`}))
    await user.click(full)
    expect(window.open).toHaveBeenCalledWith(`https://example.org/all.tsv`, `_self`, undefined)
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
  })

  it(`opens the disclaimers' web links in a new tab by default, and leaves the mail link alone`, async () => {
    const user = userEvent.setup()
    const openDisclaimer = async (disclaimer, linkTarget) => {
      const rendered = render(
        <DownloadButton currentlyShownContent={content()} disclaimer={disclaimer} fullDatasetUrl={``} linkTarget={linkTarget} />)
      const dialog = await openDialog(user)
      return {...rendered, links: within(within(dialog).getByRole(`region`, {name: `Data reuse statement`})).getAllByRole(`link`)}
    }

    const lauderdale = await openDisclaimer(`lauderdale`)
    expect(lauderdale.links.map(link => link.getAttribute(`href`)))
      .toEqual([`http://www.sanger.ac.uk/datasharing/`, `https://www.ebi.ac.uk/gxa/experiments/E-ERAD-475`])
    for (const link of lauderdale.links) {
      expect(link).toHaveAttribute(`target`, `_blank`)
      expect(link).toHaveAttribute(`rel`, `noopener noreferrer`)
    }
    lauderdale.unmount()

    // a falsy linkTarget: no target attribute, as for every other link
    const blueprint = await openDisclaimer(`blueprint`, null)
    expect(blueprint.links).toHaveLength(1)
    expect(blueprint.links[0]).not.toHaveAttribute(`target`)
    blueprint.unmount()

    const pcawg = await openDisclaimer(`pcawg`, `_blank`)
    expect(pcawg.links.map(link => link.getAttribute(`href`))).toEqual([`mailto:jennifer.jennings@oicr.on.ca`])
    expect(pcawg.links[0]).not.toHaveAttribute(`target`)
  })

  it(`writes the table with NA for missing values in multi-experiment heatmaps`, () => {
    const {heatmapData} = chartData()
    const lines = heatmapDataIntoLinesOfData(heatmapData, `NA`)
    expect(lines).toHaveLength(heatmapData.yAxisCategories.length + 1)
    expect(lines[0].split(`\t`)).toEqual([``, ...heatmapData.xAxisCategories.map(x => x.label)])
    expect(lines[1].split(`\t`)[0]).toBe(heatmapData.yAxisCategories[0].label)
  })
})

// Warelab payloads have no column groupings; this is the shape of an EBI experiment's
const groupedColumns = [
  {value: `leaf`, categories: [`All`, `Medium`], groupings: [
    {name: `Anatomical systems`, memberName: `organ`, values: [{id: `PO_1`, label: `shoot system`}]},
    {name: `Organs`, memberName: `organ`, values: [{id: `PO_2`, label: `leaf`}]}]},
  {value: `root`, categories: [`All`, `Low`], groupings: [
    {name: `Anatomical systems`, memberName: `organ`, values: [{id: `PO_3`, label: `root system`}]},
    {name: `Organs`, memberName: `organ`, values: [{id: `PO_4`, label: `root`}]}]},
  {value: `stem`, categories: [`All`, `Low`], groupings: [
    {name: `Anatomical systems`, memberName: `organ`, values: [{id: `PO_1`, label: `shoot system`}]},
    {name: `Organs`, memberName: `organ`, values: [{id: `PO_5`, label: `stem`}]}]}
]

const filtersProps = (overrides = {}) => ({
  defaultShowModal: false,
  categories: [{name: `All`, disabled: false}, {name: `None`, disabled: false}],
  categoryCheckboxes: [{name: `Medium`, disabled: false}, {name: `Low`, disabled: false}],
  allValues: groupedColumns,
  currentValues: groupedColumns,
  disabled: false,
  onChangeCurrentValues: vi.fn(),
  tabNames: [`Anatomical systems`, `Organs`],
  ...overrides
})

describe(`FiltersButton`, () => {
  it(`opens a scoped modal with grouping tabs, category pills and filter options, and closes it`, async () => {
    const user = userEvent.setup()
    const props = filtersProps()
    render(<FiltersButton {...props} />)

    const button = screen.getByRole(`button`, {name: `Filters`})
    expect(button).toHaveClass(`btn-sm`, `btn-outline-secondary`)
    expect(button.querySelector(`svg.gxa-icon-sliders`)).not.toBeNull()
    await user.click(button)

    const dialog = await screen.findByRole(`dialog`)
    expect(dialog).toHaveClass(`gxa-heatmap-modal`)
    expect(dialog.querySelector(`.modal-dialog`)).toHaveClass(`modal-lg`)

    const tabs = dialog.querySelector(`.modal-header .nav-tabs`)
    expect([...tabs.querySelectorAll(`.nav-link`)].map(a => a.textContent)).toEqual([`Anatomical systems`, `Organs`])
    expect(tabs.querySelector(`.nav-link.active`)).toHaveTextContent(`Anatomical systems`)
    const pills = dialog.querySelector(`.nav-pills.flex-column`)
    expect(pills.querySelector(`.nav-link.active`)).toHaveTextContent(`All`)

    // options of the current grouping, capitalised by CSS through a span (buttons take no ::first-letter)
    const names = [...dialog.querySelectorAll(`.gxa-filter-option-name`)]
    expect(names.map(n => n.textContent.trim())).toEqual([`root system`, `shoot system`])
    expect(names.every(n => n.tagName === `BUTTON`)).toBe(true)
    expect(names[0].querySelector(`.gxa-filter-option-label`)).toHaveTextContent(`root system`)

    // a pill selects that category's columns
    await user.click(within(pills).getByText(`None`))
    expect(props.onChangeCurrentValues).toHaveBeenLastCalledWith([])

    // the other grouping
    await user.click(within(tabs).getByText(`Organs`))
    expect([...dialog.querySelectorAll(`.gxa-filter-option-name`)].map(n => n.textContent.trim()))
      .toEqual([`leaf`, `root`, `stem`])

    // options that are a single column of the same name do not open
    expect([...dialog.querySelectorAll(`.gxa-filter-option-name`)].every(n => n.tagName === `SPAN`)).toBe(true)

    await user.click(within(dialog.querySelector(`.modal-footer`)).getByRole(`button`, {name: `Close`}))
    await waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
  })

  it(`opens a filter option to (un)check its columns`, async () => {
    const user = userEvent.setup()
    const props = filtersProps()
    render(<FiltersButton {...props} />)
    await user.click(screen.getByRole(`button`, {name: `Filters`}))
    const dialog = await screen.findByRole(`dialog`)

    const shoot = within(dialog).getByRole(`button`, {name: /shoot system/})
    expect(shoot).toHaveAttribute(`aria-expanded`, `false`)
    expect(shoot.querySelector(`svg.gxa-icon-chevron-down`)).not.toBeNull()
    await user.click(shoot)
    expect(shoot).toHaveAttribute(`aria-expanded`, `true`)

    await user.click(within(dialog).getByRole(`checkbox`, {name: `stem`}))
    expect(props.onChangeCurrentValues).toHaveBeenLastCalledWith([groupedColumns[0], groupedColumns[1]])

    await user.click(within(dialog).getByRole(`checkbox`, {name: `shoot system`}))
    expect(props.onChangeCurrentValues).toHaveBeenLastCalledWith([groupedColumns[1]])
  })

  it(`is disabled while zoomed, with its title on a wrapper`, () => {
    render(<FiltersButton {...filtersProps({disabled: true})} />)
    const button = screen.getByRole(`button`, {name: `Filters`})
    expect(button).toBeDisabled()
    expect(button.parentElement).toHaveAttribute(`title`, `Reset zoom to enable filters`)
  })

  it(`titles the modal "Filters" when there is one grouping or none`, async () => {
    const user = userEvent.setup()
    render(<FiltersButton {...filtersProps({tabNames: [], allValues: [], currentValues: []})} />)
    await user.click(screen.getByRole(`button`, {name: `Filters`}))
    const dialog = await screen.findByRole(`dialog`)
    expect(dialog.querySelector(`.modal-title`)).toHaveTextContent(`Filters`)
    expect(dialog.querySelector(`.nav-tabs`)).toBeNull()
  })
})

describe(`CategoryCheckboxes`, () => {
  it(`renders Bootstrap 5 checkboxes whose labels are tied to them`, async () => {
    const user = userEvent.setup()
    const onChangeCurrentValues = vi.fn()
    const {columnGroups} = chartData()
    const {container} = render(
      <>
        <CategoryCheckboxes categories={columnGroups.categoryCheckboxes} allValues={columnGroups.data}
          currentValues={columnGroups.data} currentTab={`All`} onChangeCurrentValues={onChangeCurrentValues} />
        <CategoryCheckboxes categories={columnGroups.categoryCheckboxes} allValues={columnGroups.data}
          currentValues={columnGroups.data} currentTab={`All`} onChangeCurrentValues={vi.fn()} />
      </>)

    const checks = container.querySelectorAll(`.form-check.form-check-inline`)
    expect(checks).toHaveLength(8)
    const ids = [...container.querySelectorAll(`input.form-check-input`)].map(input => input.id)
    expect(new Set(ids).size).toBe(8)
    expect(ids.every(id => /^\S+$/.test(id))).toBe(true)

    const [medium] = screen.getAllByLabelText(`Medium`)
    expect(medium).toBeChecked()
    await user.click(medium)
    expect(onChangeCurrentValues).toHaveBeenCalledTimes(1)
    expect(onChangeCurrentValues.mock.calls[0][0].every(column => column.categories.includes(`Medium`))).toBe(true)
  })
})

describe(`CoexpressionOption`, () => {
  it(`offers similarly expressed genes, then a range that commits when released`, async () => {
    const user = userEvent.setup()
    const showCoexpressionsCallback = vi.fn()
    const props = {geneName: `SORBI_3001G000200`, numCoexpressionsAvailable: 50, showCoexpressionsCallback}
    const {rerender} = render(<CoexpressionOption {...props} numCoexpressionsVisible={0} />)

    const button = screen.getByRole(`button`, {name: /Add similarly expressed genes/})
    expect(button.querySelector(`svg.gxa-icon-grid-3x3-gap`)).not.toBeNull()
    await user.click(button)
    expect(showCoexpressionsCallback).toHaveBeenLastCalledWith(10)

    rerender(<CoexpressionOption {...props} numCoexpressionsVisible={10} />)
    const range = screen.getByRole(`slider`, {name: `Genes with similar expression to SORBI_3001G000200`})
    expect(range).toHaveClass(`form-range`)
    expect(range).toHaveAttribute(`max`, `50`)
    expect(range).toHaveValue(`10`)
    expect([...document.querySelectorAll(`.gxa-range-mark`)].map(mark => [mark.textContent, mark.style.left]))
      .toEqual([[`off`, `0%`], [`10`, `20%`], [`50`, `100%`]])

    // dragging only moves the thumb; releasing it commits (rc-slider's onAfterChange)
    fireEvent.change(range, {target: {value: `11`}})
    fireEvent.change(range, {target: {value: `12`}})
    expect(range).toHaveValue(`12`)
    expect(showCoexpressionsCallback).toHaveBeenCalledTimes(1)
    fireEvent.mouseUp(range)
    expect(showCoexpressionsCallback).toHaveBeenCalledTimes(2)
    expect(showCoexpressionsCallback).toHaveBeenLastCalledWith(12)

    rerender(<CoexpressionOption {...props} numCoexpressionsVisible={12} />)
    fireEvent.keyUp(range, {key: `Tab`})    // nothing changed
    expect(showCoexpressionsCallback).toHaveBeenCalledTimes(2)
    fireEvent.change(range, {target: {value: `0`}})
    fireEvent.keyUp(range, {key: `Home`})
    expect(showCoexpressionsCallback).toHaveBeenLastCalledWith(0)
  })

  it(`says so when there are no similarly expressed genes`, () => {
    render(<CoexpressionOption geneName={`G`} numCoexpressionsAvailable={0} numCoexpressionsVisible={0}
      showCoexpressionsCallback={vi.fn()} />)
    expect(screen.getByText(`No genes with similar expression to G could be found`)).toBeInTheDocument()
  })
})
