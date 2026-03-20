import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'

const USAGE = `prez image - Generate, search, and create images for presentations

Usage:
  prez image gen <prompt> -o <output>          Generate an image with AI (Pollinations.ai, free)
  prez image search <query> -o <output>        Search royalty-free photos (Unsplash/Pexels)
  prez image render <file.svg> -o <output>     Render SVG to PNG

Options:
  -o, --output <path>    Output file path (required)
  -w, --width <px>       Width in pixels (default: 1280)
  -h, --height <px>      Height in pixels (default: 720)
  --provider <name>      For search: "unsplash" or "pexels" (default: tries both)
  --model <name>         For gen: Pollinations model (default: "flux")
  --seed <n>             For gen: seed for reproducible results

Environment variables:
  POLLINATIONS_API_KEY   Optional, for higher rate limits on image generation
  UNSPLASH_ACCESS_KEY    Required for image search via Unsplash
  PEXELS_API_KEY         Required for image search via Pexels
`

interface Args {
  command: string
  input: string
  output: string
  width: number
  height: number
  provider?: string
  model: string
  seed?: number
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)
  const command = args[0]
  const input = args[1]

  let output = ''
  let width = 1280
  let height = 720
  let provider: string | undefined
  let model = 'flux'
  let seed: number | undefined

  for (let i = 2; i < args.length; i++) {
    switch (args[i]) {
      case '-o':
      case '--output':
        output = args[++i]
        break
      case '-w':
      case '--width':
        width = parseInt(args[++i], 10)
        break
      case '-h':
      case '--height':
        height = parseInt(args[++i], 10)
        break
      case '--provider':
        provider = args[++i]
        break
      case '--model':
        model = args[++i]
        break
      case '--seed':
        seed = parseInt(args[++i], 10)
        break
    }
  }

  return { command, input, output, width, height, provider, model, seed }
}

async function generate(args: Args) {
  if (!args.input) {
    console.error(
      'Error: prompt is required. Usage: prez image gen "your prompt" -o output.png',
    )
    process.exit(1)
  }
  if (!args.output) {
    console.error('Error: -o <output> is required')
    process.exit(1)
  }

  const prompt = encodeURIComponent(args.input)
  const params = new URLSearchParams({
    width: String(args.width),
    height: String(args.height),
    model: args.model,
    nologo: 'true',
  })
  if (args.seed !== undefined) params.set('seed', String(args.seed))

  const apiKey = process.env.POLLINATIONS_API_KEY
  if (apiKey) params.set('key', apiKey)

  const url = `https://gen.pollinations.ai/image/${prompt}?${params}`

  console.log(`Generating image: "${args.input}"`)
  console.log(`Model: ${args.model}, Size: ${args.width}x${args.height}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  let res: Response
  try {
    res = await fetch(url, { signal: controller.signal })
  } catch (err: unknown) {
    const e = err as Error
    if (e.name === 'AbortError') {
      console.error(
        'Error: generation timed out after 120s. Pollinations may be overloaded — try again.',
      )
    } else {
      console.error(`Error: ${e.message}`)
    }
    process.exit(1)
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    console.error(
      `Error: Pollinations returned ${res.status}. The service may be temporarily unavailable.`,
    )
    process.exit(1)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(resolve(args.output)), { recursive: true })
  writeFileSync(resolve(args.output), buffer)
  console.log(`Saved: ${args.output} (${buffer.length} bytes)`)
}

async function search(args: Args) {
  if (!args.input) {
    console.error(
      'Error: query is required. Usage: prez image search "your query" -o output.jpg',
    )
    process.exit(1)
  }
  if (!args.output) {
    console.error('Error: -o <output> is required')
    process.exit(1)
  }

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  const pexelsKey = process.env.PEXELS_API_KEY

  if (!unsplashKey && !pexelsKey) {
    console.error(
      'Error: Set UNSPLASH_ACCESS_KEY or PEXELS_API_KEY environment variable',
    )
    console.error('  Get a free Unsplash key: https://unsplash.com/developers')
    console.error('  Get a free Pexels key: https://www.pexels.com/api/')
    process.exit(1)
  }

  const providers = args.provider
    ? [args.provider]
    : ([unsplashKey ? 'unsplash' : null, pexelsKey ? 'pexels' : null].filter(
        Boolean,
      ) as string[])

  let imageUrl: string | null = null
  let photographer = ''

  for (const p of providers) {
    if (p === 'unsplash' && unsplashKey) {
      imageUrl = await searchUnsplash(args.input, unsplashKey)
      if (imageUrl) {
        console.log(`Found on Unsplash`)
        break
      }
    }
    if (p === 'pexels' && pexelsKey) {
      const result = await searchPexels(args.input, pexelsKey)
      if (result) {
        imageUrl = result.url
        photographer = result.photographer
        console.log(`Found on Pexels (photo by ${photographer})`)
        break
      }
    }
  }

  if (!imageUrl) {
    console.error(`No results found for "${args.input}"`)
    process.exit(1)
  }

  console.log(`Downloading...`)
  const res = await fetch(imageUrl)
  if (!res.ok) {
    console.error(`Error downloading image: ${res.status}`)
    process.exit(1)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(resolve(args.output)), { recursive: true })
  writeFileSync(resolve(args.output), buffer)
  console.log(`Saved: ${args.output} (${buffer.length} bytes)`)
}

async function searchUnsplash(
  query: string,
  key: string,
): Promise<string | null> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    results: { urls: { regular: string } }[]
  }
  if (!data.results?.length) return null
  return data.results[0].urls.regular
}

async function searchPexels(
  query: string,
  key: string,
): Promise<{ url: string; photographer: string } | null> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, {
    headers: { Authorization: key },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    photos: { src: { large: string }; photographer: string }[]
  }
  if (!data.photos?.length) return null
  return {
    url: data.photos[0].src.large,
    photographer: data.photos[0].photographer,
  }
}

async function render(args: Args) {
  if (!args.input) {
    console.error(
      'Error: SVG file is required. Usage: prez image render input.svg -o output.png',
    )
    process.exit(1)
  }
  if (!args.output) {
    console.error('Error: -o <output> is required')
    process.exit(1)
  }

  const ext = extname(args.input).toLowerCase()
  if (ext !== '.svg') {
    console.error('Error: input must be an .svg file')
    process.exit(1)
  }

  const { Resvg } = await import('@resvg/resvg-js')

  const svg = readFileSync(resolve(args.input), 'utf-8')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: args.width },
  })

  const rendered = resvg.render()
  const pngBuffer = rendered.asPng()

  mkdirSync(dirname(resolve(args.output)), { recursive: true })
  writeFileSync(resolve(args.output), pngBuffer)
  console.log(
    `Rendered: ${args.output} (${rendered.width}x${rendered.height}, ${pngBuffer.length} bytes)`,
  )
}

async function main() {
  const args = parseArgs(process.argv)

  switch (args.command) {
    case 'gen':
      await generate(args)
      break
    case 'search':
      await search(args)
      break
    case 'render':
      await render(args)
      break
    default:
      console.log(USAGE)
      break
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
