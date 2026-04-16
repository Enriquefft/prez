import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { request as httpRequest, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isInsideDir, startStaticServer } from '../scripts/serve-dist'

/**
 * Send a raw HTTP GET to `url` with `rawPath` appended verbatim to the
 * origin. Bypasses URL / fetch() normalization so that `../` and
 * `%2e%2e` actually reach the server. Returns the response body and
 * status code.
 */
function rawGet(
  url: string,
  rawPath: string,
): Promise<{ status: number; body: string }> {
  const parsed = new URL(url)
  const base = parsed.pathname.endsWith('/')
    ? parsed.pathname
    : `${parsed.pathname}/`
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 80,
        method: 'GET',
        path: `${base}${rawPath}`,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.from(c)))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf-8'),
          })
        })
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.end()
  })
}

interface TestFixture {
  distDir: string
  evilDir: string
  cleanup: () => void
}

function createFixture(): TestFixture {
  const rand = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const distDir = join(tmpdir(), `prez-test-dist-${rand}`)
  const evilDir = `${distDir}-evil`
  mkdirSync(distDir, { recursive: true })
  mkdirSync(evilDir, { recursive: true })
  writeFileSync(join(distDir, 'index.html'), 'OK')
  writeFileSync(join(evilDir, 'secret.txt'), 'LEAK')
  return {
    distDir,
    evilDir,
    cleanup: () => {
      rmSync(distDir, { recursive: true, force: true })
      rmSync(evilDir, { recursive: true, force: true })
    },
  }
}

let activeServers: Server[] = []
let activeCleanups: Array<() => void> = []

afterEach(() => {
  for (const s of activeServers) {
    try {
      s.closeAllConnections?.()
      s.close()
    } catch {
      // already closed
    }
  }
  activeServers = []
  for (const fn of activeCleanups) {
    try {
      fn()
    } catch {
      // best effort
    }
  }
  activeCleanups = []
})

async function bootServer(distDir: string): Promise<{ url: string }> {
  const { server, url } = await startStaticServer(distDir, '/')
  activeServers.push(server)
  return { url }
}

describe('isInsideDir', () => {
  it('accepts the directory itself', () => {
    expect(isInsideDir('/tmp/dist', '/tmp/dist')).toBe(true)
  })

  it('accepts descendants', () => {
    expect(isInsideDir('/tmp/dist', '/tmp/dist/a/b')).toBe(true)
  })

  it('rejects sibling-prefix attack (startsWith would pass)', () => {
    expect(isInsideDir('/tmp/dist', '/tmp/dist-evil/foo')).toBe(false)
  })

  it('rejects parent escape via ..', () => {
    expect(isInsideDir('/tmp/dist', '/tmp/secret')).toBe(false)
  })
})

describe('startStaticServer path traversal', () => {
  it('rejects the /tmp/dist-evil sibling-prefix attack', async () => {
    const fx = createFixture()
    activeCleanups.push(fx.cleanup)
    const { url } = await bootServer(fx.distDir)

    // Raw HTTP so '..' is not normalized client-side. After server-side
    // decode + resolve, the path lands in the evil sibling dir — the
    // server MUST NOT serve LEAK.
    const evilName = fx.evilDir.split('/').pop() as string
    const res = await rawGet(url, `../${evilName}/secret.txt`)

    // Either 403 or SPA-fallback to index.html — never the secret.
    expect(res.body).not.toBe('LEAK')
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body).toBe('OK')
    }
  })

  it('rejects the percent-encoded %2e%2e variant', async () => {
    const fx = createFixture()
    activeCleanups.push(fx.cleanup)
    const { url } = await bootServer(fx.distDir)

    const evilName = fx.evilDir.split('/').pop() as string
    const res = await rawGet(url, `%2e%2e/${evilName}/secret.txt`)

    expect(res.body).not.toBe('LEAK')
    expect([200, 403]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body).toBe('OK')
    }
  })

  it('rejects symlink escape (symlink inside dist to a file outside)', async () => {
    if (process.platform === 'win32') return
    const fx = createFixture()
    activeCleanups.push(fx.cleanup)

    const linkPath = join(fx.distDir, 'sneaky.txt')
    symlinkSync(join(fx.evilDir, 'secret.txt'), linkPath)

    const { url } = await bootServer(fx.distDir)
    const res = await rawGet(url, 'sneaky.txt')

    // Must never be the target content.
    expect(res.body).not.toBe('LEAK')
    expect([200, 403, 404]).toContain(res.status)
    if (res.status === 200) {
      // SPA fallback is the only 200 path we permit; it serves index.html.
      expect(res.body).toBe('OK')
    }
  })

  it('serves real files inside dist', async () => {
    const fx = createFixture()
    activeCleanups.push(fx.cleanup)
    writeFileSync(join(fx.distDir, 'inside.txt'), 'INSIDE')
    const { url } = await bootServer(fx.distDir)

    const res = await rawGet(url, 'inside.txt')
    expect(res.status).toBe(200)
    expect(res.body).toBe('INSIDE')
  })
})
