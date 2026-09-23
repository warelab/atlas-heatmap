import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import useElementWidth from '../../src/show/useElementWidth.js'
import { ResizeObserverStub } from '../shims.js'

// Each probe's element reports the width in its data-width attribute
const widthOf = element => Number(element.dataset.width || 0)
const useDataWidth = () => vi.spyOn(HTMLElement.prototype, `clientWidth`, `get`).mockImplementation(function () {
  return widthOf(this)
})

const Probe = ({id, initial}) => {
  const [ref, width] = useElementWidth()
  return <div ref={ref} data-testid={id} data-width={initial}>{width}</div>
}

const observerOf = element => ResizeObserverStub.instances.find(observer => observer.targets.has(element))

const resize = async (element, width) => {
  element.dataset.width = String(width)
  act(() => observerOf(element).trigger())
  await act(() => new Promise(resolve => setTimeout(resolve, 150)))   // debounced by 100 ms
}

describe(`useElementWidth`, () => {
  it(`measures each element on its own`, async () => {
    useDataWidth()
    render(<><Probe id={`a`} initial={640.4} /><Probe id={`b`} initial={300} /></>)
    const [a, b] = [screen.getByTestId(`a`), screen.getByTestId(`b`)]
    expect(a).toHaveTextContent(`640`)
    expect(b).toHaveTextContent(`300`)
    expect(ResizeObserverStub.instances).toHaveLength(2)

    await resize(a, 1200)
    expect(a).toHaveTextContent(`1200`)
    expect(b).toHaveTextContent(`300`)
  })

  it(`debounces resizes by 100 ms`, async () => {
    useDataWidth()
    render(<Probe id={`a`} initial={500} />)
    const a = screen.getByTestId(`a`)
    a.dataset.width = `700`
    act(() => observerOf(a).trigger())
    expect(a).toHaveTextContent(`500`)
    await act(() => new Promise(resolve => setTimeout(resolve, 150)))
    expect(a).toHaveTextContent(`700`)
  })

  it(`ignores a width of 0: 0 until first laid out, then the last real width while hidden`, async () => {
    useDataWidth()
    render(<Probe id={`a`} initial={0} />)
    const a = screen.getByTestId(`a`)
    expect(a).toHaveTextContent(`0`)

    await resize(a, 800)
    expect(a).toHaveTextContent(`800`)
    await resize(a, 0)
    expect(a).toHaveTextContent(`800`)
  })

  it(`stops observing on unmount`, async () => {
    useDataWidth()
    const {unmount} = render(<Probe id={`a`} initial={500} />)
    const observer = observerOf(screen.getByTestId(`a`))
    unmount()
    expect(observer.disconnected).toBe(true)
  })

  it(`follows window resizes without ResizeObserver`, async () => {
    useDataWidth()
    vi.stubGlobal(`ResizeObserver`, undefined)
    const {unmount} = render(<Probe id={`a`} initial={500} />)
    const a = screen.getByTestId(`a`)
    expect(a).toHaveTextContent(`500`)

    a.dataset.width = `900`
    act(() => window.dispatchEvent(new Event(`resize`)))
    await act(() => new Promise(resolve => setTimeout(resolve, 150)))
    expect(a).toHaveTextContent(`900`)

    const removeEventListener = vi.spyOn(window, `removeEventListener`)
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith(`resize`, expect.any(Function))
  })
})
