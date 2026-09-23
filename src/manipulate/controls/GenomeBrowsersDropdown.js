import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'react-bootstrap'
import { Eye, EyeSlash } from './icons.js'

const buttonUnsetStyles = {
  textTransform: `unset`,
  letterSpacing: `unset`,
  height: `unset`
}

const genomeBrowserIcon = (genomeBrowser) => {
  switch (genomeBrowser) {
  case `none`:
    return EyeSlash
  default:
    return Eye
  }
}

const GenomeBrowsersDropdown = ({genomeBrowsers: genomeBrowserNames, selected, onSelect}) => {
  const genomeBrowsers = genomeBrowserNames.map(genomeBrowserName => ({
    id: genomeBrowserName.replace(/\s+/g, ``).toLowerCase(),
    label: `${genomeBrowserName} genome browser`
  }))
  // Upstream threw when `selected` was not one of the genome browsers
  const current = genomeBrowsers.find(gb => selected === gb.id)
  const GenomeBrowserIcon = genomeBrowserIcon(selected)

  return (
    <div title={`Choose genome browser`}>
      <Dropdown onSelect={(eventKey) => onSelect && onSelect(eventKey)}>

        <Dropdown.Toggle size={`sm`} variant={`outline-secondary`} style={buttonUnsetStyles}>
          <GenomeBrowserIcon/>
          &nbsp;{current ? current.label : `Choose genome browser`}
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {genomeBrowsers.map(gb =>
            <Dropdown.Item as={`button`} type={`button`} key={gb.id} eventKey={gb.id} active={gb.id === selected}>
              {gb.label}
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  )
}

GenomeBrowsersDropdown.propTypes = {
  genomeBrowsers: PropTypes.arrayOf(PropTypes.string).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func
}

export default GenomeBrowsersDropdown
