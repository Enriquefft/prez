import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const CANDIDATES = [
  // Linux
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  // Windows (WSL / native)
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

/**
 * Module-level latch so the resolution source is announced exactly once per
 * process, regardless of how many Chrome-launching CLIs end up calling
 * `getChrome()`. Exported only for tests via `__resetChromeLogForTests`.
 */
let logged = false

function logOnce(message: string): void {
  if (logged) return
  logged = true
  process.stderr.write(`${message}\n`)
}

/** Test-only helper: reset the module-level `logged` latch. */
export function __resetChromeLogForTests(): void {
  logged = false
}

function resolveFromCandidates(): string | null {
  for (const candidate of CANDIDATES) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate
      continue
    }
    try {
      const cmd =
        process.platform === 'win32'
          ? `where ${candidate}`
          : `which ${candidate}`
      const result = execSync(cmd, { stdio: 'pipe' }).toString().trim()
      if (result) {
        // `which` may return multiple newline-separated paths on some systems;
        // take the first one. `where` (Windows) behaves the same.
        const firstLine = result.split(/\r?\n/)[0].trim()
        if (firstLine.length > 0) return firstLine
      }
    } catch {
      // not found, try next
    }
  }
  return null
}

export function findChrome(): string {
  const resolved = resolveFromCandidates()
  if (resolved) {
    logOnce(`Using Chrome: ${resolved} (auto-detected)`)
    return resolved
  }

  process.stderr.write('Error: Chrome/Chromium not found on your system.\n')
  process.stderr.write(
    'Install Chrome or Chromium, or set CHROME_PATH environment variable.\n',
  )
  process.exit(1)
}

export function getChrome(): string {
  const envPath = process.env.CHROME_PATH
  if (envPath && envPath.length > 0) {
    if (!existsSync(envPath)) {
      process.stderr.write(
        `Error: CHROME_PATH=${envPath} is set but does not exist on disk.\n`,
      )
      process.exit(1)
    }
    logOnce(`Using Chrome: ${envPath} (from CHROME_PATH)`)
    return envPath
  }
  return findChrome()
}
