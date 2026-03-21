import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Deck, Notes, Slide, useDeck } from '../index'

afterEach(() => cleanup())

describe('Slide', () => {
  it('renders children', () => {
    render(
      <Deck>
        <Slide>
          <div data-testid="content">Hello</div>
        </Slide>
      </Deck>,
    )
    expect(screen.getByTestId('content').textContent).toBe('Hello')
  })

  it('applies className and style', () => {
    render(
      <Deck>
        <Slide className="custom-class" style={{ backgroundColor: 'red' }}>
          <div data-testid="inner">Styled</div>
        </Slide>
      </Deck>,
    )
    const slide = screen.getByTestId('inner').parentElement!
    expect(slide.classList.contains('custom-class')).toBe(true)
    expect(slide.style.backgroundColor).toBe('red')
  })
})

describe('Notes', () => {
  it('renders nothing in normal mode', () => {
    const { container } = render(
      <Deck>
        <Slide>
          <div>Content</div>
          <Notes>Speaker notes here</Notes>
        </Slide>
      </Deck>,
    )
    expect(container.textContent).not.toContain('Speaker notes here')
  })
})

describe('useDeck', () => {
  it('throws when used outside Deck', () => {
    function BadComponent() {
      useDeck()
      return <div />
    }

    const origError = console.error
    console.error = () => {}
    expect(() => render(<BadComponent />)).toThrow(
      'useDeck must be used inside <Deck>',
    )
    console.error = origError
  })

  it('provides deck state inside Deck', () => {
    let capturedCtx: ReturnType<typeof useDeck> | null = null

    function Inspector() {
      capturedCtx = useDeck()
      return <div data-testid="inspector" />
    }

    render(
      <Deck>
        <Slide>
          <Inspector />
        </Slide>
        <Slide>
          <div>Two</div>
        </Slide>
        <Slide>
          <div>Three</div>
        </Slide>
      </Deck>,
    )

    expect(capturedCtx).not.toBeNull()
    expect(capturedCtx?.totalSlides).toBe(3)
    expect(capturedCtx?.currentSlide).toBe(0)
    expect(typeof capturedCtx?.next).toBe('function')
    expect(typeof capturedCtx?.prev).toBe('function')
    expect(typeof capturedCtx?.goTo).toBe('function')
  })
})
