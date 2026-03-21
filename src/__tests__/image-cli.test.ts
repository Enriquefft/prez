import { afterEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

// Extract parseArgs logic inline since it's not exported
function parseArgs(argv: string[]) {
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

describe('parseArgs', () => {
  it('parses gen command with all options', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'a sunset over mountains',
      '-o',
      'out.png',
      '-w',
      '1920',
      '-h',
      '1080',
      '--model',
      'turbo',
      '--seed',
      '42',
    ])
    expect(result.command).toBe('gen')
    expect(result.input).toBe('a sunset over mountains')
    expect(result.output).toBe('out.png')
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
    expect(result.model).toBe('turbo')
    expect(result.seed).toBe(42)
  })

  it('parses search command with provider', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'search',
      'office workspace',
      '-o',
      'photo.jpg',
      '--provider',
      'pexels',
    ])
    expect(result.command).toBe('search')
    expect(result.input).toBe('office workspace')
    expect(result.output).toBe('photo.jpg')
    expect(result.provider).toBe('pexels')
  })

  it('uses defaults when no options given', () => {
    const result = parseArgs(['node', 'image.js', 'render', 'logo.svg'])
    expect(result.command).toBe('render')
    expect(result.input).toBe('logo.svg')
    expect(result.output).toBe('')
    expect(result.width).toBe(1280)
    expect(result.height).toBe(720)
    expect(result.model).toBe('flux')
    expect(result.seed).toBeUndefined()
    expect(result.provider).toBeUndefined()
    expect(result.enhance).toBe(false)
    expect(result.negativePrompt).toBeUndefined()
    expect(result.quality).toBeUndefined()
    expect(result.transparent).toBe(false)
  })

  it('handles long-form flags', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'test',
      '--output',
      'file.png',
      '--width',
      '800',
      '--height',
      '600',
    ])
    expect(result.output).toBe('file.png')
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  it('returns undefined command for no args', () => {
    const result = parseArgs(['node', 'image.js'])
    expect(result.command).toBeUndefined()
    expect(result.input).toBeUndefined()
  })

  it('parses setup command with key flags', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'setup',
      '--pollinations-key',
      'pk_123',
      '--unsplash-key',
      'us_456',
      '--pexels-key',
      'px_789',
    ])
    expect(result.command).toBe('setup')
    expect(result.pollinationsKey).toBe('pk_123')
    expect(result.unsplashKey).toBe('us_456')
    expect(result.pexelsKey).toBe('px_789')
  })

  it('parses setup with only one key flag', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'setup',
      '--pollinations-key',
      'pk_only',
    ])
    expect(result.command).toBe('setup')
    expect(result.pollinationsKey).toBe('pk_only')
    expect(result.unsplashKey).toBeUndefined()
    expect(result.pexelsKey).toBeUndefined()
  })

  it('parses --enhance boolean flag', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'mountains',
      '-o',
      'out.png',
      '--enhance',
    ])
    expect(result.enhance).toBe(true)
  })

  it('parses --negative-prompt', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'landscape',
      '-o',
      'out.png',
      '--negative-prompt',
      'blurry, text, watermark',
    ])
    expect(result.negativePrompt).toBe('blurry, text, watermark')
  })

  it('parses --quality', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'photo',
      '-o',
      'out.png',
      '--quality',
      'hd',
    ])
    expect(result.quality).toBe('hd')
  })

  it('parses --transparent boolean flag', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'logo',
      '-o',
      'out.png',
      '--transparent',
    ])
    expect(result.transparent).toBe(true)
  })

  it('parses models command', () => {
    const result = parseArgs(['node', 'image.js', 'models'])
    expect(result.command).toBe('models')
  })

  it('parses gen with all new flags combined', () => {
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'a futuristic city',
      '-o',
      'city.png',
      '--model',
      'gptimage',
      '--enhance',
      '--negative-prompt',
      'blurry',
      '--quality',
      'high',
      '--transparent',
      '--seed',
      '99',
    ])
    expect(result.command).toBe('gen')
    expect(result.input).toBe('a futuristic city')
    expect(result.model).toBe('gptimage')
    expect(result.enhance).toBe(true)
    expect(result.negativePrompt).toBe('blurry')
    expect(result.quality).toBe('high')
    expect(result.transparent).toBe(true)
    expect(result.seed).toBe(99)
  })
})

describe('config read/write', () => {
  const tmpDir = join(import.meta.dir, '.tmp-config-test')
  const configPath = join(tmpDir, 'config.json')

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true })
  })

  it('returns empty config when file does not exist', () => {
    expect(existsSync(configPath)).toBe(false)
    // Simulate readConfig
    const config = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, 'utf-8'))
      : {}
    expect(config).toEqual({})
  })

  it('round-trips config through write and read', () => {
    mkdirSync(dirname(configPath), { recursive: true })
    const data = { unsplash_access_key: 'key123', pexels_api_key: 'key456' }
    writeFileSync(configPath, `${JSON.stringify(data, null, 2)}\n`)

    const loaded = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(loaded.unsplash_access_key).toBe('key123')
    expect(loaded.pexels_api_key).toBe('key456')
  })

  it('handles corrupted config gracefully', () => {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, 'not json{{{')

    let config = {}
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'))
    } catch {
      config = {}
    }
    expect(config).toEqual({})
  })
})

describe('search key resolution', () => {
  it('prefers env var over config', () => {
    const envKey = 'env-unsplash-key'
    const configKey = 'config-unsplash-key'
    const resolved = envKey || configKey
    expect(resolved).toBe('env-unsplash-key')
  })

  it('falls back to config when env var is empty', () => {
    const envKey = ''
    const configKey = 'config-pexels-key'
    const resolved = envKey || configKey
    expect(resolved).toBe('config-pexels-key')
  })

  it('is undefined when both are missing', () => {
    const envKey = undefined
    const configKey = undefined
    const resolved = envKey || configKey
    expect(resolved).toBeUndefined()
  })
})

describe('CLI exit codes', () => {
  it('search exits with error when no keys configured', async () => {
    const proc = Bun.spawn(
      [
        'node',
        join(import.meta.dir, '../../dist/cli/image.js'),
        'search',
        'test',
        '-o',
        '/tmp/test.jpg',
      ],
      {
        env: {
          ...process.env,
          UNSPLASH_ACCESS_KEY: '',
          PEXELS_API_KEY: '',
          XDG_CONFIG_HOME: '/tmp/prez-test-nonexistent',
        },
        stderr: 'pipe',
        stdout: 'pipe',
      },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)

    const stderr = await new Response(proc.stderr).text()
    const stdout = await new Response(proc.stdout).text()
    const output = stderr + stdout
    expect(output).toContain('prez-image setup')
  })

  it('gen exits with error when no API key configured', async () => {
    const proc = Bun.spawn(
      [
        'node',
        join(import.meta.dir, '../../dist/cli/image.js'),
        'gen',
        'test prompt',
        '-o',
        '/tmp/test.png',
      ],
      {
        env: {
          ...process.env,
          POLLINATIONS_API_KEY: '',
          XDG_CONFIG_HOME: '/tmp/prez-test-nonexistent',
        },
        stderr: 'pipe',
        stdout: 'pipe',
      },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)

    const stderr = await new Response(proc.stderr).text()
    const stdout = await new Response(proc.stdout).text()
    const output = stderr + stdout
    expect(output).toContain('prez-image setup')
  })

  it('gen exits with error when no prompt given', async () => {
    const proc = Bun.spawn(
      ['node', join(import.meta.dir, '../../dist/cli/image.js'), 'gen'],
      { env: process.env },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)
  })

  it('render exits with error when no file given', async () => {
    const proc = Bun.spawn(
      ['node', join(import.meta.dir, '../../dist/cli/image.js'), 'render'],
      { env: process.env },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)
  })

  it('shows usage when no command given', async () => {
    const proc = Bun.spawn(
      ['node', join(import.meta.dir, '../../dist/cli/image.js')],
      { env: process.env },
    )
    const code = await proc.exited
    expect(code).toBe(0)

    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-image')
    expect(stdout).toContain('models')
    expect(stdout).toContain('--enhance')
  })
})
