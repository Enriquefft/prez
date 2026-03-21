import { describe, expect, it } from 'bun:test'
import { symbols } from '../symbols'

describe('symbols', () => {
  it('exports an object with symbol keys', () => {
    expect(typeof symbols).toBe('object')
    expect(Object.keys(symbols).length).toBeGreaterThan(30)
  })

  it('has non-empty string values', () => {
    for (const [_key, value] of Object.entries(symbols)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('contains common presentation symbols', () => {
    expect(symbols.check).toBe('\u2713')
    expect(symbols.cross).toBe('\u2717')
    expect(symbols.arrowRight).toBe('\u2192')
    expect(symbols.mdash).toBe('\u2014')
    expect(symbols.bullet).toBe('\u2022')
    expect(symbols.star).toBe('\u2605')
    expect(symbols.times).toBe('\u00D7')
    expect(symbols.warning).toBe('\u26A0')
  })
})
