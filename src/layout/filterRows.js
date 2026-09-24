import {useMemo} from 'react'

// The filterRows prop of ExpressionAtlasHeatmap: rows of the fetched payload for which filterRows(row) is false are
// removed, and so are the columns that no remaining row has a value in. Nothing is fetched again.

// An expression with something to draw: a baseline value, or a differential fold change. Missing ones are {}.
const hasValue = expression => Boolean(expression) && (
  (expression.value !== undefined && expression.value !== null) ||
  (expression.foldChange !== undefined && expression.foldChange !== null))

/**
 * Which rows and columns of `data` filterRows keeps, as {rows, columns} (indices), or null when it keeps every row (or
 * there is no function or no rows to filter). Columns are dropped only when rows were.
 */
const selectRows = (data, filterRows) => {
  if (typeof filterRows !== `function` || !data || !data.profiles || !Array.isArray(data.profiles.rows)) {
    return null
  }
  const allRows = data.profiles.rows
  const rows = allRows.reduce((kept, row, index) => (filterRows(row) ? kept.concat(index) : kept), [])
  if (rows.length === allRows.length) {
    return null
  }
  const columnHeaders = data.columnHeaders || []
  const columns = columnHeaders
    .map((header, index) => index)
    .filter(index => rows.some(row => hasValue((allRows[row].expressions || [])[index])))
  return {rows, columns}
}

const withoutRemovedRows = (total, removed) => {
  if (total === undefined || total === null || total === ``) {
    return total
  }
  const remaining = Math.max(0, Number(total) - removed)
  if (Number.isNaN(remaining)) {
    return total
  }
  return typeof total === `number` ? remaining : String(remaining)
}

/**
 * A copy of `data` with only the selected rows and columns. Every row's expressions stay aligned with columnHeaders,
 * and profiles.searchResultTotal (a string in baseline payloads, a number in differential ones) loses the removed rows.
 */
const applySelection = (data, {rows, columns}) => {
  const allRows = data.profiles.rows
  const columnHeaders = data.columnHeaders || []
  const everyColumn = columns.length === columnHeaders.length
  const pick = list => (everyColumn || !Array.isArray(list) ? list : columns.map(index => list[index]))
  return {
    ...data,
    columnHeaders: pick(columnHeaders),
    profiles: {
      ...data.profiles,
      rows: rows.map(index => {
        const row = allRows[index]
        return everyColumn ? row : {...row, expressions: pick(row.expressions)}
      }),
      searchResultTotal: withoutRemovedRows(data.profiles.searchResultTotal, allRows.length - rows.length)
    }
  }
}

/**
 * The payload filterRows leaves (the same object when it keeps every row), and a key that changes only when a
 * different set of rows or columns is kept: a new filterRows function that keeps the same rows gives the same object.
 */
const useFilteredPayload = (data, filterRows) => {
  const selection = selectRows(data, filterRows)
  const key = selection ? JSON.stringify(selection) : ``
  const filtered = useMemo(() => (selection ? applySelection(data, selection) : data), [data, key])
  return {data: filtered, key, filtered: Boolean(selection)}
}

export {hasValue, selectRows, applySelection, useFilteredPayload}
