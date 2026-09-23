// Every link the heatmap renders or opens goes to `linkTarget` (default `_blank`: a new tab, which cannot reach back
// into the page). Upstream relied on the iframe's <base target=_parent> instead.

const linkAttrs = (target = `_blank`) => ({
  target,
  rel: target === `_blank` ? `noopener noreferrer` : undefined
})

const openUrl = (url, target = `_blank`) =>
  window.open(url, target, target === `_blank` ? `noopener,noreferrer` : undefined)

// urlFor(kind, defaultUrl, context) gives the URL of a link: a string, or null for no link. Without a resolveUrl
// prop every link keeps its default.
const keepDefaultUrl = (kind, defaultUrl) => defaultUrl

export {linkAttrs, openUrl, keepDefaultUrl}
