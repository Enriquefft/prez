import { execSync } from 'node:child_process'
import { getChrome } from './find-chrome'

const url = process.argv[2] || 'http://localhost:5173'
const output = process.argv[3] || 'deck.pdf'

const chrome = getChrome()
const printUrl = `${url}?print=true`

console.log(`Exporting PDF from ${printUrl}`)
console.log(`Using: ${chrome}`)

execSync(
  `"${chrome}" --headless --disable-gpu --no-sandbox --print-to-pdf="${output}" --no-pdf-header-footer "${printUrl}"`,
  { stdio: 'inherit' },
)

console.log(`Exported to ${output}`)
