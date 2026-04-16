import { describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { safeCleanScreenshotsDir } from '../scripts/safe-clean'

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), 'prez-safe-clean-'))
}

describe('safeCleanScreenshotsDir - happy path', () => {
  it('removes slide-*.png and diff-*.png, leaves other files alone', () => {
    const dir = makeTmp()
    try {
      writeFileSync(join(dir, 'slide-01.png'), 'a')
      writeFileSync(join(dir, 'slide-02.png'), 'b')
      writeFileSync(join(dir, 'diff-01.png'), 'c')
      writeFileSync(join(dir, 'random.txt'), 'd')
      writeFileSync(join(dir, '.hidden'), 'e')

      const report = safeCleanScreenshotsDir(dir)

      expect(report.deleted).toHaveLength(3)
      expect(report.skipped).toHaveLength(2)

      const remaining = readdirSync(dir).sort()
      expect(remaining).toEqual(['.hidden', 'random.txt'])
      expect(existsSync(dir)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('is a no-op on empty directories', () => {
    const dir = makeTmp()
    try {
      const report = safeCleanScreenshotsDir(dir)
      expect(report.deleted).toHaveLength(0)
      expect(report.skipped).toHaveLength(0)
      expect(existsSync(dir)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('is a no-op on non-existent directories', () => {
    const dir = join(tmpdir(), `prez-safe-clean-missing-${Date.now()}`)
    expect(existsSync(dir)).toBe(false)
    const report = safeCleanScreenshotsDir(dir)
    expect(report.deleted).toHaveLength(0)
    expect(report.skipped).toHaveLength(0)
  })
})

describe('safeCleanScreenshotsDir - refusal', () => {
  const dangerousPaths = [
    '/',
    homedir(),
    process.cwd(),
    dirname(process.cwd()),
    '/etc',
    '/tmp',
  ]

  for (const p of dangerousPaths) {
    it(`refuses to clean ${p}`, () => {
      // Snapshot some evidence the path is untouched afterwards.
      const snapshotBefore = existsSync(p) ? readdirSync(p).sort() : null

      expect(() => safeCleanScreenshotsDir(p)).toThrow(/refused to clean/)

      if (snapshotBefore !== null) {
        const snapshotAfter = readdirSync(p).sort()
        expect(snapshotAfter).toEqual(snapshotBefore)
      }
    })
  }
})
