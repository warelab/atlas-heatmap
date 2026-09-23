import {useEffect, useRef, useState} from 'react'
import debounce from 'lodash/debounce.js'

// [ref, width]: the rounded clientWidth of the element `ref` is attached to, updated (debounced) whenever it resizes.
// Upstream measured the first .gxaHeatmapContainer in the document, so every heatmap took the first one's width and
// none followed its own panel (a fullscreen modal, several genes side by side).
//
// Measured in an effect, not a layout effect: inside a modal that is still opening the element can be 0 wide on the
// first commit. A width of 0 (hidden, e.g. an inactive tab) is ignored, so the width stays 0 until the element is first
// laid out and keeps its last real value while hidden. Without ResizeObserver, window resizes are followed instead.
const useElementWidth = (wait = 100) => {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) {
      return undefined
    }

    const measure = () => {
      const measured = Math.round(element.clientWidth)
      if (measured > 0) {
        setWidth(measured)   // an equal width does not re-render
      }
    }
    const measureDebounced = debounce(measure, wait)
    measure()

    if (typeof ResizeObserver === `function`) {
      const observer = new ResizeObserver(measureDebounced)
      observer.observe(element)
      return () => {
        observer.disconnect()
        measureDebounced.cancel()
      }
    }

    window.addEventListener(`resize`, measureDebounced)
    return () => {
      window.removeEventListener(`resize`, measureDebounced)
      measureDebounced.cancel()
    }
  }, [wait])

  return [ref, width]
}

export default useElementWidth
