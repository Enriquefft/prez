import { cpSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)
const command = args[0]

if (command === 'init') {
  const target = resolve(process.cwd(), args[1] || 'deck')

  if (existsSync(target)) {
    console.error(`Error: ${target} already exists.`)
    process.exit(1)
  }

  // template/ is at the package root, CLI is in dist/cli/
  const templateDir = join(__dirname, '..', '..', 'template')

  if (!existsSync(templateDir)) {
    console.error('Error: template directory not found. Is the prez package installed correctly?')
    process.exit(1)
  }

  mkdirSync(target, { recursive: true })
  cpSync(templateDir, target, { recursive: true })

  console.log(`\nCreated presentation at ${target}\n`)
  console.log('Next steps:')
  console.log(`  cd ${args[1] || 'deck'}`)
  console.log('  npm install')
  console.log('  npm run dev\n')
} else {
  console.log('prez - Zero-opinion presentation engine for AI\n')
  console.log('Usage:')
  console.log('  prez init [path]    Scaffold a new presentation (default: ./deck)')
  console.log('')
}
