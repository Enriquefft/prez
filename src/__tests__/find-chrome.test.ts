import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { __resetChromeLogForTests, getChrome } from '../scripts/find-chrome'

interface IOCapture {
  stderr: string
  restore: () => void
}

function captureStderr(): IOCapture {
  const original = process.stderr.write.bind(process.stderr)
  const cap: IOCapture = {
    stderr: '',
    restore: () => {
      process.stderr.write = original
    },
  }
  process.stderr.write = ((chunk: string | Uint8Array) => {
    cap.stderr +=
      typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof process.stderr.write
  return cap
}

/** Create an executable stub file that stands in for a real Chrome binary. */
function makeExecutableStub(dir: string, name = 'fake-chrome'): string {
  const path = join(dir, name)
  writeFileSync(path, '#!/bin/sh\nexit 0\n')
  chmodSync(path, 0o755)
  return path
}

let tmpRoot: string
let savedEnv: string | undefined

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'prez-find-chrome-'))
  savedEnv = process.env.CHROME_PATH
  __resetChromeLogForTests()
})

afterEach(() => {
  if (savedEnv === undefined) {
    delete process.env.CHROME_PATH
  } else {
    process.env.CHROME_PATH = savedEnv
  }
  rmSync(tmpRoot, { recursive: true, force: true })
  __resetChromeLogForTests()
})

describe('getChrome — CHROME_PATH env', () => {
  it('returns CHROME_PATH and logs "from CHROME_PATH" on first call', () => {
    const stub = makeExecutableStub(tmpRoot)
    process.env.CHROME_PATH = stub

    const cap = captureStderr()
    try {
      const resolved = getChrome()
      expect(resolved).toBe(stub)
      expect(cap.stderr).toContain('Using Chrome:')
      expect(cap.stderr).toContain(stub)
      expect(cap.stderr).toContain('from CHROME_PATH')
    } finally {
      cap.restore()
    }
  })

  it('stays silent on subsequent calls within the same process', () => {
    const stub = makeExecutableStub(tmpRoot)
    process.env.CHROME_PATH = stub

    const first = captureStderr()
    try {
      getChrome()
    } finally {
      first.restore()
    }
    expect(first.stderr).toContain('Using Chrome:')

    const second = captureStderr()
    try {
      getChrome()
      getChrome()
    } finally {
      second.restore()
    }
    expect(second.stderr).toBe('')
  })
})

describe('getChrome — auto-detected', () => {
  it('logs "(auto-detected)" on first call when CHROME_PATH is unset', () => {
    delete process.env.CHROME_PATH

    const cap = captureStderr()
    let resolved: string
    try {
      resolved = getChrome()
    } finally {
      cap.restore()
    }

    // On CI / minimal environments Chrome may be absent — in that case
    // getChrome() calls process.exit(1) inside the kernel, which Bun's
    // test runner catches as an uncaught exception and fails the test.
    // If we reach here at all, resolution succeeded.
    expect(typeof resolved).toBe('string')
    expect(resolved.length).toBeGreaterThan(0)
    expect(cap.stderr).toContain('Using Chrome:')
    expect(cap.stderr).toContain('auto-detected')
    expect(cap.stderr).not.toContain('from CHROME_PATH')
  })

  it('is silent on second call after auto-detection', () => {
    delete process.env.CHROME_PATH

    const first = captureStderr()
    try {
      getChrome()
    } finally {
      first.restore()
    }
    expect(first.stderr).toContain('auto-detected')

    const second = captureStderr()
    try {
      getChrome()
    } finally {
      second.restore()
    }
    expect(second.stderr).toBe('')
  })
})
