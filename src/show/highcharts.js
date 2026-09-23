import Highcharts from 'highcharts'
import HighchartsHeatmap from 'highcharts/modules/heatmap.js'
import HighchartsCustomEvents from 'highcharts-custom-events'

// Highcharts 6.2 with the modules the heatmap needs. Nothing happens at import time (the package has no module-scope
// side effects): the modules are registered on first use. The flag lives on the Highcharts object, not in this module,
// because the modules patch Highcharts' prototypes: a second copy of this module (another bundle chunk, a test
// re-importing src/) must not register them again, or every axis label handler would run twice.
//
// There is no window.Highcharts: a host that also loads a global Highcharts of another version gets Highcharts error 16.
const initOnce = (H, flag, init) => {
  if (!H[flag]) {
    init(H)
    Object.defineProperty(H, flag, {value: true})
  }
  return H
}

// Heatmap series, plus labels with mouseover/mouseout events (highcharts-custom-events 3; 4.x needs Highcharts 9)
const getHeatmapHighcharts = () => initOnce(Highcharts, `__gxaHeatmapInit`, H => {
  HighchartsHeatmap(H)
  HighchartsCustomEvents(H)
})

export {initOnce, getHeatmapHighcharts}
export default getHeatmapHighcharts
