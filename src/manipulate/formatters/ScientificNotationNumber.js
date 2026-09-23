/*
 * Copyright EMBL-EBI (Expression Atlas).
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 *
 * From @ebi-gene-expression-group/expression-atlas-number-format 3.2.0, src/ScientificNotationNumber.js
 * (https://github.com/ebi-gene-expression-group/atlas-number-format).
 * Modified for gramene-atlas-heatmap: default parameters replace defaultProps, which React 18.3 deprecates on
 * function components.
 */
import React from 'react'
import PropTypes from 'prop-types'

const removeTrailingZeroes = (str) => str.replace(/(\d)0+$/, `$1`)
const removeLeadingPlus = (str) => str.replace(/^\+/, ``)

const ScientificNotationNumber = ({value, accuracy = 4, style = {}}) => {
  if (value >= 0.1 && value < 100000 || value === 0) {
    return <span>{value}</span>
  }

  const scientificNotationString= value.toExponential(accuracy)
  const mantissaExponent = scientificNotationString.split(`e`)
  const mantissa = removeTrailingZeroes(mantissaExponent[0])
  const exponent = removeLeadingPlus(mantissaExponent[1])

  return(
    <span style={style}>
      {(+mantissa !== 1) ? `${mantissa} × ` : ``}10
      <span style={{verticalAlign: `super`}}>{exponent}</span>
    </span>
  )
}

ScientificNotationNumber.propTypes = {
  value: PropTypes.number.isRequired,
  accuracy: PropTypes.number,
  style: PropTypes.object
}

export default ScientificNotationNumber
