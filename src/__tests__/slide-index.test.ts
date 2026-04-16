import { describe, expect, it } from 'bun:test'
import {
  asExternal,
  asInternal,
  assertValidExternal,
  toExternal,
  toInternal,
} from '../slide-index'

describe('asExternal', () => {
  it('accepts positive integers', () => {
    expect(asExternal(1)).toBe(1)
    expect(asExternal(42)).toBe(42)
  })

  it('rejects zero', () => {
    expect(() => asExternal(0)).toThrow(RangeError)
  })

  it('rejects negatives', () => {
    expect(() => asExternal(-1)).toThrow(RangeError)
  })

  it('rejects non-integers', () => {
    expect(() => asExternal(1.5)).toThrow(RangeError)
    expect(() => asExternal(Number.NaN)).toThrow(RangeError)
    expect(() => asExternal(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('asInternal', () => {
  it('accepts zero', () => {
    expect(asInternal(0)).toBe(0)
  })

  it('accepts positive integers', () => {
    expect(asInternal(5)).toBe(5)
  })

  it('rejects negatives', () => {
    expect(() => asInternal(-1)).toThrow(RangeError)
  })

  it('rejects non-integers', () => {
    expect(() => asInternal(1.5)).toThrow(RangeError)
  })
})

describe('toInternal / toExternal', () => {
  it('round-trips', () => {
    expect(toInternal(asExternal(1))).toBe(0)
    expect(toExternal(asInternal(0))).toBe(1)
    for (const n of [1, 2, 7, 100]) {
      const ext = asExternal(n)
      expect(toExternal(toInternal(ext))).toBe(ext)
    }
  })
})

describe('assertValidExternal', () => {
  it('throws RangeError with exact message for 0 of 5', () => {
    expect(() => assertValidExternal(0, 5)).toThrow(
      new RangeError('Slide 0 out of range (1..5)'),
    )
  })

  it('throws RangeError with exact message for 6 of 5', () => {
    expect(() => assertValidExternal(6, 5)).toThrow(
      new RangeError('Slide 6 out of range (1..5)'),
    )
  })

  it('does not throw for 3 of 5', () => {
    expect(() => assertValidExternal(3, 5)).not.toThrow()
  })

  it('rejects non-integers', () => {
    expect(() => assertValidExternal(1.5, 5)).toThrow(RangeError)
  })
})
