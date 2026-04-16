import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'

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

/**
 * Canonical containment check. A path is "inside" `dir` iff
 * `path.relative(dir, p)` neither begins with `..` nor is absolute.
 *
 * Prefix matching (`p.startsWith(dir)`) is unsound: given `dir=/tmp/dist`,
 * it falsely accepts `/tmp/dist-evil/foo` because string prefixes do not
 * respect path separators. The `relative()`-based form is robust against
 * that sibling-prefix attack and against platform-dependent separators.
 *
 * Symlinks that escape `dir` are caught by a separate realpath check at
 * serve time — see the request handler below.
 */
export function isInsideDir(dir: string, candidate: string): boolean {
  const rel = relative(dir, candidate)
  if (rel === '') return true
  if (rel.startsWith('..')) return false
  if (isAbsolute(rel)) return false
  return true
}

export function startStaticServer(
  distDir: string,
  basePath: string,
): Promise<{ server: Server; url: string }> {
  // Canonicalize once so the containment check compares realpath-to-realpath.
  // If distDir itself is a symlink, we must resolve it before comparing.
  const canonicalDistDir = existsSync(distDir)
    ? realpathSync(resolve(distDir))
    : resolve(distDir)
  return new Promise((res) => {
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`

    const server = createServer((req, reply) => {
      let pathname: string
      try {
        pathname = decodeURIComponent(req.url?.split('?')[0] || '/')
      } catch {
        // Malformed percent-encoding (e.g. a lone '%') cannot be a valid path.
        reply.writeHead(400)
        reply.end()
        return
      }

      if (base !== '/' && pathname.startsWith(base)) {
        pathname = pathname.slice(base.length - 1) || '/'
      }

      const filePath = resolve(
        canonicalDistDir,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      )

      if (!isInsideDir(canonicalDistDir, filePath)) {
        reply.writeHead(403)
        reply.end()
        return
      }

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        // Resolve symlinks and re-check containment. A symlink inside dist
        // that points outside dist must never leak its target.
        let realPath: string
        try {
          realPath = realpathSync(filePath)
        } catch {
          reply.writeHead(404)
          reply.end()
          return
        }
        if (!isInsideDir(canonicalDistDir, realPath)) {
          reply.writeHead(403)
          reply.end()
          return
        }
        const ext = extname(filePath).toLowerCase()
        reply.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        })
        reply.end(readFileSync(realPath))
      } else {
        const indexPath = join(canonicalDistDir, 'index.html')
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
