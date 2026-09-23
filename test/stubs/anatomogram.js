// Test double for gramene-anatomogram, aliased in vitest.config.js (and in the dev playground while the real
// package is not installed). It mirrors the public surface the heatmap uses: the default component,
// anatomogramSpecies, normaliseSpecies and isSupportedSpecies. The component renders a marker <div> and
// records the props of every render so tests can inspect them or call its callbacks.

// The 20 species of anatomogram 2.4.0's svgsMetadata.json (upstream `supportedSpecies`), in the same order.
export const anatomogramSpecies = Object.freeze([
  `anolis_carolinensis`,
  `arabidopsis_thaliana`,
  `bos_taurus`,
  `brachypodium_distachyon`,
  `gallus_gallus`,
  `homo_sapiens`,
  `hordeum_vulgare`,
  `macaca_mulatta`,
  `monodelphis_domestica`,
  `mus_musculus`,
  `oryza_sativa`,
  `papio_anubis`,
  `rattus_norvegicus`,
  `solanum_lycopersicum`,
  `solanum_tuberosum`,
  `sorghum_bicolor`,
  `tetraodon_nigroviridis`,
  `triticum_aestivum`,
  `xenopus_tropicalis`,
  `zea_mays`,
])
export const supportedSpecies = anatomogramSpecies

// 'Sorghum bicolor' -> 'sorghum_bicolor'
export const normaliseSpecies = species =>
  typeof species === `string` ? species.toLowerCase().replace(/\s+/g, `_`) : ``

export const isSupportedSpecies = species => anatomogramSpecies.includes(normaliseSpecies(species))

// Props of every render, oldest first.
export const renders = []
export const lastProps = () => renders[renders.length - 1]
export const resetAnatomogramStub = () => {
  renders.length = 0
}

const Anatomogram = props => {
  renders.push(props)
  return <div data-testid={`anatomogram-stub`} data-species={props.species} />
}

export default Anatomogram
