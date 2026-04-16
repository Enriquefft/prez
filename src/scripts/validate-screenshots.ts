import { mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getSlideCount, screenshotSlide } from './screenshot-slide.js'

export interface ValidateOptions {
  url: string
  outputDir: string
  slide?: number
  timeout?: number
  clean?: boolean
}

export interface ValidateManifest {
  totalSlides: number
  slidesValidated: number[]
  screenshots: { slide: number; path: string }[]
  outputDir: string
}

function pad(n: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return String(n).padStart(width, '0')
}

export async function validateScreenshots(
  opts: ValidateOptions,
): Promise<ValidateManifest> {
  const timeout = opts.timeout ?? 30000
  const outputDir = resolve(opts.outputDir)

  if (opts.clean) {
    rmSync(outputDir, { recursive: true, force: true })
  }
  mkdirSync(outputDir, { recursive: true })

  const totalSlides = await getSlideCount(opts.url, timeout)

  let targets: number[]
  if (opts.slide !== undefined) {
    if (opts.slide < 1 || opts.slide > totalSlides) {
      throw new Error(`Slide ${opts.slide} out of range (1..${totalSlides})`)
    }
    targets = [opts.slide]
  } else {
    targets = Array.from({ length: totalSlides }, (_, i) => i + 1)
  }

  const screenshots: { slide: number; path: string }[] = []
  for (const oneBased of targets) {
    const filename = `slide-${pad(oneBased, totalSlides)}.png`
    const path = join(outputDir, filename)
    await screenshotSlide(opts.url, oneBased - 1, path, timeout)
    screenshots.push({ slide: oneBased, path })
  }

  return {
    totalSlides,
    slidesValidated: targets,
    screenshots,
    outputDir,
  }
}
