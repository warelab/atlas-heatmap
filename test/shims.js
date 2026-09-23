// jsdom does no layout. These shims give Highcharts and the width hooks something to measure.
// They are installed before any test module (and so before Highcharts) is imported.

// Every element reports 1000px unless a test overrides it (Object.defineProperty(el, 'clientWidth', …)).
Object.defineProperty(HTMLElement.prototype, `clientWidth`, {
  configurable: true,
  get() {
    return 1000
  },
})

if (!SVGElement.prototype.getBBox) {
  SVGElement.prototype.getBBox = function getBBox() {
    return { x: 0, y: 0, width: 10, height: 10 }
  }
}
if (!SVGElement.prototype.getComputedTextLength) {
  SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
    return 10
  }
}
// Highcharts sets H.svg from `!!createElementNS(SVG_NS, 'svg').createSVGRect` when it is first imported.
if (!SVGSVGElement.prototype.createSVGRect) {
  SVGSVGElement.prototype.createSVGRect = function createSVGRect() {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
}

// Records every observer so tests can fire resizes; like browsers, it reports an element as soon as it is observed.
export class ResizeObserverStub {
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.targets = new Set()
    this.disconnected = false
    ResizeObserverStub.instances.push(this)
  }

  observe(target) {
    this.targets.add(target)
    this.trigger([target])
  }

  unobserve(target) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    this.disconnected = true
  }

  trigger(targets = [...this.targets]) {
    const entries = targets.map(target => ({
      target,
      contentRect: { width: target.clientWidth, height: target.clientHeight },
    }))
    if (entries.length > 0) this.callback(entries, this)
  }
}
globalThis.ResizeObserver = ResizeObserverStub
