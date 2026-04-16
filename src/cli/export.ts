import { existsSync, mkdirSync } from 'node:fs'
import type { Server } from 'node:http'
import { join, resolve } from 'node:path'
import {
  detectBasePath,
  detectPackageManager,
  startStaticServer,
  waitForServer,
} from '../scripts/serve-dist.js'

const USAGE = `prez-export - Export presentations to PDF and PPTX

Usage:
  prez-export [pdf|pptx]           Export PDF, PPTX, or both (default: both)

Options:
  --url <url>                      URL of running dev/preview server (skip auto-serve)
  -o, --output <dir>               Output directory (default: ./public/)
  --build                          Run build before exporting
  --base <path>                    Base URL path override (default: auto-detect from vite.config)
  --timeout <ms>                   Chrome timeout in ms (default: 30000)

Examples:
  prez-export                      Export both PDF and PPTX to ./public/
  prez-export pdf                  Export only PDF
  prez-export pptx -o dist/        Export PPTX to dist/
  prez-export --url http://localhost:5173   Export from running server
  prez-export --build              Build first, then export
`

interface Args {
  format: 'pdf' | 'pptx' | 'both'
  url?: string
  output: string
  build: boolean
  base?: string
  timeout: number
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)

  let format: 'pdf' | 'pptx' | 'both' = 'both'
  let url: string | undefined
  let output = './public'
  let build = false
  let base: string | undefined
  let timeout = 30000

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case 'pdf':
        format = 'pdf'
        break
      case 'pptx':
        format = 'pptx'
        break
      case '--url':
        url = args[++i]
        break
      case '-o':
      case '--output':
        output = args[++i]
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
      case '--help':
      case '-h':
        console.log(USAGE)
        process.exit(0)
    }
  }

  return { format, url, output, build, base, timeout }
}

async function main() {
  const args = parseArgs(process.argv)

  if (!args.format) {
    console.log(USAGE)
    return
  }

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
      console.error('Error: dist/ not found.')
      console.error(
        '  Run "bun run build" first, or pass --build to build automatically.',
      )
      process.exit(1)
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
  console.error(`Export failed: ${err.message}`)
  process.exit(1)
})
