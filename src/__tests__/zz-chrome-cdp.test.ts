import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import {
  ChromeBrowser,
  ChromeCdpError,
  type ChromeSession,
} from '../scripts/chrome-cdp'

/**
 * The bun test preload registers happy-dom globals (`window`, `fetch`,
 * `WebSocket`) for the React component tests. Chrome-CDP runs in pure
 * Node space — we need the native `WebSocket`, not a happy-dom stub
 * that enforces browser Same-Origin Policy. Unregister in `beforeAll`
 * and re-register in `afterAll` so we don't break sibling test files
 * loaded in the same process after ours.
 */
let hadHappyDom = false

function detectChrome(): string | null {
  const envPath = process.env.CHROME_PATH
  if (envPath && existsSync(envPath)) return envPath
  const candidates = [
    '/run/current-system/sw/bin/google-chrome',
    '/run/current-system/sw/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const chromePath = detectChrome()
const SKIP = Boolean(process.env.SKIP_CHROME_TESTS) || chromePath === null

const testGroup = SKIP ? describe.skip : describe

testGroup('ChromeBrowser + ChromeSession (real Chrome)', () => {
  let dataDir: string

  beforeAll(async () => {
    hadHappyDom = GlobalRegistrator.isRegistered
    if (hadHappyDom) GlobalRegistrator.unregister()
    dataDir = await mkdtemp(join(tmpdir(), 'prez-cdp-test-'))
  })

  afterAll(async () => {
    await rm(dataDir, { recursive: true, force: true })
    if (hadHappyDom && !GlobalRegistrator.isRegistered) {
      GlobalRegistrator.register()
    }
  })

  it('launches Chrome, reports version metadata, and cleans up tmpdir on close', async () => {
    const browser = await ChromeBrowser.launch({ chromePath: chromePath ?? '' })
    expect(browser.version.browser).toMatch(
      /^(Chrome|Chromium|HeadlessChrome)\//,
    )
    expect(browser.version.protocolVersion).toMatch(/^\d+\.\d+$/)
    await browser.close()
    // Idempotence: calling close twice must not throw.
    await browser.close()
  })

  it('screenshots a data: URL with exact pixel dimensions', async () => {
    const browser = await ChromeBrowser.launch({ chromePath: chromePath ?? '' })
    try {
      const session: ChromeSession = await browser.newSession()
      const outPath = join(dataDir, 'one.png')
      const html =
        '<!doctype html><html><body style="margin:0;background:#0af"></body></html>'
      const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      await session.screenshot(url, outPath, {
        width: 400,
        height: 300,
      })
      const buf = readFileSync(outPath)
      // PNG header.
      expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      // IHDR chunk: bytes 16..19 = width (big-endian), 20..23 = height.
      expect(buf.readUInt32BE(16)).toBe(400)
      expect(buf.readUInt32BE(20)).toBe(300)
      await session.close()
      // Idempotent close on session.
      await session.close()
    } finally {
      await browser.close()
    }
  })

  it('runs two parallel sessions in one Chrome process', async () => {
    const browser = await ChromeBrowser.launch({ chromePath: chromePath ?? '' })
    try {
      const s1 = await browser.newSession()
      const s2 = await browser.newSession()
      const out1 = join(dataDir, 'p1.png')
      const out2 = join(dataDir, 'p2.png')
      const html1 = '<!doctype html><body style="background:red">A</body>'
      const html2 = '<!doctype html><body style="background:green">B</body>'
      const u1 = `data:text/html;charset=utf-8,${encodeURIComponent(html1)}`
      const u2 = `data:text/html;charset=utf-8,${encodeURIComponent(html2)}`
      await Promise.all([
        s1.screenshot(u1, out1, { width: 200, height: 150 }),
        s2.screenshot(u2, out2, { width: 200, height: 150 }),
      ])
      expect(readFileSync(out1).subarray(0, 8).toString('hex')).toBe(
        '89504e470d0a1a0a',
      )
      expect(readFileSync(out2).subarray(0, 8).toString('hex')).toBe(
        '89504e470d0a1a0a',
      )
    } finally {
      await browser.close()
    }
  })

  it('throws ChromeCdpError with loadEvent stage when navigation never completes before timeout', async () => {
    // Spin up a trivial local server whose response body streams
    // forever — never completes the load event — so the load-event
    // timeout reliably fires. Loopback + a real socket is orders of
    // magnitude more deterministic than trying to find an IP range
    // Chrome will drop silently across distros.
    const { createServer } = await import('node:http')
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.write('<!doctype html><html><body>')
      // Dribble bytes at an interval; never end the response.
      const tick = setInterval(() => {
        if (!res.writableEnded) res.write('.')
      }, 100)
      res.on('close', () => clearInterval(tick))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port =
      typeof addr === 'object' && addr ? (addr as { port: number }).port : 0

    const browser = await ChromeBrowser.launch({ chromePath: chromePath ?? '' })
    const start = Date.now()
    try {
      const s = await browser.newSession()
      const out = join(dataDir, 'never.png')
      let caught: unknown
      try {
        await s.screenshot(`http://127.0.0.1:${port}/`, out, {
          width: 200,
          height: 150,
          timeout: 800,
        })
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(ChromeCdpError)
      const e = caught as ChromeCdpError
      expect(['navigate', 'loadEvent']).toContain(e.stage)
      // Outer wall-clock: must finish promptly, not hang indefinitely.
      expect(Date.now() - start).toBeLessThan(5000)
    } finally {
      await browser.close()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('removes a browser-owned user data dir after close', async () => {
    const before = (await readdir(tmpdir()).catch(() => [] as string[])).filter(
      (n) => n.startsWith('prez-cdp-'),
    )
    const browser = await ChromeBrowser.launch({ chromePath: chromePath ?? '' })
    await browser.close()
    const after = (await readdir(tmpdir()).catch(() => [] as string[])).filter(
      (n) => n.startsWith('prez-cdp-'),
    )
    // At minimum, the dir we created is gone (could equal `before` if
    // another test's dir lingers — don't depend on exact count, just
    // confirm no net growth).
    expect(after.length).toBeLessThanOrEqual(before.length + 0)
  })
})
