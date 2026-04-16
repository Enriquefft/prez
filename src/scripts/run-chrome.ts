import { spawn } from 'node:child_process'

export interface ChromeResult {
  stdout: Buffer
  stderr: Buffer
}

export function runChromeAsync(
  chrome: string,
  args: string[],
  wallTimeout: number,
  captureStdout = false,
): Promise<ChromeResult> {
  return new Promise((res, rej) => {
    const child = spawn(chrome, args, {
      stdio: ['ignore', captureStdout ? 'pipe' : 'ignore', 'pipe'],
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    child.stdout?.on('data', (c) => stdoutChunks.push(c))
    child.stderr?.on('data', (c) => stderrChunks.push(c))

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL')
    }, wallTimeout)

    child.on('error', (err) => {
      clearTimeout(killTimer)
      rej(err)
    })

    child.on('exit', (code, signal) => {
      clearTimeout(killTimer)
      const result: ChromeResult = {
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
      }
      if (signal) {
        rej(
          new Error(
            `Chrome killed by ${signal} (wall-clock timeout ${wallTimeout}ms exceeded)`,
          ),
        )
        return
      }
      if (code !== 0) {
        rej(
          new Error(
            `Chrome exited with status ${code}: ${result.stderr.toString().slice(0, 500)}`,
          ),
        )
        return
      }
      res(result)
    })
  })
}
