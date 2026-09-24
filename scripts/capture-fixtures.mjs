#!/usr/bin/env node
// Captures live responses of the Warelab gramene-swagger GXA backend into test/fixtures/, for the load/ snapshot
// tests, the render tests and the playground's ?api=mock mode. It only sends the read-only POSTs the heatmap
// itself sends, built by src/layout/request.js, so the fixtures also document the exact request body.
//
//   npm run fixtures                                   every fixture, from its own base (default auth_testing)
//   npm run fixtures -- --only paralogs.E-CURD-25.baseline,error.unknown-gene
//   npm run fixtures -- --base https://data.sorghumbase.org/sorghum_v11/gxa/    override the default base
//
// Each file is {captured_at, base, method, path, body_sent, status, contentType, body}.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildRequest, buildSource } from '../src/layout/request.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), `..`)
const OUT = resolve(root, `test/fixtures`)
const AUTH_TESTING = `https://data.sorghumbase.org/auth_testing/gxa/`
const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`

const argv = process.argv.slice(2)
const argValue = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
const withSlash = url => (url.endsWith(`/`) ? url : `${url}/`)
const DEFAULT_BASE = withSlash(argValue(`--base`) || AUTH_TESTING)
const only = argValue(`--only`) ? new Set(argValue(`--only`).split(`,`).filter(Boolean)) : null

// SORBI_3001G000200 and two neighbours: listed in E-CURD-25 (baseline, anatomogram 'Sorghum bicolor') and
// E-GEOD-30249 (differential).
const THREE_GENES = [`SORBI_3001G000200`, `SORBI_3001G000400`, `SORBI_3001G000100`]
// The within-species paralogs gramene-search sends for SORBI_3001G000200 (sorghum_v10b search API:
// q=homology__within_species_paralog:SORBI_3001G000200, fq=taxon_id:4558001), in that order.
const FOURTEEN_PARALOGS = [
  `SORBI_3001G000200`, `SORBI_3001G193300`, `SORBI_3002G272600`, `SORBI_3002G323000`, `SORBI_3003G110000`,
  `SORBI_3003G395300`, `SORBI_3004G264400`, `SORBI_3004G339000`, `SORBI_3004G339100`, `SORBI_3004G345700`,
  `SORBI_3005G114400`, `SORBI_3006G050000`, `SORBI_3007G179800`, `SORBI_3K044407`,
]

// The within-species paralogs gramene-search sends for SORBI_3006G095600 (msd2; sorghum_v11 search API:
// q=homology__within_species_paralog:SORBI_3006G095600, fq=taxon_id:4558006), in that order.
const MSD2_PARALOGS = [
  `SORBI_3001G125700`, `SORBI_3001G125800`, `SORBI_3001G125900`, `SORBI_3001G483400`, `SORBI_3003G385500`,
  `SORBI_3003G385900`, `SORBI_3004G078600`, `SORBI_3006G095600`, `SORBI_3006G248300`, `SORBI_3007G210400`,
  `SORBI_3008G191000`,
]

// name -> the heatmap props that produce the request, plus the status the capture expects
const FIXTURES = {
  'all-studies.SORBI_3001G000200': {query: {gene: `SORBI_3001G000200`}, experiment: false, expect: 200},
  'paralogs.E-CURD-25.baseline': {query: {gene: THREE_GENES.join(` `)}, experiment: `E-CURD-25`, expect: 200},
  'paralogs.E-GEOD-30249.differential': {query: {gene: THREE_GENES.join(` `)}, experiment: `E-GEOD-30249`, expect: 200},
  'paralogs.E-GEOD-167101.baseline': {query: {gene: FOURTEEN_PARALOGS.join(` `)}, experiment: `E-GEOD-167101`, expect: 200},
  'error.unknown-gene': {query: {gene: `NOT_A_REAL_GENE`}, experiment: false, expect: 500},
  // A larger All Studies payload from the instance SorghumBase uses (about 58 rows).
  'all-studies.SORBI_3001G000200.sorghum_v11': {query: {gene: `SORBI_3001G000200`}, experiment: false, expect: 200, base: SORGHUM_V11},
  // Few columns with long labels (up to 52 characters): at desktop widths each column is wider than 80 px.
  'paralogs.E-MTAB-5956.sorghum_v11': {query: {gene: MSD2_PARALOGS.join(` `)}, experiment: `E-MTAB-5956`, expect: 200, base: SORGHUM_V11},
}

mkdirSync(OUT, { recursive: true })

async function capture(name, {query, experiment, expect, base = DEFAULT_BASE}) {
  const source = buildSource({query, experiment})
  const request = buildRequest({inProxy: ``, atlasUrl: base, source})
  const res = await fetch(request.url, {method: request.method, headers: request.headers, body: request.body, cache: `no-store`})
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = {non_json_body: text.slice(0, 2000)}
  }
  const doc = {
    captured_at: new Date().toISOString(),
    base,
    method: request.method,
    path: source.endpoint,
    body_sent: request.body,
    status: res.status,
    contentType: res.headers.get(`content-type`),
    body,
  }
  writeFileSync(resolve(OUT, `${name}.json`), `${JSON.stringify(doc, null, 2)}\n`)

  const rows = Array.isArray(body?.profiles?.rows) ? ` rows=${body.profiles.rows.length}` : ``
  const columns = Array.isArray(body?.columnHeaders) ? ` columns=${body.columnHeaders.length}` : ``
  console.log(`  ${String(res.status).padEnd(3)} ${name}${rows}${columns}`)
  if (res.status !== expect) {
    console.error(`  !! ${name}: expected HTTP ${expect}, got ${res.status}`)
    process.exitCode = 1
  }
}

async function main() {
  console.log(`capture-fixtures: default base ${DEFAULT_BASE} -> ${OUT}`)
  for (const [name, spec] of Object.entries(FIXTURES)) {
    if (!only || only.has(name)) await capture(name, spec)
  }
}

main().catch(err => {
  console.error(`capture-fixtures failed:`, err)
  process.exit(1)
})
