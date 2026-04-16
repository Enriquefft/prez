/**
 * Bounded-concurrency screenshot pool backed by `ChromeBrowser` + N
 * `ChromeSession`s (one tab per worker, one Chrome process total).
 *
 * The pool is a dumb FIFO queue with a few rules:
 *   1. One `ChromeBrowser`, `min(concurrency, slides.length)` sessions.
 *   2. On per-slide failure, rotate the session (close + replace via
 *      `browser.newSession()`) and requeue up to `maxRetriesPerSlide`.
 *   3. If `newSession()` itself fails, the browser is dead — abort the
 *      remaining queue, close the browser, rethrow.
 *   4. `ValidateEvent` (`'slide'` / `'error'`) is emitted as each slide
 *      settles, in completion order.
 *
 * URL construction goes through `screenshotUrl(url, toInternal(slide))`
 * from `../render-modes` — the SSOT defined in WS-A. This matches the
 * render-mode contract the Deck will honor once WS-B lands. Before
 * WS-B: the parameter is ignored by the Deck and screenshots always
 * show slide 1. That's a known WS-B coordination point; this layer is
 * correct on contract.
 */

import type { ValidateEvent } from '../node.js'
import { screenshotUrl } from '../render-modes.js'
import {
  asExternal,
  type ExternalSlideNumber,
  toInternal,
} from '../slide-index.js'
import {
  ChromeBrowser,
  ChromeCdpError,
  type ChromeSession,
} from './chrome-cdp.js'

export interface ParallelScreenshotOptions {
  /** Base URL of the served deck, e.g. `http://127.0.0.1:1234/`. */
  url: string
  /** 1-based external slide numbers to capture. */
  slides: ExternalSlideNumber[]
  /** Maps a 1-based slide number to an absolute output path. */
  outputFor: (slide: ExternalSlideNumber) => string
  /** Target worker count. This layer respects the caller's clamp. */
  concurrency: number
  /** Absolute path to the Chrome binary. */
  chromePath: string
  /** Per-slide timeout, default 30000. */
  timeoutMs?: number
  /** Maximum retries per slide before giving up. Default 2 (3 total attempts). */
  maxRetriesPerSlide?: number
  /** Optional stream of `slide` / `error` events, emitted in completion order. */
  onEvent?: (e: ValidateEvent) => void
}

export interface ParallelScreenshotResult {
  succeeded: ExternalSlideNumber[]
  failed: { slide: ExternalSlideNumber; error: Error }[]
}

/**
 * Factory abstraction kept private (not re-exported from `node.ts`). Tests
 * pass a fake to exercise pool semantics without real Chrome; production
 * callers never supply this argument.
 */
export interface ScreenshotBrowserLike {
  newSession(): Promise<ScreenshotSessionLike>
  close(): Promise<void>
}
export interface ScreenshotSessionLike {
  screenshot(
    url: string,
    outPath: string,
    opts?: { width: number; height: number; timeout: number },
  ): Promise<void>
  close(): Promise<void>
}

interface Task {
  slide: ExternalSlideNumber
  attempt: number
}

export async function screenshotSlides(
  opts: ParallelScreenshotOptions,
  browserFactory?: () => Promise<ScreenshotBrowserLike>,
): Promise<ParallelScreenshotResult> {
  const timeoutMs = opts.timeoutMs ?? 30000
  const maxRetries = opts.maxRetriesPerSlide ?? 2
  const concurrency = Math.max(
    1,
    Math.min(opts.concurrency, opts.slides.length),
  )

  const succeeded: ExternalSlideNumber[] = []
  const failed: { slide: ExternalSlideNumber; error: Error }[] = []

  if (opts.slides.length === 0) {
    return { succeeded, failed }
  }

  const queue: Task[] = opts.slides.map((slide) => ({ slide, attempt: 0 }))
  const browser: ScreenshotBrowserLike = browserFactory
    ? await browserFactory()
    : await ChromeBrowser.launch({ chromePath: opts.chromePath })

  let aborted: Error | null = null

  async function runWorker(): Promise<void> {
    let session: ScreenshotSessionLike | null = null
    try {
      session = await browser.newSession()
    } catch (err) {
      aborted =
        aborted ??
        new ChromeCdpError({
          stage: 'newSession',
          message: `Failed to create initial session: ${
            err instanceof Error ? err.message : String(err)
          }`,
          cause: err,
        })
      return
    }

    while (!aborted) {
      const task = queue.shift()
      if (!task) return

      const startedAt = Date.now()
      const outPath = opts.outputFor(task.slide)
      const url = screenshotUrl(opts.url, toInternal(asExternal(task.slide)))
      try {
        await session.screenshot(url, outPath, {
          width: 1280,
          height: 720,
          timeout: timeoutMs,
        })
        const durationMs = Date.now() - startedAt
        succeeded.push(task.slide)
        opts.onEvent?.({
          type: 'slide',
          slide: task.slide,
          path: outPath,
          durationMs,
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        if (task.attempt < maxRetries) {
          queue.push({ slide: task.slide, attempt: task.attempt + 1 })
          try {
            await session.close()
          } catch {
            /* ignore */
          }
          try {
            session = await browser.newSession()
          } catch (rotateErr) {
            aborted =
              aborted ??
              new ChromeCdpError({
                stage: 'newSession',
                message: `Failed to rotate session: ${
                  rotateErr instanceof Error
                    ? rotateErr.message
                    : String(rotateErr)
                }`,
                cause: rotateErr,
              })
            return
          }
        } else {
          failed.push({ slide: task.slide, error })
          opts.onEvent?.({
            type: 'error',
            slide: task.slide,
            message: error.message,
          })
        }
      }
    }

    try {
      await session.close()
    } catch {
      /* best-effort */
    }
  }

  const workers = Array.from({ length: concurrency }, () => runWorker())
  try {
    await Promise.all(workers)
  } finally {
    try {
      await browser.close()
    } catch {
      /* best-effort */
    }
  }

  if (aborted) throw aborted
  return { succeeded, failed }
}

/**
 * Module-private handle exposed to tests (never re-exported from `node.ts`).
 * Lets the unit test narrow the `ChromeSession` type it receives from a
 * fake factory without importing the real class.
 */
export type { ChromeSession as _ChromeSessionPublic }
