import React, {Fragment, useId, useLayoutEffect, useMemo, useRef, useState} from 'react'
import PropTypes from 'prop-types'
import {Button, Form} from 'react-bootstrap'

import loadChartData from '../load/main.js'
import {GradientLegend as SingleExperimentLegend} from '../manipulate/heatmap-legend/Main.js'
import disclaimers from '../manipulate/controls/download-button/disclaimers.js'
import {DownloadDialogButton} from '../manipulate/controls/download-button/DownloadDialog.js'
import {downloadContext} from '../manipulate/controls/download-button/downloadFile.js'
import {assayGroupColours} from './colours.js'
import {analyseFactors, chooseAxis, layoutFactorGrid, LABEL_SEPARATOR, MISSING, swapAxes} from './factorGrid.js'
import {gridFileName, gridJson, gridSummary, gridTsv} from './gridDownload.js'

// ExpressionFactorGrid's grid, drawn as a plain table (no Highcharts): the model is grid/factorGrid.js, the colours
// grid/colours.js, and the styles the .gxa-grid rules of styles/heatmap.css. (Not FactorGrid.js: on a case-insensitive
// file system that is the model's file.)

// A cell is at least MIN_CELL_PX wide, and wide enough for BAND_PX per sample of its column's fullest cell
const MIN_CELL_PX = 40
const BAND_PX = 14
// When any column label is longer than this, all the column labels are drawn vertically
const VERTICAL_LABEL_CHARS = 8
// Room between a band and its tooltip, and between the tooltip and the window's edges
const TOOLTIP_GAP_PX = 6

const valueText = (value, unit) => (
  value === null ?
    `No data` :
    `${value}${unit ? ` ${unit}` : ``}${value === 0 ? ` (below cutoff)` : ``}`
)

const SwapButton = ({onClick}) =>
  <Button size={`sm`} variant={`outline-secondary`} className={`gxa-grid-swap`} onClick={onClick}>
    <span aria-hidden={`true`}>{`⇄`}</span> Swap rows and columns
  </Button>

SwapButton.propTypes = {
  onClick: PropTypes.func.isRequired
}

const AxisSelect = ({id, label, value, factors, onChange}) =>
  <Form.Group controlId={id} className={`gxa-grid-axis-choice`}>
    <Form.Label className={`mb-0`}>{label}</Form.Label>
    <Form.Select size={`sm`} value={value} onChange={event => onChange(event.target.value)}>
      {factors.map(name => <option key={name} value={name}>{name}</option>)}
    </Form.Select>
  </Form.Group>

AxisSelect.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  factors: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired
}

const Tooltip = React.forwardRef(({id, sample, factors, colour, unit}, ref) =>
  <div ref={ref} id={id} role={`tooltip`} className={`gxa-grid-tooltip`} style={{visibility: `hidden`}}>
    <dl>
      {factors
        .filter(({name}) => sample.factorValues[name] !== MISSING)
        .map(({name}) =>
          <Fragment key={name}>
            <dt>{name}</dt>
            <dd>{sample.factorValues[name]}</dd>
          </Fragment>)}
      <dt>sample id</dt>
      <dd>{sample.sampleId}</dd>
      {sample.replicates !== null &&
        <Fragment>
          <dt>replicates</dt>
          <dd>{sample.replicates}</dd>
        </Fragment>}
      <dt>expression</dt>
      <dd>
        <span className={colour ? `gxa-grid-swatch` : `gxa-grid-swatch gxa-grid-no-data`} style={colour ? {background: colour} : undefined} />
        {valueText(sample.value, unit)}
      </dd>
    </dl>
  </div>)

Tooltip.displayName = `FactorGridTooltip`
Tooltip.propTypes = {
  id: PropTypes.string.isRequired,
  sample: PropTypes.object.isRequired,
  factors: PropTypes.arrayOf(PropTypes.shape({name: PropTypes.string.isRequired})).isRequired,
  colour: PropTypes.string,
  unit: PropTypes.string
}

const FactorGridView = ({
  payload, gene, experiment, inProxy, atlasUrl, linkTarget, urlFor, rowFactor, columnFactor, onChangeFactors,
  downloadFileName, showDownload = true
}) => {
  const ids = useId()
  const wrapperRef = useRef(null)
  const tooltipRef = useRef(null)

  // The flat heatmap's chart data of the same payload: its colour axis colours the samples and draws the legend
  const chartData = useMemo(
    () => loadChartData({
      data: payload, inProxy, outProxy: ``, atlasUrl, showAnatomogram: false, showControlMenu: false, isWidget: false,
      linkTarget, urlFor
    }),
    [payload, inProxy, atlasUrl, linkTarget, urlFor])
  const analysis = useMemo(() => analyseFactors(payload, {gene}), [payload, gene])
  const colours = useMemo(() => assayGroupColours(chartData, analysis.profileIndex), [chartData, analysis.profileIndex])

  // The axes are the props when they name varying factors (controlled), else the last choice made here
  const [chosen, setChosen] = useState({rowFactor: null, columnFactor: null})
  const varies = name => analysis.varyingFactors.includes(name)
  const requestedRow = varies(rowFactor) ? rowFactor : chosen.rowFactor
  const requestedColumn = varies(columnFactor) ? columnFactor : chosen.columnFactor
  const grid = useMemo(
    () => layoutFactorGrid(analysis, {rowFactor: requestedRow, columnFactor: requestedColumn}),
    [analysis, requestedRow, requestedColumn])

  // The sample whose tooltip shows, and its band: the tooltip is placed by the band's box, relative to the wrapper's
  const [active, setActive] = useState(null)
  const activeBandRef = useRef(null)
  const change = next => {
    activeBandRef.current = null
    setActive(null)
    setChosen(next)
    onChangeFactors && onChangeFactors(next)
  }
  const axes = {rowFactor: grid.rowFactor, columnFactor: grid.columnFactor}

  const anchorOf = element => {
    const box = wrapperRef.current.getBoundingClientRect()
    const band = element.getBoundingClientRect()
    return {left: band.left - box.left, top: band.top - box.top, width: band.width, height: band.height}
  }
  const show = (sample, element) => {
    if (!wrapperRef.current) {
      return
    }
    activeBandRef.current = element
    setActive({index: sample.index, anchor: anchorOf(element)})
  }
  const hide = () => {
    activeBandRef.current = null
    setActive(null)
  }
  // Scrolling the table moves its bands. The tooltip of the band in focus moves with it: focusing a band out of view
  // scrolls it into view, after the focus event. Any other tooltip (the mouse's) goes.
  const onScroll = () => {
    const band = activeBandRef.current
    if (band && band === document.activeElement && wrapperRef.current) {
      const anchor = anchorOf(band)
      setActive(current => current && {...current, anchor})
    } else if (band) {
      hide()
    }
  }

  // Centred below the band (above it when the window has no room below), and inside the window
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const wrapper = wrapperRef.current
    if (!active || !tooltip || !wrapper) {
      return
    }
    const {left, top, width, height} = active.anchor
    const box = wrapper.getBoundingClientRect()
    const windowWidth = document.documentElement.clientWidth || window.innerWidth
    const centred = box.left + left + width / 2 - tooltip.offsetWidth / 2
    const x = Math.max(TOOLTIP_GAP_PX, Math.min(centred, windowWidth - tooltip.offsetWidth - TOOLTIP_GAP_PX)) - box.left
    const below = top + height + TOOLTIP_GAP_PX
    const above = top - TOOLTIP_GAP_PX - tooltip.offsetHeight
    const roomBelow = box.top + below + tooltip.offsetHeight <= window.innerHeight
    const y = roomBelow || box.top + above < 0 ? below : above
    tooltip.style.left = `${x}px`
    tooltip.style.top = `${y}px`
    tooltip.style.visibility = `visible`
  }, [active])

  const {rows, columns, cells, unit, varyingFactors, constantFactors, foldedFactors} = grid
  const activeSample = active && grid.samples[active.index]
  const tooltipId = `${ids}-tooltip`
  const verticalLabels = columns.some(column => column.label.length > VERTICAL_LABEL_CHARS)
  const columnWidths = columns.map((column, c) =>
    Math.max(MIN_CELL_PX, BAND_PX * Math.max(...cells.map(cellsOfRow => cellsOfRow[c].length))))
  const noData = cells.some(cellsOfRow => cellsOfRow.some(cell => cell.length === 0 || cell.some(s => !colours[s.index])))
  const rowTitle = grid.rowFactor === null ? `` : [grid.rowFactor, ...foldedFactors].join(LABEL_SEPARATOR)
  const accession = payload.experiment ? payload.experiment.accession : ``
  // The download has every sample, whatever the axes (and, like the heatmap's, asks for agreement to the payload's
  // data reuse disclaimer if it has one)
  const downloadAccession = accession || experiment || ``
  const buildDownload = format => {
    const context = downloadContext()
    return format === `json` ?
      gridJson(grid, {experiment: payload.experiment, accession: downloadAccession, ...context}) :
      gridTsv(grid, {accession: downloadAccession})
  }

  return (
    <div ref={wrapperRef} className={`gxa-grid`}>
      <div className={`gxa-grid-toolbar`}>
        {(varyingFactors.length >= 2 || showDownload) &&
          <div className={`gxa-grid-controls`}>
            {varyingFactors.length > 2 &&
              <Fragment>
                <AxisSelect
                  id={`${ids}-rows`} label={`Rows`} value={grid.rowFactor} factors={varyingFactors}
                  onChange={factor => change(chooseAxis(axes, `row`, factor))} />
                <AxisSelect
                  id={`${ids}-columns`} label={`Columns`} value={grid.columnFactor} factors={varyingFactors}
                  onChange={factor => change(chooseAxis(axes, `column`, factor))} />
              </Fragment>}
            {varyingFactors.length >= 2 && <SwapButton onClick={() => change(swapAxes(axes))} />}
            {showDownload &&
              <DownloadDialogButton
                className={`gxa-grid-download`}
                defaultFileName={downloadFileName || gridFileName({gene: gene || grid.gene.id, accession: downloadAccession})}
                summary={gridSummary(grid, {accession: downloadAccession})}
                buildContent={buildDownload}
                disclaimer={disclaimers[payload.config && payload.config.disclaimer]}
                linkTarget={linkTarget} />}
          </div>}
        <div className={`gxa-grid-legend`}>
          {chartData.colourAxis &&
            <SingleExperimentLegend heatmapConfig={chartData.heatmapConfig} colourAxis={chartData.colourAxis} />}
          {noData &&
            <div className={`gxa-legend-item`}>
              <div className={`gxa-legend-swatch gxa-grid-no-data`} />
              <span className={`gxa-va-middle`}>No data</span>
            </div>}
        </div>
      </div>

      <div className={`gxa-grid-scroll`} onScroll={onScroll}>
        <table className={`gxa-grid-table`}>
          <caption>
            <span className={`gxa-visually-hidden`}>
              {`Expression of ${grid.gene.id}${accession ? ` in ${accession}` : ``}${unit ? `, in ${unit}` : ``}` +
                (grid.rowFactor ? `; rows: ${rowTitle}` : ``) + (grid.columnFactor ? `; columns: ${grid.columnFactor}` : ``) +
                `. `}
            </span>
            {constantFactors.length > 0 &&
              <span className={`gxa-grid-constant`}>
                {constantFactors.map(({name, value}) => `${name}: ${value}`).join(`; `)}
              </span>}
          </caption>
          <thead>
            {grid.columnFactor !== null &&
              <tr>
                <td />
                <th colSpan={columns.length} className={`gxa-grid-axis gxa-grid-axis--columns`}>{grid.columnFactor}</th>
              </tr>}
            <tr>
              {rowTitle ?
                <th scope={`col`} className={`gxa-grid-axis gxa-grid-axis--rows`}>{rowTitle}</th> :
                <td />}
              {columns.map((column, c) =>
                <th
                  key={column.key}
                  scope={`col`}
                  className={verticalLabels ? `gxa-grid-col gxa-grid-col--vertical` : `gxa-grid-col`}
                  style={{width: `${columnWidths[c]}px`, minWidth: `${columnWidths[c]}px`}}
                  title={column.value === MISSING ? `no ${grid.columnFactor}` : column.label}>
                  <span className={`gxa-grid-col-label`}>{column.label}</span>
                </th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) =>
              <tr key={row.key}>
                <th scope={`row`} className={`gxa-grid-row`} title={row.label}>
                  <span className={`gxa-grid-row-label`}>{row.label}</span>
                </th>
                {columns.map((column, c) => {
                  const samples = cells[r][c]
                  return samples.length === 0 ?
                    <td key={column.key} className={`gxa-grid-cell gxa-grid-cell--empty gxa-grid-no-data`}>
                      <span className={`gxa-visually-hidden`}>No data</span>
                    </td> :
                    <td key={column.key} className={`gxa-grid-cell`} data-samples={samples.length}>
                      <div className={`gxa-grid-bands`}>
                        {samples.map(sample => {
                          const colour = colours[sample.index]
                          const isActive = activeSample === sample
                          return (
                            <span
                              key={sample.index}
                              role={`img`}
                              tabIndex={0}
                              className={[
                                `gxa-grid-band`, colour ? null : `gxa-grid-no-data`, isActive ? `gxa-grid-band--active` : null
                              ].filter(Boolean).join(` `)}
                              style={colour ? {background: colour} : undefined}
                              data-assay-group={sample.assayGroupId}
                              aria-label={
                                `${row.label}${column.value === null ? `` : `, ${column.label}`}: ` +
                                `sample ${sample.sampleId}, ${valueText(sample.value, unit)}`}
                              aria-describedby={isActive ? tooltipId : undefined}
                              onMouseEnter={event => show(sample, event.currentTarget)}
                              onMouseLeave={hide}
                              onFocus={event => show(sample, event.currentTarget)}
                              onBlur={hide}
                              onKeyDown={event => event.key === `Escape` && hide()} />
                          )
                        })}
                      </div>
                    </td>
                })}
              </tr>)}
          </tbody>
        </table>
      </div>

      {activeSample &&
        <Tooltip
          ref={tooltipRef}
          id={tooltipId}
          sample={activeSample}
          factors={grid.factors}
          colour={colours[activeSample.index]}
          unit={unit} />}
    </div>
  )
}

FactorGridView.propTypes = {
  payload: PropTypes.shape({
    columnHeaders: PropTypes.array.isRequired,
    profiles: PropTypes.shape({rows: PropTypes.array.isRequired}).isRequired,
    experiment: PropTypes.object
  }).isRequired,
  gene: PropTypes.string.isRequired,
  experiment: PropTypes.string,
  inProxy: PropTypes.string.isRequired,
  atlasUrl: PropTypes.string.isRequired,
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func.isRequired,
  rowFactor: PropTypes.string,
  columnFactor: PropTypes.string,
  onChangeFactors: PropTypes.func,
  downloadFileName: PropTypes.string,
  showDownload: PropTypes.bool
}

export default FactorGridView
