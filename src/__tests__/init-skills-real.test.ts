import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PREZ_ROOT = resolve(import.meta.dir, '..', '..')
const SKILLS_SRC = join(PREZ_ROOT, 'skills')

const RUN = process.env.RUN_INTEGRATION === '1'
const describeIfGated = RUN ? describe : describe.skip

describeIfGated('skills CLI integration (RUN_INTEGRATION=1)', () => {
  let tmpCwd: string

  beforeEach(() => {
    tmpCwd = mkdtempSync(join(tmpdir(), 'prez-skills-real-'))
  })

  afterEach(() => {
    rmSync(tmpCwd, { recursive: true, force: true })
  })

  it('bunx skills add <prezRoot/skills> --skill * -y symlinks all three skills', async () => {
    const proc = Bun.spawn(
      ['bunx', 'skills', 'add', SKILLS_SRC, '--skill', '*', '-y'],
      { cwd: tmpCwd, stdout: 'pipe', stderr: 'pipe' },
    )
    const code = await proc.exited
    expect(code).toBe(0)

    for (const name of ['prez', 'prez-image', 'prez-validate']) {
      const dest = join(tmpCwd, '.claude', 'skills', name, 'SKILL.md')
      expect(existsSync(dest)).toBe(true)
      const stat = lstatSync(dest)
      expect(stat.isSymbolicLink() || stat.isFile()).toBe(true)
      const content = readFileSync(dest, 'utf-8')
      expect(content).toContain('## Prerequisites')
    }

    expect(existsSync(join(tmpCwd, 'skills-lock.json'))).toBe(true)
  })
})
