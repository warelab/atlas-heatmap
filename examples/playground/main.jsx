// Bootstrap 5 CSS is the host page's job: the playground loads it here, the package never does.
import 'bootstrap/dist/css/bootstrap.min.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import { installMockFetch } from './mockFetch.js'

const params = new URLSearchParams(window.location.search)
const api = params.get(`api`) === `mock` ? `mock` : `live`
const strict = params.get(`strict`) === `1`
if (api === `mock`) {
  installMockFetch()
}

const app = <App api={api} strict={strict} initialPanel={params.get(`panel`) || undefined} />
createRoot(document.getElementById(`root`)).render(strict ? <StrictMode>{app}</StrictMode> : app)
