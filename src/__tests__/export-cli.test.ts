import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  DEFAULT_OUTPUT_DIR,
  type ExportArgs,
  parseExportArgs,
} from '../cli/export'

const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..')
const EXPORT_CLI = join(PACKAGE_ROOT, 'dist', 'cli', 'export.js')
const pkg = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'),
) as { version: string }

function parse(argv: string[]): ExportArgs {
  return parseExportArgs(['node', 'export.js', ...argv])
}

describe('parseExportArgs', () => {
  it('defaults to both formats and the new ./dist/ output', () => {
    const result = parse([])
    expect(result.format).toBe('both')
    expect(result.output).toBe(DEFAULT_OUTPUT_DIR)
    expect(result.output).toBe('./dist')
    expect(result.outputExplicit).toBe(false)
    expect(result.build).toBe(false)
    expect(result.timeout).toBe(30000)
    expect(result.url).toBeUndefined()
    expect(result.base).toBeUndefined()
  })

  it('parses pdf format', () => {
    expect(parse(['pdf']).format).toBe('pdf')
  })

  it('parses pptx format', () => {
    expect(parse(['pptx']).format).toBe('pptx')
  })

  it('parses both format explicitly', () => {
    expect(parse(['both']).format).toBe('both')
  })

  it('parses --url flag', () => {
    expect(parse(['--url', 'http://localhost:3000']).url).toBe(
      'http://localhost:3000',
    )
  })

  it('parses -o output flag and marks it explicit', () => {
    const result = parse(['-o', 'public/'])
    expect(result.output).toBe('public/')
    expect(result.outputExplicit).toBe(true)
  })

  it('parses --output long form and marks it explicit', () => {
    const result = parse(['--output', 'out/'])
    expect(result.output).toBe('out/')
    expect(result.outputExplicit).toBe(true)
  })

  it('--output override still works', () => {
    const result = parse(['--output', './public/'])
    expect(result.output).toBe('./public/')
    expect(result.outputExplicit).toBe(true)
  })

  it('parses --build flag', () => {
    expect(parse(['--build']).build).toBe(true)
  })

  it('parses --base flag', () => {
    expect(parse(['--base', '/deck/']).base).toBe('/deck/')
  })

  it('parses --timeout flag', () => {
    expect(parse(['--timeout', '60000']).timeout).toBe(60000)
  })

  it('parses all flags combined', () => {
    const result = parse([
      'pdf',
      '--url',
      'http://localhost:5173',
      '-o',
      'build/',
      '--base',
      '/slides/',
      '--timeout',
      '45000',
    ])
    expect(result.format).toBe('pdf')
    expect(result.url).toBe('http://localhost:5173')
    expect(result.output).toBe('build/')
    expect(result.outputExplicit).toBe(true)
    expect(result.base).toBe('/slides/')
    expect(result.timeout).toBe(45000)
  })
})

describe('prez-export CLI (subprocess)', () => {
  it('exposes help from _cli-kit with commands, options, examples', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)

    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-export')
    expect(stdout).toContain('Commands:')
    expect(stdout).toContain('Options:')
    expect(stdout).toContain('Examples:')
    expect(stdout).toContain('--url')
    expect(stdout).toContain('--build')
    expect(stdout).toContain('--timeout')
    expect(stdout).toContain('./dist/')
    // Footer: slide-index docs.
    expect(stdout).toContain('Slide numbering')
  })

  it('exposes -h alias identical to --help', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI, '-h'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-export')
    expect(stdout).toContain('Commands:')
  })

  it('prints --version matching package.json', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-export')
    expect(stdout).toContain(pkg.version)
  })

  it('prints -V alias identical to --version', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI, '-V'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain(pkg.version)
  })

  it('errors when dist/ is missing and no --build', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI], {
      cwd: '/tmp',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).not.toBe(0)

    const stderr = await new Response(proc.stderr).text()
    const stdout = await new Response(proc.stdout).text()
    const output = stderr + stdout
    expect(output).toContain('dist/')
  })

  it('help output documents the new ./dist/ default', async () => {
    const proc = Bun.spawn(['node', EXPORT_CLI, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    await proc.exited
    const stdout = await new Response(proc.stdout).text()
    // The help text lists ./dist/ as the default and never ./public/ for output.
    expect(stdout).toMatch(/default: \.\/dist\//)
    expect(stdout).not.toMatch(/default: \.\/public\//)
  })
})
