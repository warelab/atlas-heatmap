import {useInsertionEffect} from 'react'

import css from './heatmap.css?inline'

// A JS port of gramene-primers' src/styles/inject.ts.

/** `id` of the `<style>` element that holds the injected stylesheet. */
export const STYLE_ELEMENT_ID = `gramene-atlas-heatmap-styles`

/** The stylesheet text (also shipped as `gramene-atlas-heatmap/dist/gramene-atlas-heatmap.css`). */
export const HEATMAP_CSS = typeof css === `string` ? css : ``

const isShadowRoot = node => typeof node.host !== `undefined` && !node.createElement

/**
 * Injects the gramene-atlas-heatmap stylesheet once, as `<style id="gramene-atlas-heatmap-styles">`, at the start of
 * `<head>` (so host stylesheets of equal specificity win) or into a shadow root. Returns true when a new element was
 * added. Safe to call repeatedly and outside browsers.
 */
export function ensureStylesInjected(target) {
  const host = target || (typeof document !== `undefined` ? document : null)
  if (!host) return false
  if (host.getElementById(STYLE_ELEMENT_ID)) return false
  const doc = isShadowRoot(host) ? host.ownerDocument : host
  if (!doc) return false
  const el = doc.createElement(`style`)
  el.id = STYLE_ELEMENT_ID
  el.setAttribute(`data-gramene-atlas-heatmap`, ``)
  el.textContent = HEATMAP_CSS
  if (isShadowRoot(host)) {
    host.insertBefore(el, host.firstChild)
  } else {
    const head = host.head || host.documentElement
    head.insertBefore(el, head.firstChild)
  }
  return true
}

/** Injects the stylesheet, once per document, before the component's DOM is laid out. */
export function useStyleInjection(enabled) {
  useInsertionEffect(() => {
    if (enabled) ensureStylesInjected()
  }, [enabled])
}
