import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const DIST_INIT_CLI = resolve(
  import.meta.dir,
  '..',
  '..',
  'dist',
  'cli',
  'init.js',
)
const PACKAGE_JSON_PATH = resolve(import.meta.dir, '..', '..', 'package.json')
const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
  version: string
}

/**
 * Write a `bunx` shim into `dir` that records its argv (newline-delimited)
 * to `$SHIM_SENTINEL` and exits with `$SHIM_EXIT_CODE` (default 0).
 * Returns the absolute sentinel path the shim will write to.
 */
function installBunxShim(dir: string): string {
  const shimPath = join(dir, 'bunx')
  const sentinel = join(dir, 'bunx-invocation.txt')
  writeFileSync(
    shimPath,
    `#!/bin/sh\nprintf '%s\\n' "$@" > "$SHIM_SENTINEL"\nexit \${SHIM_EXIT_CODE:-0}\n`,
  )
  chmodSync(shimPath, 0o755)
  return sentinel
}

describe('prez init CLI (subprocess)', () => {
  let tmpCwd: string
  let shimDir: string

  beforeEach(() => {
    tmpCwd = mkdtempSync(join(tmpdir(), 'prez-init-'))
    shimDir = mkdtempSync(join(tmpdir(), 'prez-shim-'))
  })

  afterEach(() => {
    rmSync(tmpCwd, { recursive: true, force: true })
    rmSync(shimDir, { recursive: true, force: true })
  })

  it('prez --help exits 0 and prints usage', async () => {
    const proc = Bun.spawn(['node', DIST_INIT_CLI, '--help'], {
      cwd: tmpCwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez')
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('--no-skills')
  })

  it('prez --version exits 0 and prints version', async () => {
    const proc = Bun.spawn(['node', DIST_INIT_CLI, '--version'], {
      cwd: tmpCwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)
    const stdout = await new Response(proc.stdout).text()
    expect(stdout).toContain('prez')
    expect(stdout).toContain(pkg.version)
  })

  it('prez init deck --yes --no-skills does not invoke skills CLI', async () => {
    const sentinel = installBunxShim(shimDir)
    const proc = Bun.spawn(
      ['node', DIST_INIT_CLI, 'init', 'deck', '--yes', '--no-skills'],
      {
        cwd: tmpCwd,
        env: {
          ...process.env,
          PATH: `${shimDir}:${process.env.PATH ?? ''}`,
          SHIM_SENTINEL: sentinel,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const code = await proc.exited
    expect(code).toBe(0)

    // Deck scaffolded
    expect(existsSync(join(tmpCwd, 'deck'))).toBe(true)
    // Skills CLI never invoked
    expect(existsSync(sentinel)).toBe(false)
  })

  it('prez init deck --yes delegates to bunx skills add with expected argv', async () => {
    const sentinel = installBunxShim(shimDir)
    const proc = Bun.spawn(['node', DIST_INIT_CLI, 'init', 'deck', '--yes'], {
      cwd: tmpCwd,
      env: {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH ?? ''}`,
        SHIM_SENTINEL: sentinel,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)

    // Deck scaffolded
    expect(existsSync(join(tmpCwd, 'deck'))).toBe(true)

    // Skills CLI invoked with the expected argv contract
    expect(existsSync(sentinel)).toBe(true)
    const argv = readFileSync(sentinel, 'utf-8').split('\n').filter(Boolean)
    expect(argv[0]).toBe('skills')
    expect(argv[1]).toBe('add')
    expect(argv[2]).toMatch(/skills$/)
    expect(existsSync(argv[2])).toBe(true)
    expect(argv).toContain('--skill')
    expect(argv).toContain('*')
    expect(argv).toContain('-y')
  })

  it('prez init deck --yes hard-fails and rolls back deck when skills CLI exits non-zero', async () => {
    const sentinel = installBunxShim(shimDir)
    const proc = Bun.spawn(['node', DIST_INIT_CLI, 'init', 'deck', '--yes'], {
      cwd: tmpCwd,
      env: {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH ?? ''}`,
        SHIM_SENTINEL: sentinel,
        SHIM_EXIT_CODE: '1',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).not.toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('skills CLI failed')
    expect(stderr).toContain('--no-skills')
    // Rollback: half-scaffolded deck removed so user can retry cleanly
    expect(existsSync(join(tmpCwd, 'deck'))).toBe(false)
  })

  it('prez init existingDir --yes errors non-zero and does not overwrite', async () => {
    const existing = mkdtempSync(join(tmpCwd, 'existing-'))
    const proc = Bun.spawn(['node', DIST_INIT_CLI, 'init', existing, '--yes'], {
      cwd: tmpCwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).not.toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('already exists')
  })
})
