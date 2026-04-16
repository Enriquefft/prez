export type { RenderMode } from './render-modes'
export {
  parseRenderMode,
  presenterUrl,
  printUrl,
  screenshotUrl,
} from './render-modes'
export type {
  ChromeLaunchOptions,
  ScreenshotOptions,
} from './scripts/chrome-cdp'
export {
  ChromeBrowser,
  ChromeCdpError,
  ChromeSession,
} from './scripts/chrome-cdp'
export type {
  ParallelScreenshotOptions,
  ParallelScreenshotResult,
} from './scripts/parallel-screenshot'
export { screenshotSlides } from './scripts/parallel-screenshot'
export type { SafeCleanReport } from './scripts/safe-clean'
export { safeCleanScreenshotsDir } from './scripts/safe-clean'
export type {
  ValidateManifest,
  ValidateOptions,
} from './scripts/validate-screenshots'
export { validateScreenshots } from './scripts/validate-screenshots'
export type {
  ExternalSlideNumber,
  InternalSlideIndex,
} from './slide-index'
export {
  asExternal,
  asInternal,
  assertValidExternal,
  toExternal,
  toInternal,
} from './slide-index'

import type { ExternalSlideNumber } from './slide-index'

/**
 * NDJSON-friendly event stream emitted by `validateScreenshots` when the
 * caller provides an `onEvent` callback (wired in WS-C). Every field uses
 * the canonical external 1-based slide number convention defined in
 * `./slide-index`.
 */
export type ValidateEvent =
  | {
      type: 'start'
      totalSlides: number
      outputDir: string
      url: string
      mode: 'screenshot' | 'diff'
    }
  | {
      type: 'slide'
      slide: ExternalSlideNumber
      path: string
      durationMs: number
    }
  | {
      type: 'diff'
      slide: ExternalSlideNumber
      baseline: string
      current: string
      diffPath: string
      diffRatio: number
      pass: boolean
    }
  | { type: 'warn'; message: string; slide?: ExternalSlideNumber }
  | { type: 'error'; message: string; slide?: ExternalSlideNumber }
  | {
      type: 'done'
      outputDir: string
      slidesValidated: number
      durationMs: number
      diffFailures: number
    }
