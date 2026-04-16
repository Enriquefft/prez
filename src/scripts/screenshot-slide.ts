import { getChrome } from './find-chrome.js'
import { runChromeAsync } from './run-chrome.js'

function commonArgs(timeout: number): string[] {
  return [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--virtual-time-budget=${timeout}`,
    '--run-all-compositor-stages-before-draw',
  ]
}

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
      `${url}?print=true`,
    ],
    timeout + 15000,
    true,
  )
  const match = stdout.toString().match(/data-prez-total="(\d+)"/)
  return match ? Number.parseInt(match[1], 10) : 1
}

export async function screenshotSlide(
  url: string,
  slideIndex: number,
  outputPath: string,
  timeout = 30000,
): Promise<void> {
  await runChromeAsync(
    getChrome(),
    [
      ...commonArgs(timeout),
      `--screenshot=${outputPath}`,
      '--window-size=1280,720',
      `${url}#/${slideIndex}`,
    ],
    timeout + 15000,
  )
}
