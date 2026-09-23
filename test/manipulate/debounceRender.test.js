import React, { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import debounceRender from '../../src/manipulate/debounceRender.js'

const renders = []
const Label = ({text}) => {
  renders.push(text)
  return <span data-testid={`label`}>{text}</span>
}

beforeEach(() => {
  renders.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe(`debounceRender`, () => {
  it(`renders at once, then once per burst of prop changes with the latest props`, () => {
    const Debounced = debounceRender(Label, 50)
    expect(Debounced.displayName).toBe(`debounceRender(Label)`)

    const {rerender} = render(<Debounced text={`a`} />)
    expect(screen.getByTestId(`label`)).toHaveTextContent(`a`)

    rerender(<Debounced text={`b`} />)
    rerender(<Debounced text={`c`} />)
    act(() => vi.advanceTimersByTime(49))
    expect(screen.getByTestId(`label`)).toHaveTextContent(`a`)
    rerender(<Debounced text={`d`} />)
    act(() => vi.advanceTimersByTime(49))
    expect(screen.getByTestId(`label`)).toHaveTextContent(`a`)

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByTestId(`label`)).toHaveTextContent(`d`)
    expect(renders).toEqual([`a`, `d`])
  })

  it(`still updates after StrictMode remounts the instance`, () => {
    const Debounced = debounceRender(Label, 50)
    const {rerender} = render(<StrictMode><Debounced text={`a`} /></StrictMode>)
    rerender(<StrictMode><Debounced text={`b`} /></StrictMode>)
    act(() => vi.advanceTimersByTime(50))
    expect(screen.getByTestId(`label`)).toHaveTextContent(`b`)
  })

  it(`drops a pending render when unmounted`, () => {
    const Debounced = debounceRender(Label, 50)
    const {rerender, unmount} = render(<Debounced text={`a`} />)
    rerender(<Debounced text={`b`} />)
    unmount()
    act(() => vi.advanceTimersByTime(100))
    expect(renders).toEqual([`a`])
  })

  it(`passes every prop through`, () => {
    const Inner = vi.fn(() => null)
    const Debounced = debounceRender(Inner, 10)
    const onZoom = () => {}
    render(<Debounced text={`a`} onZoom={onZoom} />)
    expect(Inner.mock.calls[0][0]).toEqual({text: `a`, onZoom})
  })
})
