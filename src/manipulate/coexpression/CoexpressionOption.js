import React, {useState} from 'react'
import PropTypes from 'prop-types'

import { Button, Form } from 'react-bootstrap'
import { Grid } from '../controls/icons.js'

const AddCoexpressedGenesButton = ({showCoexpressionsCallback}) =>
  <Button size={`sm`} variant={`outline-secondary`} onClick={() => showCoexpressionsCallback(10)}>
    <Grid/>
    <span className={`gxa-va-middle`}> Add similarly expressed genes</span>
  </Button>

AddCoexpressedGenesButton.propTypes = {
  showCoexpressionsCallback: PropTypes.func.isRequired
}


const sliderContainerStyle = {
  width: `250px`,
  margin: `15px`,
  paddingBottom: `20px`
}

// Marks as rc-slider drew them: off, 10 and the maximum
const RangeMarks = ({max}) =>
  <div className={`gxa-range-marks`} aria-hidden={`true`}>
    {[[0, `off`], ...(max > 10 ? [[10, `10`]] : []), ...(max > 0 ? [[max, String(max)]] : [])].map(([value, label]) =>
      <span key={value} className={`gxa-range-mark`} style={{left: `${max > 0 ? 100 * value / max : 0}%`}}>{label}</span>
    )}
  </div>

RangeMarks.propTypes = {
  max: PropTypes.number.isRequired
}

// A Bootstrap range input in place of rc-slider. Like rc-slider's onAfterChange, the number of genes is committed when
// the thumb is released (mouse, touch or key), not on every step of a drag.
const CoexpressedGenesSlider = ({geneName, numCoexpressionsAvailable, numCoexpressionsVisible, showCoexpressionsCallback}) => {
  const [value, setValue] = useState(numCoexpressionsVisible)
  const commit = () => {
    value !== numCoexpressionsVisible && showCoexpressionsCallback(value)
  }

  return (
    <div>
      <p style={{fontSize: `0.75rem`}}>Display genes with similar expression to {geneName}:</p>
      <div style={sliderContainerStyle}>
        <Form.Range
          min={0}
          max={numCoexpressionsAvailable}
          step={1}
          value={value}
          aria-label={`Genes with similar expression to ${geneName}`}
          aria-valuetext={value ? String(value) : `off`}
          onChange={event => setValue(Number(event.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit} />
        <RangeMarks max={numCoexpressionsAvailable} />
      </div>
    </div>
  )
}

CoexpressedGenesSlider.propTypes = {
  geneName: PropTypes.string.isRequired,
  numCoexpressionsVisible: PropTypes.number.isRequired,
  numCoexpressionsAvailable: PropTypes.number.isRequired,
  ...AddCoexpressedGenesButton.propTypes
}


const CoexpressionOption = ({geneName, numCoexpressionsVisible, numCoexpressionsAvailable, showCoexpressionsCallback}) =>
  <div style={{marginTop: `30px`}}>
    {
      numCoexpressionsAvailable ?
        numCoexpressionsVisible ?
          <div>
            <CoexpressedGenesSlider
              geneName={geneName}
              numCoexpressionsVisible={numCoexpressionsVisible}
              numCoexpressionsAvailable={numCoexpressionsAvailable}
              showCoexpressionsCallback={showCoexpressionsCallback} />
          </div> :
          <AddCoexpressedGenesButton showCoexpressionsCallback={showCoexpressionsCallback} /> :
        <span>No genes with similar expression to {geneName} could be found</span>
    }
  </div>

CoexpressionOption.propTypes = {
  ...CoexpressedGenesSlider.propTypes
}

export default CoexpressionOption
