import React, {useEffect, useId, useRef, useState} from 'react'
import PropTypes from 'prop-types'
import { Button, Form, Modal } from 'react-bootstrap'

import {Download as DownloadIcon} from '../icons.js'
import {openUrl} from '../../../layout/links.js'
import {DEFAULT_FORMAT, fileNameFor, FORMATS, sanitiseFileName, saveFile} from './downloadFile.js'

const buttonUnsetStyles = {
  textTransform: `unset`,
  letterSpacing: `unset`,
  height: `unset`
}

/**
 * The Download dialog of the heatmap and the factor grid: a file name (prefilled with `defaultFileName`, focused and
 * selected) and a format (tab-delimited text, preselected each time the dialog opens, or JSON). Download (or Enter)
 * saves `buildContent(format)` under the name, sanitised and with the format's extension, and closes the dialog, once
 * per opening (a double click saves one file); it is disabled while the name is blank and while the dialog closes. With a `disclaimer` (a component), the dialog shows it and Download waits for the
 * reader to agree to it. With a `fullDatasetUrl`, a link opens the experiment's full data in `linkTarget`. Focus goes
 * back to `returnFocusRef` (the button that opened the dialog) when it closes.
 *
 * The modal renders in a portal outside .gxaHeatmapContainer; .gxa-heatmap-modal scopes its styles.
 */
const DownloadDialog = ({
  show, onHide, defaultFileName, summary, buildContent, disclaimer: Disclaimer, fullDatasetUrl, linkTarget,
  returnFocusRef, onDownload
}) => {
  const ids = useId()
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState(() => sanitiseFileName(defaultFileName))
  const [format, setFormat] = useState(DEFAULT_FORMAT)
  const [accepted, setAccepted] = useState(false)

  // Each opening starts afresh: the default name, tab-delimited text, and the disclaimer not yet agreed to
  const [shown, setShown] = useState(show)
  if (show !== shown) {
    setShown(show)
    if (show) {
      setFileName(sanitiseFileName(defaultFileName))
      setFormat(DEFAULT_FORMAT)
      setAccepted(false)
    }
  }

  // Set by the first Download (or full data link) of an opening: the modal stays in the page, and its buttons
  // clickable, while it fades out, and a double click or a second Enter must not save the file twice
  const doneRef = useRef(false)
  useEffect(() => {
    if (show) {
      doneRef.current = false
    }
  }, [show])
  // Once only per opening, and not while the dialog is closing
  const once = action => {
    if (!show || doneRef.current) {
      return false
    }
    doneRef.current = true
    action()
    return true
  }

  const needsAgreement = Boolean(Disclaimer) && !accepted
  const canDownload = show && fileName.trim() !== `` && !needsAgreement
  const savedAs = fileNameFor(fileName, format, defaultFileName)

  const submit = event => {
    event.preventDefault()
    if (canDownload && once(() => saveFile(buildContent(format), savedAs, format))) {
      onHide()
      onDownload && onDownload({fileName: savedAs, format})
    }
  }

  const openFullDataset = () => {
    if (once(() => openUrl(fullDatasetUrl, linkTarget))) {
      onHide()
    }
  }

  // Focus the name, selected so that typing replaces it (restart-ui's Modal then leaves the focus where it is)
  const focusName = () => {
    const input = inputRef.current
    if (input) {
      input.focus()
      input.select()
    }
  }

  const returnFocus = () => {
    const element = returnFocusRef && returnFocusRef.current
    element && typeof element.focus === `function` && element.focus()
  }

  return (
    <Modal
      show={show}
      onHide={onHide}
      onShow={focusName}
      onExited={returnFocus}
      restoreFocus={!returnFocusRef}
      size={Disclaimer ? `lg` : undefined}
      aria-labelledby={`${ids}-title`}
      aria-describedby={`${ids}-summary`}
      className={`gxa-heatmap-modal gxa-download-modal`}>
      <Form noValidate onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title id={`${ids}-title`}>Download</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p id={`${ids}-summary`} className={`gxa-download-summary`}>{summary}</p>

          <Form.Group controlId={`${ids}-name`} className={`mb-3`}>
            <Form.Label>File name</Form.Label>
            <Form.Control
              ref={inputRef}
              type={`text`}
              value={fileName}
              onChange={event => setFileName(event.target.value)}
              autoComplete={`off`}
              spellCheck={false}
              aria-describedby={`${ids}-saved-as`} />
            <Form.Text id={`${ids}-saved-as`} className={`gxa-download-saved-as`} aria-live={`polite`}>
              {fileName.trim() === `` ? `Enter a file name.` : <>Saved as <code>{savedAs}</code></>}
            </Form.Text>
          </Form.Group>

          <fieldset className={`mb-3`}>
            <legend className={`form-label fs-6 mb-2`}>Format</legend>
            {Object.entries(FORMATS).map(([key, {label}]) =>
              <Form.Check
                key={key}
                type={`radio`}
                id={`${ids}-format-${key}`}
                name={`${ids}-format`}
                value={key}
                label={label}
                checked={format === key}
                onChange={() => setFormat(key)} />)}
          </fieldset>

          {Disclaimer &&
            <div className={`mb-3`}>
              <div className={`gxa-download-disclaimer`} role={`region`} aria-label={`Data reuse statement`} tabIndex={0}>
                <Disclaimer linkTarget={linkTarget} />
              </div>
              <Form.Check
                type={`checkbox`}
                id={`${ids}-accept`}
                className={`mt-2`}
                label={`I agree to the data reuse statement above`}
                checked={accepted}
                onChange={event => setAccepted(event.target.checked)} />
            </div>}

          {fullDatasetUrl &&
            <p className={`gxa-download-full mb-0`}>
              <Button
                variant={`link`}
                size={`sm`}
                className={`p-0 align-baseline`}
                disabled={!show || needsAgreement}
                onClick={openFullDataset}>
                Full experiment data on Expression Atlas
              </Button>
              <span className={`form-text`}> (every gene of the experiment, not only what is shown)</span>
            </p>}
        </Modal.Body>

        <Modal.Footer>
          <Button variant={`secondary`} onClick={onHide}>Cancel</Button>
          <Button variant={`primary`} type={`submit`} disabled={!canDownload}>
            <DownloadIcon /> Download
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

DownloadDialog.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  defaultFileName: PropTypes.string,
  summary: PropTypes.node,
  buildContent: PropTypes.func.isRequired,
  disclaimer: PropTypes.elementType,
  fullDatasetUrl: PropTypes.string,
  linkTarget: PropTypes.string,
  returnFocusRef: PropTypes.shape({current: PropTypes.any}),
  onDownload: PropTypes.func
}

/**
 * A Download button that opens the dialog; every prop but `className` goes to DownloadDialog (which gets `show`,
 * `onHide` and `returnFocusRef` from here).
 */
const DownloadDialogButton = ({className, ...dialogProps}) => {
  const [show, setShow] = useState(false)
  const buttonRef = useRef(null)
  return (
    <>
      <Button
        ref={buttonRef}
        size={`sm`}
        variant={`outline-secondary`}
        className={className}
        aria-haspopup={`dialog`}
        onClick={() => setShow(true)}
        style={buttonUnsetStyles}>
        <DownloadIcon /> Download
      </Button>
      <DownloadDialog {...dialogProps} show={show} onHide={() => setShow(false)} returnFocusRef={buttonRef} />
    </>
  )
}

DownloadDialogButton.propTypes = {
  className: PropTypes.string
}

export {DownloadDialogButton}
export default DownloadDialog
