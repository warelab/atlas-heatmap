import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as icons from '../../src/manipulate/controls/icons.js'
import disclaimers from '../../src/manipulate/controls/download-button/disclaimers.js'

describe(`icons`, () => {
  it(`are 1em, currentColor, decorative SVGs`, () => {
    expect(Object.keys(icons).sort()).toEqual([
      `ChevronDown`, `ChevronUp`, `Download`, `Eye`, `EyeSlash`, `Grid`, `InfoCircle`, `Sliders`, `SortAlpha`,
      `SortDown`, `SortNumeric`
    ])
    for (const [name, Icon] of Object.entries(icons)) {
      const {container, unmount} = render(<Icon className={`extra`} style={{color: `red`}} data-name={name} />)
      const svg = container.firstChild
      expect(svg.tagName.toLowerCase()).toBe(`svg`)
      expect(svg).toHaveAttribute(`viewBox`, `0 0 16 16`)
      expect(svg).toHaveAttribute(`width`, `1em`)
      expect(svg).toHaveAttribute(`fill`, `currentColor`)
      expect(svg).toHaveAttribute(`aria-hidden`, `true`)
      expect(svg).toHaveClass(`gxa-icon`, `extra`)
      expect(svg).toHaveAttribute(`data-name`, name)
      expect(svg.style.color).toBe(`red`)
      expect(svg.style.verticalAlign).toBe(`-0.125em`)
      expect(svg.querySelectorAll(`path`).length).toBeGreaterThan(0)
      svg.querySelectorAll(`path`).forEach(path => expect(path.getAttribute(`d`)).toMatch(/^[Mm]/))
      unmount()
    }
  })
})

describe(`disclaimers`, () => {
  it(`are upstream's three data reuse statements`, () => {
    expect(Object.keys(disclaimers)).toEqual([`blueprint`, `lauderdale`, `pcawg`])
    for (const Disclaimer of Object.values(disclaimers)) {
      const {container, unmount} = render(<Disclaimer />)
      expect(container.querySelector(`h3`)).not.toBeNull()
      unmount()
    }
  })
})
