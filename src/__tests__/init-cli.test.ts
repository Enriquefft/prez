import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

describe('prez init CLI (subprocess)', () => {
  let tmpCwd: string

  beforeEach(() => {
    tmpCwd = mkdtempSync(join(tmpdir(), 'prez-init-'))
  })

  afterEach(() => {
    rmSync(tmpCwd, { recursive: true, force: true })
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

  it('prez init deck --yes --no-skills scaffolds without skills anywhere', async () => {
    const proc = Bun.spawn(
      ['node', DIST_INIT_CLI, 'init', 'deck', '--yes', '--no-skills'],
      { cwd: tmpCwd, stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).toBe(0)

    // deck/ exists
    expect(existsSync(join(tmpCwd, 'deck'))).toBe(true)
    // deck-local skills absent (flag honored)
    expect(existsSync(join(tmpCwd, 'deck', '.claude', 'skills'))).toBe(false)
    // cwd-rooted skills absent (Issue 4 — skills should never land in cwd)
    expect(existsSync(join(tmpCwd, '.claude', 'skills'))).toBe(false)
  })

  it('prez init deck --yes installs skills into <deck>/.claude/skills, not cwd', async () => {
    const proc = Bun.spawn(['node', DIST_INIT_CLI, 'init', 'deck', '--yes'], {
      cwd: tmpCwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const code = await proc.exited
    expect(code).toBe(0)

    // deck-local skills present
    expect(
      existsSync(join(tmpCwd, 'deck', '.claude', 'skills', 'prez', 'SKILL.md')),
    ).toBe(true)
    // All three skills travel with the deck
    expect(
      existsSync(
        join(tmpCwd, 'deck', '.claude', 'skills', 'prez-image', 'SKILL.md'),
      ),
    ).toBe(true)
    expect(
      existsSync(
        join(tmpCwd, 'deck', '.claude', 'skills', 'prez-validate', 'SKILL.md'),
      ),
    ).toBe(true)
    // cwd-rooted .claude/ MUST NOT exist (Issue 4 regression guard)
    expect(existsSync(join(tmpCwd, '.claude'))).toBe(false)
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
