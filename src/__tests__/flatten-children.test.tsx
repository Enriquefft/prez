import { afterEach, describe, expect, it } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { Deck, Notes, Slide } from '../index'

afterEach(() => cleanup())

// We test flattenChildren indirectly through Deck since it's not exported

describe('flattenChildren', () => {
  it('counts direct Slide children', () => {
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
    expect(container.querySelector('[data-prez-total="3"]')).toBeTruthy()
  })

  it('flattens Fragment children', () => {
    const slides = (
      <>
        <Slide>
          <div>Slide 1</div>
        </Slide>
        <Slide>
          <div>Slide 2</div>
        </Slide>
      </>
    )
    const { container } = render(<Deck>{slides}</Deck>)
    expect(container.querySelector('[data-prez-total="2"]')).toBeTruthy()
  })

  it('flattens nested Fragments', () => {
    const group1 = (
      <>
        <Slide>
          <div>A</div>
        </Slide>
        <Slide>
          <div>B</div>
        </Slide>
      </>
    )
    const group2 = (
      <>
        <Slide>
          <div>C</div>
        </Slide>
      </>
    )
    const { container } = render(
      <Deck>
        {group1}
        {group2}
      </Deck>,
    )
    expect(container.querySelector('[data-prez-total="3"]')).toBeTruthy()
  })

  it('excludes Notes from slide count', () => {
    const { container } = render(
      <Deck>
        <Slide>
          <div>Slide 1</div>
        </Slide>
        <Notes>Some notes</Notes>
        <Slide>
          <div>Slide 2</div>
        </Slide>
      </Deck>,
    )
    expect(container.querySelector('[data-prez-total="2"]')).toBeTruthy()
  })

  it('handles mixed Fragments and direct children', () => {
    const extra = (
      <>
        <Slide>
          <div>B</div>
        </Slide>
        <Slide>
          <div>C</div>
        </Slide>
      </>
    )
    const { container } = render(
      <Deck>
        <Slide>
          <div>A</div>
        </Slide>
        {extra}
      </Deck>,
    )
    expect(container.querySelector('[data-prez-total="3"]')).toBeTruthy()
  })

  it('warns on single component child in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const warns: string[] = []
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => warns.push(String(args[0]))

    function MySlides() {
      return (
        <>
          <Slide>
            <div>A</div>
          </Slide>
          <Slide>
            <div>B</div>
          </Slide>
        </>
      )
    }

    render(
      <Deck>
        <MySlides />
      </Deck>,
    )

    console.warn = origWarn
    process.env.NODE_ENV = originalEnv
    expect(warns.some((w) => w.includes('[prez]'))).toBe(true)
  })
})
