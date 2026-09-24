import React, {useCallback, useEffect, useMemo, useRef} from 'react'
import PropTypes from 'prop-types'
import HighchartsReact from 'highcharts-react-official'

import getHeatmapHighcharts from './highcharts.js'
import useElementWidth from './useElementWidth.js'

import {heatmapDataPropTypes, colourAxisPropTypes} from '../manipulate/chartDataPropTypes.js'

const stringWidthInPixels = (strLength, averageCharWidth, rotationInDeg) =>
  strLength * averageCharWidth * Math.cos(rotationInDeg * Math.PI / 180)
const stringHeightInPixels = (strLength, averageCharWidth, rotationInDeg) =>
  strLength * averageCharWidth * Math.sin(rotationInDeg * Math.PI / 180)

// Upstream replaced the window's context menu handler here, at import time, to undo an older highcharts-custom-events
// that disabled right-click. Version 3 does not, so the page's context menu is left alone.

const countColumns = (heatmapData) => heatmapData.xAxisCategories.length

const getAutoRotationBasedOnLastLabelsLength = (heatmapData) => {
  // If any of the last four labels is longer than 30 chars make the labels vertical, ymmv, change if needed
  const tailLength = 4
  const maxChars = 30
  const lastLabels = heatmapData.xAxisCategories.map((category) => category.label).slice(-tailLength)
  return lastLabels.some((label) => label.length > maxChars) ? [-90] : [-45]
}

// containerWidth is the width of the chart's own column (80% of the heatmap when the anatomogram shows). Upstream
// measured document.getElementsByClassName(`gxaHeatmapContainer`)[0], i.e. the first heatmap on the page, and took 80%.
const getColumnWidthInPixels = (heatmapData, containerWidth) => {
  const longestRowLabelLength =
    Math.max(...heatmapData.yAxisCategories.map(category => category.label.length))

  const yAxisAvgCharWidth = 8.75
  const yAxisPadding = 12

  const heatmapWidth =
    containerWidth - stringWidthInPixels(longestRowLabelLength, yAxisAvgCharWidth, 0) - yAxisPadding

  return heatmapWidth / heatmapData.xAxisCategories.length
}

const xAxisLabelsRotationAngle = (heatmapData, containerWidth) => {
  const columnWidth = getColumnWidthInPixels(heatmapData, containerWidth)
  const longestColumnLabelLength =
    Math.max(...heatmapData.xAxisCategories.map(category => category.label.length))

  const labelLengthToWidthRatio = longestColumnLabelLength / columnWidth

  // Ratio cutoff based on trial and error...
  return labelLengthToWidthRatio < 0.2 ? 0 : getAutoRotationBasedOnLastLabelsLength(heatmapData)[0]
}

const getAdjustedMarginRight = (heatmapData, containerWidth) => {
  const minMarginRight = 20
  const rotationAngle = xAxisLabelsRotationAngle(heatmapData, containerWidth)

  if (rotationAngle === 0 || rotationAngle === -90) {
    return minMarginRight
  }
  else {
    const columnWidth = getColumnWidthInPixels(heatmapData, containerWidth)
    const longestColumnLabelWidthNearTheTailInPixels =
      stringWidthInPixels(
        Math.max(...heatmapData.xAxisCategories.slice(-4).map(category => category.label.length)), 6, 45)

    // We divide by two because the label is placed in the middle of the column
    return Math.max(minMarginRight, longestColumnLabelWidthNearTheTailInPixels - columnWidth / 2)
  }
}

const getMarginTop = (heatmapData, containerWidth) => {
  const minMarginTop = 30
  const xAxisLabelAvgCharWidth = 6
  const rotationAngle = xAxisLabelsRotationAngle(heatmapData, containerWidth)

  const longestColumnLabelLength =
    Math.max(...heatmapData.xAxisCategories.map(category => category.label.length))

  return rotationAngle === 0 ?
    minMarginTop :
    stringHeightInPixels(longestColumnLabelLength, xAxisLabelAvgCharWidth, Math.abs(rotationAngle))
}

const getHeight = (heatmapData, containerWidth, marginBottom) => {
  const rowCount = heatmapData.yAxisCategories.length
  return rowCount * 40 + getMarginTop(heatmapData, containerWidth) + marginBottom
}

// The chart's size-dependent options, as upstream computed them, except that marginRight is rounded up to 10 px: most
// width changes then leave the layout as it is, and the chart only reflows (keeping its zoom) instead of being redrawn.
const computeLayout = (heatmapData, containerWidth) => {
  const marginBottom = 10
  return {
    marginBottom,
    marginRight: Math.ceil(getAdjustedMarginRight(heatmapData, containerWidth) / 10) * 10,
    height: getHeight(heatmapData, containerWidth, marginBottom),
    autoRotation: getAutoRotationBasedOnLastLabelsLength(heatmapData)
  }
}

// Selects the points of the columns whose ontology ids are highlighted in the anatomogram (upstream's
// handleGxaAnatomogramTissueMouseEnter chart event, without Highcharts.each)
const selectColumnsByOntologyIds = (chart, svgPathIds = []) => {
  const selectedPoints = chart.getSelectedPoints()
  if (selectedPoints.length > 0) {
    selectedPoints.forEach(point => point.select(false))
  }

  chart.series.forEach(series => {
    series.points.forEach(point => {
      if (svgPathIds.includes(point.series.xAxis.categories[point.x].id)) {
        point.select(true, true)
      }
    })
  })
}

// Upstream's highchartsConfig. Series, categories and styles come from the props when the options are built; every
// callback reads the latest props from latestRef when it runs, so new callbacks alone never rebuild the chart.
// onSetExtremes(extremes | null) hears of every zoom and zoom reset.
const buildHeatmapOptions = (latestRef, {marginBottom, marginRight, height, autoRotation}, {onSetExtremes} = {}) => {
  const {heatmapData, colourAxis, xAxisStyle, yAxisStyle, noDataCellsColour = `white`, events = {}} = latestRef.current
  const latest = () => latestRef.current

  return {
    chart: {
      marginBottom,
      marginRight,
      height,
      type: `heatmap`,
      plotBackgroundColor: noDataCellsColour,
      spacingTop: 0,
      plotBorderWidth: 1,
      events: {
        // Fired by HeatmapCanvas when the anatomogram highlights tissues
        handleGxaAnatomogramTissueMouseEnter: function (e) {
          selectColumnsByOntologyIds(this, e.svgPathIds)
        }
      },
      zoomType: `x`
    },

    plotOptions: {
      heatmap: {
        turboThreshold: 0
      },

      series: {
        cursor: events.onClick ? `pointer` : undefined,
        point: {
          events: {
            click: function() {
              const {events, currentGenomeBrowser} = latest()
              events.onClick && events.onClick(this.x, this.y, currentGenomeBrowser)
            },
            mouseOver: function() { latest().events.onHoverPoint(this.x) },
            mouseOut: function() { latest().events.onHoverOff() }
          }
        },

        states: {
          hover: {
            color: `#eeec38` //#edab12 color cell on mouse over
          },
          select: {
            color: `#eeec38`
          }
        }
      }
    },

    credits: {
      enabled: false
    },

    legend: {
      enabled: false
    },

    title: null,

    colorAxis: colourAxis,

    xAxis: { //assay groups, contrasts, or factors across experiments
      tickLength: 5,
      tickColor: `rgb(192, 192, 192)`,
      lineColor: `rgb(192, 192, 192)`,
      labels: {
        style: xAxisStyle,
        // Events in labels enabled by 'highcharts-custom-events'
        events: {
          mouseover: function() {
            latest().events.onHoverColumnLabel(this.value)
          },
          mouseout: function() {
            latest().events.onHoverOff()
          }
        },
        autoRotation,
        // Highcharts only auto-rotates while a column is under 80 px wide; wider, it word-wraps instead, which the
        // nowrap style of baseline labels prevents, so long labels overlapped on wide screens. Rotate whenever a label
        // is wider than its column, as the layout (marginTop, height) already assumes.
        autoRotationLimit: Infinity,
        formatter: function() {
          return latest().xAxisFormatter(this.value)
        }
      },

      opposite: `true`,
      categories: heatmapData.xAxisCategories,
      min: 0,
      max: countColumns(heatmapData) - 1,

      events: {
        setExtremes: function(event) {
          const zoomed = event.min !== undefined && event.max !== undefined
          onSetExtremes && onSetExtremes(zoomed ? {min: event.min, max: event.max} : null)
          latest().onZoom(zoomed)
        }
      }
    },

    yAxis: { //experiments or bioentities
      useHTML: true,
      reversed: true,
      labels: {
        useHTML: true,
        style: yAxisStyle,
        events: {
          mouseover: function() {
            latest().events.onHoverRowLabel(this.value)
          },
          mouseout: function() {
            latest().events.onHoverOff()
          }
        },
        formatter: function() {
          return latest().yAxisFormatter(this.value, this.pos)
        }
      },

      categories: heatmapData.yAxisCategories,
      title: null,
      gridLineWidth: 0,
      minorGridLineWidth: 0,
      endOnTick: false
    },

    tooltip: {
      useHTML: true,
      shared: false,
      borderRadius: 0,
      borderWidth: 0,
      shadow: false,
      enabled: true,
      backgroundColor: `none`,
      outside: true,
      formatter: function() {
        return latest().cellTooltipFormatter(this.series, this.point)
      }
    },

    series: heatmapData.dataSeries.map(e => {
      return {
        name: e.info.name,
        color: e.info.colour,
        borderWidth: countColumns(heatmapData) > 200 ? 0 : 1,
        borderColor: `white`,
        // Copies: Highcharts writes the selection state into point options
        data: e.data.map(point => ({...point}))
      }
    })
  }
}

// The chart fits its own column, measured per instance. Its options are rebuilt (and the chart redrawn) only when the
// data or the layout changes; a width change that keeps the layout reflows the chart. Zoom survives a redraw for a new
// layout and is reset only by new data. This replaces react-highcharts and upstream's object-hash shouldComponentUpdate.
const HeatmapCanvas = (props) => {
  const [wrapperRef, width] = useElementWidth()
  const latest = useRef(props)
  latest.current = props
  const chartComponent = useRef(null)
  const currentChart = () => chartComponent.current && chartComponent.current.chart

  // What the options are built from. The callbacks are left out: the options read them through `latest`.
  const dataKey = JSON.stringify([
    props.heatmapData, props.colourAxis, props.noDataCellsColour, props.xAxisStyle, props.yAxisStyle,
    Boolean(props.events && props.events.onClick)
  ])
  const dataKeyRef = useRef(dataKey)
  dataKeyRef.current = dataKey

  const layout = width > 0 ? computeLayout(props.heatmapData, width) : null
  const layoutKey = layout && JSON.stringify(layout)

  // What else the labels are formatted from (the link target and outProxy of the row links). Highcharts formats them as
  // the chart is drawn, so a new key redraws the chart; it is no new data, so the zoom is kept.
  const labelsKey = props.labelsKey

  // {dataKey, min, max} of the current zoom, or null
  const zoom = useRef(null)

  const options = useMemo(
    () => layout && buildHeatmapOptions(latest, layout, {
      onSetExtremes: extremes => {
        zoom.current = extremes && {...extremes, dataKey: dataKeyRef.current}
      }
    }),
    [dataKey, layoutKey, labelsKey])   // layoutKey stands for layout

  // Runs as each chart is created: a chart redrawn for a new layout gets the zoom of the one it replaces
  const restoreZoom = useCallback(chart => {
    const current = zoom.current
    if (current && current.dataKey === dataKeyRef.current && chart.xAxis[0]) {
      chart.xAxis[0].zoom(current.min, current.max)
      if (!chart.resetZoomButton) {
        chart.showResetZoom()
      }
      chart.redraw(false)
    }
  }, [])

  // New data is drawn unzoomed: tell the controls (upstream left them disabled)
  useEffect(() => {
    const current = zoom.current
    if (current && current.dataKey !== dataKey) {
      zoom.current = null
      latest.current.onZoom(false)
    }
  }, [dataKey])

  // A width change that keeps the layout
  useEffect(() => {
    const chart = currentChart()
    chart && chart.reflow()
  }, [width])

  // Anatomogram → heatmap: select the highlighted tissues' columns (upstream fired this from componentWillReceiveProps)
  useEffect(() => {
    const chart = currentChart()
    chart && getHeatmapHighcharts().fireEvent(
      chart, `handleGxaAnatomogramTissueMouseEnter`, {svgPathIds: props.ontologyIdsToHighlight})
  }, [props.ontologyIdsToHighlight, options])

  // Highcharts 6 caches the chart's page position between mouse moves; the outside tooltip is placed with it. Scrolling
  // any ancestor (e.g. the body of a fullscreen modal) moves the chart, so forget the position. Scroll events do not
  // bubble, hence the capture phase.
  useEffect(() => {
    const forgetChartPosition = () => {
      const chart = currentChart()
      if (chart && chart.pointer) {
        chart.pointer.chartPosition = null
      }
    }
    document.addEventListener(`scroll`, forgetChartPosition, {capture: true, passive: true})
    return () => document.removeEventListener(`scroll`, forgetChartPosition, {capture: true})
  }, [])

  return (
    <div ref={wrapperRef}>
      {options &&
        <HighchartsReact
          ref={chartComponent}
          highcharts={getHeatmapHighcharts()}
          options={options}
          immutable={true}
          callback={restoreZoom} />}
    </div>
  )
}

HeatmapCanvas.propTypes = {
  heatmapData: heatmapDataPropTypes.isRequired,
  noDataCellsColour: PropTypes.string,
  colourAxis: colourAxisPropTypes,    // Only for experiment heatmap
  cellTooltipFormatter: PropTypes.func.isRequired,
  xAxisFormatter: PropTypes.func.isRequired,
  xAxisStyle: PropTypes.object.isRequired,
  yAxisFormatter: PropTypes.func.isRequired,
  yAxisStyle: PropTypes.object.isRequired,
  ontologyIdsToHighlight: PropTypes.arrayOf(PropTypes.string).isRequired,
  events: PropTypes.shape({
    onHoverRowLabel: PropTypes.func.isRequired,
    onHoverColumnLabel: PropTypes.func.isRequired,
    onHoverPoint: PropTypes.func.isRequired,
    onHoverOff: PropTypes.func.isRequired,
    onClick: PropTypes.func
  }),
  onZoom: PropTypes.func.isRequired,
  labelsKey: PropTypes.string,
  withAnatomogram: PropTypes.bool.isRequired,
  currentGenomeBrowser: PropTypes.string   // null when there are no genome browsers
}

const Main = props => (
  props.heatmapData.yAxisCategories.length < 1?
    <div style={{padding: `50px 0`}}>
     No data match your filtering criteria or your original query. Please, change your query or your filters and try again.
    </div> :
    <HeatmapCanvas {...props} />
)

export {computeLayout, buildHeatmapOptions, selectColumnsByOntologyIds, HeatmapCanvas}
export default Main
