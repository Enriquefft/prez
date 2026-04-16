/**
 * Canonical slide-index convention.
 *
 * Two coordinate systems exist in prez; this module is the single source of
 * truth for converting between them:
 *
 *   - ExternalSlideNumber: 1-based. The value shown to humans and emitted by
 *     every CLI, every JSON manifest, and every log message. An agent
 *     consuming `prez-validate --json` sees `slide: 1` for the first slide.
 *
 *   - InternalSlideIndex: 0-based. The value used by React state, the URL
 *     hash (`#/0`, `#/1`, ...), and any array indexing inside the library.
 *
 * Branding is compile-time only: at runtime these are plain numbers, so they
 * cross JSON / URL / process boundaries with zero cost. `asExternal` /
 * `asInternal` enforce validity (integer + sign) and pin the brand.
 */

declare const EXTERNAL_BRAND: unique symbol
declare const INTERNAL_BRAND: unique symbol

export type ExternalSlideNumber = number & { readonly [EXTERNAL_BRAND]: true }
export type InternalSlideIndex = number & { readonly [INTERNAL_BRAND]: true }

/**
 * Brand an arbitrary number as a 1-based external slide number.
 * Throws RangeError if the value is not a positive integer.
 */
export function asExternal(n: number): ExternalSlideNumber {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(
      `Invalid ExternalSlideNumber: ${n} (must be a positive integer, 1-based)`,
    )
  }
  return n as ExternalSlideNumber
}

/**
 * Brand an arbitrary number as a 0-based internal slide index.
 * Throws RangeError if the value is not a non-negative integer.
 */
export function asInternal(n: number): InternalSlideIndex {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(
      `Invalid InternalSlideIndex: ${n} (must be a non-negative integer, 0-based)`,
    )
  }
  return n as InternalSlideIndex
}

/** Convert a 1-based external slide number to a 0-based internal index. */
export function toInternal(n: ExternalSlideNumber): InternalSlideIndex {
  return (n - 1) as InternalSlideIndex
}

/** Convert a 0-based internal slide index to a 1-based external number. */
export function toExternal(i: InternalSlideIndex): ExternalSlideNumber {
  return (i + 1) as ExternalSlideNumber
}

/**
 * Assert that `n` is a valid ExternalSlideNumber within a deck of `total`
 * slides. Throws RangeError with a stable, grep-able message shape if not.
 */
export function assertValidExternal(
  n: number,
  total: number,
): asserts n is ExternalSlideNumber {
  if (!Number.isInteger(n) || n < 1 || n > total) {
    throw new RangeError(`Slide ${n} out of range (1..${total})`)
  }
}

/**
 * Human-readable documentation fragment appended to every CLI's `--help`
 * output so agents consuming help text see the convention exactly once.
 */
export const SLIDE_INDEX_DOCS = `Slide numbering:
  Every CLI flag, JSON field, and log message uses 1-based slide numbers
  (slide 1 is the first slide). Internal URL hashes use 0-based indices
  (e.g. #/0 is slide 1), but this is never exposed through the CLI.`
