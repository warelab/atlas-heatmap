// Hand-written declarations for gramene-atlas-heatmap (the source is plain JavaScript). `npm run build` copies this
// file to dist/index.d.ts and dist/index.d.cts (scripts/copy-dts.mjs).
import type { CSSProperties, FunctionComponent } from 'react'

/** The links a `resolveUrl` prop is asked about. */
export type UrlKind =
  | 'row'              // a y-axis label: the experiment (All Studies) or the gene (one experiment)
  | 'experiment'       // the experiment description above a single-experiment heatmap
  | 'atlas'            // “Expression Atlas” in the footer
  | 'moreInformation'  // “click here for the full record” in the footer
  | 'support'          // the EBI support links in the footer and the error alert
  | 'genomeBrowser'    // opened by a click on a differential cell
  | 'download'         // “All data” in the Download menu

/** An object query; `gene` and `condition` are sent as `geneQuery` and `conditionQuery`, other keys as they are. */
export interface HeatmapQuery {
  /** Gene ids separated by single spaces; the request body carries them unencoded. */
  gene?: string
  condition?: string
  species?: string
  source?: string
  [param: string]: unknown
}

export interface UrlContext {
  /** The `query` prop. */
  query: HeatmapQuery | string | undefined
  /** The experiment accession, or null for the multi-experiment (All Studies) heatmap. */
  experiment: string | null
  /** kind `row` */
  row?: {
    id: string
    label: string
    /** The payload's uri, which may be relative to atlasUrl. */
    uri?: string
    experimentType?: string
    index?: number
  }
  /** kind `moreInformation`: the payload's `config`. */
  config?: Record<string, unknown>
  /** kind `genomeBrowser` */
  genomeBrowser?: string
  geneId?: string
  trackId?: string
  [key: string]: unknown
}

/**
 * Rewrites a link: return a string to use instead of `defaultUrl` (which already includes `outProxy`), `null` to
 * drop the link (or menu option), or `undefined` to keep the default.
 */
export type ResolveUrl = (kind: UrlKind, defaultUrl: string, context: UrlContext) => string | null | undefined

export interface HeatmapFailure {
  url: string
  method: string
  message: string
}

export interface ExpressionAtlasHeatmapProps {
  /** An object query, or an endpoint relative to `atlasUrl`. */
  query?: HeatmapQuery | string
  /** Falsy: every baseline experiment (json/baseline_experiments); `'reference'`: the reference experiment; else an accession. */
  experiment?: string | boolean
  /** Default `'https://www.ebi.ac.uk/gxa/'`; a trailing `/` is added. `undefined` keeps the default. */
  atlasUrl?: string
  /** Prefix for requests. Default `''`. */
  inProxy?: string
  /** Prefix for links. Default `''`. */
  outProxy?: string
  /** Default true. */
  showAnatomogram?: boolean
  /** Default true: show the experiment description and the attribution footer. */
  isWidget?: boolean
  /** Default true: show the ordering, filter, genome browser and download controls. */
  showControlMenu?: boolean
  /** Called once per failed request, and when drawing the heatmap throws. */
  fail?: (failure: HeatmapFailure) => void
  /** Target of every link and window.open. Default `'_blank'` (with rel="noopener noreferrer"); `''` for none. */
  linkTarget?: string
  /** Read through a ref: a new function alone does not redraw the chart. */
  resolveUrl?: ResolveUrl
  /** Added to the root `div.gxaHeatmapContainer`. */
  className?: string
  /** Style of the root `div.gxaHeatmapContainer`. */
  style?: CSSProperties
  /** Default true. With false, load `gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css` yourself. */
  injectStyles?: boolean
  /** @deprecated Accepted and ignored: there is no Google Analytics any more. */
  disableGoogleAnalytics?: boolean
}

export declare const ExpressionAtlasHeatmap: FunctionComponent<ExpressionAtlasHeatmapProps>
export default ExpressionAtlasHeatmap

export interface RenderOptions extends ExpressionAtlasHeatmapProps {
  /** An element, or the id of one. */
  target: string | Element
  /** Called after each render() call has been committed. */
  render?: () => void
}

export interface RenderHandle {
  unmount(): void
}

/** Renders into `target` with createRoot, reusing one root per element. */
export declare function render(options: RenderOptions): RenderHandle

export declare const DEFAULT_OPTIONS: Readonly<{
  showAnatomogram: true
  isWidget: true
  showControlMenu: true
  atlasUrl: string
  inProxy: string
  outProxy: string
  experiment: string
  linkTarget: string
  injectStyles: true
}>

/**
 * Injects the stylesheet once, as `<style id="gramene-atlas-heatmap-styles">`, into `document` or a shadow root.
 * Returns true when it added the element.
 */
export declare function ensureStylesInjected(target?: Document | ShadowRoot): boolean

export declare const STYLE_ELEMENT_ID: 'gramene-atlas-heatmap-styles'

/** The stylesheet text. */
export declare const HEATMAP_CSS: string
