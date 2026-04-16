import { describe, expect, it } from 'bun:test'
import { PNG } from 'pngjs'
import { diffPng } from '../scripts/diff-screenshots'

function makeSolid(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): Buffer {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  return PNG.sync.write(png)
}

function decodePng(buf: Buffer): PNG {
  return PNG.sync.read(buf)
}

describe('diffPng', () => {
  it('reports zero diff for identical buffers', async () => {
    const a = makeSolid(32, 32, 12, 34, 56)
    const b = makeSolid(32, 32, 12, 34, 56)
    const result = await diffPng(a, b)
    expect(result.differingPixels).toBe(0)
    expect(result.diffRatio).toBe(0)
    expect(result.width).toBe(32)
    expect(result.height).toBe(32)
    expect(result.totalPixels).toBe(32 * 32)

    // Heatmap contains no red-dominant pixels (matching pixels are
    // dimmed to 0.5× average; 12/2*0.5=3, 34/2*0.5≈9, 56/2*0.5=14 — all
    // nowhere near the overlay red 255).
    const decoded = decodePng(result.diffPng)
    let redDominant = 0
    for (let i = 0; i < decoded.data.length; i += 4) {
      const r = decoded.data[i]
      const g = decoded.data[i + 1]
      const b = decoded.data[i + 2]
      if (r > 200 && g < 80 && b < 80) redDominant++
    }
    expect(redDominant).toBe(0)
  })

  it('reports 100% diff for all-white vs all-black of same size', async () => {
    const size = 16
    const a = makeSolid(size, size, 255, 255, 255)
    const b = makeSolid(size, size, 0, 0, 0)
    const result = await diffPng(a, b)
    expect(result.differingPixels).toBe(size * size)
    expect(result.diffRatio).toBe(1)

    // Every pixel should be red-dominant (the overlay won).
    const decoded = decodePng(result.diffPng)
    let redDominant = 0
    for (let i = 0; i < decoded.data.length; i += 4) {
      const r = decoded.data[i]
      const g = decoded.data[i + 1]
      const b = decoded.data[i + 2]
      if (r > 200 && g < 120 && b < 120) redDominant++
    }
    expect(redDominant).toBe(size * size)
  })

  it('reports 1/10000 diff when a single pixel differs in a 100x100 image', async () => {
    const width = 100
    const height = 100
    const aPng = new PNG({ width, height })
    const bPng = new PNG({ width, height })
    for (let i = 0; i < aPng.data.length; i += 4) {
      aPng.data[i] = 50
      aPng.data[i + 1] = 50
      aPng.data[i + 2] = 50
      aPng.data[i + 3] = 255
      bPng.data[i] = 50
      bPng.data[i + 1] = 50
      bPng.data[i + 2] = 50
      bPng.data[i + 3] = 255
    }
    // Flip the (50,50) pixel in b to pure white.
    const flipIdx = (50 * width + 50) * 4
    bPng.data[flipIdx] = 255
    bPng.data[flipIdx + 1] = 255
    bPng.data[flipIdx + 2] = 255
    bPng.data[flipIdx + 3] = 255

    const result = await diffPng(PNG.sync.write(aPng), PNG.sync.write(bPng))
    expect(result.differingPixels).toBe(1)
    expect(result.diffRatio).toBeCloseTo(1 / 10000, 10)
    expect(result.totalPixels).toBe(10000)
  })

  it('throws on dimension mismatch', async () => {
    const a = makeSolid(10, 10, 0, 0, 0)
    const b = makeSolid(12, 10, 0, 0, 0)
    await expect(diffPng(a, b)).rejects.toThrow(/Dimension mismatch/)
  })

  it('produces a valid decodable PNG heatmap with matching dimensions', async () => {
    const a = makeSolid(40, 20, 100, 100, 100)
    const b = makeSolid(40, 20, 200, 200, 200)
    const result = await diffPng(a, b)
    const decoded = decodePng(result.diffPng)
    expect(decoded.width).toBe(40)
    expect(decoded.height).toBe(20)
    // RGBA means 40 * 20 * 4 bytes of pixel data.
    expect(decoded.data.length).toBe(40 * 20 * 4)
  })

  it('respects custom pixelThreshold to ignore noise', async () => {
    // Distance between (100,100,100) and (110,100,100) is 10 — below
    // the default 30, so no pixels should count as different.
    const a = makeSolid(8, 8, 100, 100, 100)
    const b = makeSolid(8, 8, 110, 100, 100)
    const result = await diffPng(a, b)
    expect(result.differingPixels).toBe(0)

    // With a stricter threshold (5), every pixel should count.
    const strict = await diffPng(a, b, { pixelThreshold: 5 })
    expect(strict.differingPixels).toBe(8 * 8)
  })
})
