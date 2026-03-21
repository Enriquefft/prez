import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

function parseArgs(argv: string[]) {
  const args = argv.slice(2)

  let format: 'pdf' | 'pptx' | 'both' = 'both'
  let url: string | undefined
  let output = './public'
  let build = false
  let base: string | undefined
  let timeout = 30000

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case 'pdf':
        format = 'pdf'
        break
      case 'pptx':
        format = 'pptx'
        break
      case '--url':
        url = args[++i]
        break
      case '-o':
      case '--output':
        output = args[++i]
        break
      case '--build':
        build = true
        break
      case '--base':
        base = args[++i]
        break
      case '--timeout':
        timeout = Number.parseInt(args[++i], 10)
        break
    }
  }

  return { format, url, output, build, base, timeout }
}

describe('parseArgs', () => {
  it('defaults to both formats', () => {
    const result = parseArgs(['node', 'export.js'])
    expect(result.format).toBe('both')
    expect(result.output).toBe('./public')
    expect(result.build).toBe(false)
    expect(result.timeout).toBe(30000)
    expect(result.url).toBeUndefined()
    expect(result.base).toBeUndefined()
  })

  it('parses pdf format', () => {
    const result = parseArgs(['node', 'export.js', 'pdf'])
    expect(result.format).toBe('pdf')
  })

  it('parses pptx format', () => {
    const result = parseArgs(['node', 'export.js', 'pptx'])
    expect(result.format).toBe('pptx')
  })

  it('parses --url flag', () => {
    const result = parseArgs([
      'node',
      'export.js',
      '--url',
      'http://localhost:3000',
    ])
    expect(result.url).toBe('http://localhost:3000')
  })

  it('parses -o output flag', () => {
    const result = parseArgs(['node', 'export.js', '-o', 'dist/'])
    expect(result.output).toBe('dist/')
  })

  it('parses --output long form', () => {
    const result = parseArgs(['node', 'export.js', '--output', 'out/'])
    expect(result.output).toBe('out/')
  })

  it('parses --build flag', () => {
    const result = parseArgs(['node', 'export.js', '--build'])
    expect(result.build).toBe(true)
  })

  it('parses --base flag', () => {
    const result = parseArgs(['node', 'export.js', '--base', '/deck/'])
    expect(result.base).toBe('/deck/')
  })

  it('parses --timeout flag', () => {
    const result = parseArgs(['node', 'export.js', '--timeout', '60000'])
    expect(result.timeout).toBe(60000)
  })

  it('parses all flags combined', () => {
    const result = parseArgs([
      'node',
      'export.js',
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
    expect(result.base).toBe('/slides/')
    expect(result.timeout).toBe(45000)
  })
})

describe('CLI exit codes', () => {
  it('shows usage with --help', async () => {
    const proc = Bun.spawn(
      ['node', join(import.meta.dir, '../../dist/cli/export.js'), '--help'],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).toBe(0)

    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez-export')
    expect(stdout).toContain('--url')
    expect(stdout).toContain('--build')
    expect(stdout).toContain('--timeout')
  })

  it('errors when dist/ is missing and no --build', async () => {
    const proc = Bun.spawn(
      ['node', join(import.meta.dir, '../../dist/cli/export.js')],
      {
        cwd: '/tmp',
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const code = await proc.exited
    expect(code).not.toBe(0)

    const stderr = await new Response(proc.stderr).text()
    const stdout = await new Response(proc.stdout).text()
    const output = stderr + stdout
    expect(output).toContain('dist/')
  })
})
