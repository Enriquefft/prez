import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  die,
  getPackageVersion,
  type HelpSpec,
  handleGlobalFlags,
  printHelp,
  printVersion,
} from '../cli/_cli-kit'

const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..')
const pkg = JSON.parse(
  readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf-8'),
) as { version: string }

const spec: HelpSpec = {
  name: 'prez-test',
  summary: 'Unit-test CLI',
  usage: ['prez-test [options]'],
  sections: [
    {
      title: 'Options',
      rows: [
        ['--flag', 'A test flag'],
        ['--other', 'Another flag'],
      ],
    },
  ],
  footer: 'FOOTER_MARKER',
}

interface IOCapture {
  stdout: string
  stderr: string
  exitCode: number | null
  restore: () => void
}

function captureIO(): IOCapture {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  const originalExit = process.exit.bind(process)

  const cap: IOCapture = {
    stdout: '',
    stderr: '',
    exitCode: null,
    restore: () => {
      process.stdout.write = originalStdoutWrite
      process.stderr.write = originalStderrWrite
      process.exit = originalExit
    },
  }

  process.stdout.write = ((chunk: string | Uint8Array) => {
    cap.stdout +=
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    cap.stderr +=
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof process.stderr.write

  process.exit = ((code?: number) => {
    cap.exitCode = code ?? 0
    throw new Error(`__EXIT__:${cap.exitCode}`)
  }) as typeof process.exit

  return cap
}

describe('getPackageVersion', () => {
  it('returns the version from package.json', () => {
    expect(getPackageVersion()).toBe(pkg.version)
  })
})

describe('printVersion', () => {
  let cap: IOCapture
  beforeEach(() => {
    cap = captureIO()
  })
  afterEach(() => cap.restore())

  it('writes name and version separated by a space', () => {
    printVersion('prez-test')
    expect(cap.stdout).toBe(`prez-test ${pkg.version}\n`)
  })
})

describe('printHelp', () => {
  let cap: IOCapture
  beforeEach(() => {
    cap = captureIO()
  })
  afterEach(() => cap.restore())

  it('renders name, summary, usage, sections, footer', () => {
    printHelp(spec)
    expect(cap.stdout).toContain('prez-test')
    expect(cap.stdout).toContain('Unit-test CLI')
    expect(cap.stdout).toContain('prez-test [options]')
    expect(cap.stdout).toContain('Options:')
    expect(cap.stdout).toContain('--flag')
    expect(cap.stdout).toContain('A test flag')
    expect(cap.stdout).toContain('FOOTER_MARKER')
  })
})

describe('handleGlobalFlags', () => {
  let cap: IOCapture
  beforeEach(() => {
    cap = captureIO()
  })
  afterEach(() => cap.restore())

  it('prints version and exits 0 on --version', () => {
    expect(() => handleGlobalFlags(['--version'], spec)).toThrow('__EXIT__:0')
    expect(cap.exitCode).toBe(0)
    expect(cap.stdout).toContain('prez-test')
    expect(cap.stdout).toContain(pkg.version)
  })

  it('prints version and exits 0 on -V', () => {
    expect(() => handleGlobalFlags(['-V'], spec)).toThrow('__EXIT__:0')
    expect(cap.exitCode).toBe(0)
    expect(cap.stdout).toContain(pkg.version)
  })

  it('prints help and exits 0 on --help', () => {
    expect(() => handleGlobalFlags(['--help'], spec)).toThrow('__EXIT__:0')
    expect(cap.exitCode).toBe(0)
    expect(cap.stdout).toContain(spec.usage[0])
    expect(cap.stdout).toContain(spec.sections[0].rows[0][0])
    expect(cap.stdout).toContain('FOOTER_MARKER')
  })

  it('prints help and exits 0 on -h', () => {
    expect(() => handleGlobalFlags(['-h'], spec)).toThrow('__EXIT__:0')
    expect(cap.exitCode).toBe(0)
    expect(cap.stdout).toContain(spec.usage[0])
  })

  it('returns normally when no global flag is present', () => {
    handleGlobalFlags(['--foo', 'value'], spec)
    expect(cap.exitCode).toBeNull()
    expect(cap.stdout).toBe('')
    expect(cap.stderr).toBe('')
  })
})

describe('die', () => {
  let cap: IOCapture
  beforeEach(() => {
    cap = captureIO()
  })
  afterEach(() => cap.restore())

  it('writes to stderr and exits 1 by default', () => {
    expect(() => die('bad')).toThrow('__EXIT__:1')
    expect(cap.exitCode).toBe(1)
    expect(cap.stderr).toContain('bad')
  })

  it('honors a custom exit code', () => {
    expect(() => die('nope', 42)).toThrow('__EXIT__:42')
    expect(cap.exitCode).toBe(42)
  })
})
