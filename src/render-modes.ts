/**
 * URL contract between the Deck renderer and the screenshot / export
 * scripts. A single source of truth for the query-string parameters that
 * switch Deck into a non-normal render mode.
 *
 * This module defines the wire format only. The Deck-side implementation
 * of each mode lives in `src/components/Deck.tsx`; the Chrome-driving
 * scripts live under `src/scripts/`. Both sides import from here so a
 * rename or addition propagates in one place.
 */

import { asInternal, type InternalSlideIndex } from './slide-index.js'

export type RenderMode =
  | { kind: 'normal' }
  | { kind: 'print' }
  | { kind: 'presenter' }
  | { kind: 'screenshot'; slide: InternalSlideIndex }

export const RENDER_MODE_PARAM = {
  print: 'print',
  presenter: 'presenter',
  screenshot: 'screenshot',
} as const

/**
 * Parse a URL search string (with or without leading `?`) into a RenderMode.
 *
 * - Missing / empty / unrecognized parameters yield `{ kind: 'normal' }`.
 * - `print=true` or `presenter=true` select the matching mode.
 * - `screenshot=<n>` requires `n` to be a non-negative integer; anything
 *   else throws RangeError eagerly. Agents see the error — never silent
 *   fallback to normal mode, which would be a debugging nightmare.
 */
export function parseRenderMode(search: string): RenderMode {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )

  const screenshotRaw = params.get(RENDER_MODE_PARAM.screenshot)
  if (screenshotRaw !== null) {
    const n = Number(screenshotRaw)
    if (!Number.isInteger(n)) {
      throw new RangeError(
        `Invalid screenshot parameter: ${JSON.stringify(screenshotRaw)} (expected non-negative integer)`,
      )
    }
    return { kind: 'screenshot', slide: asInternal(n) }
  }

  if (params.get(RENDER_MODE_PARAM.print) === 'true') {
    return { kind: 'print' }
  }
  if (params.get(RENDER_MODE_PARAM.presenter) === 'true') {
    return { kind: 'presenter' }
  }

  return { kind: 'normal' }
}

function appendParam(baseUrl: string, key: string, value: string): string {
  // Split on the first '#' so the query parameter lands in the URL's
  // search component, not its fragment. Browsers drop the fragment on
  // the wire, so `http://x/#/2?foo=1` never reaches the server with
  // `foo=1` — the query must precede the fragment.
  const hashIdx = baseUrl.indexOf('#')
  const head = hashIdx === -1 ? baseUrl : baseUrl.slice(0, hashIdx)
  const tail = hashIdx === -1 ? '' : baseUrl.slice(hashIdx) // includes '#'
  const sep = head.includes('?') ? '&' : '?'
  return `${head}${sep}${key}=${value}${tail}`
}

export function printUrl(baseUrl: string): string {
  return appendParam(baseUrl, RENDER_MODE_PARAM.print, 'true')
}

export function presenterUrl(baseUrl: string): string {
  return appendParam(baseUrl, RENDER_MODE_PARAM.presenter, 'true')
}

export function screenshotUrl(
  baseUrl: string,
  slide: InternalSlideIndex,
): string {
  return appendParam(baseUrl, RENDER_MODE_PARAM.screenshot, String(slide))
}
