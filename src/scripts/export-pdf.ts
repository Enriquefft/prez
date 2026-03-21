import { execSync } from 'node:child_process'
import { getChrome } from './find-chrome'

export function exportPdf(url: string, output: string, timeout = 30000): void {
  const chrome = getChrome()
  const printUrl = `${url}?print=true`

  console.log(`Exporting PDF from ${printUrl}`)
  console.log(`Using: ${chrome}`)

  execSync(
    `"${chrome}" --headless=new --disable-gpu --no-sandbox --disable-features=LazyImageLoading --print-to-pdf="${output}" --no-pdf-header-footer --virtual-time-budget=${timeout} --run-all-compositor-stages-before-draw "${printUrl}"`,
    { stdio: 'inherit' },
  )

  console.log(`Exported to ${output}`)
}

// Run as standalone script
if (
  typeof Bun !== 'undefined'
    ? Bun.main === import.meta.path
    : process.argv[1] === new URL(import.meta.url).pathname
) {
  const url = process.argv[2] || 'http://localhost:5173'
  const output = process.argv[3] || 'deck.pdf'
  exportPdf(url, output)
}
