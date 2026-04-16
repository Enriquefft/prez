import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseValidateArgs } from '../cli/validate'

const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..')
const VALIDATE_CLI = join(PACKAGE_ROOT, 'dist', 'cli', 'validate.js')
const pkg = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf-8'),
) as { version: string }

function parse(argv: string[]) {
  return parseValidateArgs(['node', 'validate.js', ...argv])
}

describe('parseValidateArgs', () => {
  it('defaults to screenshot mode, ./screenshots, full deck, no json', () => {
    const a = parse([])
    expect(a.slide).toBeUndefined()
    expect(a.output).toBe('./screenshots')
    expect(a.build).toBe(false)
    expect(a.clean).toBe(false)
    expect(a.json).toBe(false)
    expect(a.jsonManifest).toBe(false)
    expect(a.diff).toBeUndefined()
    expect(a.threshold).toBe(0.005)
    expect(a.watch).toBe(false)
    expect(a.timeout).toBe(30000)
    expect(a.concurrency).toBeGreaterThanOrEqual(1)
    expect(a.concurrency).toBeLessThanOrEqual(8)
  })

  it('parses --slide as a positive integer', () => {
    expect(parse(['--slide', '3']).slide).toBe(3)
  })

  it('parses --diff and --threshold', () => {
    const a = parse(['--diff', 'baseline/', '--threshold', '0.02'])
    expect(a.diff).toBe('baseline/')
    expect(a.threshold).toBe(0.02)
  })

  it('clamps --concurrency into [1, 16]', () => {
    expect(parse(['--concurrency', '99']).concurrency).toBe(16)
    expect(parse(['--concurrency', '4']).concurrency).toBe(4)
  })

  it('accepts --json and --json-manifest individually', () => {
    expect(parse(['--json']).json).toBe(true)
    expect(parse(['--json-manifest']).jsonManifest).toBe(true)
  })

  it('parses --chrome-path override', () => {
    expect(parse(['--chrome-path', '/tmp/chromium']).chromePath).toBe(
      '/tmp/chromium',
    )
  })

  it('parses --watch flag', () => {
    expect(parse(['--watch']).watch).toBe(true)
  })
})

describe('prez-validate CLI (subprocess)', () => {
  it('--help exits 0 with usage, flags, slide-numbering footer', async () => {
    const proc = Bun.spawn(['node', VALIDATE_CLI, '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-validate')
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('Options:')
    expect(stdout).toContain('Examples:')
    expect(stdout).toContain('--diff')
    expect(stdout).toContain('--concurrency')
    expect(stdout).toContain('--json')
    expect(stdout).toContain('--watch')
    // Slide-index footer.
    expect(stdout).toContain('Slide numbering')
  })

  it('--version exits 0 and prints package.json version', async () => {
    const proc = Bun.spawn(['node', VALIDATE_CLI, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-validate')
    expect(stdout).toContain(pkg.version)
  })

  it('--watch without --build fails with exit code 2 and clear message', async () => {
    const proc = Bun.spawn(['node', VALIDATE_CLI, '--watch'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(2)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('requires --build')
  })

  it('--json and --json-manifest together exit 2 as mutually exclusive', async () => {
    const proc = Bun.spawn(
      ['node', VALIDATE_CLI, '--json', '--json-manifest'],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).toBe(2)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('mutually exclusive')
  })

  it('--clean -o / refuses to clean the filesystem root', async () => {
    const proc = Bun.spawn(
      [
        'node',
        VALIDATE_CLI,
        '--clean',
        '-o',
        '/',
        '--url',
        'http://127.0.0.1:1/',
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr.toLowerCase()).toContain('refused to clean')
  })

  it('unknown flag exits non-zero with helpful message', async () => {
    const proc = Bun.spawn(['node', VALIDATE_CLI, '--nope'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).not.toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('unknown argument')
  })
})
