import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { startConsoleGuard, stopConsoleGuard } from './consoleGuard.js'
// Imported first thing, so the layout shims exist before any test module (and so Highcharts) loads.
import { ResizeObserverStub } from './shims.js'

beforeEach(() => {
  ResizeObserverStub.instances.length = 0
  window.open = vi.fn()
  startConsoleGuard()
})

afterEach(() => {
  // Unmount first, so warnings raised while unmounting still count.
  cleanup()
  stopConsoleGuard()
})
