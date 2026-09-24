import download from 'downloadjs'

// The Download dialog's formats, file names and saving: shared by the heatmap (DownloadButton.js) and the factor grid
// (grid/FactorGridView.js). Pure functions apart from saveFile.

/** The formats a Download dialog offers, in the order it lists them; the first is the default. */
const FORMATS = Object.freeze({
  tsv: Object.freeze({
    label: `Tab-delimited text (.tsv)`,
    extension: `.tsv`,
    mimeType: `text/tab-separated-values`
  }),
  json: Object.freeze({
    label: `JSON (.json)`,
    extension: `.json`,
    mimeType: `application/json`
  })
})

const DEFAULT_FORMAT = `tsv`

/** The base name of a file saved with no usable name. */
const FALLBACK_FILE_NAME = `expression-data`

// Path separators, the characters Windows forbids in file names, and control characters
const INVALID_CHARACTERS = /[/\\:*?"<>|\u0000-\u001f\u007f]/g

/**
 * A name that is safe as a file name: without path separators, the characters Windows does not allow (: * ? " < > |)
 * or control characters, without the spaces around it, and without leading dots (hidden files, `..`) or trailing dots
 * (which Windows drops). A name left empty becomes `fallback`, itself cleaned, or FALLBACK_FILE_NAME.
 */
const sanitiseFileName = (name, fallback = FALLBACK_FILE_NAME) => {
  const clean = value => String(value === undefined || value === null ? `` : value)
    .replace(INVALID_CHARACTERS, ``)
    .replace(/\s+/g, ` `)
    .trim()
    .replace(/^\.+/, ``)
    .replace(/[. ]+$/, ``)
    .trim()
  return clean(name) || clean(fallback) || FALLBACK_FILE_NAME
}

/** `name` with the format's extension, unless it already ends with it (in any case). */
const withExtension = (name, format) => {
  const {extension} = FORMATS[format] || FORMATS[DEFAULT_FORMAT]
  return name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`
}

/** The name a file is saved under: `name` sanitised (see sanitiseFileName), with the format's extension. */
const fileNameFor = (name, format, fallback) => withExtension(sanitiseFileName(name, fallback), format)

/**
 * Saves `content` (a string) as `fileName` with downloadjs. It is handed a UTF-8 Blob of the content: downloadjs would
 * write a string with characters past U+007F (—, ×, é) one byte per UTF-16 unit, which is not UTF-8.
 */
const saveFile = (content, fileName, format) => {
  const {mimeType} = FORMATS[format] || FORMATS[DEFAULT_FORMAT]
  download(new Blob([content], {type: `${mimeType};charset=utf-8`}), fileName, mimeType)
}

// A value in a tab-delimited cell: tabs and line breaks would start another cell or line
const tsvCell = value => (value === undefined || value === null ? `` : String(value).replace(/[\t\r\n]+/g, ` `))

/** Tab-delimited lines, each ending with a line break. */
const tsvLines = rows => rows.map(cells => `${cells.map(tsvCell).join(`\t`)}\n`).join(``)

/** Indented JSON, ending with a line break. */
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`

// Where and when a download is made: the builders take them as arguments, so they stay pure
const downloadContext = () => ({
  downloadedFrom: typeof window !== `undefined` && window.location ? window.location.href : ``,
  downloadedAt: new Date().toISOString()
})

const plural = (count, noun, nouns = `${noun}s`) => `${count} ${count === 1 ? noun : nouns}`

export {
  FORMATS, DEFAULT_FORMAT, FALLBACK_FILE_NAME, sanitiseFileName, withExtension, fileNameFor, saveFile, tsvCell,
  tsvLines, jsonText, downloadContext, plural
}
