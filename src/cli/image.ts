import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve } from 'node:path'
import { SLIDE_INDEX_DOCS } from '../slide-index.js'
import { die, type HelpSpec, handleGlobalFlags, printHelp } from './_cli-kit.js'

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

const IMAGE_HELP_SPEC: HelpSpec = {
  name: 'prez-image',
  summary: 'Generate, search, and create images for presentations',
  usage: [
    'prez-image gen <prompt> -o <output>',
    'prez-image search <query> -o <output>',
    'prez-image render <file.svg> -o <output>',
    'prez-image models',
    'prez-image setup [--pollinations-key <key>] [--unsplash-key <key>] [--pexels-key <key>]',
  ],
  sections: [
    {
      title: 'Commands',
      rows: [
        ['gen <prompt>', 'Generate an image with AI (Pollinations.ai)'],
        ['search <query>', 'Search royalty-free photos (Unsplash/Pexels)'],
        ['render <file.svg>', 'Render SVG to PNG'],
        ['models', 'List available AI models'],
        ['setup', 'Configure API keys (interactive or via flags)'],
      ],
    },
    {
      title: 'Setup options',
      rows: [
        ['--pollinations-key <key>', 'Pollinations API key'],
        ['--unsplash-key <key>', 'Unsplash access key'],
        ['--pexels-key <key>', 'Pexels API key'],
      ],
    },
    {
      title: 'Generation options',
      rows: [
        ['-o, --output <path>', 'Output file path (required)'],
        ['-w, --width <px>', 'Width in pixels (default: 1280)'],
        ['--height <px>', 'Height in pixels (default: 720)'],
        ['--model <name>', 'Pollinations model (default: "flux")'],
        ['--seed <n>', 'Seed for reproducible results'],
        ['--enhance', 'AI-rewrite prompt for better output'],
        ['--negative-prompt <s>', 'Things to avoid (e.g. "blurry, text")'],
        ['--quality <level>', 'low | medium | high | hd (gptimage only)'],
        ['--transparent', 'Transparent background (gptimage only)'],
      ],
    },
    {
      title: 'Search options',
      rows: [
        ['--provider <name>', '"unsplash" or "pexels" (default: tries both)'],
      ],
    },
    {
      title: 'Global options',
      rows: [
        ['-h, --help', 'Show this help and exit'],
        ['-V, --version', 'Print version and exit'],
      ],
    },
    {
      title: 'Environment variables (override config)',
      rows: [
        ['POLLINATIONS_API_KEY', 'Required for image generation'],
        ['UNSPLASH_ACCESS_KEY', 'For image search via Unsplash'],
        ['PEXELS_API_KEY', 'For image search via Pexels'],
      ],
    },
  ],
  footer: `Config file: ~/.config/prez/config.json (set via prez-image setup)\n\n${SLIDE_INDEX_DOCS}`,
}

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

/**
 * Detect the legacy `-h <number>` shape (pre-v1.2 meant `--height <n>`).
 * In v1.2 `-h` is reserved for `--help`, consistent with every other prez
 * CLI. A bare `-h 720` now means "help" under handleGlobalFlags, which
 * would silently discard the user's intended height — so we error before
 * that happens with a pointer to `--height`.
 */
function assertNoLegacyHeightAlias(argv: string[]): void {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '-h') continue
    const next = argv[i + 1]
    if (next === undefined) continue
    // Tolerate the rare `-h` followed by a non-numeric value (treat as help
    // upstream via handleGlobalFlags). Only the numeric shape is unambiguous
    // evidence of the legacy height-alias usage.
    if (/^-?\d+$/.test(next)) {
      die('-h is reserved for --help. Use --height.', 2)
    }
  }
}

export function parseArgs(argv: string[]): Args {
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
    die('Error: could not fetch models from Pollinations API')
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
    die(
      'Error: prompt is required. Usage: prez-image gen "your prompt" -o output.png',
    )
  }
  if (!args.output) {
    die('Error: -o <output> is required')
  }

  const config = readConfig()
  const apiKey = process.env.POLLINATIONS_API_KEY || config.pollinations_api_key

  if (!apiKey) {
    die(
      [
        'Error: No Pollinations API key configured.',
        '',
        '  Run: prez-image setup',
        '',
        '  Or set environment variable:',
        '    POLLINATIONS_API_KEY  https://pollinations.ai',
      ].join('\n'),
    )
  }

  // Validate model name
  const availableModels = await fetchAvailableModels()
  if (availableModels.length > 0 && !availableModels.includes(args.model)) {
    die(
      `Error: unknown model "${args.model}"\nAvailable models: ${availableModels.join(', ')}`,
    )
  }

  // Validate quality value
  if (args.quality) {
    const validQualities = ['low', 'medium', 'high', 'hd']
    if (!validQualities.includes(args.quality)) {
      die(
        `Error: invalid quality "${args.quality}". Must be one of: ${validQualities.join(', ')}`,
      )
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
      die(
        'Error: generation timed out after 120s. Pollinations may be overloaded — try again.',
      )
    }
    die(`Error: ${e.message}`)
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    switch (res.status) {
      case 401:
        die('Error: invalid API key. Check your key with: prez-image setup')
        break
      case 402:
        die(
          `Error: model "${args.model}" requires a paid Pollinations plan.\n  Use --model flux (free) or upgrade at https://pollinations.ai`,
        )
        break
      case 429:
        die('Error: rate limit exceeded. Wait a moment and try again.')
        break
      case 500:
      case 520:
        die(
          `Error: server error (${res.status}). The model may be temporarily unavailable.\n  Try again, or use a different model with --model`,
        )
        break
      default:
        die(`Error: Pollinations returned HTTP ${res.status}.`)
        break
    }
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
    die('No keys provided. Setup cancelled.')
  }

  if (pollinationsKey) {
    const res = await fetch(
      'https://gen.pollinations.ai/image/test?width=64&height=64&model=flux&key=' +
        encodeURIComponent(pollinationsKey),
    )
    if (!res.ok) {
      die(
        `Pollinations key validation failed (HTTP ${res.status}). Check your key.`,
      )
    }
    console.log('Pollinations key validated.')
  }

  if (unsplashKey) {
    const res = await fetch(
      'https://api.unsplash.com/search/photos?query=test&per_page=1',
      { headers: { Authorization: `Client-ID ${unsplashKey}` } },
    )
    if (!res.ok) {
      die(
        `Unsplash key validation failed (HTTP ${res.status}). Check your key.`,
      )
    }
    console.log('Unsplash key validated.')
  }

  if (pexelsKey) {
    const res = await fetch(
      'https://api.pexels.com/v1/search?query=test&per_page=1',
      { headers: { Authorization: pexelsKey } },
    )
    if (!res.ok) {
      die(`Pexels key validation failed (HTTP ${res.status}). Check your key.`)
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
    die(
      'Error: query is required. Usage: prez-image search "your query" -o output.jpg',
    )
  }
  if (!args.output) {
    die('Error: -o <output> is required')
  }

  const config = readConfig()
  const unsplashKey =
    process.env.UNSPLASH_ACCESS_KEY || config.unsplash_access_key
  const pexelsKey = process.env.PEXELS_API_KEY || config.pexels_api_key

  if (!unsplashKey && !pexelsKey) {
    die(
      [
        'Error: No image search API keys configured.',
        '',
        '  Run: prez-image setup',
        '',
        '  Or set environment variables:',
        '    UNSPLASH_ACCESS_KEY  https://unsplash.com/developers',
        '    PEXELS_API_KEY       https://www.pexels.com/api/',
      ].join('\n'),
    )
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
    die(`No results found for "${args.input}"`)
  }

  console.log(`Downloading...`)
  const res = await fetch(imageUrl)
  if (!res.ok) {
    die(`Error downloading image: ${res.status}`)
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
    die(
      'Error: SVG file is required. Usage: prez-image render input.svg -o output.png',
    )
  }
  if (!args.output) {
    die('Error: -o <output> is required')
  }

  const ext = extname(args.input).toLowerCase()
  if (ext !== '.svg') {
    die('Error: input must be an .svg file')
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
  // Detect the legacy `-h <number>` shape BEFORE handleGlobalFlags so we can
  // give a pointed error. After this, `-h` unambiguously means --help.
  assertNoLegacyHeightAlias(process.argv)
  handleGlobalFlags(process.argv, IMAGE_HELP_SPEC)

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
      printHelp(IMAGE_HELP_SPEC)
      break
  }
}

main().catch((err) => {
  die(`Error: ${err.message}`)
})
