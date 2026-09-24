import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, Modal, Row, Tab, Tabs } from 'react-bootstrap'
import * as anatomogram from 'gramene-anatomogram'

import { ExpressionAtlasHeatmap, ExpressionFactorGrid, render as renderHeatmap } from 'gramene-atlas-heatmap'

// Playground for gramene-atlas-heatmap: `npm run dev`, then http://localhost:5175/ (?api=mock, ?strict=1, ?panel=…).

const SORGHUM_V11 = `https://data.sorghumbase.org/sorghum_v11/gxa/`

export const ATLAS_URLS = [
  {value: `https://data.sorghumbase.org/auth_testing/gxa/`, label: `auth_testing (gramene-search default)`},
  {value: SORGHUM_V11, label: `sorghum_v11 (SorghumBase)`},
  {value: `https://www.ebi.ac.uk/gxa/`, label: `EBI Expression Atlas (the component's default)`}
]

const EXPERIMENTS = [
  [`E-CURD-25`, `baseline, with an anatomogram`],
  [`E-GEOD-30249`, `differential`],
  [`E-GEOD-140928`, `differential`],
  [`E-GEOD-167101`, `baseline, 14 paralogs of SORBI_3001G000200`],
  [`reference`, `the reference experiment`]
]

export const DEFAULT_GENES = `SORBI_3001G000200 SORBI_3001G000400 SORBI_3001G000100`

const LINK_TARGETS = [[`_blank`, `_blank (default)`], [`_self`, `_self`], [`gxa`, `a window named gxa`], [``, `none`]]

const PANELS = [
  [`side-by-side`, `Side by side`],
  [`resizable`, `Resizable`],
  [`fullscreen`, `Fullscreen modal`],
  [`render-api`, `render() API`],
  [`grid`, `Factor grid`]
]

// The studies of the factor grid panel (sorghum_v11), and what each shows
export const GRID_STUDIES = [
  [`JGI-SB-1`, `Mullet lab - developmental stages: 2 factors, up to 3 samples a cell`],
  [`JGI-SB-2`, `Mullet lab - internode time course: 3 factors, which some samples lack`],
  [`JGI-SB-3`, `Mullet lab - nitrogen source: 2 factors, every cell measured`],
  [`JGI-SB-4`, `Mullet lab - standard tissue panel: 3 factors`],
  [`E-MTAB-5956`, `Wang et al., 2018 (EBI): 2 factors`],
  [`E-CURD-25`, `Turco et al 2017 (EBI): 1 factor, one row`]
]
export const GRID_GENE = `SORBI_3006G095600`

// A resolveUrl like gramene-search's: the Warelab backend echoes geneQuery as [null,…] and answers relative row uris
// (genes/<id>), and atlasUrl is an API rather than a page, so links go to EBI instead.
const EBI_GXA = `https://www.ebi.ac.uk/gxa/`
const genesOf = query => (query && typeof query.gene === `string` ? query.gene.split(` `).filter(Boolean) : [])
const editUrl = (url, edit) => {
  try {
    const parsed = new URL(url)
    edit(parsed.searchParams)
    return parsed.href
  } catch (e) {
    return undefined
  }
}
export const demoResolveUrl = (kind, url, context) => {
  const genes = genesOf(context.query)
  const withGenes = params => params.set(`geneQuery`, JSON.stringify(genes.map(value => ({value}))))
  switch (kind) {
    case `row`:
      return context.row && context.row.uri && !/^https?:/i.test(context.row.uri) ?
        new URL(context.row.uri, EBI_GXA).href :
        undefined
    case `atlas`:
      return EBI_GXA
    case `experiment`:
      return editUrl(url, withGenes)
    case `moreInformation`:
      return context.experiment ? editUrl(url, withGenes) : `${EBI_GXA}genes/${encodeURIComponent(genes[0] || ``)}`
    case `download`:
      return editUrl(url, params => params.delete(`geneQuery`))
    default:
      return undefined
  }
}

// The stub stands in for gramene-anatomogram until its tarball is installed (vite.config.js); it draws nothing.
const anatomogramIsStub = `resetAnatomogramStub` in anatomogram

// gramene-search's FullscreenContainer: the children render once, into a node that moves between the page and a
// fullscreen Modal, so the heatmap keeps its data, zoom and ordering and only its width changes.
const FullscreenContainer = ({fullscreen, onExitFullscreen, title, children}) => {
  const [stableNode] = useState(() => document.createElement(`div`))
  const inlineRef = useRef(null)
  const modalRef = useRef(null)

  useLayoutEffect(() => {
    const parent = fullscreen ? modalRef.current : inlineRef.current
    if (parent && stableNode.parentNode !== parent) {
      parent.appendChild(stableNode)
    }
  })

  return (
    <>
      <div ref={inlineRef} />
      {fullscreen &&
        <Modal show fullscreen onHide={onExitFullscreen}>
          <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div ref={modalRef} />
          </Modal.Body>
        </Modal>}
      {createPortal(children, stableNode)}
    </>
  )
}

const Panel = ({title, children, ...props}) =>
  <Card className={`mb-3`} {...props}>
    <Card.Header className={`py-2`}>{title}</Card.Header>
    <Card.Body>{children}</Card.Body>
  </Card>

const SideBySide = ({heatmapProps, allStudiesQuery, paralogsQuery, experiment}) =>
  <Row>
    <Col lg={6}>
      <Panel title={<>All Studies · <code>{allStudiesQuery.gene}</code></>} data-testid={`panel-all-studies`}>
        <ExpressionAtlasHeatmap {...heatmapProps} query={allStudiesQuery} experiment={false} />
      </Panel>
    </Col>
    <Col lg={6}>
      <Panel title={<>Paralogs · <code>{experiment || `All Studies`}</code></>} data-testid={`panel-paralogs`}>
        <ExpressionAtlasHeatmap {...heatmapProps} query={paralogsQuery} experiment={experiment} />
      </Panel>
    </Col>
  </Row>

const WIDTHS = [`360px`, `640px`, `100%`]

const Resizable = ({heatmapProps, query, experiment}) => {
  const [width, setWidth] = useState(`70%`)
  return (
    <Panel title={`Drag the bottom-right corner, or pick a width: the chart re-lays out; zoom survives a small change`}>
      <ButtonGroup size={`sm`} className={`mb-2`}>
        {WIDTHS.map(w => <Button key={w} variant={`outline-secondary`} onClick={() => setWidth(w)}>{w}</Button>)}
      </ButtonGroup>
      <div
        data-testid={`resizable`}
        className={`border rounded p-2`}
        style={{resize: `horizontal`, overflow: `auto`, width, minWidth: `280px`, maxWidth: `100%`}}>
        <ExpressionAtlasHeatmap {...heatmapProps} query={query} experiment={experiment} />
      </div>
    </Panel>
  )
}

const Fullscreen = ({heatmapProps, query, experiment}) => {
  const [fullscreen, setFullscreen] = useState(false)
  return (
    <Panel title={`Like gramene-search's full screen view: the same heatmap moves into a fullscreen Modal`}>
      <Button size={`sm`} className={`mb-2`} onClick={() => setFullscreen(true)}>View full screen</Button>
      <FullscreenContainer fullscreen={fullscreen} onExitFullscreen={() => setFullscreen(false)} title={`Expression`}>
        <ExpressionAtlasHeatmap {...heatmapProps} query={query} experiment={experiment} />
        {fullscreen &&
          <p className={`text-muted`} style={{minHeight: `100vh`, paddingTop: `2rem`}}>
            Room to scroll the modal body: after scrolling, the tooltip should still name the cell under the mouse,
            above the modal. The Filters dialog should stack over this one, and Escape should close only it.
          </p>}
      </FullscreenContainer>
    </Panel>
  )
}

// render({target, render: callback, ...props}) is the entry point for pages without React (upstream's widget API)
const RenderApi = ({heatmapProps, query, experiment, log}) => {
  const target = useRef(null)
  const handle = useRef(null)
  const [mounted, setMounted] = useState(false)

  const mount = () => {
    handle.current = renderHeatmap({
      ...heatmapProps, query, experiment, target: target.current, render: () => log(`render()`, `callback`)
    })
    setMounted(true)
  }
  const unmount = () => {
    handle.current && handle.current.unmount()
    handle.current = null
    setMounted(false)
  }
  // Unmounting another root while React commits this one would warn, so leave that to the next task
  useEffect(() => () => {
    const leftover = handle.current
    handle.current = null
    leftover && setTimeout(() => leftover.unmount())
  }, [])

  return (
    <Panel title={<><code>render()</code> into a plain element; calling it again updates the same root</>}>
      <ButtonGroup size={`sm`} className={`mb-2`}>
        <Button variant={`outline-primary`} onClick={mount}>{mounted ? `render() again` : `render()`}</Button>
        <Button variant={`outline-secondary`} onClick={unmount} disabled={!mounted}>unmount()</Button>
      </ButtonGroup>
      <div ref={target} data-testid={`render-target`} />
    </Panel>
  )
}

// ExpressionFactorGrid with its axes kept per study in the panel's state, as gramene-search keeps them in its view
const FactorGridPanel = ({heatmapProps, atlasUrl, onChangeAtlasUrl, log}) => {
  const [study, setStudy] = useState(GRID_STUDIES[0][0])
  const [draftGene, setDraftGene] = useState(GRID_GENE)
  const [gene, setGene] = useState(GRID_GENE)
  const [axes, setAxes] = useState({})
  const onChangeFactors = useCallback(next => {
    log(`onChangeFactors`, `${study}: rows ${next.rowFactor}, columns ${next.columnFactor}`)
    setAxes(current => ({...current, [study]: next}))
  }, [study, log])
  const {rowFactor, columnFactor} = axes[study] || {}

  return (
    <Panel title={<>ExpressionFactorGrid · <code>{study}</code> · <code>{gene}</code></>} data-testid={`panel-grid`}>
      {atlasUrl !== SORGHUM_V11 &&
        <Alert variant={`info`} className={`py-2 small d-flex align-items-center gap-2`}>
          The JGI studies are on sorghum_v11.
          <Button size={`sm`} variant={`outline-primary`} onClick={() => onChangeAtlasUrl(SORGHUM_V11)}>Use sorghum_v11</Button>
        </Alert>}
      <Form
        className={`mb-3`}
        onSubmit={event => {
          event.preventDefault()
          setGene(draftGene.trim())
        }}>
        <Row className={`g-2 align-items-end`}>
          <Form.Group as={Col} md={6} controlId={`grid-study`}>
            <Form.Label className={`small mb-1`}>Study</Form.Label>
            <Form.Select size={`sm`} value={study} onChange={event => setStudy(event.target.value)}>
              {GRID_STUDIES.map(([accession, about]) => <option key={accession} value={accession}>{`${accession}: ${about}`}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group as={Col} md={4} controlId={`grid-gene`}>
            <Form.Label className={`small mb-1`}>Gene</Form.Label>
            <Form.Control size={`sm`} value={draftGene} onChange={event => setDraftGene(event.target.value)} />
          </Form.Group>
          <Col md={2}>
            <Button size={`sm`} type={`submit`}>Show</Button>
          </Col>
        </Row>
      </Form>
      <ExpressionFactorGrid
        key={`${atlasUrl} ${study} ${gene}`}
        atlasUrl={atlasUrl}
        experiment={study}
        gene={gene}
        rowFactor={rowFactor}
        columnFactor={columnFactor}
        onChangeFactors={onChangeFactors}
        linkTarget={heatmapProps.linkTarget}
        resolveUrl={heatmapProps.resolveUrl}
        injectStyles={heatmapProps.injectStyles}
        fail={heatmapProps.fail} />
    </Panel>
  )
}

let nextEventId = 0

const App = ({api = `live`, strict = false, initialPanel = `side-by-side`}) => {
  // The JGI studies of the factor grid panel are on sorghum_v11
  const [atlasUrl, setAtlasUrl] = useState(initialPanel === `grid` ? SORGHUM_V11 : ATLAS_URLS[0].value)
  const [draft, setDraft] = useState({genes: DEFAULT_GENES, experiment: `E-CURD-25`})
  const [applied, setApplied] = useState(draft)
  const [flags, setFlags] = useState({
    showAnatomogram: true, isWidget: true, showControlMenu: true, injectStyles: true,
    demoResolveUrl: false, logWindowOpen: false
  })
  const [linkTarget, setLinkTarget] = useState(`_blank`)
  const [panel, setPanel] = useState(PANELS.some(([key]) => key === initialPanel) ? initialPanel : PANELS[0][0])
  const [generation, setGeneration] = useState(0)
  const [events, setEvents] = useState([])

  const log = useCallback((kind, detail) => {
    console.info(`[heatmap] ${kind}`, detail)
    setEvents(list => [{id: nextEventId++, time: new Date().toLocaleTimeString(), kind, detail}, ...list].slice(0, 100))
  }, [])

  // Cell clicks on a differential heatmap open a genome browser: this logs them instead
  useEffect(() => {
    if (!flags.logWindowOpen) {
      return undefined
    }
    const open = window.open
    window.open = (...args) => {
      log(`window.open`, args.map(arg => JSON.stringify(arg)).join(`, `))
      return null
    }
    return () => {
      window.open = open
    }
  }, [flags.logWindowOpen, log])

  const genes = applied.genes.trim().split(/\s+/).filter(Boolean)
  const firstGene = genes[0] || ``
  const allGenes = genes.join(` `)
  const allStudiesQuery = useMemo(() => ({gene: firstGene}), [firstGene])
  const paralogsQuery = useMemo(() => ({gene: allGenes}), [allGenes])
  const experiment = applied.experiment.trim()

  const fail = useCallback(failure => log(`fail`, `${failure.method} ${failure.url}: ${failure.message}`), [log])
  const heatmapProps = {
    atlasUrl,
    showAnatomogram: flags.showAnatomogram,
    isWidget: flags.isWidget,
    showControlMenu: flags.showControlMenu,
    injectStyles: flags.injectStyles,
    linkTarget,
    resolveUrl: flags.demoResolveUrl ? demoResolveUrl : undefined,
    fail
  }
  const panelProps = {heatmapProps, query: paralogsQuery, experiment, allStudiesQuery, paralogsQuery, log}

  const toggle = name => event => setFlags(current => ({...current, [name]: event.target.checked}))
  const withParams = changes => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(changes).forEach(([name, value]) => (value ? params.set(name, value) : params.delete(name)))
    const search = params.toString()
    return search ? `?${search}` : window.location.pathname
  }

  return (
    <div className={`container-fluid py-3`}>
      <div className={`d-flex flex-wrap align-items-baseline gap-2 mb-3`}>
        <h1 className={`h4 mb-0 me-2`}>gramene-atlas-heatmap playground</h1>
        <Badge bg={api === `mock` ? `warning` : `success`} text={api === `mock` ? `dark` : undefined}>
          {api === `mock` ? `mock API (test/fixtures)` : `live API`}
        </Badge>
        {strict && <Badge bg={`info`} text={`dark`}>StrictMode</Badge>}
        <a className={`small`} href={withParams({api: api === `mock` ? `` : `mock`})}>
          {api === `mock` ? `use the live API` : `use the mock API`}
        </a>
        <a className={`small`} href={withParams({strict: strict ? `` : `1`})}>
          {strict ? `without StrictMode` : `with StrictMode`}
        </a>
      </div>

      {anatomogramIsStub &&
        <Alert variant={`secondary`} className={`py-2 small`}>
          gramene-anatomogram is not installed, so the anatomogram is a stub that draws nothing. Install its tarball
          with <code>npm install --no-save ../anatomogram/gramene-anatomogram-3.0.0.tgz</code> and restart
          <code> npm run dev</code>.
        </Alert>}

      <Form
        className={`mb-3`}
        onSubmit={event => {
          event.preventDefault()
          setApplied(draft)
        }}>
        <Row className={`g-2 align-items-end`}>
          <Form.Group as={Col} md={3} controlId={`atlasUrl`}>
            <Form.Label className={`small mb-1`}>atlasUrl</Form.Label>
            <Form.Select size={`sm`} value={atlasUrl} onChange={event => setAtlasUrl(event.target.value)}>
              {ATLAS_URLS.map(({value, label}) => <option key={value} value={value}>{label}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group as={Col} md={4} controlId={`genes`}>
            <Form.Label className={`small mb-1`}>Genes (All Studies uses the first)</Form.Label>
            <Form.Control size={`sm`} value={draft.genes} onChange={event => setDraft({...draft, genes: event.target.value})} />
          </Form.Group>
          <Form.Group as={Col} md={3} controlId={`experiment`}>
            <Form.Label className={`small mb-1`}>Experiment (empty: All Studies)</Form.Label>
            <Form.Control
              size={`sm`}
              list={`experiments`}
              value={draft.experiment}
              onChange={event => setDraft({...draft, experiment: event.target.value})} />
            <datalist id={`experiments`}>
              {EXPERIMENTS.map(([accession, about]) => <option key={accession} value={accession}>{about}</option>)}
            </datalist>
          </Form.Group>
          <Col md={2} className={`d-flex gap-2`}>
            <Button size={`sm`} type={`submit`}>Apply</Button>
            <Button size={`sm`} variant={`outline-secondary`} onClick={() => setGeneration(g => g + 1)}>Remount</Button>
          </Col>
        </Row>
        <div className={`d-flex flex-wrap gap-3 mt-2 small`}>
          {[`showAnatomogram`, `isWidget`, `showControlMenu`, `injectStyles`].map(name =>
            <Form.Check key={name} type={`switch`} id={`flag-${name}`} label={name} checked={flags[name]} onChange={toggle(name)} />)}
          <Form.Check type={`switch`} id={`flag-demoResolveUrl`} label={`demo resolveUrl (links to EBI)`}
            checked={flags.demoResolveUrl} onChange={toggle(`demoResolveUrl`)} />
          <Form.Check type={`switch`} id={`flag-logWindowOpen`} label={`log window.open instead of opening`}
            checked={flags.logWindowOpen} onChange={toggle(`logWindowOpen`)} />
          <Form.Group controlId={`linkTarget`} className={`d-flex align-items-center gap-1`}>
            <Form.Label className={`mb-0`}>linkTarget</Form.Label>
            <Form.Select size={`sm`} style={{width: `auto`}} value={linkTarget} onChange={event => setLinkTarget(event.target.value)}>
              {LINK_TARGETS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
            </Form.Select>
          </Form.Group>
        </div>
        {api === `mock` &&
          <div className={`form-text`}>
            The mock API answers with the captured responses whatever the atlasUrl; NOT_A_REAL_GENE and experiments
            without a fixture get the backend's 500.
          </div>}
      </Form>

      <Tabs activeKey={panel} onSelect={key => setPanel(key)} mountOnEnter unmountOnExit className={`mb-3`}>
        <Tab eventKey={`side-by-side`} title={PANELS[0][1]}>
          <SideBySide key={generation} {...panelProps} />
        </Tab>
        <Tab eventKey={`resizable`} title={PANELS[1][1]}>
          <Resizable key={generation} {...panelProps} query={allStudiesQuery} experiment={false} />
        </Tab>
        <Tab eventKey={`fullscreen`} title={PANELS[2][1]}>
          <Fullscreen key={generation} {...panelProps} query={allStudiesQuery} experiment={false} />
        </Tab>
        <Tab eventKey={`render-api`} title={PANELS[3][1]}>
          <RenderApi key={generation} {...panelProps} />
        </Tab>
        <Tab eventKey={`grid`} title={PANELS[4][1]}>
          <FactorGridPanel key={generation} {...panelProps} atlasUrl={atlasUrl} onChangeAtlasUrl={setAtlasUrl} />
        </Tab>
      </Tabs>

      <Panel title={<>Events <Button size={`sm`} variant={`link`} className={`p-0 ms-2`} onClick={() => setEvents([])}>clear</Button></>}>
        {events.length === 0 ?
          <p className={`text-muted small mb-0`}>
            fail() calls, render() callbacks, onChangeFactors calls and logged window.open calls show here.
          </p> :
          <ul className={`list-unstyled small mb-0`} data-testid={`events`}>
            {events.map(event =>
              <li key={event.id}><span className={`text-muted`}>{event.time}</span> <strong>{event.kind}</strong> {event.detail}</li>)}
          </ul>}
      </Panel>
    </div>
  )
}

export default App
