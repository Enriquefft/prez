import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import type { Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { screenshotSlide } from '../scripts/screenshot-slide'
import { startStaticServer } from '../scripts/serve-dist'

/**
 * Real-Chrome integration test for the `?screenshot=N` render branch.
 *
 * What this catches that unit tests can't:
 *   - The Deck actually mounts without a scaling container at exactly
 *     1280×720 when Chrome drives it.
 *   - Letterbox bars (top/bottom or left/right) from the legacy scaling
 *     container are absent.
 *
 * Heuristic: sample corners, midpoints of the edges, and the center of
 * each screenshot. On the legacy path, slides with full-bleed gradients
 * had at least one strip of uniform black bars from the scaling
 * container. The pattern we reject: edges uniformly black while the
 * center is non-black — that's letterbox, not a black slide.
 *
 * Slide 3 of the template has a pure-black background (`bg-black`).
 * That's a valid all-black result, distinguishable from letterbox only
 * by also being black in the center — which we accept.
 *
 * Gated by SKIP_CHROME_TESTS and by the absence of Chrome on the host.
 * Uses `zz-` prefix so it runs after unit tests (happy-dom globals that
 * would interfere with the native Node WebSocket are unregistered in
 * beforeAll and re-registered in afterAll, matching the pattern in
 * zz-chrome-cdp.test.ts).
 */

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
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const chromePath = detectChrome()
const templateDir = join(__dirname, '..', '..', 'template')
const SKIP =
  Boolean(process.env.SKIP_CHROME_TESTS) ||
  chromePath === null ||
  !existsSync(templateDir)

const testGroup = SKIP ? describe.skip : describe

let hadHappyDom = false

function decodePng(buf: Buffer): {
  width: number
  height: number
  bpp: number
  pixels: Buffer
} {
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : -1
  if (channels < 0) throw new Error(`unsupported color type ${colorType}`)
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)

  let off = 8
  const idat: Buffer[] = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len))
    if (type === 'IEND') break
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const inRow = raw.subarray(
      y * (stride + 1) + 1,
      y * (stride + 1) + 1 + stride,
    )
    const outRow = out.subarray(y * stride, (y + 1) * stride)
    const prevRow = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? outRow[x - bpp] : 0
      const b = prevRow ? prevRow[x] : 0
      const c = prevRow && x >= bpp ? prevRow[x - bpp] : 0
      let v: number
      switch (filter) {
        case 0:
          v = inRow[x]
          break
        case 1:
          v = (inRow[x] + a) & 0xff
          break
        case 2:
          v = (inRow[x] + b) & 0xff
          break
        case 3:
          v = (inRow[x] + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          v = (inRow[x] + paeth) & 0xff
          break
        }
        default:
          throw new Error(`unsupported filter ${filter}`)
      }
      outRow[x] = v
    }
  }
  return { width, height, bpp, pixels: out }
}

interface Pixel {
  r: number
  g: number
  b: number
}

function at(
  img: { width: number; bpp: number; pixels: Buffer },
  x: number,
  y: number,
): Pixel {
  const i = y * img.width * img.bpp + x * img.bpp
  return { r: img.pixels[i], g: img.pixels[i + 1], b: img.pixels[i + 2] }
}

function isBlack(p: Pixel, tol = 8): boolean {
  return p.r <= tol && p.g <= tol && p.b <= tol
}

testGroup('screenshotSlide pixel-perfect render (real Chrome)', () => {
  let tmpRoot: string
  let distDir: string
  let server: Server
  let serverUrl: string

  beforeAll(async () => {
    hadHappyDom = GlobalRegistrator.isRegistered
    if (hadHappyDom) GlobalRegistrator.unregister()

    // Build the template against the local @enriquefft/prez package. The
    // template already declares `file:..` in its own repo; here we copy it
    // to a tmpdir and install with bun so it links against src/ we just
    // modified, then run the template's `bun run build` to produce dist/.
    tmpRoot = await mkdtemp(join(tmpdir(), 'prez-ws-b-'))
    const sampleDir = join(tmpRoot, 'sample')
    // Use prez init CLI in --yes mode to scaffold identically to users.
    const cliPath = join(__dirname, '..', '..', 'dist', 'cli', 'init.js')
    if (!existsSync(cliPath)) {
      throw new Error(
        `Expected built CLI at ${cliPath}; run \`bun run build\` first.`,
      )
    }
    execSync(`node ${cliPath} init sample --yes --no-skills`, {
      cwd: tmpRoot,
      stdio: 'pipe',
    })
    execSync('bun install --silent', { cwd: sampleDir, stdio: 'pipe' })
    execSync('bun run build', { cwd: sampleDir, stdio: 'pipe' })
    distDir = join(sampleDir, 'dist')

    const started = await startStaticServer(distDir, '/')
    server = started.server
    serverUrl = started.url
  }, 180000)

  afterAll(async () => {
    if (server) {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    if (tmpRoot) await rm(tmpRoot, { recursive: true, force: true })
    if (hadHappyDom && !GlobalRegistrator.isRegistered) {
      GlobalRegistrator.register()
    }
  })

  it('captures all 4 template slides at 1280×720 with no letterbox bars', async () => {
    const shots: string[] = []
    for (let slide = 1; slide <= 4; slide++) {
      const out = join(tmpRoot, `slide-${slide}.png`)
      await screenshotSlide(serverUrl, slide, out, 30000)
      shots.push(out)
    }

    for (let i = 0; i < shots.length; i++) {
      const slideN = i + 1
      const buf = readFileSync(shots[i])
      // PNG header.
      expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      const img = decodePng(buf)
      expect(img.width).toBe(1280)
      expect(img.height).toBe(720)

      const tl = at(img, 0, 0)
      const tr = at(img, 1279, 0)
      const bl = at(img, 0, 719)
      const br = at(img, 1279, 719)
      const center = at(img, 640, 360)

      // Letterbox heuristic: all corners pure-black while center is
      // non-black. That pattern only arises from the legacy scaling
      // container. An all-black slide (template slide 3) has all
      // corners AND the center black — also accepted.
      const cornersBlack =
        isBlack(tl) && isBlack(tr) && isBlack(bl) && isBlack(br)
      if (cornersBlack && !isBlack(center)) {
        throw new Error(
          `Slide ${slideN}: letterbox detected. Corners uniformly black but center rgb(${center.r},${center.g},${center.b}) — this is the WS-B bug signature.`,
        )
      }

      // Additional guard: detect partial letterbox (top OR bottom bar)
      // by sampling the vertical midline at y=10 and y=710 and the
      // center. If top+bottom are black but the center is non-black,
      // that's a horizontal letterbox bar — also the legacy bug.
      const midTop = at(img, 640, 10)
      const midBot = at(img, 640, 710)
      if (isBlack(midTop) && isBlack(midBot) && !isBlack(center)) {
        throw new Error(
          `Slide ${slideN}: horizontal letterbox detected. y=10 and y=710 black, center rgb(${center.r},${center.g},${center.b}).`,
        )
      }
    }
  }, 240000)
})
