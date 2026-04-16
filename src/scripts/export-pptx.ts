import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getSlideCount, screenshotSlide } from './screenshot-slide.js'

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

    for (let i = 0; i < totalSlides; i++) {
      const screenshotPath = join(tmpDir, `slide-${i}.png`)
      await screenshotSlide(url, i, screenshotPath, timeout)
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
