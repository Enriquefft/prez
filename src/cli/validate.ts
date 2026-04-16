import { existsSync } from 'node:fs'
import type { Server } from 'node:http'
import { relative, resolve } from 'node:path'
import {
  detectBasePath,
  detectPackageManager,
  startStaticServer,
  waitForServer,
} from '../scripts/serve-dist.js'
import { validateScreenshots } from '../scripts/validate-screenshots.js'

const USAGE = `prez-validate - Screenshot every slide for visual validation

Usage:
  prez-validate [options]

Options:
  --slide <n>          Validate only slide n (1-indexed)
  -o, --output <dir>   Output directory (default: ./screenshots/)
  --url <url>          URL of running dev/preview server (skip auto-serve)
  --build              Run build before validating
  --base <path>        Base URL path override
  --timeout <ms>       Chrome timeout (default: 30000)
  --clean              Remove output dir before writing
  --json               Emit machine-readable manifest to stdout

Examples:
  prez-validate                    Screenshot every slide to ./screenshots/
  prez-validate --slide 3          Screenshot only slide 3
  prez-validate --build            Build first, then validate
  prez-validate --json             Print manifest JSON for agent consumption
`

interface Args {
  slide?: number
  output: string
  url?: string
  build: boolean
  base?: string
  timeout: number
  clean: boolean
  json: boolean
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)

  let slide: number | undefined
  let output = './screenshots'
  let url: string | undefined
  let build = false
  let base: string | undefined
  let timeout = 30000
  let clean = false
  let json = false

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--slide':
        slide = Number.parseInt(args[++i], 10)
        if (Number.isNaN(slide) || slide < 1) {
          console.error(
            'Error: --slide requires a positive integer (1-indexed)',
          )
          process.exit(1)
        }
        break
      case '-o':
      case '--output':
        output = args[++i]
        break
      case '--url':
        url = args[++i]
        break
      case '--build':
        build = true
        break
      case '--base':
        base = args[++i]
        break
      case '--timeout':
        timeout = Number.parseInt(args[++i], 10)
        break
      case '--clean':
        clean = true
        break
      case '--json':
        json = true
        break
      case '--help':
      case '-h':
        console.log(USAGE)
        process.exit(0)
    }
  }

  return { slide, output, url, build, base, timeout, clean, json }
}

async function main() {
  const args = parseArgs(process.argv)
  const distDir = resolve(process.cwd(), 'dist')

  if (args.build) {
    const pm = detectPackageManager()
    const buildCmd = pm === 'bun' ? 'bun run build' : `${pm} run build`
    if (!args.json) console.log(`Building with: ${buildCmd}`)
    const { execSync } = await import('node:child_process')
    execSync(buildCmd, {
      stdio: args.json ? 'pipe' : 'inherit',
      cwd: process.cwd(),
    })
  }

  let serverUrl = args.url
  let server: Server | null = null

  if (!serverUrl) {
    if (!existsSync(distDir)) {
      console.error('Error: dist/ not found.')
      console.error(
        '  Run "bun run build" first, or pass --build to build automatically.',
      )
      process.exit(1)
    }

    const basePath = args.base || detectBasePath()
    if (!args.json) console.log(`Serving dist/ with base path: ${basePath}`)

    const result = await startStaticServer(distDir, basePath)
    server = result.server
    serverUrl = result.url

    if (!args.json) console.log(`Static server running at ${serverUrl}`)
    await waitForServer(serverUrl)
  }

  try {
    const manifest = await validateScreenshots({
      url: serverUrl as string,
      outputDir: resolve(process.cwd(), args.output),
      slide: args.slide,
      timeout: args.timeout,
      clean: args.clean,
    })

    if (args.json) {
      console.log(JSON.stringify(manifest, null, 2))
    } else {
      const label = args.slide
        ? `slide ${args.slide}`
        : `${manifest.totalSlides} slides`
      console.log(`\nValidated ${label}:`)
      for (const { path } of manifest.screenshots) {
        console.log(`  ${relative(process.cwd(), path)}`)
      }
      console.log(`\nDone. Read each PNG and report issues per slide.`)
    }
  } finally {
    if (server) {
      server.closeAllConnections()
      server.close()
    }
  }
}

main().catch((err) => {
  console.error(`Validate failed: ${err.message}`)
  process.exit(1)
})
