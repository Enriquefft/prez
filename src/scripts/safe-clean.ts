/**
 * Path-guarded, pattern-restricted cleaner for the validate screenshots
 * output directory. Replaces the earlier `rmSync(outputDir, { recursive:
 * true, force: true })` which could obliterate the user's HOME, cwd, or
 * `/` if they passed a careless `--output` flag.
 *
 * Guarantees:
 *   - Refuses to touch anything outside cwd or os.tmpdir().
 *   - Refuses a short list of dangerous absolute paths even when they
 *     technically satisfy the above (e.g. `/tmp` itself, `os.homedir()`).
 *   - Only removes files matching `slide-<digits>.png` or
 *     `diff-<digits>.png`. Anything else in the directory is left alone
 *     and reported in `skipped`.
 *   - Never removes the directory itself — the caller is responsible for
 *     re-using it via `mkdirSync(..., { recursive: true })`.
 */

import { existsSync, lstatSync, readdirSync, unlinkSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { parse, resolve, sep } from 'node:path'

export interface SafeCleanReport {
  /** Absolute paths of files that were deleted. */
  deleted: string[]
  /** Absolute paths of entries that were left untouched (did not match). */
  skipped: string[]
}

const SLIDE_PATTERN = /^slide-\d+\.png$/
const DIFF_PATTERN = /^diff-\d+\.png$/

/** Cross-platform "is this the filesystem root?" check. */
function isRoot(p: string): boolean {
  const { root, dir, base } = parse(p)
  return p === root || (dir === root && base === '')
}

/**
 * Dangerous absolute paths we refuse to touch even if they resolve under
 * `cwd` or `tmpdir`. The check is exact-match after normalization — a
 * nested subdirectory like `/tmp/screenshots-abc` is fine; the literal
 * `/tmp` is not.
 */
function dangerousExactPaths(): string[] {
  return [
    '/',
    '/etc',
    '/usr',
    '/var',
    '/tmp',
    '/bin',
    '/sbin',
    '/opt',
    '/boot',
    '/root',
    '/home',
    homedir(),
    process.cwd(),
    tmpdir(),
  ]
}

/**
 * Is `child` equal to `parent` or strictly nested underneath it?
 * Uses path.sep so it works on Windows too.
 */
function isUnder(child: string, parent: string): boolean {
  if (child === parent) return true
  const parentWithSep = parent.endsWith(sep) ? parent : parent + sep
  return child.startsWith(parentWithSep)
}

/**
 * Throw if `resolved` fails any guard. Distinct error messages make the
 * refusal reason greppable in agent logs.
 */
function assertSafeTarget(resolved: string): void {
  const refuse = (reason: string) => {
    throw new Error(
      `safeCleanScreenshotsDir refused to clean ${resolved}: ${reason}`,
    )
  }

  if (isRoot(resolved)) refuse('path is a filesystem root')

  for (const dangerous of dangerousExactPaths()) {
    if (resolved === dangerous) {
      refuse(`path is a protected location (${dangerous})`)
    }
  }

  const cwd = process.cwd()
  // Refuse any ancestor of cwd (would nuke the working tree or higher).
  if (isUnder(cwd, resolved) && resolved !== cwd) {
    refuse('path is an ancestor of process.cwd()')
  }

  // Positive containment: must live under cwd or tmpdir.
  const tmp = tmpdir()
  const containedInCwd = isUnder(resolved, cwd) && resolved !== cwd
  const containedInTmp = isUnder(resolved, tmp) && resolved !== tmp
  if (!containedInCwd && !containedInTmp) {
    refuse('path is not under process.cwd() or os.tmpdir()')
  }
}

/**
 * Surgical clean: remove screenshot / diff PNGs from `outputDir`, leaving
 * every other entry (and the directory itself) untouched.
 */
export function safeCleanScreenshotsDir(outputDir: string): SafeCleanReport {
  const resolved = resolve(outputDir)
  assertSafeTarget(resolved)

  if (!existsSync(resolved)) {
    return { deleted: [], skipped: [] }
  }

  const report: SafeCleanReport = { deleted: [], skipped: [] }

  const entries = readdirSync(resolved)
  for (const entry of entries) {
    const full = `${resolved}${sep}${entry}`
    const matches = SLIDE_PATTERN.test(entry) || DIFF_PATTERN.test(entry)
    if (!matches) {
      report.skipped.push(full)
      continue
    }
    // Do not follow symlinks, do not descend into subdirs — we only
    // unlink regular files whose basename matches the pattern. We use
    // lstatSync (not statSync) so we inspect link metadata, not the
    // target's: a symlink named `slide-1.png` pointing at /etc/hosts
    // would pass an `isFile()` check under statSync (target is a
    // regular file), whereas lstatSync correctly reports it as a
    // symlink and we skip it. Broken symlinks also do not throw
    // ENOENT under lstatSync (the link metadata is readable).
    const st = lstatSync(full)
    if (!st.isFile()) {
      report.skipped.push(full)
      continue
    }
    unlinkSync(full)
    report.deleted.push(full)
  }

  return report
}
