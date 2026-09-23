import PropTypes from 'prop-types'
import { describe, expect, it } from 'vitest'

import DataPropTypes from '../../src/layout/jsonPayloadPropTypes.js'
import { allowConsole } from '../consoleGuard.js'
import allStudies from '../fixtures/all-studies.SORBI_3001G000200.json'
import allStudiesV11 from '../fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import curd25 from '../fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../fixtures/paralogs.E-GEOD-30249.differential.json'
import geod167101 from '../fixtures/paralogs.E-GEOD-167101.baseline.json'

// Container.js validates the payload with these propTypes in development builds. A failure is a console.error,
// which the console guard turns into a test failure.
const check = (data, name) => PropTypes.checkPropTypes({data: DataPropTypes.isRequired}, {data}, `prop`, name)

describe(`jsonPayloadPropTypes`, () => {
  it.each([
    [`All Studies`, allStudies],
    [`All Studies (sorghum_v11)`, allStudiesV11],
    [`E-CURD-25 baseline`, curd25],
    [`E-GEOD-167101 baseline`, geod167101],
    // No designElement, and no contrastName in the expressions
    [`E-GEOD-30249 differential`, geod30249],
  ])(`accepts the Warelab %s payload`, (name, fixture) => {
    check(fixture.body, name)
  })

  it(`reports an invalid payload`, () => {
    allowConsole()
    check({...curd25.body, profiles: undefined}, `InvalidPayload`)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`profiles`))
  })
})
