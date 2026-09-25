import { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import download from 'downloadjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DownloadDialog, { DownloadDialogButton } from '../../src/manipulate/controls/download-button/DownloadDialog.js'
import {
  fileNameFor, FORMATS, MAX_FILE_NAME_BYTES, sanitiseFileName, saveFile, tsvLines, withExtension
} from '../../src/manipulate/controls/download-button/downloadFile.js'
import disclaimers from '../../src/manipulate/controls/download-button/disclaimers.js'
import { lastDownload, textOf } from '../helpers/download.js'

vi.mock(`downloadjs`, () => ({default: vi.fn()}))

beforeEach(() => {
  download.mockClear()
})

describe(`file names`, () => {
  it(`strips path separators, characters Windows forbids and control characters, and the spaces and dots around`, () => {
    expect(sanitiseFileName(`SORBI_3006G095600-JGI-SB-1`)).toBe(`SORBI_3006G095600-JGI-SB-1`)
    expect(sanitiseFileName(`../a/b\\c:d*e?f"g<h>i|j`)).toBe(`abcdefghij`)
    expect(sanitiseFileName(`tab\there\u0000 and\nnewline\u007f`)).toBe(`tabhere andnewline`)
    expect(sanitiseFileName(`   my   data   `)).toBe(`my data`)
    expect(sanitiseFileName(`.hidden`)).toBe(`hidden`)
    expect(sanitiseFileName(`ends with dots...`)).toBe(`ends with dots`)
    expect(sanitiseFileName(`émigré — ×2`)).toBe(`émigré — ×2`)
  })

  // What Chrome replaces with `_` (checked in Chrome 140): the name the dialog shows must be the name saved
  it(`strips the format characters, lone surrogates, noncharacters and leading tildes browsers would replace`, () => {
    expect(sanitiseFileName(`\u202Egpj.exe`)).toBe(`gpj.exe`)          // right-to-left override
    expect(sanitiseFileName(`x\u200By\u200Dz\u00ADw\u061Cv\uFEFFu`)).toBe(`xyzwvu`)
    expect(sanitiseFileName(`a\u{E0001}b`)).toBe(`ab`)                 // a tag character, outside the BMP
    expect(sanitiseFileName(`a\uD800b\uDC00c`)).toBe(`abc`)            // lone surrogates
    expect(sanitiseFileName(`a\uFDD0b\uFFFEc\u{10FFFF}d`)).toBe(`abcd`)
    expect(sanitiseFileName(`a\u0085b\u009Fc`)).toBe(`abc`)            // C1 controls
    expect(sanitiseFileName(`~tilde`)).toBe(`tilde`)
    expect(sanitiseFileName(` ~ .~x`)).toBe(`x`)
    expect(sanitiseFileName(`a~b~`)).toBe(`a~b~`)                     // only a leading tilde is replaced
    expect(sanitiseFileName(`\u00A0lead\u3000trail\u2028`)).toBe(`lead trail`)
    expect(sanitiseFileName(`\u{1F468}\u200D\u{1F469}\u200D\u{1F467} e\u0301`)).toBe(`\u{1F468}\u{1F469}\u{1F467} e\u0301`)
  })

  it(`cuts a long name to 200 bytes of UTF-8, between whole characters`, () => {
    expect(MAX_FILE_NAME_BYTES).toBe(200)
    expect(sanitiseFileName(`a`.repeat(300))).toBe(`a`.repeat(200))
    expect(sanitiseFileName(`a`.repeat(200))).toBe(`a`.repeat(200))
    expect(sanitiseFileName(`é`.repeat(150))).toBe(`é`.repeat(100))    // two bytes each
    expect(sanitiseFileName(`a${`\u{1F600}`.repeat(60)}`)).toBe(`a${`\u{1F600}`.repeat(49)}`)   // four bytes each, never split
    expect(sanitiseFileName(`${`a`.repeat(198)} .b`)).toBe(`a`.repeat(198))       // no trailing space or dot left
    expect(fileNameFor(`${`x`.repeat(250)}.tsv`, `tsv`)).toBe(`${`x`.repeat(200)}.tsv`)
    expect(new TextEncoder().encode(fileNameFor(`é`.repeat(300), `json`)).length).toBe(205)
  })

  it(`puts _ before a Windows device name, with or without an extension`, () => {
    expect([`CON`, `con.foo`, `Aux`, `nul.tar`, `PRN`, `COM1`, `lpt9.tsv`, `clock$`].map(name => sanitiseFileName(name)))
      .toEqual([`_CON`, `_con.foo`, `_Aux`, `_nul.tar`, `_PRN`, `_COM1`, `_lpt9.tsv`, `_clock$`])
    expect([`console`, `COM0`, `COM10`, `lpt1x`, `my con`, `CON-data`].map(name => sanitiseFileName(name)))
      .toEqual([`console`, `COM0`, `COM10`, `lpt1x`, `my con`, `CON-data`])
    expect(fileNameFor(` con `, `tsv`)).toBe(`_con.tsv`)
    expect(sanitiseFileName(`///`, `nul`)).toBe(`_nul`)
  })

  it(`falls back to the default name, cleaned, or to expression-data when nothing is left`, () => {
    expect(sanitiseFileName(`///`, `SORBI_3006G095600-JGI-SB-1`)).toBe(`SORBI_3006G095600-JGI-SB-1`)
    expect(sanitiseFileName(``, `a/b`)).toBe(`ab`)
    expect(sanitiseFileName(`  `, `..`)).toBe(`expression-data`)
    expect(sanitiseFileName(undefined)).toBe(`expression-data`)
  })

  it(`appends the format's extension unless the name already ends with it, in any case`, () => {
    expect(withExtension(`data`, `tsv`)).toBe(`data.tsv`)
    expect(withExtension(`data.tsv`, `tsv`)).toBe(`data.tsv`)
    expect(withExtension(`DATA.TSV`, `tsv`)).toBe(`DATA.TSV`)
    expect(withExtension(`data.json`, `tsv`)).toBe(`data.json.tsv`)
    expect(withExtension(`data.Json`, `json`)).toBe(`data.Json`)
    expect(withExtension(`data.tsv`, `json`)).toBe(`data.tsv.json`)
    expect(fileNameFor(` a:b.tsv `, `tsv`)).toBe(`ab.tsv`)
    expect(fileNameFor(`?`, `json`, `fallback`)).toBe(`fallback.json`)
  })

  it(`lists tab-delimited text first, then JSON`, () => {
    expect(Object.entries(FORMATS).map(([key, {label, extension, mimeType}]) => [key, label, extension, mimeType])).toEqual([
      [`tsv`, `Tab-delimited text (.tsv)`, `.tsv`, `text/tab-separated-values`],
      [`json`, `JSON (.json)`, `.json`, `application/json`]
    ])
  })
})

describe(`saveFile and tsvLines`, () => {
  it(`hands downloadjs a UTF-8 Blob of the content, the file name and the MIME type`, async () => {
    saveFile(`a\t—\n`, `x.tsv`, `tsv`)
    expect(download).toHaveBeenCalledTimes(1)
    const [blob, fileName, mimeType] = download.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe(`text/tab-separated-values;charset=utf-8`)
    expect(blob.size).toBe(6)   // — is three bytes in UTF-8
    expect(await textOf(blob)).toBe(`a\t—\n`)
    expect([fileName, mimeType]).toEqual([`x.tsv`, `text/tab-separated-values`])
  })

  it(`writes a line per row, with empty cells for null and no tabs or line breaks inside a cell`, () => {
    expect(tsvLines([[`a`, null, 1.5, undefined], [`b\tc`, `d\r\ne`, 0, false]])).toBe(`a\t\t1.5\t\nb c\td e\t0\tfalse\n`)
  })
})

// A host of the dialog: its own Download button, as DownloadDialogButton renders it, plus something else to focus
const Host = ({buildContent, ...props}) => {
  const [show, setShow] = useState(false)
  const buttonRef = useRef(null)
  return (
    <>
      <button ref={buttonRef} type={`button`} onClick={() => setShow(true)}>Open</button>
      <input aria-label={`elsewhere`} />
      <DownloadDialog
        show={show}
        onHide={() => setShow(false)}
        returnFocusRef={buttonRef}
        defaultFileName={`SORBI_3006G095600-JGI-SB-1`}
        summary={`31 samples of JGI-SB-1`}
        buildContent={buildContent}
        {...props} />
    </>
  )
}

const contentOf = format => (format === `json` ? `{"a": 1}\n` : `a\tb\n`)

const open = async (user, name = `Open`) => {
  await user.click(screen.getByRole(`button`, {name}))
  return screen.findByRole(`dialog`)
}
const closed = () => waitFor(() => expect(screen.queryByRole(`dialog`)).toBeNull())
const nameInput = dialog => within(dialog).getByRole(`textbox`, {name: `File name`})
const radio = (dialog, name) => within(dialog).getByRole(`radio`, {name})
const downloadButton = dialog => within(dialog).getByRole(`button`, {name: `Download`})

describe(`DownloadDialog`, () => {
  it(`asks for a file name (prefilled, focused and selected) and a format (tab-delimited text by default)`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} />)
    const dialog = await open(user)

    expect(dialog).toHaveClass(`gxa-heatmap-modal`)
    expect(dialog).toHaveAccessibleName(`Download`)
    expect(dialog).toHaveAccessibleDescription(`31 samples of JGI-SB-1`)
    const input = nameInput(dialog)
    expect(input).toHaveValue(`SORBI_3006G095600-JGI-SB-1`)
    expect(input).toHaveFocus()
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length])
    expect(input).toHaveAccessibleDescription(`Saved as SORBI_3006G095600-JGI-SB-1.tsv`)

    const format = within(dialog).getByRole(`group`, {name: `Format`})
    expect(within(format).getAllByRole(`radio`).map(r => r.labels[0].textContent))
      .toEqual([`Tab-delimited text (.tsv)`, `JSON (.json)`])
    expect(radio(dialog, `Tab-delimited text (.tsv)`)).toBeChecked()
    expect(radio(dialog, `JSON (.json)`)).not.toBeChecked()
    expect(within(dialog).getByRole(`button`, {name: `Cancel`})).toBeEnabled()
    expect(downloadButton(dialog)).toBeEnabled()
    expect(downloadButton(dialog)).toHaveAttribute(`type`, `submit`)
  })

  it(`saves the content of the chosen format under the name typed, with its extension, then closes`, async () => {
    const user = userEvent.setup()
    const buildContent = vi.fn(contentOf)
    const onDownload = vi.fn()
    render(<Host buildContent={buildContent} onDownload={onDownload} />)
    const dialog = await open(user)

    await user.keyboard(`msd2 grid`)    // typing replaces the name, which is selected
    await user.click(radio(dialog, `JSON (.json)`))
    expect(nameInput(dialog)).toHaveAccessibleDescription(`Saved as msd2 grid.json`)
    await user.click(downloadButton(dialog))

    expect(buildContent).toHaveBeenCalledTimes(1)
    expect(buildContent).toHaveBeenCalledWith(`json`)
    expect(download).toHaveBeenCalledTimes(1)
    expect(await lastDownload()).toMatchObject({content: `{"a": 1}\n`, fileName: `msd2 grid.json`, mimeType: `application/json`})
    expect(onDownload).toHaveBeenCalledWith({fileName: `msd2 grid.json`, format: `json`})
    await closed()
  })

  it(`submits with Enter, and does not add the extension twice`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} />)
    const dialog = await open(user)
    await user.clear(nameInput(dialog))
    await user.type(nameInput(dialog), `Expression.TSV{Enter}`)
    expect(await lastDownload()).toMatchObject({content: `a\tb\n`, fileName: `Expression.TSV`, mimeType: `text/tab-separated-values`})
    await closed()
  })

  it(`sanitises the name it saves under`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} />)
    const dialog = await open(user)
    await user.clear(nameInput(dialog))
    await user.type(nameInput(dialog), `../results/msd2:JGI*?`)
    expect(nameInput(dialog)).toHaveAccessibleDescription(`Saved as resultsmsd2JGI.tsv`)
    await user.click(downloadButton(dialog))
    expect((await lastDownload()).fileName).toBe(`resultsmsd2JGI.tsv`)

    // nothing usable left: the default name
    const again = await open(user)
    await user.clear(nameInput(again))
    await user.type(nameInput(again), `///`)
    await user.keyboard(`{Enter}`)
    expect((await lastDownload()).fileName).toBe(`SORBI_3006G095600-JGI-SB-1.tsv`)
  })

  // The modal stays in the page while it fades out: a double click or a second Enter came in then
  it(`saves once however often Download is clicked or Enter pressed before it has closed`, async () => {
    const user = userEvent.setup()
    const buildContent = vi.fn(contentOf)
    const onDownload = vi.fn()
    render(<Host buildContent={buildContent} onDownload={onDownload} />)
    const dialog = await open(user)
    const button = downloadButton(dialog)
    const form = dialog.querySelector(`form`)

    fireEvent.click(button)
    expect(screen.getByRole(`dialog`)).toBe(dialog)     // still fading out
    expect(button).toBeDisabled()
    fireEvent.click(button)
    fireEvent.submit(form)
    fireEvent.keyDown(nameInput(dialog), {key: `Enter`, code: `Enter`})
    fireEvent.submit(form)
    await closed()
    expect(buildContent).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledTimes(1)

    // and once again at the next opening
    const again = await open(user)
    await user.dblClick(downloadButton(again))
    await closed()
    expect(download).toHaveBeenCalledTimes(2)
  })

  it(`opens the full experiment data once however often its link is clicked before it has closed`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} fullDatasetUrl={`https://example.org/all.tsv`} />)
    const dialog = await open(user)
    const full = within(dialog).getByRole(`button`, {name: `Full experiment data on Expression Atlas`})
    fireEvent.click(full)
    expect(full).toBeDisabled()
    fireEvent.click(full)
    await closed()
    expect(window.open).toHaveBeenCalledTimes(1)

    const again = await open(user)
    await user.dblClick(within(again).getByRole(`button`, {name: /Full experiment data/}))
    await closed()
    expect(window.open).toHaveBeenCalledTimes(2)
    expect(download).not.toHaveBeenCalled()
  })

  it(`disables Download while the name is blank, and Enter does nothing then`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} />)
    const dialog = await open(user)
    await user.clear(nameInput(dialog))
    expect(downloadButton(dialog)).toBeDisabled()
    expect(nameInput(dialog)).toHaveAccessibleDescription(`Enter a file name.`)
    await user.type(nameInput(dialog), `   {Enter}`)
    expect(downloadButton(dialog)).toBeDisabled()
    expect(download).not.toHaveBeenCalled()
    expect(screen.getByRole(`dialog`)).toBeInTheDocument()

    await user.type(nameInput(dialog), `x`)
    expect(downloadButton(dialog)).toBeEnabled()
  })

  it(`does nothing on Cancel, the close button or Escape, and starts afresh each time it opens`, async () => {
    const user = userEvent.setup()
    const buildContent = vi.fn(contentOf)
    render(<Host buildContent={buildContent} />)

    let dialog = await open(user)
    await user.type(nameInput(dialog), `changed`)
    await user.click(radio(dialog, `JSON (.json)`))
    await user.click(within(dialog).getByRole(`button`, {name: `Cancel`}))
    await closed()

    dialog = await open(user)
    expect(nameInput(dialog)).toHaveValue(`SORBI_3006G095600-JGI-SB-1`)
    expect(radio(dialog, `Tab-delimited text (.tsv)`)).toBeChecked()
    await user.click(radio(dialog, `JSON (.json)`))
    await user.click(within(dialog).getByRole(`button`, {name: `Close`}))
    await closed()

    dialog = await open(user)
    expect(radio(dialog, `Tab-delimited text (.tsv)`)).toBeChecked()
    await user.click(radio(dialog, `JSON (.json)`))
    await user.keyboard(`{Escape}`)
    await closed()

    // after a JSON download too
    dialog = await open(user)
    expect(radio(dialog, `Tab-delimited text (.tsv)`)).toBeChecked()
    expect(buildContent).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
    await user.click(radio(dialog, `JSON (.json)`))
    await user.click(downloadButton(dialog))
    await closed()
    dialog = await open(user)
    expect(radio(dialog, `Tab-delimited text (.tsv)`)).toBeChecked()
  })

  it(`gives the focus back to the button that opened it`, async () => {
    const user = userEvent.setup()
    render(<Host buildContent={vi.fn(contentOf)} />)
    const button = screen.getByRole(`button`, {name: `Open`})

    let dialog = await open(user)
    await user.click(within(dialog).getByRole(`button`, {name: `Cancel`}))
    await closed()
    await waitFor(() => expect(button).toHaveFocus())

    // even when the click did not focus it (Safari)
    screen.getByRole(`textbox`, {name: `elsewhere`}).focus()
    dialog = await open(user)
    button.blur()
    await user.click(downloadButton(dialog))
    await closed()
    await waitFor(() => expect(button).toHaveFocus())
  })

  it(`asks the reader to agree to a disclaimer first, and shows its links in linkTarget`, async () => {
    const user = userEvent.setup()
    render(
      <Host buildContent={vi.fn(contentOf)} disclaimer={disclaimers.blueprint} linkTarget={`_self`}
        fullDatasetUrl={`https://example.org/all.tsv`} />)
    const dialog = await open(user)
    expect(dialog.querySelector(`.modal-dialog`)).toHaveClass(`modal-lg`)

    const statement = within(dialog).getByRole(`region`, {name: `Data reuse statement`})
    expect(within(statement).getByText(`The Blueprint Project Data Reuse Statement`)).toBeInTheDocument()
    const link = within(statement).getByRole(`link`, {name: `www.blueprint-epigenome.eu`})
    expect(link).toHaveAttribute(`target`, `_self`)

    const agree = within(dialog).getByRole(`checkbox`, {name: `I agree to the data reuse statement above`})
    expect(agree).not.toBeChecked()
    expect(downloadButton(dialog)).toBeDisabled()
    expect(within(dialog).getByRole(`button`, {name: `Full experiment data on Expression Atlas`})).toBeDisabled()
    await user.type(nameInput(dialog), `{Enter}`)
    expect(download).not.toHaveBeenCalled()

    await user.click(agree)
    expect(downloadButton(dialog)).toBeEnabled()
    await user.click(downloadButton(dialog))
    expect(download).toHaveBeenCalledTimes(1)
    await closed()

    // agreed to again at each opening
    const again = await open(user)
    expect(within(again).getByRole(`checkbox`, {name: /I agree/})).not.toBeChecked()
    expect(downloadButton(again)).toBeDisabled()
  })

  it(`opens the full experiment data in linkTarget only when there is a fullDatasetUrl, and closes`, async () => {
    const user = userEvent.setup()
    const {unmount} = render(<Host buildContent={vi.fn(contentOf)} fullDatasetUrl={`https://example.org/all.tsv`} />)
    const dialog = await open(user)
    const full = within(dialog).getByRole(`button`, {name: `Full experiment data on Expression Atlas`})
    expect(full.closest(`.modal-body`)).not.toBeNull()
    await user.click(full)
    expect(window.open).toHaveBeenCalledWith(`https://example.org/all.tsv`, `_blank`, `noopener,noreferrer`)
    expect(download).not.toHaveBeenCalled()
    await closed()
    unmount()

    render(<Host buildContent={vi.fn(contentOf)} />)
    const withoutUrl = await open(user)
    expect(within(withoutUrl).queryByRole(`button`, {name: /Full experiment data/})).toBeNull()
  })
})

describe(`DownloadDialogButton`, () => {
  it(`is a small outlined Download button that opens the dialog`, async () => {
    const user = userEvent.setup()
    render(
      <DownloadDialogButton className={`my-download`} defaultFileName={`x`} summary={`1 row`} buildContent={contentOf} />)
    const button = screen.getByRole(`button`, {name: `Download`})
    expect(button).toHaveClass(`btn-sm`, `btn-outline-secondary`, `my-download`)
    expect(button).toHaveAttribute(`aria-haspopup`, `dialog`)
    expect(button.querySelector(`svg.gxa-icon-download`)).not.toBeNull()

    await user.click(button)
    const dialog = await screen.findByRole(`dialog`)
    expect(nameInput(dialog)).toHaveValue(`x`)
    await user.click(downloadButton(dialog))
    expect(await lastDownload()).toMatchObject({fileName: `x.tsv`, content: `a\tb\n`})
    await closed()
    await waitFor(() => expect(button).toHaveFocus())
  })
})
