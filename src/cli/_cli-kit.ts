/**
 * Shared CLI infrastructure for every `prez-*` binary.
 *
 * Centralizes:
 *   - package version (read ONCE from package.json at module load)
 *   - `--help` / `--version` handling (uniform shape across CLIs)
 *   - `die()` for fatal errors with consistent exit code and stderr channel
 *
 * File name prefix `_` signals privacy: this module is not re-exported
 * from any public package entry (`src/index.ts`, `src/node.ts`). It exists
 * solely for the four CLI entry points.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Build output lives at `dist/cli/_cli-kit.js`; the source lives at
// `src/cli/_cli-kit.ts`. In both cases, going up two levels lands at
// the package root containing `package.json`. This is the sole reader
// of the version field — every CLI derives its version from here.
const PACKAGE_JSON_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'package.json',
)

function readPackageVersion(): string {
  const raw = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as { version?: unknown }
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(
      `package.json at ${PACKAGE_JSON_PATH} has no string "version" field`,
    )
  }
  return parsed.version
}

const PACKAGE_VERSION = readPackageVersion()

export function getPackageVersion(): string {
  return PACKAGE_VERSION
}

export interface HelpSpec {
  /** CLI binary name, e.g. "prez-validate". */
  name: string
  /** One-line summary of what this CLI does. */
  summary: string
  /** Lines shown under the `Usage:` heading. */
  usage: string[]
  /** Grouped option / command / example rows. */
  sections: Array<{
    title: string
    rows: Array<[string, string]>
  }>
  /** Optional footer appended verbatim at the bottom (e.g. SLIDE_INDEX_DOCS). */
  footer?: string
}

function formatSection(section: HelpSpec['sections'][number]): string {
  if (section.rows.length === 0) return ''
  const pad = Math.min(
    28,
    Math.max(...section.rows.map(([left]) => left.length)) + 2,
  )
  const lines = section.rows.map(([left, right]) => {
    const padded = left.padEnd(pad, ' ')
    return `  ${padded}${right}`
  })
  return `${section.title}:\n${lines.join('\n')}`
}

function renderHelp(spec: HelpSpec): string {
  const parts: string[] = []
  parts.push(`${spec.name} - ${spec.summary}`)
  parts.push('')
  parts.push('Usage:')
  for (const line of spec.usage) parts.push(`  ${line}`)
  for (const section of spec.sections) {
    const formatted = formatSection(section)
    if (formatted) {
      parts.push('')
      parts.push(formatted)
    }
  }
  if (spec.footer) {
    parts.push('')
    parts.push(spec.footer)
  }
  return parts.join('\n')
}

/** Write the formatted help text to stdout. Does not exit. */
export function printHelp(spec: HelpSpec): void {
  process.stdout.write(`${renderHelp(spec)}\n`)
}

/** Write `${name} ${version}` to stdout. Does not exit. */
export function printVersion(name: string): void {
  process.stdout.write(`${name} ${PACKAGE_VERSION}\n`)
}

/**
 * Scan argv for `--help` / `-h` / `--version` / `-V`. If any is present,
 * print the corresponding output to stdout and `process.exit(0)`. Otherwise
 * return without mutating argv — the caller parses its own flags.
 *
 * Call this as the first line of each CLI's `main()` so help / version
 * never depend on the rest of argv being well-formed.
 */
export function handleGlobalFlags(argv: string[], spec: HelpSpec): void {
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp(spec)
      process.exit(0)
    }
    if (arg === '--version' || arg === '-V') {
      printVersion(spec.name)
      process.exit(0)
    }
  }
}

/** Print `msg` to stderr and exit the process with the given code. */
export function die(msg: string, code = 1): never {
  process.stderr.write(`${msg}\n`)
  process.exit(code)
}
