import { execSync } from 'node:child_process'
import { getChrome } from './find-chrome'

const url = process.argv[2] || 'http://localhost:5173'
const output = process.argv[3] || 'deck.pdf'

const chrome = getChrome()
const printUrl = `${url}?print=true`

console.log(`Exporting PDF from ${printUrl}`)
console.log(`Using: ${chrome}`)

execSync(
  `"${chrome}" --headless=new --disable-gpu --no-sandbox --print-to-pdf="${output}" --no-pdf-header-footer --virtual-time-budget=10000 --run-all-compositor-stages-before-draw "${printUrl}"`,
  { stdio: 'inherit' },
)

console.log(`Exported to ${output}`)
