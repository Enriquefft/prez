import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'

const CONFIG_PATH = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'prez',
  'config.json',
)

interface Config {
  pollinations_api_key?: string
  unsplash_access_key?: string
  pexels_api_key?: string
}

function readConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig(config: Config) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true })
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

const USAGE = `prez-image - Generate, search, and create images for presentations

Usage:
  prez-image gen <prompt> -o <output>          Generate an image with AI (Pollinations.ai)
  prez-image search <query> -o <output>        Search royalty-free photos (Unsplash/Pexels)
  prez-image render <file.svg> -o <output>     Render SVG to PNG
  prez-image models                            List available AI models
  prez-image setup                             Configure API keys (interactive)
  prez-image setup --pollinations-key <key>    Configure keys non-interactively

Setup options:
  --pollinations-key <key>   Pollinations API key
  --unsplash-key <key>       Unsplash access key
  --pexels-key <key>         Pexels API key

Generation options:
  -o, --output <path>      Output file path (required)
  -w, --width <px>         Width in pixels (default: 1280)
  -h, --height <px>        Height in pixels (default: 720)
  --model <name>           Pollinations model (default: "flux", run "models" to list)
  --seed <n>               Seed for reproducible results
  --enhance                AI-rewrite prompt for better output (recommended)
  --negative-prompt <s>    Things to avoid (e.g. "blurry, text, watermark")
  --quality <level>        Quality: low, medium, high, hd (gptimage model only)
  --transparent            Transparent background (gptimage model only)

Search options:
  --provider <name>        "unsplash" or "pexels" (default: tries both)

Environment variables (override config):
  POLLINATIONS_API_KEY   Required for image generation via Pollinations.ai
  UNSPLASH_ACCESS_KEY    For image search via Unsplash
  PEXELS_API_KEY         For image search via Pexels

Config file: ~/.config/prez/config.json (set via prez-image setup)
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
  enhance: boolean
  negativePrompt?: string
  quality?: string
  transparent: boolean
  pollinationsKey?: string
  unsplashKey?: string
  pexelsKey?: string
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2)
  const command = args[0]
  const noPositionalInput = command === 'setup' || command === 'models'
  const input = noPositionalInput ? '' : args[1]

  let output = ''
  let width = 1280
  let height = 720
  let provider: string | undefined
  let model = 'flux'
  let seed: number | undefined
  let enhance = false
  let negativePrompt: string | undefined
  let quality: string | undefined
  let transparent = false
  let pollinationsKey: string | undefined
  let unsplashKey: string | undefined
  let pexelsKey: string | undefined

  for (let i = noPositionalInput ? 1 : 2; i < args.length; i++) {
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
      case '--enhance':
        enhance = true
        break
      case '--negative-prompt':
        negativePrompt = args[++i]
        break
      case '--quality':
        quality = args[++i]
        break
      case '--transparent':
        transparent = true
        break
      case '--pollinations-key':
        pollinationsKey = args[++i]
        break
      case '--unsplash-key':
        unsplashKey = args[++i]
        break
      case '--pexels-key':
        pexelsKey = args[++i]
        break
    }
  }

  return {
    command,
    input,
    output,
    width,
    height,
    provider,
    model,
    seed,
    enhance,
    negativePrompt,
    quality,
    transparent,
    pollinationsKey,
    unsplashKey,
    pexelsKey,
  }
}

async function fetchAvailableModels(): Promise<string[]> {
  try {
    const res = await fetch('https://gen.pollinations.ai/image/models')
    if (res.ok) {
      const data = (await res.json()) as unknown
      if (Array.isArray(data)) {
        return data
          .map((m: unknown) =>
            typeof m === 'string' ? m : (m as { name?: string }).name,
          )
          .filter((n): n is string => !!n)
      }
    }
  } catch {
    // Network error, skip
  }
  return []
}

async function models() {
  const list = await fetchAvailableModels()
  if (!list.length) {
    console.error('Error: could not fetch models from Pollinations API')
    process.exit(1)
  }
  console.log('Available image generation models:\n')
  for (const name of list) {
    console.log(`  ${name}`)
  }
  console.log(`\nTotal: ${list.length} models`)
  console.log(
    'Note: some models require a paid Pollinations plan. "flux" is free.',
  )
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

  const config = readConfig()
  const apiKey = process.env.POLLINATIONS_API_KEY || config.pollinations_api_key

  if (!apiKey) {
    console.error('Error: No Pollinations API key configured.')
    console.error('')
    console.error('  Run: prez-image setup')
    console.error('')
    console.error('  Or set environment variable:')
    console.error('    POLLINATIONS_API_KEY  https://pollinations.ai')
    process.exit(1)
  }

  // Validate model name
  const availableModels = await fetchAvailableModels()
  if (availableModels.length > 0 && !availableModels.includes(args.model)) {
    console.error(`Error: unknown model "${args.model}"`)
    console.error(`Available models: ${availableModels.join(', ')}`)
    process.exit(1)
  }

  // Validate quality value
  if (args.quality) {
    const validQualities = ['low', 'medium', 'high', 'hd']
    if (!validQualities.includes(args.quality)) {
      console.error(
        `Error: invalid quality "${args.quality}". Must be one of: ${validQualities.join(', ')}`,
      )
      process.exit(1)
    }
  }

  const prompt = encodeURIComponent(args.input)
  const params = new URLSearchParams({
    width: String(args.width),
    height: String(args.height),
    model: args.model,
    nologo: 'true',
    key: apiKey,
  })
  if (args.seed !== undefined) params.set('seed', String(args.seed))
  if (args.enhance) params.set('enhance', 'true')
  if (args.negativePrompt) params.set('negative_prompt', args.negativePrompt)
  if (args.quality) params.set('quality', args.quality)
  if (args.transparent) params.set('transparent', 'true')

  const url = `https://gen.pollinations.ai/image/${prompt}?${params}`

  console.log(`Generating image: "${args.input}"`)
  console.log(
    `Model: ${args.model}, Size: ${args.width}x${args.height}${args.enhance ? ', enhance: on' : ''}`,
  )

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
    switch (res.status) {
      case 401:
        console.error(
          'Error: invalid API key. Check your key with: prez-image setup',
        )
        break
      case 402:
        console.error(
          `Error: model "${args.model}" requires a paid Pollinations plan.`,
        )
        console.error(
          '  Use --model flux (free) or upgrade at https://pollinations.ai',
        )
        break
      case 429:
        console.error(
          'Error: rate limit exceeded. Wait a moment and try again.',
        )
        break
      case 500:
      case 520:
        console.error(
          `Error: server error (${res.status}). The model may be temporarily unavailable.`,
        )
        console.error('  Try again, or use a different model with --model')
        break
      default:
        console.error(`Error: Pollinations returned HTTP ${res.status}.`)
        break
    }
    process.exit(1)
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  mkdirSync(dirname(resolve(args.output)), { recursive: true })
  writeFileSync(resolve(args.output), buffer)
  console.log(`Saved: ${args.output} (${buffer.length} bytes)`)
}

async function validateAndSaveKeys(
  pollinationsKey: string | undefined,
  unsplashKey: string | undefined,
  pexelsKey: string | undefined,
) {
  if (!pollinationsKey && !unsplashKey && !pexelsKey) {
    console.error('No keys provided. Setup cancelled.')
    process.exit(1)
  }

  if (pollinationsKey) {
    const res = await fetch(
      'https://gen.pollinations.ai/image/test?width=64&height=64&model=flux&key=' +
        encodeURIComponent(pollinationsKey),
    )
    if (!res.ok) {
      console.error(
        `Pollinations key validation failed (HTTP ${res.status}). Check your key.`,
      )
      process.exit(1)
    }
    console.log('Pollinations key validated.')
  }

  if (unsplashKey) {
    const res = await fetch(
      'https://api.unsplash.com/search/photos?query=test&per_page=1',
      { headers: { Authorization: `Client-ID ${unsplashKey}` } },
    )
    if (!res.ok) {
      console.error(
        `Unsplash key validation failed (HTTP ${res.status}). Check your key.`,
      )
      process.exit(1)
    }
    console.log('Unsplash key validated.')
  }

  if (pexelsKey) {
    const res = await fetch(
      'https://api.pexels.com/v1/search?query=test&per_page=1',
      { headers: { Authorization: pexelsKey } },
    )
    if (!res.ok) {
      console.error(
        `Pexels key validation failed (HTTP ${res.status}). Check your key.`,
      )
      process.exit(1)
    }
    console.log('Pexels key validated.')
  }

  const newConfig: Config = { ...readConfig() }
  if (pollinationsKey) newConfig.pollinations_api_key = pollinationsKey
  if (unsplashKey) newConfig.unsplash_access_key = unsplashKey
  if (pexelsKey) newConfig.pexels_api_key = pexelsKey
  writeConfig(newConfig)

  console.log(`Saved to ${CONFIG_PATH}`)
}

async function setup(args: Args) {
  // Non-interactive mode: keys passed via flags
  if (args.pollinationsKey || args.unsplashKey || args.pexelsKey) {
    await validateAndSaveKeys(
      args.pollinationsKey,
      args.unsplashKey,
      args.pexelsKey,
    )
    return
  }

  // Interactive mode
  const { intro, text, outro, note, isCancel } = await import('@clack/prompts')

  intro('prez-image setup')

  const config = readConfig()

  note(
    'prez-image needs API keys for image generation and search.\n' +
      'All services offer free tiers. Press Enter to skip any.\n\n' +
      'Pollinations  https://pollinations.ai\n' +
      '  1. Sign up at https://auth.pollinations.ai\n' +
      '  2. Go to dashboard, create an API key\n\n' +
      'Unsplash      https://unsplash.com/developers\n' +
      '  1. Create an app (or log in)\n' +
      '  2. Copy your "Access Key"\n\n' +
      'Pexels        https://www.pexels.com/api/\n' +
      '  1. Sign up / log in\n' +
      '  2. Copy your "API Key"',
    'Get your API keys',
  )

  const pollinationsKey = await text({
    message: 'Pollinations API Key (for image generation)',
    placeholder: 'paste key or press Enter to skip',
    defaultValue: config.pollinations_api_key || '',
    initialValue: config.pollinations_api_key || '',
  })
  if (isCancel(pollinationsKey)) process.exit(0)

  const unsplashKey = await text({
    message: 'Unsplash Access Key (for image search)',
    placeholder: 'paste key or press Enter to skip',
    defaultValue: config.unsplash_access_key || '',
    initialValue: config.unsplash_access_key || '',
  })
  if (isCancel(unsplashKey)) process.exit(0)

  const pexelsKey = await text({
    message: 'Pexels API Key (for image search)',
    placeholder: 'paste key or press Enter to skip',
    defaultValue: config.pexels_api_key || '',
    initialValue: config.pexels_api_key || '',
  })
  if (isCancel(pexelsKey)) process.exit(0)

  await validateAndSaveKeys(
    pollinationsKey || undefined,
    unsplashKey || undefined,
    pexelsKey || undefined,
  )

  outro('Done!')
}

async function search(args: Args) {
  if (!args.input) {
    console.error(
      'Error: query is required. Usage: prez-image search "your query" -o output.jpg',
    )
    process.exit(1)
  }
  if (!args.output) {
    console.error('Error: -o <output> is required')
    process.exit(1)
  }

  const config = readConfig()
  const unsplashKey =
    process.env.UNSPLASH_ACCESS_KEY || config.unsplash_access_key
  const pexelsKey = process.env.PEXELS_API_KEY || config.pexels_api_key

  if (!unsplashKey && !pexelsKey) {
    console.error('Error: No image search API keys configured.')
    console.error('')
    console.error('  Run: prez-image setup')
    console.error('')
    console.error('  Or set environment variables:')
    console.error('    UNSPLASH_ACCESS_KEY  https://unsplash.com/developers')
    console.error('    PEXELS_API_KEY       https://www.pexels.com/api/')
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
    case 'models':
      await models()
      break
    case 'setup':
      await setup(args)
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
