import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prezRoot = resolve(__dirname, '..', '..')

function linkPrezDependency(targetDir: string) {
  const pkgPath = join(targetDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.dependencies['@enriquefft/prez'] = `file:${prezRoot}`
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

function installSkills() {
  const skillsSrc = join(prezRoot, 'skills')
  if (!existsSync(skillsSrc)) return
  const skillsDest = join(process.cwd(), '.claude', 'skills')
  mkdirSync(skillsDest, { recursive: true })
  cpSync(skillsSrc, skillsDest, { recursive: true })
}

function updateManifest(targetDir: string, name: string) {
  const manifestPath = join(targetDir, 'public', 'manifest.json')
  if (!existsSync(manifestPath)) return
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  manifest.name = name
  manifest.short_name = name
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'init') {
    const positionalName =
      args[1] && !args[1].startsWith('-') ? args[1] : undefined
    const isNonInteractive = args.includes('--yes') || args.includes('-y')

    if (isNonInteractive) {
      // Non-interactive path for CI
      const target = resolve(process.cwd(), positionalName || 'deck')

      if (existsSync(target)) {
        console.error(`Error: ${target} already exists.`)
        process.exit(1)
      }

      const templateDir = join(__dirname, '..', '..', 'template')

      if (!existsSync(templateDir)) {
        console.error(
          'Error: template directory not found. Is the prez package installed correctly?',
        )
        process.exit(1)
      }

      mkdirSync(target, { recursive: true })
      cpSync(templateDir, target, { recursive: true })
      linkPrezDependency(target)
      updateManifest(target, positionalName || 'deck')
      installSkills()

      console.log(`Created presentation at ${target}`)
      console.log(
        `Installed Claude skills to ${resolve(process.cwd(), '.claude', 'skills')}`,
      )
      console.log(`\nNext steps:`)
      console.log(`  cd ${positionalName || 'deck'}`)
      console.log('  bun install')
      console.log('  bun run dev')
    } else {
      // Interactive wizard
      p.intro('prez — Create a new presentation')

      const answers = await p.group(
        {
          name: () =>
            p.text({
              message: 'Deck name',
              placeholder: 'deck',
              defaultValue: positionalName || 'deck',
              validate: (value) => {
                if (!value) return 'Name is required'
                if (existsSync(resolve(process.cwd(), value))) {
                  return `${value} already exists`
                }
              },
            }),
          imageTools: () =>
            p.confirm({
              message:
                'Include image tools? (prez-image for AI generation, photo search, SVG rendering)',
              initialValue: true,
            }),
          installSkills: () =>
            p.confirm({
              message:
                'Install Claude Code skills? (prez + prez-image skills to .claude/skills/)',
              initialValue: true,
            }),
        },
        {
          onCancel: () => {
            p.cancel('Setup cancelled.')
            process.exit(0)
          },
        },
      )

      const target = resolve(process.cwd(), answers.name)
      const templateDir = join(__dirname, '..', '..', 'template')

      if (!existsSync(templateDir)) {
        p.cancel(
          'Template directory not found. Is the prez package installed correctly?',
        )
        process.exit(1)
      }

      const s = p.spinner()
      s.start('Scaffolding presentation')

      mkdirSync(target, { recursive: true })
      cpSync(templateDir, target, { recursive: true })
      linkPrezDependency(target)
      updateManifest(target, answers.name)
      if (answers.installSkills) {
        installSkills()
      }

      s.stop('Presentation scaffolded')

      const nextSteps = [`cd ${answers.name}`, 'bun install', 'bun run dev']

      p.note(nextSteps.join('\n'), 'Next steps')

      if (answers.imageTools) {
        p.note(
          [
            'prez-image is available via bunx prez-image after install.',
            '',
            'Commands:',
            '  bunx prez-image gen "prompt" -o public/image.png    Generate with AI (free)',
            '  bunx prez-image search "query" -o public/photo.jpg  Search royalty-free photos',
            '  bunx prez-image render input.svg -o public/out.png  Render SVG to PNG',
            '',
            'For photo search, set one of these environment variables:',
            '  export UNSPLASH_ACCESS_KEY="your-key"   # https://unsplash.com/developers',
            '  export PEXELS_API_KEY="your-key"         # https://www.pexels.com/api/',
          ].join('\n'),
          'Image tools',
        )
      }

      p.outro('Happy presenting!')
    }
  } else {
    console.log('prez - Zero-opinion presentation engine for AI\n')
    console.log('Usage:')
    console.log(
      '  prez init [name]         Scaffold a new presentation (default: ./deck)',
    )
    console.log('  prez init [name] --yes   Non-interactive mode (for CI)')
    console.log('')
  }
}

main()
