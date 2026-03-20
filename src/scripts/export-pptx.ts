import puppeteer from 'puppeteer'

const url = process.argv[2] || 'http://localhost:5173'
const output = process.argv[3] || 'deck.pptx'

async function exportPptx() {
  console.log('PPTX export is planned for a future release.')
  console.log('For now, use PDF export: npm run export:pdf')
  console.log('')
  console.log(`Target: ${url} -> ${output}`)
  process.exit(0)
}

exportPptx()
