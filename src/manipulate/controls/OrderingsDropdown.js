import React from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'react-bootstrap'
import { SortAlpha, SortDown, SortNumeric } from './icons.js'

const buttonUnsetStyles = {
  textTransform: `unset`,
  letterSpacing: `unset`,
  height: `unset`
}

const orderingIcon = (ordering) => {
  switch (ordering) {
  case `Alphabetical order`:
    return SortAlpha
  case `Expression rank`:
    return SortDown
  case `By experiment type`:
    return SortNumeric
  default:
    return SortNumeric
  }
}

// Items are buttons whose eventKey is the ordering name. Upstream read the name back from event.target.text, which
// only <a> elements have.
// The title sits on a wrapper: a disabled button shows no tooltip.
const OrderingsDropdown = ({allOptions,currentOption,onChangeCurrentOption,title,disabled}) => {
  const OrderingIcon = orderingIcon(currentOption)
  return (
    <div title={title || undefined}>
      <Dropdown onSelect={(eventKey) => onChangeCurrentOption(eventKey)}>

        <Dropdown.Toggle
          size={`sm`}
          variant={`outline-secondary`}
          disabled={disabled}
          style={buttonUnsetStyles}>
          <OrderingIcon /> {currentOption}
        </Dropdown.Toggle>

        <Dropdown.Menu>
          {allOptions.map(option =>
            <Dropdown.Item as={`button`} type={`button`} key={option} eventKey={option} active={option===currentOption}>
              {option}
            </Dropdown.Item>
          )}
        </Dropdown.Menu>

      </Dropdown>
    </div>
  )
}

OrderingsDropdown.propTypes = {
  allOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  currentOption: PropTypes.string.isRequired,
  onChangeCurrentOption: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  disabled:PropTypes.bool.isRequired
}

export default OrderingsDropdown
