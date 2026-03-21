import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { Deck, Slide, useDeck } from '../index'

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

function SlideWithIndex() {
  const { currentSlide, totalSlides } = useDeck()
  return <div data-testid="info">{`${currentSlide}/${totalSlides}`}</div>
}

function TestDeck({ total = 3 }: { total?: number }) {
  return (
    <Deck>
      <Slide>
        <SlideWithIndex />
      </Slide>
      {Array.from({ length: total - 1 }, (_, i) => (
        <Slide key={i}>
          <div>Slide {i + 2}</div>
        </Slide>
      ))}
    </Deck>
  )
}

function pressKey(key: string) {
  act(() => {
    fireEvent.keyDown(window, { key })
  })
}

describe('keyboard navigation', () => {
  it('starts at slide 0', () => {
    render(<TestDeck />)
    expect(screen.getByTestId('info').textContent).toBe('0/3')
  })

  it('navigates forward with ArrowRight', () => {
    render(<TestDeck />)
    pressKey('ArrowRight')
    expect(screen.getByTestId('info').textContent).toBe('1/3')
  })

  it('navigates backward with ArrowLeft', () => {
    render(<TestDeck />)
    pressKey('ArrowRight')
    pressKey('ArrowRight')
    expect(screen.getByTestId('info').textContent).toBe('2/3')

    pressKey('ArrowLeft')
    expect(screen.getByTestId('info').textContent).toBe('1/3')
  })

  it('clamps to first slide', () => {
    render(<TestDeck />)
    pressKey('ArrowLeft')
    expect(screen.getByTestId('info').textContent).toBe('0/3')
  })

  it('clamps to last slide', () => {
    render(<TestDeck />)
    pressKey('ArrowRight')
    pressKey('ArrowRight')
    pressKey('ArrowRight')
    pressKey('ArrowRight')
    expect(screen.getByTestId('info').textContent).toBe('2/3')
  })

  it('navigates with Space', () => {
    render(<TestDeck />)
    pressKey(' ')
    expect(screen.getByTestId('info').textContent).toBe('1/3')
  })

  it('jumps to first with Home', () => {
    render(<TestDeck />)
    pressKey('ArrowRight')
    pressKey('ArrowRight')
    expect(screen.getByTestId('info').textContent).toBe('2/3')
    pressKey('Home')
    expect(screen.getByTestId('info').textContent).toBe('0/3')
  })

  it('jumps to last with End', () => {
    render(<TestDeck />)
    pressKey('End')
    expect(screen.getByTestId('info').textContent).toBe('2/3')
  })

  it('syncs hash on navigation', () => {
    render(<TestDeck />)
    pressKey('ArrowRight')
    expect(window.location.hash).toBe('#/1')
  })
})

describe('hash-based initial slide', () => {
  it('reads initial slide from URL hash', () => {
    window.location.hash = '#/2'
    render(<TestDeck />)
    expect(screen.getByTestId('info').textContent).toBe('2/3')
  })

  it('defaults to 0 for invalid hash', () => {
    window.location.hash = '#/999'
    render(<TestDeck />)
    expect(screen.getByTestId('info').textContent).toBe('0/3')
  })

  it('defaults to 0 for non-numeric hash', () => {
    window.location.hash = '#/abc'
    render(<TestDeck />)
    expect(screen.getByTestId('info').textContent).toBe('0/3')
  })
})
