import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo, Server } from 'node:net'
import { extname, join, normalize, resolve } from 'node:path'

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

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

function startStaticServer(
  distDir: string,
  basePath: string,
): Promise<{ server: Server; url: string }> {
  return new Promise((res) => {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`

    const server = createServer((req, reply) => {
      let pathname = decodeURIComponent(req.url?.split('?')[0] || '/')

      // Strip base path
      if (base !== '/' && pathname.startsWith(base)) {
        pathname = pathname.slice(base.length - 1) || '/'
      }

      const filePath = normalize(
        join(distDir, pathname === '/' ? 'index.html' : pathname),
      )

      // Prevent directory traversal
      if (!filePath.startsWith(distDir)) {
        reply.writeHead(403)
        reply.end()
        return
      }

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath).toLowerCase()
        reply.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        })
        reply.end(readFileSync(filePath))
      } else {
        // SPA fallback
        const indexPath = join(distDir, 'index.html')
        if (existsSync(indexPath)) {
          reply.writeHead(200, { 'Content-Type': 'text/html' })
          reply.end(readFileSync(indexPath))
        } else {
          reply.writeHead(404)
          reply.end('Not found')
        }
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo
      const serverUrl = `http://127.0.0.1:${addr.port}${base}`
      res({ server, url: serverUrl })
    })
  })
}

async function waitForServer(url: string, maxMs = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Server at ${url} did not respond within ${maxMs}ms`)
}

function detectBasePath(): string {
  const configPaths = ['vite.config.ts', 'vite.config.js', 'vite.config.mts']
  for (const configPath of configPaths) {
    const fullPath = resolve(process.cwd(), configPath)
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8')
      const match = content.match(/base\s*:\s*['"]([^'"]+)['"]/)
      if (match) return match[1]
    }
  }
  return '/'
}

function detectPackageManager(): string {
  if (
    existsSync(resolve(process.cwd(), 'bun.lockb')) ||
    existsSync(resolve(process.cwd(), 'bun.lock'))
  )
    return 'bun'
  if (existsSync(resolve(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(process.cwd(), 'yarn.lock'))) return 'yarn'
  return 'npm'
}

async function main() {
  const args = parseArgs(process.argv)

  if (!args.format) {
    console.log(USAGE)
    return
  }

  const distDir = resolve(process.cwd(), 'dist')

  // Handle --build flag
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
    // Auto-serve mode
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

  // Ensure output directory exists
  const outputDir = resolve(process.cwd(), args.output)
  mkdirSync(outputDir, { recursive: true })

  const resolvedUrl = serverUrl as string

  try {
    const { exportPdf } = await import('../scripts/export-pdf.js')
    const { exportPptx } = await import('../scripts/export-pptx.js')

    if (args.format === 'pdf' || args.format === 'both') {
      const pdfOutput = join(outputDir, 'deck.pdf')
      exportPdf(resolvedUrl, pdfOutput, args.timeout)
    }

    if (args.format === 'pptx' || args.format === 'both') {
      const pptxOutput = join(outputDir, 'deck.pptx')
      await exportPptx(resolvedUrl, pptxOutput, args.timeout)
    }

    console.log(`\nExport complete! Files saved to ${args.output}/`)
  } finally {
    if (server) {
      server.close()
    }
  }
}

main().catch((err) => {
  console.error(`Export failed: ${err.message}`)
  process.exit(1)
})
