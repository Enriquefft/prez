import { describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { Deck, Slide } from '../index'

// These tests run last (z- prefix) because print mode tests
// modify window.location which affects happy-dom's global state.

describe('Deck print mode', () => {
  it('renders all slides and injects @page CSS when ?print=true', () => {
    window.location.href = 'http://localhost/?print=true'

    const { container } = render(
      <Deck>
        <Slide>
          <div>Slide 1</div>
        </Slide>
        <Slide>
          <div>Slide 2</div>
        </Slide>
        <Slide>
          <div>Slide 3</div>
        </Slide>
      </Deck>,
    )

    // All slides visible
    const text = container.textContent
    expect(text).toContain('Slide 1')
    expect(text).toContain('Slide 2')
    expect(text).toContain('Slide 3')

    // @page CSS injected
    const style = container.querySelector('style')
    expect(style).toBeTruthy()
    expect(style?.textContent).toContain('@page')
    expect(style?.textContent).toContain('338.67mm')
    expect(style?.textContent).toContain('190.50mm')
    expect(style?.textContent).toContain('print-color-adjust')
  })

  it('does not inject @page CSS in normal mode', () => {
    window.location.href = 'http://localhost/'

    const { container } = render(
      <Deck>
        <Slide>
          <div>A</div>
        </Slide>
      </Deck>,
    )

    const style = container.querySelector('style')
    expect(style).toBeNull()
  })
})

describe('Deck transitions', () => {
  it('defaults to display none/block for transition="none"', () => {
    const { container } = render(
      <Deck>
        <Slide>
          <div>One</div>
        </Slide>
        <Slide>
          <div>Two</div>
        </Slide>
      </Deck>,
    )

    const slideWrappers = container.querySelectorAll(
      '[style*="position: absolute"]',
    )
    expect(slideWrappers.length).toBeGreaterThanOrEqual(2)
  })

  it('uses opacity for transition="fade"', () => {
    const { container } = render(
      <Deck transition="fade">
        <Slide>
          <div>One</div>
        </Slide>
        <Slide>
          <div>Two</div>
        </Slide>
      </Deck>,
    )

    const html = container.innerHTML
    expect(html).toContain('opacity')
  })
})

describe('Deck aspect ratio', () => {
  it('renders with data-prez-total attribute', () => {
    const { container } = render(
      <Deck>
        <Slide>
          <div>A</div>
        </Slide>
      </Deck>,
    )
    expect(container.querySelector('[data-prez-total="1"]')).toBeTruthy()
  })

  it('accepts custom aspect ratio', () => {
    const { container } = render(
      <Deck aspectRatio="4/3">
        <Slide>
          <div>A</div>
        </Slide>
      </Deck>,
    )
    expect(container.querySelector('[data-prez-total]')).toBeTruthy()
  })
})
