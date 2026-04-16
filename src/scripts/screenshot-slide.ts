import { printUrl, screenshotUrl } from '../render-modes.js'
import { asExternal, toInternal } from '../slide-index.js'
import { ChromeBrowser } from './chrome-cdp.js'
import { getChrome } from './find-chrome.js'
import { runChromeAsync } from './run-chrome.js'

export async function getSlideCount(
  url: string,
  timeout = 30000,
): Promise<number> {
  const { stdout } = await runChromeAsync(
    getChrome(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--virtual-time-budget=${timeout}`,
      '--dump-dom',
      printUrl(url),
    ],
    timeout + 15000,
    true,
  )
  const match = stdout.toString().match(/data-prez-total="(\d+)"/)
  return match ? Number.parseInt(match[1], 10) : 1
}

/**
 * Capture a single slide into a PNG at exactly 1280×720.
 *
 * `slide` is a 1-based ExternalSlideNumber (the public convention shared
 * with every CLI and every JSON manifest). Internally it is converted to
 * the 0-based InternalSlideIndex the Deck's `?screenshot=N` contract
 * expects, and the URL is built via the canonical `screenshotUrl` helper
 * so this script and the parallel CDP-based engine produce identical
 * URLs for identical inputs.
 *
 * Uses the Chrome DevTools Protocol (via `ChromeBrowser`/`ChromeSession`)
 * rather than the `--screenshot` / `--window-size` CLI flags. CDP's
 * `Emulation.setDeviceMetricsOverride` pins the viewport to the requested
 * dimensions exactly; the CLI-flag path on Linux reserves ~88px for
 * emulated OS chrome, producing a sub-720 inner viewport and the
 * letterbox/white-bottom artifacts WS-B fixes.
 */
export async function screenshotSlide(
  url: string,
  slide: number,
  outputPath: string,
  timeout = 30000,
): Promise<void> {
  const target = screenshotUrl(url, toInternal(asExternal(slide)))
  const browser = await ChromeBrowser.launch({ chromePath: getChrome() })
  try {
    const session = await browser.newSession()
    try {
      await session.screenshot(target, outputPath, {
        width: 1280,
        height: 720,
        timeout,
      })
    } finally {
      await session.close()
    }
  } finally {
    await browser.close()
  }
}
