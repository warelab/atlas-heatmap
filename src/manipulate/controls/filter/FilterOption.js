import React from 'react'
import PropTypes from 'prop-types'
import xor from 'lodash/xor.js'
import { uncontrollable } from 'uncontrollable'
import { ChevronDown, ChevronUp } from '../icons.js'

const _FilterOption = ({ name, allValues, currentValues, isOpen, onChangeIsOpen, onChangeCurrentValues }) => {
  const allChecked = allValues.every(v => currentValues.includes(v))
  const allUnchecked = allValues.every(v => !currentValues.includes(v))

  const openable = allValues.length !== 1 || allValues[0] !==name
  // .gxa-filter-option-label is an inline block with its first letter capitalised (src/styles/heatmap.css; buttons
  // themselves take no ::first-letter)
  const label = <span className={`gxa-filter-option-label`}>{name}</span>
  return (
    <div>
      <input type={`checkbox`}
        style={{margin: `10px 0 0 `}}
        value={name}
        aria-label={name}
        onChange={
          () => onChangeCurrentValues(xor(allValues, currentValues).length ? allValues: [])
        }
        checked={allChecked}
        ref={checkbox => {checkbox ? checkbox.indeterminate = !allChecked && !allUnchecked : null}} />

      {openable ?
        <button type={`button`} className={`gxa-filter-option-name`} aria-expanded={isOpen} onClick={() => onChangeIsOpen(!isOpen)}>
          {label} {isOpen ?
            <ChevronUp style={{fontSize: `x-small`, marginLeft: `5px`}}/> :
            <ChevronDown style={{fontSize: `x-small`, marginLeft: `5px`}}/>}
        </button> :
        <span className={`gxa-filter-option-name`}>{label}</span>
      }

      {openable && isOpen &&
      <div>
        {allValues.map(value => (
          <div key={value} style={{marginLeft: `20px`, fontSize: `smaller`}}>
            <input type={`checkbox`}
              value={value}
              aria-label={value}
              onChange={() => onChangeCurrentValues(xor([value], currentValues))}
              checked={currentValues.includes(value)}
              style={{margin: `0`}}/>
            <span> {value}</span>
          </div>
        ))}
      </div>
      }
    </div>
  )
}

_FilterOption.propTypes = {
  name: PropTypes.string.isRequired,
  allValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  currentValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChangeCurrentValues: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onChangeIsOpen: PropTypes.func.isRequired,
}

// Callers pass defaultIsOpen={false} (no defaultProps)
const FilterOption = uncontrollable(
  _FilterOption, {
    isOpen: `onChangeIsOpen`
  }
)

export default FilterOption
