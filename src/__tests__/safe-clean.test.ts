import { describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
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

describe('safeCleanScreenshotsDir - symlink safety', () => {
  it('does not follow a symlink matching the pattern (target survives)', () => {
    // If the implementation uses statSync, the symlink would be
    // stat()'d through to its target: isFile() returns true for the
    // regular-file target, so unlinkSync would remove the symlink
    // (not the target — unlink never follows — but we still want to
    // inspect link metadata, not target metadata). With lstatSync the
    // link itself is reported as a symlink, isFile() is false, and
    // the entry is skipped. Either way the target survives; this test
    // pins that property and also drives the lstatSync-vs-statSync
    // distinction via the broken-symlink case below.
    const dir = makeTmp()
    const targetHolder = makeTmp()
    const target = join(targetHolder, 'real-target.txt')
    writeFileSync(target, 'keep-me')
    try {
      const link = join(dir, 'slide-99.png')
      symlinkSync(target, link)

      safeCleanScreenshotsDir(dir)

      // Target must survive regardless of whether the link was removed.
      expect(existsSync(target)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
      rmSync(targetHolder, { recursive: true, force: true })
    }
  })

  it('does not throw on a broken symlink matching the pattern (lstatSync)', () => {
    // statSync on a broken symlink throws ENOENT because it follows
    // the link and tries to stat a nonexistent target. lstatSync
    // reads link metadata and succeeds. This test would fail with
    // statSync (unhandled throw) and pass with lstatSync.
    const dir = makeTmp()
    try {
      const link = join(dir, 'slide-77.png')
      symlinkSync(join(tmpdir(), `prez-nonexistent-${Date.now()}`), link)

      expect(() => safeCleanScreenshotsDir(dir)).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
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
