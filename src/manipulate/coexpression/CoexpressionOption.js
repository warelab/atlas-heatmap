import React from 'react'
import PropTypes from 'prop-types'

import Button from 'react-bootstrap/lib/Button'
import Glyphicon from 'react-bootstrap/lib/Glyphicon'
import Slider from 'rc-slider'

const AddCoexpressedGenesButton = ({showCoexpressionsCallback}) =>
  <Button bsSize={`xsmall`} onClick={() => showCoexpressionsCallback(10)}>
    <Glyphicon glyph={`th`}/>
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

const CoexpressedGenesSlider = ({geneName, numCoexpressionsAvailable, numCoexpressionsVisible, showCoexpressionsCallback}) =>
  <div>
    <p style={{fontSize: `0.75rem`}}>Display genes with similar expression to {geneName}:</p>
    <div style={sliderContainerStyle}>
      <Slider
        min={0}
        max={numCoexpressionsAvailable}
        onAfterChange={showCoexpressionsCallback}
        marks={{0: `off`, 10: `10`, [numCoexpressionsAvailable]: numCoexpressionsAvailable}}
        included={false}
        defaultValue={numCoexpressionsVisible} />
    </div>
  </div>

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
