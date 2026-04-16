import { describe, expect, it } from 'bun:test'
import {
  parseRenderMode,
  presenterUrl,
  printUrl,
  screenshotUrl,
} from '../render-modes'
import { asInternal } from '../slide-index'

describe('parseRenderMode', () => {
  it('returns normal for empty search', () => {
    expect(parseRenderMode('')).toEqual({ kind: 'normal' })
  })

  it('returns normal for unrecognized params', () => {
    expect(parseRenderMode('?foo=bar')).toEqual({ kind: 'normal' })
  })

  it('parses print=true', () => {
    expect(parseRenderMode('?print=true')).toEqual({ kind: 'print' })
  })

  it('parses presenter=true', () => {
    expect(parseRenderMode('?presenter=true')).toEqual({ kind: 'presenter' })
  })

  it('parses screenshot=<integer>', () => {
    const mode = parseRenderMode('?screenshot=2')
    expect(mode.kind).toBe('screenshot')
    if (mode.kind === 'screenshot') {
      expect(mode.slide).toBe(2 as ReturnType<typeof asInternal>)
    }
  })

  it('parses screenshot=0', () => {
    const mode = parseRenderMode('?screenshot=0')
    expect(mode.kind).toBe('screenshot')
    if (mode.kind === 'screenshot') {
      expect(mode.slide).toBe(0 as ReturnType<typeof asInternal>)
    }
  })

  it('throws on non-integer screenshot value', () => {
    expect(() => parseRenderMode('?screenshot=foo')).toThrow(RangeError)
    expect(() => parseRenderMode('?screenshot=1.5')).toThrow(RangeError)
  })

  it('throws on negative screenshot value', () => {
    expect(() => parseRenderMode('?screenshot=-1')).toThrow(RangeError)
  })

  it('accepts search string without leading ?', () => {
    expect(parseRenderMode('print=true')).toEqual({ kind: 'print' })
  })
})

describe('screenshotUrl', () => {
  it('appends ?screenshot=N when no existing query', () => {
    expect(screenshotUrl('http://127.0.0.1:8080/', asInternal(0))).toBe(
      'http://127.0.0.1:8080/?screenshot=0',
    )
  })

  it('appends &screenshot=N when an existing query is present', () => {
    expect(screenshotUrl('http://x/?foo=1', asInternal(3))).toBe(
      'http://x/?foo=1&screenshot=3',
    )
  })

  it('preserves a URL fragment (query must precede #)', () => {
    // Before the fragment-aware fix the helper produced
    // 'http://x/#/nav?screenshot=3', which browsers treat as part of
    // the fragment — the server never sees ?screenshot=3.
    expect(screenshotUrl('http://x/#/nav', asInternal(3))).toBe(
      'http://x/?screenshot=3#/nav',
    )
  })

  it('preserves a URL fragment when an existing query is present', () => {
    expect(screenshotUrl('http://x/?foo=1#/nav', asInternal(3))).toBe(
      'http://x/?foo=1&screenshot=3#/nav',
    )
  })
})

describe('printUrl', () => {
  it('appends ?print=true', () => {
    expect(printUrl('http://x/')).toBe('http://x/?print=true')
  })

  it('appends &print=true when an existing query is present', () => {
    expect(printUrl('http://x/?foo=1')).toBe('http://x/?foo=1&print=true')
  })

  it('preserves a URL fragment', () => {
    expect(printUrl('http://x/#/nav')).toBe('http://x/?print=true#/nav')
  })
})

describe('presenterUrl', () => {
  it('appends ?presenter=true', () => {
    expect(presenterUrl('http://x/')).toBe('http://x/?presenter=true')
  })

  it('preserves a URL fragment', () => {
    expect(presenterUrl('http://x/#/nav')).toBe('http://x/?presenter=true#/nav')
  })
})

describe('node.ts re-exports', () => {
  it('re-exports presenterUrl from the package node entrypoint', async () => {
    // Regression: src/node.ts initially re-exported only parseRenderMode,
    // printUrl, and screenshotUrl — presenterUrl was dead code from the
    // public package API surface (@enriquefft/prez/node). Downstream
    // consumers must be able to import presenterUrl from there.
    const nodeEntry = await import('../node')
    expect(typeof nodeEntry.presenterUrl).toBe('function')
    expect(nodeEntry.presenterUrl('http://x/')).toBe('http://x/?presenter=true')
  })

  it('re-exports printUrl and screenshotUrl from node entrypoint', async () => {
    const nodeEntry = await import('../node')
    expect(typeof nodeEntry.printUrl).toBe('function')
    expect(typeof nodeEntry.screenshotUrl).toBe('function')
    expect(typeof nodeEntry.parseRenderMode).toBe('function')
  })
})
