// Every link the heatmap renders or opens goes to `linkTarget` (default `_blank`: a new tab, which cannot reach back
// into the page). Upstream relied on the iframe's <base target=_parent> instead.

// A falsy target means no target attribute: the link opens in the same tab, and so does openUrl.
const linkAttrs = (target = `_blank`) => (
  target ?
    {target, rel: target === `_blank` ? `noopener noreferrer` : undefined} :
    {}
)

const openUrl = (url, target = `_blank`) =>
  window.open(url, target || `_self`, target === `_blank` ? `noopener,noreferrer` : undefined)

// The kinds of link a resolveUrl prop is asked about.
const URL_KINDS = Object.freeze([`row`, `experiment`, `atlas`, `moreInformation`, `support`, `genomeBrowser`, `download`])

const SUPPORT_URL = `https://www.ebi.ac.uk/support/gxa`

// urlFor(kind, defaultUrl, context) gives the URL of a link: a string, or null for no link. Without a resolveUrl
// prop every link keeps its default.
const keepDefaultUrl = (kind, defaultUrl) => defaultUrl

// resolveUrl(kind, defaultUrl, context) returns a string to override the URL, null to suppress the link, or
// undefined to keep the default.
const applyResolveUrl = (resolveUrl, kind, defaultUrl, context) => {
  if (typeof resolveUrl !== `function`) {
    return defaultUrl
  }
  const url = resolveUrl(kind, defaultUrl, context)
  return url === undefined ? defaultUrl : url === null ? null : String(url)
}

export {linkAttrs, openUrl, keepDefaultUrl, applyResolveUrl, URL_KINDS, SUPPORT_URL}
