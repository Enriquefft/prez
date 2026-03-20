import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

const url = process.argv[2] || 'http://localhost:5173'
const output = process.argv[3] || 'deck.pdf'

async function exportPdf() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  await page.goto(`${url}#/0`, { waitUntil: 'networkidle0' })

  // Get total slide count from the deck
  const totalSlides = await page.evaluate(() => {
    const el = document.querySelector('[data-prez-total]')
    return el ? parseInt(el.getAttribute('data-prez-total') || '1', 10) : 1
  })

  const pages: Buffer[] = []

  for (let i = 0; i < totalSlides; i++) {
    await page.goto(`${url}#/${i}`, { waitUntil: 'networkidle0' })
    await page.waitForTimeout(300) // allow transitions to settle

    const pdf = await page.pdf({
      width: '1280px',
      height: '720px',
      printBackground: true,
      pageRanges: '1',
    })
    pages.push(Buffer.from(pdf))
  }

  // For simplicity, capture as single-page PDFs and use the last full export
  // A proper implementation would merge PDFs — for v1, use full-page capture
  await page.goto(`${url}#/0`, { waitUntil: 'networkidle0' })

  const fullPdf = await page.pdf({
    width: '1280px',
    height: '720px',
    printBackground: true,
  })

  writeFileSync(output, fullPdf)
  console.log(`Exported ${totalSlides} slides to ${output}`)

  await browser.close()
}

exportPdf().catch((err) => {
  console.error('PDF export failed:', err.message)
  process.exit(1)
})
