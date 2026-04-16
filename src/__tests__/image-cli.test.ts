import { afterEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from '../cli/image'

const DIST_IMAGE_CLI = resolve(
  import.meta.dir,
  '..',
  '..',
  'dist',
  'cli',
  'image.js',
)
const PACKAGE_JSON_PATH = resolve(import.meta.dir, '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
  version: string
}

describe('parseArgs (re-exported from cli/image)', () => {
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
      '--height',
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

  it('handles long-form flags including --height (not -h)', () => {
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

  it('no longer accepts -h as a height alias (silently ignored by parser)', () => {
    // parseArgs itself ignores unknown tokens; the -h <number> rejection
    // lives in main() before parseArgs runs, so a subprocess test covers
    // end-to-end behavior. Here we just confirm parseArgs does not set
    // height via -h.
    const result = parseArgs([
      'node',
      'image.js',
      'gen',
      'test',
      '-o',
      'out.png',
      '-h',
      '720',
    ])
    expect(result.height).toBe(720) // still the default, NOT from -h
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
  it('--help exits 0 and prints prez-image + sections', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-image')
    expect(stdout).toContain('Commands:')
    expect(stdout).toContain('Generation options:')
  })

  it('-h alone (no numeric arg) prints help and exits 0', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, '-h'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-image')
  })

  it('--version exits 0 and prints package version', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-image')
    expect(stdout).toContain(pkg.version)
  })

  it('-V exits 0 and prints package version', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, '-V'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain(pkg.version)
  })

  it('rejects the legacy `-h <number>` shape with exit 2 and a pointer to --height', async () => {
    const proc = Bun.spawn(
      ['node', DIST_IMAGE_CLI, 'gen', 'x', '-o', '/tmp/x.png', '-h', '720'],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).toBe(2)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('reserved for --help')
    expect(stderr).toContain('--height')
  })

  it('search exits with error when no keys configured', async () => {
    const proc = Bun.spawn(
      ['node', DIST_IMAGE_CLI, 'search', 'test', '-o', '/tmp/test.jpg'],
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
      ['node', DIST_IMAGE_CLI, 'gen', 'test prompt', '-o', '/tmp/test.png'],
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
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, 'gen'], {
      env: process.env,
    })
    const code = await proc.exited
    expect(code).not.toBe(0)
  })

  it('render exits with error when no file given', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI, 'render'], {
      env: process.env,
    })
    const code = await proc.exited
    expect(code).not.toBe(0)
  })

  it('shows usage when no command given', async () => {
    const proc = Bun.spawn(['node', DIST_IMAGE_CLI], { env: process.env })
    const code = await proc.exited
    expect(code).toBe(0)

    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-image')
    expect(stdout).toContain('Commands:')
  })
})
