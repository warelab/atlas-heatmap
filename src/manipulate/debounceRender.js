import React from 'react'
import debounce from 'lodash/debounce.js'

// Replaces react-debounce-render 5 (whose later versions need React 17 exactly). The wrapped component renders at most
// once per `wait` ms of prop changes, with the latest props: React updates this.props even when
// shouldComponentUpdate says no.
//
// The mounted flag is set in componentDidMount, not the constructor: React 18 StrictMode unmounts and remounts the same
// instance, and a render scheduled before the unmount must still run after the remount.
const debounceRender = (ComponentToDebounce, wait = 0, options) => {
  class DebouncedContainer extends React.Component {
    constructor(props) {
      super(props)
      this.mounted = false
      this.updateDebounced = debounce(() => this.mounted && this.forceUpdate(), wait, options)
    }

    componentDidMount() {
      this.mounted = true
    }

    shouldComponentUpdate() {
      this.updateDebounced()
      return false
    }

    componentWillUnmount() {
      this.mounted = false
      this.updateDebounced.cancel()
    }

    render() {
      return <ComponentToDebounce {...this.props} />
    }
  }

  DebouncedContainer.displayName =
    `debounceRender(${ComponentToDebounce.displayName || ComponentToDebounce.name || `Component`})`

  return DebouncedContainer
}

export default debounceRender
