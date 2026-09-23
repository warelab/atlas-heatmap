import React, {useCallback, useMemo} from 'react'
import PropTypes from 'prop-types'
import URI from 'urijs'

import ExperimentDescription from './ExperimentDescription.js'
import Footer from './Footer.js'

import ChartContainer from '../manipulate/ChartContainer.js'

import DataPropTypes from './jsonPayloadPropTypes.js'
import loadChartData from '../load/main.js'
import {keepDefaultUrl, SUPPORT_URL} from './links.js'

const Container = (props) => {
  const {data, inProxy, outProxy, atlasUrl, showAnatomogram, showControlMenu, isWidget, linkTarget} = props
  const {geneQuery, conditionQuery, species} = data.config

  // Every link of this payload tells resolveUrl which experiment it is about (null for the All Studies view)
  const urlForProps = props.urlFor || keepDefaultUrl
  const accession = data.experiment ? data.experiment.accession : null
  const urlFor = useCallback(
    (kind, defaultUrl, context) => urlForProps(kind, defaultUrl, {experiment: accession, ...context}),
    [urlForProps, accession])

  // Built once per payload: re-rendering the page must not rebuild (and redraw) the chart
  const chartData = useMemo(
    () => loadChartData({data, inProxy, outProxy, atlasUrl, showAnatomogram, showControlMenu, isWidget, linkTarget, urlFor}),
    [data, inProxy, outProxy, atlasUrl, showAnatomogram, showControlMenu, isWidget, linkTarget, urlFor])

  const moreInformationUrl = data.experiment ?    // single experiment?
    URI(data.experiment.urls.main_page, atlasUrl) :
    URI(atlasUrl).segment(`query`).search({geneQuery, conditionQuery, species})

  return (
    <div style={{width: `100%`}}>
      { isWidget && data.experiment &&
      <ExperimentDescription
        linkTarget={linkTarget}
        experimentUrl={urlFor(`experiment`, outProxy + URI(data.experiment.urls.main_page, atlasUrl).toString(), {})}
        description={data.experiment.description} /> }

      <ChartContainer
        chartData={chartData} />

      { isWidget &&
      <Footer
        linkTarget={linkTarget}
        atlasUrl={urlFor(`atlas`, outProxy + atlasUrl, {})}
        moreInformationUrl={urlFor(`moreInformation`, outProxy + moreInformationUrl.toString(), {config: data.config})}
        supportUrl={urlFor(`support`, SUPPORT_URL, {})} /> }
    </div>
  )
}

Container.propTypes = {
  inProxy: PropTypes.string.isRequired,
  outProxy: PropTypes.string.isRequired,
  atlasUrl: PropTypes.string.isRequired,
  showAnatomogram: PropTypes.bool.isRequired,
  isWidget: PropTypes.bool.isRequired,
  linkTarget: PropTypes.string,
  urlFor: PropTypes.func,
  data: DataPropTypes.isRequired
}

export default Container
