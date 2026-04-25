import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as p from '@clack/prompts'
import { SLIDE_INDEX_DOCS } from '../slide-index.js'
import { die, type HelpSpec, handleGlobalFlags } from './_cli-kit.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prezRoot = resolve(__dirname, '..', '..')

const INIT_HELP_SPEC: HelpSpec = {
  name: 'prez',
  summary: 'Zero-opinion presentation engine for AI',
  usage: ['prez init [name] [options]', 'prez init [name] --yes [--no-skills]'],
  sections: [
    {
      title: 'Commands',
      rows: [['init [name]', 'Scaffold a new presentation (default: ./deck)']],
    },
    {
      title: 'Options',
      rows: [
        ['-y, --yes', 'Non-interactive mode (for CI)'],
        ['--no-skills', 'Skip installing Claude skills via the skills CLI'],
        ['-h, --help', 'Show this help and exit'],
        ['-V, --version', 'Print version and exit'],
      ],
    },
    {
      title: 'Examples',
      rows: [
        ['prez init', 'Interactive wizard, scaffolds ./deck'],
        ['prez init mydeck --yes', 'Non-interactive scaffold at ./mydeck'],
        ['prez init d --yes --no-skills', 'CI scaffold without Claude skills'],
      ],
    },
  ],
  footer: SLIDE_INDEX_DOCS,
}

function linkPrezDependency(targetDir: string) {
  const pkgPath = join(targetDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  pkg.dependencies['@enriquefft/prez'] = `file:${prezRoot}`
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

/**
 * Delegate skill installation to vercel-labs/skills CLI.
 *
 * Skills CLI owns the install layout: symlinks by default (single source of
 * truth — package updates propagate), auto-detects 44 agent targets
 * (Claude Code, Cursor, Cline, Roo, …), writes a project-scoped lockfile.
 * Source is the local `skills/` dir inside the installed prez package, so
 * the install works offline and is implicitly version-pinned to the prez
 * the user is running.
 */
function installSkills() {
  const skillsSrc = join(prezRoot, 'skills')
  if (!existsSync(skillsSrc)) return
  const result = spawnSync(
    'bunx',
    ['skills', 'add', skillsSrc, '--skill', '*', '-y'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    },
  )
  if (result.error) {
    throw new Error(`skills CLI failed to launch: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || '(no output)'
    throw new Error(`skills CLI failed (exit ${result.status}):\n${stderr}`)
  }
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
  handleGlobalFlags(process.argv, INIT_HELP_SPEC)

  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'init') {
    const positionalName =
      args[1] && !args[1].startsWith('-') ? args[1] : undefined
    const isNonInteractive = args.includes('--yes') || args.includes('-y')
    const noSkills = args.includes('--no-skills')

    if (isNonInteractive) {
      // Non-interactive path for CI
      const target = resolve(process.cwd(), positionalName || 'deck')

      if (existsSync(target)) {
        die(`Error: ${target} already exists.`)
      }

      const templateDir = join(__dirname, '..', '..', 'template')

      if (!existsSync(templateDir)) {
        die(
          'Error: template directory not found. Is the prez package installed correctly?',
        )
      }

      mkdirSync(target, { recursive: true })
      cpSync(templateDir, target, { recursive: true })
      linkPrezDependency(target)
      updateManifest(target, positionalName || 'deck')
      if (!noSkills) {
        try {
          installSkills()
        } catch (err) {
          rmSync(target, { recursive: true, force: true })
          const msg = err instanceof Error ? err.message : String(err)
          die(
            `${msg}\n\nRe-run 'prez init' after fixing, or pass --no-skills to scaffold without skills.`,
          )
        }
      }

      console.log(`Created presentation at ${target}`)
      if (!noSkills) {
        console.log('Installed Claude skills via skills CLI')
      }
      console.log(`\nNext steps:`)
      console.log(`  cd ${positionalName || 'deck'}`)
      console.log('  bun install')
      console.log('  bun run dev')
    } else {
      // Interactive wizard
      p.intro('prez — Create a new presentation')

      // If --no-skills is on argv, pre-answer the confirm prompt so the
      // interactive path doesn't ask about something the user already
      // opted out of.
      const skillsPreAnswer = noSkills ? false : undefined

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
            skillsPreAnswer === false
              ? Promise.resolve(false)
              : p.confirm({
                  message:
                    'Install Claude Code skills via the skills CLI? (symlinks prez + prez-image + prez-validate to ./.claude/skills/)',
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
        try {
          installSkills()
        } catch (err) {
          s.stop('Skills install failed')
          rmSync(target, { recursive: true, force: true })
          const msg = err instanceof Error ? err.message : String(err)
          p.cancel(
            `${msg}\n\nRe-run 'prez init' after fixing, or pass --no-skills to scaffold without skills.`,
          )
          process.exit(1)
        }
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
    // No subcommand: print help and exit.
    // handleGlobalFlags above already handles --help / -h / --version / -V.
    // This branch covers bare `prez` with no args or unrecognized subcommand.
    const { printHelp } = await import('./_cli-kit.js')
    printHelp(INIT_HELP_SPEC)
  }
}

main()
