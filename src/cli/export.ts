import { existsSync, mkdirSync } from 'node:fs'
import type { Server } from 'node:http'
import { join, resolve } from 'node:path'
import {
  detectBasePath,
  detectPackageManager,
  startStaticServer,
  waitForServer,
} from '../scripts/serve-dist.js'
import { SLIDE_INDEX_DOCS } from '../slide-index.js'
import { die, type HelpSpec, handleGlobalFlags, warn } from './_cli-kit.js'

const HELP_SPEC: HelpSpec = {
  name: 'prez-export',
  summary: 'Export presentations to PDF and PPTX',
  usage: ['prez-export [pdf|pptx|both] [options]'],
  sections: [
    {
      title: 'Commands',
      rows: [
        ['pdf', 'Export only PDF'],
        ['pptx', 'Export only PPTX'],
        ['both', 'Export PDF and PPTX (default)'],
      ],
    },
    {
      title: 'Options',
      rows: [
        ['--url <url>', 'URL of running dev/preview server (skip auto-serve)'],
        ['-o, --output <dir>', 'Output directory (default: ./dist/)'],
        ['--build', 'Run build before exporting'],
        [
          '--base <path>',
          'Base URL path override (default: auto-detect from vite.config)',
        ],
        ['--timeout <ms>', 'Chrome timeout in ms (default: 30000)'],
        ['-h, --help', 'Show this help and exit'],
        ['-V, --version', 'Print version and exit'],
      ],
    },
    {
      title: 'Examples',
      rows: [
        ['prez-export', 'Export both PDF and PPTX to ./dist/'],
        ['prez-export pdf', 'Export only PDF'],
        ['prez-export pptx -o out/', 'Export PPTX to out/'],
        [
          'prez-export --url http://localhost:5173',
          'Export from running server',
        ],
        ['prez-export --build', 'Build first, then export'],
      ],
    },
  ],
  footer: SLIDE_INDEX_DOCS,
}

export interface ExportArgs {
  format: 'pdf' | 'pptx' | 'both'
  url?: string
  output: string
  outputExplicit: boolean
  build: boolean
  base?: string
  timeout: number
}

export const DEFAULT_OUTPUT_DIR = './dist'

/**
 * Pure argv parser. Exported for unit tests; `main()` is the only production
 * caller. Global flags (--help, --version, -h, -V) are acknowledged here
 * silently because `handleGlobalFlags` already processes them before this
 * function runs and would have exited the process; treating them as noop
 * keeps the parser total over any argv shape.
 */
export function parseExportArgs(argv: string[]): ExportArgs {
  const args = argv.slice(2)

  let format: 'pdf' | 'pptx' | 'both' = 'both'
  let url: string | undefined
  let output: string = DEFAULT_OUTPUT_DIR
  let outputExplicit = false
  let build = false
  let base: string | undefined
  let timeout = 30000

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case 'pdf':
        format = 'pdf'
        break
      case 'pptx':
        format = 'pptx'
        break
      case 'both':
        format = 'both'
        break
      case '--url':
        url = args[++i]
        break
      case '-o':
      case '--output':
        output = args[++i]
        outputExplicit = true
        break
      case '--build':
        build = true
        break
      case '--base':
        base = args[++i]
        break
      case '--timeout': {
        const raw = args[++i]
        const parsed = Number.parseInt(raw, 10)
        if (Number.isNaN(parsed) || parsed <= 0) {
          die(`Error: --timeout requires a positive integer, got '${raw}'`)
        }
        timeout = parsed
        break
      }
      case '--help':
      case '-h':
      case '--version':
      case '-V':
        // Handled by handleGlobalFlags at main() entry.
        break
      default:
        die(`Error: unknown argument '${arg}' (see --help)`)
    }
  }

  return { format, url, output, outputExplicit, build, base, timeout }
}

/**
 * Emit a one-shot stderr notice when the user relies on the default --output
 * but their cwd layout matches the pre-v1.2 convention (./public/ exists,
 * ./dist/ does not). Visible to the agent before the run starts so the path
 * change is never silent.
 */
function maybeEmitLegacyPublicNotice(args: ExportArgs): void {
  if (args.outputExplicit) return
  const cwd = process.cwd()
  const publicExists = existsSync(resolve(cwd, 'public'))
  const distExists = existsSync(resolve(cwd, 'dist'))
  if (publicExists && !distExists) {
    warn(
      'Note: prez-export default output changed to ./dist/ in v1.2 (was ./public/). Pass --output ./public/ to restore the previous behavior.',
    )
  }
}

async function main() {
  handleGlobalFlags(process.argv, HELP_SPEC)

  const args = parseExportArgs(process.argv)
  maybeEmitLegacyPublicNotice(args)

  const distDir = resolve(process.cwd(), 'dist')

  if (args.build) {
    const pm = detectPackageManager()
    const buildCmd = pm === 'bun' ? 'bun run build' : `${pm} run build`
    console.log(`Building with: ${buildCmd}`)
    const { execSync } = await import('node:child_process')
    execSync(buildCmd, { stdio: 'inherit', cwd: process.cwd() })
  }

  let serverUrl = args.url
  let server: Server | null = null

  if (!serverUrl) {
    if (!existsSync(distDir)) {
      die(
        'Error: dist/ not found.\n  Run "bun run build" first, or pass --build to build automatically.',
      )
    }

    const basePath = args.base || detectBasePath()
    console.log(`Serving dist/ with base path: ${basePath}`)

    const result = await startStaticServer(distDir, basePath)
    server = result.server
    serverUrl = result.url

    console.log(`Static server running at ${serverUrl}`)
    await waitForServer(serverUrl)
  }

  const outputDir = resolve(process.cwd(), args.output)
  mkdirSync(outputDir, { recursive: true })

  const resolvedUrl = serverUrl as string

  try {
    const { exportPdf } = await import('../scripts/export-pdf.js')
    const { exportPptx } = await import('../scripts/export-pptx.js')

    if (args.format === 'pdf' || args.format === 'both') {
      const pdfOutput = join(outputDir, 'deck.pdf')
      await exportPdf(resolvedUrl, pdfOutput, distDir, args.timeout)
    }

    if (args.format === 'pptx' || args.format === 'both') {
      const pptxOutput = join(outputDir, 'deck.pptx')
      await exportPptx(resolvedUrl, pptxOutput, args.timeout)
    }

    console.log(`\nExport complete! Files saved to ${args.output}/`)
  } finally {
    if (server) {
      server.closeAllConnections()
      server.close()
    }
  }
}

main().catch((err) => {
  die(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
})
