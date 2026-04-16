import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize, resolve } from 'node:path'

export const MIME_TYPES: Record<string, string> = {
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

export function startStaticServer(
  distDir: string,
  basePath: string,
): Promise<{ server: Server; url: string }> {
  return new Promise((res) => {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`

    const server = createServer((req, reply) => {
      let pathname = decodeURIComponent(req.url?.split('?')[0] || '/')

      if (base !== '/' && pathname.startsWith(base)) {
        pathname = pathname.slice(base.length - 1) || '/'
      }

      const filePath = normalize(
        join(distDir, pathname === '/' ? 'index.html' : pathname),
      )

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

export async function waitForServer(url: string, maxMs = 10000): Promise<void> {
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

export function detectBasePath(): string {
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

export function detectPackageManager(): string {
  if (
    existsSync(resolve(process.cwd(), 'bun.lockb')) ||
    existsSync(resolve(process.cwd(), 'bun.lock'))
  )
    return 'bun'
  if (existsSync(resolve(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(process.cwd(), 'yarn.lock'))) return 'yarn'
  return 'npm'
}
