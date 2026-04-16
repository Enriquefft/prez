/**
 * Orchestrator for the `prez-validate` capture + diff pipeline.
 *
 * Single path handles both the "screenshot every slide" mode and the
 * "screenshot + diff against a baseline directory" mode; the choice is
 * driven by `opts.baseline`. Concurrency is also a single dial — when
 * `concurrency > 1` the caller delegates to `screenshotSlides` (the
 * WS-F pool), otherwise a sequential in-process loop reuses a single
 * `ChromeBrowser` + `ChromeSession` for all slides.
 *
 * Events are the SSOT for progress reporting: every non-terminal step
 * is a `ValidateEvent` emitted via `opts.onEvent`. The CLI decides how
 * to render them (human-readable prose vs. NDJSON). The returned
 * `ValidateManifest` is the terminal summary, fully backwards-compatible
 * with the v1.1 shape (new fields are additive and optional on
 * non-diff runs).
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ValidateEvent } from '../node.js'
import { screenshotUrl } from '../render-modes.js'
import {
  asExternal,
  assertValidExternal,
  type ExternalSlideNumber,
  toInternal,
} from '../slide-index.js'
import { ChromeBrowser } from './chrome-cdp.js'
import { diffPng } from './diff-screenshots.js'
import { getChrome } from './find-chrome.js'
import { screenshotSlides } from './parallel-screenshot.js'
import { safeCleanScreenshotsDir } from './safe-clean.js'
import { getSlideCount } from './screenshot-slide.js'

export interface ValidateOptions {
  url: string
  outputDir: string
  /** 1-based ExternalSlideNumber. Caller passes a plain number; validated internally. */
  slide?: number
  timeout?: number
  clean?: boolean
  /** Default 1. Set > 1 to delegate capture to the WS-F parallel pool. */
  concurrency?: number
  /** Absolute Chrome binary path. Defaults to `getChrome()`. */
  chromePath?: string
  /** Directory containing `slide-NN.png` baselines to diff against. */
  baseline?: string
  /** Diff ratio above which a slide is marked as failing. Default 0.005 (0.5%). */
  diffThreshold?: number
  onEvent?: (e: ValidateEvent) => void
}

export interface ValidateDiffEntry {
  slide: number
  baseline: string
  current: string
  diffPath: string
  diffRatio: number
  pass: boolean
}

export interface ValidateManifest {
  totalSlides: number
  slidesValidated: number[]
  screenshots: { slide: number; path: string }[]
  outputDir: string
  diffs?: ValidateDiffEntry[]
  diffFailures?: number
  durationMs: number
}

function pad(n: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return String(n).padStart(width, '0')
}

function slideFilename(slide: number, total: number): string {
  return `slide-${pad(slide, total)}.png`
}

function diffFilename(slide: number, total: number): string {
  return `diff-${pad(slide, total)}.png`
}

/**
 * Sequential capture path: one Chrome, one session, reused across all
 * slides. Used when `concurrency === 1` (the default) so single-slide
 * invocations pay the lightest Chrome overhead possible.
 *
 * Emits `slide` events via the caller's `onEvent` exactly once per
 * successful capture, in order. Errors bubble up — the caller unwinds
 * the Chrome handle in a `finally`.
 */
async function captureSequential(args: {
  url: string
  slides: ExternalSlideNumber[]
  outputFor: (slide: ExternalSlideNumber) => string
  chromePath: string
  timeoutMs: number
  onEvent?: (e: ValidateEvent) => void
}): Promise<void> {
  const browser = await ChromeBrowser.launch({ chromePath: args.chromePath })
  try {
    const session = await browser.newSession()
    try {
      for (const slide of args.slides) {
        const startedAt = Date.now()
        const outPath = args.outputFor(slide)
        const target = screenshotUrl(args.url, toInternal(slide))
        await session.screenshot(target, outPath, {
          width: 1280,
          height: 720,
          timeout: args.timeoutMs,
        })
        const durationMs = Date.now() - startedAt
        args.onEvent?.({
          type: 'slide',
          slide,
          path: outPath,
          durationMs,
        })
      }
    } finally {
      await session.close()
    }
  } finally {
    await browser.close()
  }
}

export async function validateScreenshots(
  opts: ValidateOptions,
): Promise<ValidateManifest> {
  const startedAt = Date.now()
  const timeout = opts.timeout ?? 30000
  const outputDir = resolve(opts.outputDir)
  const concurrency = opts.concurrency ?? 1
  const diffThreshold = opts.diffThreshold ?? 0.005
  const chromePath = opts.chromePath ?? getChrome()
  const baseline = opts.baseline ? resolve(opts.baseline) : undefined

  if (opts.clean) {
    safeCleanScreenshotsDir(outputDir)
  }
  mkdirSync(outputDir, { recursive: true })

  const totalSlides = await getSlideCount(opts.url, timeout)

  let targetsRaw: number[]
  if (opts.slide !== undefined) {
    assertValidExternal(opts.slide, totalSlides)
    targetsRaw = [opts.slide]
  } else {
    targetsRaw = Array.from({ length: totalSlides }, (_, i) => i + 1)
  }
  const targets: ExternalSlideNumber[] = targetsRaw.map((n) => asExternal(n))

  opts.onEvent?.({
    type: 'start',
    totalSlides,
    outputDir,
    url: opts.url,
    mode: baseline ? 'diff' : 'screenshot',
  })

  const screenshots: { slide: number; path: string }[] = []
  const outputFor = (slide: ExternalSlideNumber): string =>
    join(outputDir, slideFilename(slide, totalSlides))

  // Capture phase: delegate to the WS-F pool when concurrency > 1, fall back
  // to the in-process sequential loop otherwise. Either way, each successful
  // capture emits a `slide` event and pushes an entry into `screenshots`.
  const capturedOk = new Set<number>()
  const forwardEvent = (e: ValidateEvent): void => {
    if (e.type === 'slide') {
      capturedOk.add(e.slide)
      screenshots.push({ slide: e.slide, path: e.path })
    }
    opts.onEvent?.(e)
  }

  if (concurrency > 1 && targets.length > 1) {
    const result = await screenshotSlides({
      url: opts.url,
      slides: targets,
      outputFor,
      concurrency,
      chromePath,
      timeoutMs: timeout,
      onEvent: forwardEvent,
    })
    if (result.failed.length > 0) {
      const first = result.failed[0]
      throw new Error(
        `Failed to capture slide ${first.slide}: ${first.error.message}`,
      )
    }
  } else {
    await captureSequential({
      url: opts.url,
      slides: targets,
      outputFor,
      chromePath,
      timeoutMs: timeout,
      onEvent: forwardEvent,
    })
  }

  // Sort screenshots into slide order so the manifest is deterministic even
  // when the parallel pool completes out-of-order.
  screenshots.sort((a, b) => a.slide - b.slide)

  let diffs: ValidateDiffEntry[] | undefined
  let diffFailures = 0
  if (baseline) {
    diffs = []
    for (const slide of targets) {
      if (!capturedOk.has(slide)) continue
      const baselinePath = join(baseline, slideFilename(slide, totalSlides))
      const currentPath = outputFor(slide)
      let baselineBuf: Buffer
      let currentBuf: Buffer
      try {
        baselineBuf = await readFile(baselinePath)
      } catch {
        opts.onEvent?.({
          type: 'warn',
          slide,
          message: `baseline/${slideFilename(slide, totalSlides)} not found — skipping diff for slide ${slide}`,
        })
        continue
      }
      try {
        currentBuf = await readFile(currentPath)
      } catch {
        opts.onEvent?.({
          type: 'warn',
          slide,
          message: `current/${slideFilename(slide, totalSlides)} not found — skipping diff for slide ${slide}`,
        })
        continue
      }

      let result: Awaited<ReturnType<typeof diffPng>>
      try {
        result = await diffPng(baselineBuf, currentBuf)
      } catch (err) {
        opts.onEvent?.({
          type: 'warn',
          slide,
          message: `diff failed for slide ${slide}: ${err instanceof Error ? err.message : String(err)}`,
        })
        continue
      }

      const pass = result.diffRatio <= diffThreshold
      const diffPath = join(outputDir, diffFilename(slide, totalSlides))
      if (!pass) {
        writeFileSync(diffPath, result.diffPng)
        diffFailures++
      }
      const entry: ValidateDiffEntry = {
        slide,
        baseline: baselinePath,
        current: currentPath,
        diffPath,
        diffRatio: result.diffRatio,
        pass,
      }
      diffs.push(entry)
      opts.onEvent?.({
        type: 'diff',
        slide,
        baseline: baselinePath,
        current: currentPath,
        diffPath,
        diffRatio: result.diffRatio,
        pass,
      })
    }
  }

  const durationMs = Date.now() - startedAt
  const slidesValidated = screenshots.map((s) => s.slide)

  opts.onEvent?.({
    type: 'done',
    outputDir,
    slidesValidated: slidesValidated.length,
    durationMs,
    diffFailures,
  })

  const manifest: ValidateManifest = {
    totalSlides,
    slidesValidated,
    screenshots,
    outputDir,
    durationMs,
  }
  if (diffs !== undefined) {
    manifest.diffs = diffs
    manifest.diffFailures = diffFailures
  }
  return manifest
}
