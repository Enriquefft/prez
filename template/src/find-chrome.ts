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

export function findChrome(): string {
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
      if (result) return result
    } catch {
      // not found, try next
    }
  }

  console.error('Error: Chrome/Chromium not found on your system.')
  console.error(
    'Install Chrome or Chromium, or set CHROME_PATH environment variable.',
  )
  process.exit(1)
}

export function getChrome(): string {
  return process.env.CHROME_PATH || findChrome()
}
