import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { screenshotUrl } from '../render-modes.js'
import { asExternal, toInternal } from '../slide-index.js'
import { ChromeBrowser } from './chrome-cdp.js'
import { getChrome } from './find-chrome.js'
import { getSlideCount } from './screenshot-slide.js'

export async function exportPptx(
  url: string,
  output: string,
  timeout = 30000,
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default

  const tmpDir = join(process.cwd(), '.prez-export-tmp')
  mkdirSync(tmpDir, { recursive: true })

  try {
    console.log(`Exporting PPTX from ${url}`)

    const totalSlides = await getSlideCount(url, timeout)
    console.log(`Found ${totalSlides} slides`)

    // One Chrome process for the whole export; a fresh session (tab) per
    // slide so navigation state never leaks between captures. Matches the
    // WS-F parallel engine's "1 browser, N sessions" invariant — one
    // browser launch/teardown instead of `totalSlides` pairs.
    const browser = await ChromeBrowser.launch({ chromePath: getChrome() })
    try {
      // 1-based ExternalSlideNumber loop — matches the CLI-facing convention
      // and the Deck's ?screenshot=N contract. URL is built via the
      // canonical screenshotUrl helper so this path and the parallel CDP
      // engine produce identical URLs for identical inputs.
      for (let slide = 1; slide <= totalSlides; slide++) {
        const screenshotPath = join(tmpDir, `slide-${slide}.png`)
        const target = screenshotUrl(url, toInternal(asExternal(slide)))
        const session = await browser.newSession()
        try {
          await session.screenshot(target, screenshotPath, {
            width: 1280,
            height: 720,
            timeout,
          })
        } finally {
          await session.close()
        }
        console.log(`  Captured slide ${slide}/${totalSlides}`)
      }
    } finally {
      await browser.close()
    }

    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'

    for (let n = 1; n <= totalSlides; n++) {
      const imgPath = join(tmpDir, `slide-${n}.png`)
      const imgData = readFileSync(imgPath).toString('base64')

      const pSlide = pptx.addSlide()
      pSlide.addImage({
        data: `image/png;base64,${imgData}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      })
    }

    const buffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
    writeFileSync(resolve(output), buffer)
    console.log(`Exported ${totalSlides} slides to ${output}`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (
  typeof Bun !== 'undefined'
    ? Bun.main === import.meta.path
    : process.argv[1] === new URL(import.meta.url).pathname
) {
  const url = process.argv[2] || 'http://localhost:5173'
  const output = process.argv[3] || 'deck.pptx'
  exportPptx(url, output).catch((err: Error) => {
    console.error('PPTX export failed:', err.message)
    process.exit(1)
  })
}
