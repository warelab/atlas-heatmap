// Placeholder until the playground proper (plan step H9). It renders two components the port does not change,
// which is enough to check that `npm run dev` compiles JSX in .js files under examples/, src/ and test/.
import 'bootstrap/dist/css/bootstrap.min.css'
import { createRoot } from 'react-dom/client'

import GradientHeatmapLegend from '../../src/manipulate/heatmap-legend/GradientHeatmapLegend.js'
import Anatomogram from 'gramene-anatomogram'

createRoot(document.getElementById(`root`)).render(
  <div className={`container py-3`}>
    <h1 className={`h4`}>gramene-atlas-heatmap playground</h1>
    <p>The heatmap playground arrives with the React 18 port. For now this page only checks the toolchain.</p>
    <GradientHeatmapLegend unit={`Log2 fold change`} gradients={[{fromValue: -3, toValue: 3, colours: [`#0000ff`, `#ffffff`, `#ff0000`]}]}/>
    <Anatomogram species={`sorghum_bicolor`}/>
  </div>
)
