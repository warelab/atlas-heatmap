import Highcharts from 'highcharts'
import HighchartsMore from 'highcharts/highcharts-more.js'

import {initOnce} from './highcharts.js'
import allowNegativeLog from './HighchartsAllowNegativeLog.js'

// Highcharts 6.2 with the boxplot series (highcharts-more) and logarithmic axes that allow negative values, for the
// gene-specific boxplot and transcript charts. Only the lazily loaded GeneSpecificResults chunk imports this module, so
// highcharts-more stays out of the host's main bundle; see ./highcharts.js for the registration flag.
const getBoxplotHighcharts = () => initOnce(Highcharts, `__gxaBoxplotInit`, H => {
  HighchartsMore(H)
  allowNegativeLog(H)
})

export default getBoxplotHighcharts
