import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getChrome } from './find-chrome'

export async function exportPptx(
  url: string,
  output: string,
  timeout = 30000,
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default
  const chrome = getChrome()

  const tmpDir = join(process.cwd(), '.prez-export-tmp')
  mkdirSync(tmpDir, { recursive: true })

  const chromeFlags = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-features=LazyImageLoading',
    `--virtual-time-budget=${timeout}`,
    '--run-all-compositor-stages-before-draw',
  ].join(' ')

  try {
    console.log(`Exporting PPTX from ${url}`)
    console.log(`Using: ${chrome}`)

    const printHtml = execSync(
      `"${chrome}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=${timeout} --dump-dom "${url}?print=true"`,
      { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 },
    ).toString()

    const totalMatch = printHtml.match(/data-prez-total="(\d+)"/)
    const totalSlides = totalMatch ? Number.parseInt(totalMatch[1], 10) : 1

    console.log(`Found ${totalSlides} slides`)

    for (let i = 0; i < totalSlides; i++) {
      const screenshotPath = join(tmpDir, `slide-${i}.png`)
      execSync(
        `"${chrome}" ${chromeFlags} --screenshot="${screenshotPath}" --window-size=1280,720 "${url}#/${i}"`,
        { stdio: 'pipe' },
      )
      console.log(`  Captured slide ${i + 1}/${totalSlides}`)
    }

    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'

    for (let i = 0; i < totalSlides; i++) {
      const imgPath = join(tmpDir, `slide-${i}.png`)
      const imgData = readFileSync(imgPath).toString('base64')

      const slide = pptx.addSlide()
      slide.addImage({
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

// Run as standalone script
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
