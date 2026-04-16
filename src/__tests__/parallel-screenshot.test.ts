import { describe, expect, it } from 'bun:test'
import type { ValidateEvent } from '../node'
import {
  type ScreenshotBrowserLike,
  type ScreenshotSessionLike,
  screenshotSlides,
} from '../scripts/parallel-screenshot'
import { asExternal, type ExternalSlideNumber } from '../slide-index'

function extSlides(...ns: number[]): ExternalSlideNumber[] {
  return ns.map((n) => asExternal(n))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface FakeSessionOptions {
  /** Per-invocation delay in ms. */
  delay?: number
  /** If set, throw on the Nth call (1-based). Repeats as a pattern. */
  failOn?: (attempt: number, url: string) => Error | null
}

class FakeBrowser implements ScreenshotBrowserLike {
  readonly sessionsCreated: FakeSession[] = []
  readonly closedSessions: FakeSession[] = []
  closed = false
  private readonly nextSessionOptions: FakeSessionOptions[]
  private readonly defaultOptions: FakeSessionOptions
  private readonly onNewSessionThrowAt: number | null
  private sessionIdx = 0

  constructor(opts?: {
    sessions?: FakeSessionOptions[]
    default?: FakeSessionOptions
    throwOnNewSessionAt?: number
  }) {
    this.nextSessionOptions = opts?.sessions ?? []
    this.defaultOptions = opts?.default ?? {}
    this.onNewSessionThrowAt = opts?.throwOnNewSessionAt ?? null
  }

  async newSession(): Promise<ScreenshotSessionLike> {
    this.sessionIdx++
    if (
      this.onNewSessionThrowAt !== null &&
      this.sessionIdx === this.onNewSessionThrowAt
    ) {
      throw new Error(`newSession failure @ ${this.sessionIdx}`)
    }
    const options =
      this.nextSessionOptions[this.sessionIdx - 1] ?? this.defaultOptions
    const s = new FakeSession(options, (self) => {
      this.closedSessions.push(self)
    })
    this.sessionsCreated.push(s)
    return s
  }

  async close(): Promise<void> {
    this.closed = true
  }
}

class FakeSession implements ScreenshotSessionLike {
  readonly calls: { url: string; outPath: string }[] = []
  closed = false
  private attempt = 0
  constructor(
    private readonly opts: FakeSessionOptions,
    private readonly onClosed: (s: FakeSession) => void,
  ) {}

  async screenshot(url: string, outPath: string): Promise<void> {
    this.attempt++
    if (this.opts.delay) await sleep(this.opts.delay)
    const err = this.opts.failOn?.(this.attempt, url)
    if (err) throw err
    this.calls.push({ url, outPath })
  }

  async close(): Promise<void> {
    this.closed = true
    this.onClosed(this)
  }
}

describe('screenshotSlides (mocked)', () => {
  it('caps concurrent sessions at `concurrency` and emits one slide event per success', async () => {
    const events: ValidateEvent[] = []
    const browser = new FakeBrowser({ default: { delay: 5 } })
    const result = await screenshotSlides(
      {
        url: 'http://example/',
        slides: extSlides(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 4,
        chromePath: '/unused',
        onEvent: (e) => events.push(e),
      },
      async () => browser,
    )

    expect(browser.sessionsCreated).toHaveLength(4)
    expect(result.succeeded).toHaveLength(10)
    expect(result.failed).toHaveLength(0)
    const slideEvents = events.filter((e) => e.type === 'slide')
    expect(slideEvents).toHaveLength(10)
    // One event per slide 1..10, no duplicates.
    const seen = new Set<number>()
    for (const e of slideEvents) {
      if (e.type === 'slide') {
        expect(seen.has(e.slide)).toBe(false)
        seen.add(e.slide)
      }
    }
    expect(seen.size).toBe(10)
    expect(browser.closed).toBe(true)
  })

  it('emits an error event and records failure when retries are exhausted', async () => {
    const events: ValidateEvent[] = []
    // Slide 3 always fails; all other slides always pass.
    const browser = new FakeBrowser({
      default: {
        failOn: (_attempt, url) => {
          if (url.includes('screenshot=2')) {
            return new Error('boom slide 3')
          }
          return null
        },
      },
    })

    const result = await screenshotSlides(
      {
        url: 'http://example/',
        slides: extSlides(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 3,
        chromePath: '/unused',
        maxRetriesPerSlide: 2,
        onEvent: (e) => events.push(e),
      },
      async () => browser,
    )

    expect(result.succeeded).toHaveLength(9)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].slide).toBe(asExternal(3))
    expect(result.failed[0].error.message).toContain('boom slide 3')

    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0].type).toBe('error')
    if (errorEvents[0].type === 'error') {
      expect(errorEvents[0].slide).toBe(asExternal(3))
      expect(errorEvents[0].message).toContain('boom slide 3')
    }
  })

  it('rotates the session on failure; retries eventually succeed', async () => {
    const events: ValidateEvent[] = []
    // Session 1 fails every call; session 2+ succeed.
    const browser = new FakeBrowser({
      sessions: [
        {
          failOn: () => new Error('dead session'),
        },
      ],
      default: {},
    })

    const result = await screenshotSlides(
      {
        url: 'http://example/',
        slides: extSlides(1),
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 1,
        chromePath: '/unused',
        maxRetriesPerSlide: 2,
        onEvent: (e) => events.push(e),
      },
      async () => browser,
    )

    // 1 session dies on the first attempt; pool rotates and eventually succeeds.
    expect(browser.sessionsCreated.length).toBeGreaterThanOrEqual(2)
    expect(result.succeeded).toEqual(extSlides(1))
    expect(result.failed).toHaveLength(0)
  })

  it('emits slide events in completion order, not submission order', async () => {
    const events: ValidateEvent[] = []
    // Create a distinct FakeSession per worker where the per-call delay is
    // determined by the URL (slide number). The highest slide finishes first.
    const browser = new FakeBrowser({
      default: {
        failOn: () => null,
      },
    })
    // Override the session factory to inject per-call delay keyed on slide.
    const origNewSession = browser.newSession.bind(browser)
    browser.newSession = async () => {
      const s = (await origNewSession()) as FakeSession
      const originalScreenshot = s.screenshot.bind(s)
      s.screenshot = async (url: string, outPath: string) => {
        const m = url.match(/screenshot=(\d+)/)
        const idx = m ? Number.parseInt(m[1], 10) : 0
        // slide 0 (external 1) slow, slide 4 (external 5) fast.
        await sleep(80 - idx * 10)
        return originalScreenshot(url, outPath)
      }
      return s
    }

    await screenshotSlides(
      {
        url: 'http://example/',
        slides: extSlides(1, 2, 3, 4, 5),
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 5,
        chromePath: '/unused',
        onEvent: (e) => events.push(e),
      },
      async () => browser,
    )

    const slideOrder = events
      .filter((e) => e.type === 'slide')
      .map((e) => (e.type === 'slide' ? e.slide : 0))
    // Completion order must be reverse of submission order given our delays.
    expect(slideOrder).toEqual(extSlides(5, 4, 3, 2, 1))
  })

  it('aborts and rethrows when browser.newSession() dies mid-run', async () => {
    const browser = new FakeBrowser({
      default: {
        failOn: () => new Error('trigger rotate'),
      },
      throwOnNewSessionAt: 2,
    })

    await expect(
      screenshotSlides(
        {
          url: 'http://example/',
          slides: extSlides(1, 2, 3),
          outputFor: (s) => `/tmp/slide-${s}.png`,
          concurrency: 1,
          chromePath: '/unused',
          maxRetriesPerSlide: 2,
        },
        async () => browser,
      ),
    ).rejects.toThrow(/rotate|newSession failure/)

    expect(browser.closed).toBe(true)
  })

  it('returns empty success/failure when slides array is empty', async () => {
    const browser = new FakeBrowser()
    const result = await screenshotSlides(
      {
        url: 'http://example/',
        slides: [],
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 4,
        chromePath: '/unused',
      },
      async () => browser,
    )
    expect(result.succeeded).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('uses screenshotUrl(url, toInternal(slide)) — SSOT on the URL contract', async () => {
    const browser = new FakeBrowser()
    const urls: string[] = []
    const origNewSession = browser.newSession.bind(browser)
    browser.newSession = async () => {
      const s = (await origNewSession()) as FakeSession
      const origShot = s.screenshot.bind(s)
      s.screenshot = async (url, outPath) => {
        urls.push(url)
        return origShot(url, outPath)
      }
      return s
    }

    await screenshotSlides(
      {
        url: 'http://example/',
        slides: extSlides(1, 2, 3),
        outputFor: (s) => `/tmp/slide-${s}.png`,
        concurrency: 1,
        chromePath: '/unused',
      },
      async () => browser,
    )

    expect(urls).toEqual([
      'http://example/?screenshot=0',
      'http://example/?screenshot=1',
      'http://example/?screenshot=2',
    ])
  })
})
