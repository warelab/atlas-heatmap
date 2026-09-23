import React from 'react'
import PropTypes from 'prop-types'
import { Button, Dropdown, Modal, SplitButton } from 'react-bootstrap'

import { uncontrollable } from 'uncontrollable'
import disclaimers from './disclaimers.js'
import ClientSideDownload from './Download.js'
import {Download as DownloadIcon} from '../icons.js'
import {openUrl} from '../../../layout/links.js'

import { heatmapDataPropTypes } from '../../../manipulate/chartDataPropTypes.js'

const buttonUnsetStyles = {
  textTransform: `unset`,
  letterSpacing: `unset`,
  height: `unset`
}

// The modal renders in a portal outside .gxaHeatmapContainer; .gxa-heatmap-modal scopes its styles
const _DownloadWithModal = ({showModal, onChangeShowModal, Disclaimer, downloadOptions}) => (
  <div>
    <Button
      size={`sm`}
      variant={`outline-secondary`}
      onClick={() => onChangeShowModal(true)}
      title={`Download`}
      style={buttonUnsetStyles}>
      <DownloadIcon /> Download
    </Button>

    <Modal show={showModal} onHide={() => onChangeShowModal(false)} className={`gxa-heatmap-modal`}>
      <Modal.Header closeButton>
        <Modal.Title>
          Data Reuse Licence Agreement
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Disclaimer />
      </Modal.Body>

      <Modal.Footer>
        <Button variant={`secondary`} onClick={() => onChangeShowModal(false)}>
          Close
        </Button>
        {
          downloadOptions.map(o => (
            <Button
              key={o.description}
              variant={`primary`}
              onClick={() => {
                o.onClick()
                onChangeShowModal(false)
              }}>
              {`Download: ${o.description}`}
            </Button>
          ))
        }
      </Modal.Footer>
    </Modal>
  </div>
)

const DownloadWithModal = uncontrollable(_DownloadWithModal, { showModal: `onChangeShowModal` })

// The main button runs the first option (react-bootstrap 2's SplitButton hands onClick to it, not to the toggle)
const SplitDownloadButton = ({downloadOptions}) => (
  <SplitButton
    size={`sm`}
    variant={`outline-secondary`}
    onClick={downloadOptions[0].onClick}
    title={<><DownloadIcon /> Download</>}
    toggleLabel={`More download options`}>
    {
      downloadOptions.map((o,ix) => (
        <Dropdown.Item
          as={`button`}
          type={`button`}
          key={o.description}
          eventKey={String(ix)}
          onClick={o.onClick}>
          <DownloadIcon /> {o.description}
        </Dropdown.Item>
      ))
    }
  </SplitButton>
)


// fullDatasetUrl is final (resolveUrl applied, cutoff set); without one there is no “All data” option
const DownloadButton = ({currentlyShownContent, fullDatasetUrl, disclaimer, linkTarget, isSingleExperiment = Boolean(fullDatasetUrl)}) => {
  const downloadOptions = [].concat(
    fullDatasetUrl ?
      [{
        onClick: () => openUrl(fullDatasetUrl, linkTarget),
        description: `All data`
      }] :
      [],
    [{
      onClick: () => ClientSideDownload({...currentlyShownContent, isSingleExperiment}),
      description : `Table content`
    }]
  )

  return (
    disclaimers[disclaimer] ?
      <DownloadWithModal
        defaultShowModal={false}
        Disclaimer={disclaimers[disclaimer]}
        downloadOptions={downloadOptions} /> :
      <SplitDownloadButton downloadOptions={downloadOptions}/>
  )
}

DownloadButton.propTypes = {
  currentlyShownContent: PropTypes.shape({
    name: PropTypes.string.isRequired,
    descriptionLines : PropTypes.arrayOf(PropTypes.string).isRequired,
    heatmapData: heatmapDataPropTypes,
  }).isRequired,
  fullDatasetUrl: PropTypes.string.isRequired,
  disclaimer: PropTypes.string.isRequired,
  linkTarget: PropTypes.string,
  isSingleExperiment: PropTypes.bool
}

export default DownloadButton
