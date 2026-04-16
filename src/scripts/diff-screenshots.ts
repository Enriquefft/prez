/**
 * Pixel-perfect PNG diffing for visual regression.
 *
 * Pure function, zero I/O: decode two in-memory PNG buffers via `pngjs`,
 * compute per-pixel Euclidean RGB distance, return a heatmap buffer plus
 * scalar summary. All filesystem concerns live in the callers
 * (`validateScreenshots` writes `diff-NN.png` only when the ratio exceeds
 * the configured threshold).
 *
 * Classification rule: a pixel is "different" iff the Euclidean distance
 * between its RGB triplet and the baseline's exceeds `pixelThreshold`.
 * The 0–441.67 scale (= sqrt(3 * 255²)) is linear, so a threshold of 30
 * tolerates roughly 17 units of per-channel noise — enough to absorb
 * antialiasing jitter without masking intentional color changes.
 *
 * Heatmap encoding (output PNG, same dimensions as inputs):
 *   - matching pixels: the dimmed (0.5×) average of the two source RGBs
 *     so reviewers still see the slide layout;
 *   - differing pixels: solid red (255, 50, 50) composited at 200/255
 *     alpha over the dimmed source so the failure geography pops.
 * The heatmap is always RGBA (8-bit) regardless of the inputs' color
 * type; `pngjs` handles normalization on decode.
 */

import { PNG } from 'pngjs'

export interface DiffResult {
  width: number
  height: number
  diffRatio: number
  diffPng: Buffer
  differingPixels: number
  totalPixels: number
}

export interface DiffOptions {
  /**
   * Euclidean RGB distance above which a pixel is considered different.
   * Scale is 0–441.67 (= sqrt(3) × 255). Default 30 — see module docs.
   */
  pixelThreshold?: number
}

const DEFAULT_PIXEL_THRESHOLD = 30

/**
 * Compute a pixel-level diff between two PNG buffers.
 *
 * Throws `Error('Dimension mismatch: <wa>×<ha> vs <wb>×<hb>')` if the
 * decoded images disagree on width or height. Threshold tuning is the
 * caller's job (`ValidateOptions.diffThreshold` wires the UX end).
 */
export async function diffPng(
  a: Buffer,
  b: Buffer,
  opts?: DiffOptions,
): Promise<DiffResult> {
  const pixelThreshold = opts?.pixelThreshold ?? DEFAULT_PIXEL_THRESHOLD
  const aPng = PNG.sync.read(a)
  const bPng = PNG.sync.read(b)

  if (aPng.width !== bPng.width || aPng.height !== bPng.height) {
    throw new Error(
      `Dimension mismatch: ${aPng.width}×${aPng.height} vs ${bPng.width}×${bPng.height}`,
    )
  }

  const width = aPng.width
  const height = aPng.height
  const totalPixels = width * height

  const out = new PNG({ width, height })
  const aData = aPng.data
  const bData = bPng.data
  const outData = out.data

  let differingPixels = 0
  const overlayR = 255
  const overlayG = 50
  const overlayB = 50
  const overlayA = 200

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4

      const ar = aData[idx]
      const ag = aData[idx + 1]
      const ab = aData[idx + 2]
      const br = bData[idx]
      const bg = bData[idx + 1]
      const bb = bData[idx + 2]

      const dr = ar - br
      const dg = ag - bg
      const db = ab - bb
      const distance = Math.sqrt(dr * dr + dg * dg + db * db)

      // Dimmed average of the two sources; preserves layout readability.
      const avgR = Math.round(((ar + br) / 2) * 0.5)
      const avgG = Math.round(((ag + bg) / 2) * 0.5)
      const avgB = Math.round(((ab + bb) / 2) * 0.5)

      if (distance > pixelThreshold) {
        differingPixels++
        // Composite solid red over the dimmed base using overlayA/255.
        const alpha = overlayA / 255
        outData[idx] = Math.round(overlayR * alpha + avgR * (1 - alpha))
        outData[idx + 1] = Math.round(overlayG * alpha + avgG * (1 - alpha))
        outData[idx + 2] = Math.round(overlayB * alpha + avgB * (1 - alpha))
        outData[idx + 3] = 255
      } else {
        outData[idx] = avgR
        outData[idx + 1] = avgG
        outData[idx + 2] = avgB
        outData[idx + 3] = 255
      }
    }
  }

  const diffPngBuffer = PNG.sync.write(out)
  const diffRatio = totalPixels === 0 ? 0 : differingPixels / totalPixels

  return {
    width,
    height,
    diffRatio,
    diffPng: diffPngBuffer,
    differingPixels,
    totalPixels,
  }
}
