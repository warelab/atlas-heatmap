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

// Path separators, the characters Windows forbids, and characters browsers replace with `_` in a file name: control
// and format characters (bidi controls such as U+202E, zero-width spaces, soft hyphens), lone surrogates and
// noncharacters
const INVALID_CHARACTERS = /[/\\:*?"<>|\p{Cc}\p{Cf}\p{Cs}\p{Noncharacter_Code_Point}]/gu

// Windows device names, reserved with any extension (Chrome on Windows puts `_` before them)
const RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9]|clock\$)(?:\.|$)/i

/**
 * The longest a sanitised name can be, in UTF-8 bytes: with an extension, a browser's ` (1)` and its `.crdownload`
 * while saving, the file name stays well under the 255 bytes of common file systems (longer ones are not saved).
 */
const MAX_FILE_NAME_BYTES = 200

const utf8Length = codePoint => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4)

// `name` cut to MAX_FILE_NAME_BYTES, between whole characters
const truncated = name => {
  let bytes = 0
  let end = 0
  for (const character of name) {
    bytes += utf8Length(character.codePointAt(0))
    if (bytes > MAX_FILE_NAME_BYTES) {
      return name.slice(0, end)
    }
    end += character.length
  }
  return name
}

/**
 * A name that is safe as a file name, and that the browser saves unchanged: without path separators, the characters
 * Windows does not allow (: * ? " < > |), control and format characters, lone surrogates or noncharacters; without the
 * spaces around it, leading dots (hidden files, `..`) and tildes, or trailing dots (which Windows drops); at most
 * MAX_FILE_NAME_BYTES long; and with `_` before a Windows device name (CON, PRN, AUX, NUL, COM1 to COM9, LPT1 to LPT9,
 * CLOCK$). A name left empty becomes `fallback`, itself cleaned, or FALLBACK_FILE_NAME.
 */
const sanitiseFileName = (name, fallback = FALLBACK_FILE_NAME) => {
  const trimmed = value => value.trim().replace(/^[.~\s]+/, ``).replace(/[.\s]+$/, ``)
  const clean = value => {
    const cleaned = trimmed(truncated(trimmed(
      String(value === undefined || value === null ? `` : value).replace(INVALID_CHARACTERS, ``).replace(/\s+/g, ` `))))
    return RESERVED_NAME.test(cleaned) ? `_${cleaned}` : cleaned
  }
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
  FORMATS, DEFAULT_FORMAT, FALLBACK_FILE_NAME, MAX_FILE_NAME_BYTES, sanitiseFileName, withExtension, fileNameFor, saveFile, tsvCell,
  tsvLines, jsonText, downloadContext, plural
}
