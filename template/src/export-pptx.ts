import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getChrome } from './find-chrome'

const url = process.argv[2] || 'http://localhost:5173'
const output = process.argv[3] || 'deck.pptx'

async function exportPptx() {
  const PptxGenJS = (await import('pptxgenjs')).default
  const chrome = getChrome()

  const tmpDir = join(process.cwd(), '.prez-export-tmp')
  mkdirSync(tmpDir, { recursive: true })

  try {
    console.log(`Exporting PPTX from ${url}`)
    console.log(`Using: ${chrome}`)

    // Screenshot slide 0
    const firstScreenshot = join(tmpDir, 'slide-0.png')
    execSync(
      `"${chrome}" --headless --disable-gpu --no-sandbox --screenshot="${firstScreenshot}" --window-size=1280,720 "${url}#/0"`,
      { stdio: 'pipe' },
    )

    // Get total slide count: print-to-pdf the print view, count /Type /Page objects
    const tmpPdf = join(tmpDir, 'count.pdf')
    execSync(
      `"${chrome}" --headless --disable-gpu --no-sandbox --print-to-pdf="${tmpPdf}" --no-pdf-header-footer "${url}?print=true"`,
      { stdio: 'pipe' },
    )

    const pdfStr = readFileSync(tmpPdf).toString('latin1')
    const pageMatches = pdfStr.match(/\/Type\s*\/Page(?!s)/g)
    const totalSlides = pageMatches ? pageMatches.length : 1

    console.log(`Found ${totalSlides} slides`)

    // Screenshot remaining slides
    for (let i = 1; i < totalSlides; i++) {
      const screenshotPath = join(tmpDir, `slide-${i}.png`)
      execSync(
        `"${chrome}" --headless --disable-gpu --no-sandbox --screenshot="${screenshotPath}" --window-size=1280,720 "${url}#/${i}"`,
        { stdio: 'pipe' },
      )
      console.log(`  Captured slide ${i + 1}/${totalSlides}`)
    }

    // Assemble PPTX
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches (16:9)

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

exportPptx().catch((err: Error) => {
  console.error('PPTX export failed:', err.message)
  process.exit(1)
})
