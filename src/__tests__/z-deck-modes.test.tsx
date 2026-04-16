import { afterEach, describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { Deck, Slide } from '../index'

// These tests run last (z- prefix) because render-mode tests modify
// window.location which affects happy-dom's global state.

// Reset the URL between render-mode tests so an earlier failure leaving
// the URL as `?print=true` cannot leak into a later case. happy-dom
// shares one window across tests in a file.
afterEach(() => {
  window.location.href = 'http://localhost/'
})

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

describe('Deck screenshot mode', () => {
  it('renders a single slide at 1280×720 with no scaling wrapper when ?screenshot=0', () => {
    window.location.href = 'http://localhost/?screenshot=0'

    const { container } = render(
      <Deck>
        <Slide>
          <div>First slide</div>
        </Slide>
        <Slide>
          <div>Second slide</div>
        </Slide>
        <Slide>
          <div>Third slide</div>
        </Slide>
      </Deck>,
    )

    // Only the requested slide is rendered.
    const text = container.textContent
    expect(text).toContain('First slide')
    expect(text).not.toContain('Second slide')
    expect(text).not.toContain('Third slide')

    // Root attributes advertise total + requested index to screenshot consumers.
    const root = container.querySelector('[data-prez-slide="0"]')
    expect(root).toBeTruthy()
    expect(root?.getAttribute('data-prez-total')).toBe('3')

    // Error state is absent.
    expect(container.querySelector('[data-prez-error]')).toBeNull()

    // No `transform: scale(...)` anywhere in the rendered tree — the
    // scaling container must not be present in screenshot mode.
    const allStyled = container.querySelectorAll('[style]')
    for (const el of Array.from(allStyled)) {
      const s = el.getAttribute('style') ?? ''
      expect(s).not.toContain('scale(')
    }

    // No outer `100vw` / `100vh` wrapper with `#000` background — the
    // legacy letterbox path. The screenshot root's style should be
    // transparent and pinned to 1280×720.
    const html = container.innerHTML
    expect(html).not.toContain('100vw')
    expect(html).not.toContain('100vh')

    // Injected style block pins html/body/#root to 1280×720.
    const style = container.querySelector('style')
    expect(style?.textContent).toContain('1280px')
    expect(style?.textContent).toContain('720px')
  })

  it('selects slide by InternalSlideIndex — ?screenshot=2 renders the third child', () => {
    window.location.href = 'http://localhost/?screenshot=2'

    const { container } = render(
      <Deck>
        <Slide>
          <div>one</div>
        </Slide>
        <Slide>
          <div>two</div>
        </Slide>
        <Slide>
          <div>three</div>
        </Slide>
        <Slide>
          <div>four</div>
        </Slide>
        <Slide>
          <div>five</div>
        </Slide>
      </Deck>,
    )

    const text = container.textContent
    expect(text).toContain('three')
    expect(text).not.toContain('one')
    expect(text).not.toContain('two')
    expect(text).not.toContain('four')

    const root = container.querySelector('[data-prez-slide="2"]')
    expect(root).toBeTruthy()
    expect(root?.getAttribute('data-prez-total')).toBe('5')
  })

  it('renders out-of-range error state when ?screenshot=99 exceeds totalSlides', () => {
    window.location.href = 'http://localhost/?screenshot=99'

    const { container } = render(
      <Deck>
        <Slide>
          <div>a</div>
        </Slide>
        <Slide>
          <div>b</div>
        </Slide>
        <Slide>
          <div>c</div>
        </Slide>
      </Deck>,
    )

    const err = container.querySelector('[data-prez-error="out-of-range"]')
    expect(err).toBeTruthy()
    expect(err?.getAttribute('data-prez-total')).toBe('3')
    // No slide content leaked into the error state. Inspect the error
    // div's text directly rather than container.textContent (which picks
    // up the injected <style> block).
    expect(err?.textContent ?? '').toBe('')
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
