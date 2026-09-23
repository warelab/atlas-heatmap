// `?api=mock`: answers the heatmap's Expression Atlas requests with the responses captured in test/fixtures
// (scripts/capture-fixtures.mjs), offline and repeatable. Every other request goes to the network.
import allStudies from '../../test/fixtures/all-studies.SORBI_3001G000200.json'
import allStudiesV11 from '../../test/fixtures/all-studies.SORBI_3001G000200.sorghum_v11.json'
import curd25 from '../../test/fixtures/paralogs.E-CURD-25.baseline.json'
import geod30249 from '../../test/fixtures/paralogs.E-GEOD-30249.differential.json'
import geod167101 from '../../test/fixtures/paralogs.E-GEOD-167101.baseline.json'
import unknownGene from '../../test/fixtures/error.unknown-gene.json'

const FIXTURES = [allStudies, allStudiesV11, curd25, geod30249, geod167101]

// json/baseline_experiments, json/experiments/E-CURD-25, … or null for a request that is not the heatmap's
const endpointOf = url => {
  const match = /\/(json\/[^?#]+)/.exec(String(url))
  return match ? match[1] : null
}

/**
 * The fixture that answers a request: the one captured for exactly this URL and body, else one captured for the same
 * URL (other genes), else for the same endpoint on another atlas. NOT_A_REAL_GENE, and an endpoint without a fixture
 * (another experiment, json/baseline_refexperiment), get the backend's 500. Returns null for other requests.
 */
export const pickFixture = (url, body = ``) => {
  const endpoint = endpointOf(url)
  if (!endpoint) {
    return null
  }
  if (/\bNOT_A_REAL_GENE\b/.test(body)) {
    return unknownGene
  }
  return FIXTURES.find(f => url === f.base + f.path && body === f.body_sent) ||
    FIXTURES.find(f => url === f.base + f.path) ||
    FIXTURES.find(f => f.path === endpoint) ||
    unknownGene
}

/** Replaces the global fetch; returns a function that puts the original back. */
export const installMockFetch = ({delay = 300, log = (...args) => console.info(...args)} = {}) => {
  const realFetch = globalThis.fetch
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === `string` ? input : String(input.url || input)
    const body = typeof init.body === `string` ? init.body : ``
    const fixture = pickFixture(url, body)
    if (!fixture) {
      return realFetch(input, init)
    }

    return new Promise((resolve, reject) => {
      const {signal} = init
      let timer
      const abort = () => {
        clearTimeout(timer)
        reject(new DOMException(`The operation was aborted.`, `AbortError`))
      }
      if (signal && signal.aborted) {
        abort()
        return
      }
      signal && signal.addEventListener(`abort`, abort, {once: true})
      timer = setTimeout(() => {
        signal && signal.removeEventListener(`abort`, abort)
        log(`[mock api] ${init.method || `GET`} ${url} ${body} → ${fixture.status} (fixture ${fixture.path})`)
        resolve(new Response(JSON.stringify(fixture.body), {
          status: fixture.status,
          headers: {'content-type': fixture.contentType || `application/json`}
        }))
      }, delay)
    })
  }
  return () => {
    globalThis.fetch = realFetch
  }
}
