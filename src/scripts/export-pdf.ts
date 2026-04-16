import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { printUrl as buildPrintUrl } from '../render-modes.js'
import { getChrome } from './find-chrome'
import { runChromeAsync } from './run-chrome'

export async function exportPdf(
  url: string,
  output: string,
  distDir: string,
  timeout = 30000,
): Promise<void> {
  const chrome = getChrome()
  const printUrl = buildPrintUrl(url)

  console.log(`Exporting PDF from ${printUrl}`)

  const { stdout } = await runChromeAsync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--virtual-time-budget=${timeout}`,
      '--dump-dom',
      printUrl,
    ],
    timeout + 15000,
    true,
  )

  const rendered = stdout
    .toString()
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')

  const tempFilename = `__prez-print-${process.pid}-${Date.now()}__.html`
  const tempPath = join(distDir, tempFilename)
  writeFileSync(tempPath, rendered)

  try {
    await runChromeAsync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1280,720',
        `--print-to-pdf=${output}`,
        '--no-pdf-header-footer',
        `--virtual-time-budget=${timeout}`,
        '--run-all-compositor-stages-before-draw',
        new URL(tempFilename, url).toString(),
      ],
      timeout + 15000,
    )
  } finally {
    try {
      unlinkSync(tempPath)
    } catch {
      // best-effort cleanup
    }
  }

  console.log(`Exported to ${output}`)
}

if (
  typeof Bun !== 'undefined'
    ? Bun.main === import.meta.path
    : process.argv[1] === new URL(import.meta.url).pathname
) {
  const url = process.argv[2] || 'http://localhost:5173'
  const output = process.argv[3] || 'deck.pdf'
  const distDir = process.argv[4] || 'dist'
  exportPdf(url, output, distDir).catch((err: Error) => {
    console.error('PDF export failed:', err.message)
    process.exit(1)
  })
}
