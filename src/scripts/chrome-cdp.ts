/**
 * Minimal Chrome DevTools Protocol client.
 *
 * One file, one philosophy: drive a single Chrome process over JSON-RPC on
 * the native Node 22+ `WebSocket` global. N tabs share one browser via flat
 * sessions (`Target.attachToTarget { flatten: true }` + `sessionId` on
 * every session-scoped command), so a pool of `ChromeSession`s never pays
 * the cost of N Chrome processes — the point of this engine.
 *
 * Public surface: `ChromeBrowser`, `ChromeSession`, `ChromeCdpError` and
 * their option types. Everything else is private.
 *
 * Error policy: this layer is primitive — one screenshot, one clear outcome.
 * Every failure throws `ChromeCdpError` with a `stage` field so callers
 * (the parallel pool, the validate CLI) can discriminate without string
 * matching. No retries are attempted here; retry strategy lives in the pool.
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { get as httpGet } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface ChromeLaunchOptions {
  chromePath: string
  /** Milliseconds allotted for Chrome to write DevToolsActivePort. Default 15000. */
  timeout?: number
  /** Custom user-data-dir. If omitted, a fresh tmpdir is created and cleaned up on close(). */
  userDataDir?: string
  /** Extra args forwarded to the Chrome process (e.g. `['--proxy-server=...']`). */
  extraArgs?: string[]
}

export interface ScreenshotOptions {
  width: number
  height: number
  deviceScaleFactor?: number
  /** Per-navigation wall-clock timeout in ms. Default 30000. */
  timeout?: number
  /** Load gate. `'load'` waits for `Page.loadEventFired`; `'networkIdle'` waits for the matching lifecycle event. Default `'load'`. */
  waitFor?: 'load' | 'networkIdle'
}

export interface ChromeVersionInfo {
  browser: string
  protocolVersion: string
  product: string
}

type CdpStage =
  | 'launch'
  | 'newSession'
  | 'navigate'
  | 'loadEvent'
  | 'capture'
  | 'write'
  | 'close'

export class ChromeCdpError extends Error {
  readonly stage: CdpStage
  readonly cdpCode?: number
  readonly cdpMessage?: string

  constructor(args: {
    stage: CdpStage
    message: string
    cdpCode?: number
    cdpMessage?: string
    cause?: unknown
  }) {
    super(
      args.message,
      args.cause === undefined ? undefined : { cause: args.cause },
    )
    this.name = 'ChromeCdpError'
    this.stage = args.stage
    this.cdpCode = args.cdpCode
    this.cdpMessage = args.cdpMessage
  }
}

interface CdpResponse {
  id?: number
  sessionId?: string
  method?: string
  params?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: { code: number; message: string }
}

interface PendingCall {
  resolve: (value: Record<string, unknown>) => void
  reject: (err: Error) => void
}

/** Bridge between `WebSocket` and typed JSON-RPC calls. */
class CdpConnection {
  private readonly ws: WebSocket
  private nextId = 1
  private readonly pending = new Map<number, PendingCall>()
  private readonly sessionListeners = new Map<
    string,
    Map<string, Set<(params: Record<string, unknown>) => void>>
  >()
  private readonly browserListeners = new Map<
    string,
    Set<(params: Record<string, unknown>) => void>
  >()
  private closed = false
  private closeError: Error | null = null
  private readonly closeWaiters = new Set<() => void>()

  constructor(ws: WebSocket) {
    this.ws = ws
    ws.addEventListener('message', (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : ''
      if (!raw) return
      let msg: CdpResponse
      try {
        msg = JSON.parse(raw) as CdpResponse
      } catch {
        return
      }
      this.dispatch(msg)
    })
    ws.addEventListener('close', () => this.handleClose(null))
    ws.addEventListener('error', () => {
      this.handleClose(new Error('WebSocket connection error'))
    })
  }

  private dispatch(msg: CdpResponse): void {
    if (typeof msg.id === 'number') {
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if (msg.error) {
        pending.reject(
          new ChromeCdpError({
            stage: 'capture',
            message: `CDP error ${msg.error.code}: ${msg.error.message}`,
            cdpCode: msg.error.code,
            cdpMessage: msg.error.message,
          }),
        )
        return
      }
      pending.resolve(msg.result ?? {})
      return
    }
    if (typeof msg.method !== 'string') return
    const params = msg.params ?? {}
    if (typeof msg.sessionId === 'string') {
      const byMethod = this.sessionListeners.get(msg.sessionId)
      const listeners = byMethod?.get(msg.method)
      if (listeners) for (const fn of listeners) fn(params)
      return
    }
    const listeners = this.browserListeners.get(msg.method)
    if (listeners) for (const fn of listeners) fn(params)
  }

  private handleClose(err: Error | null): void {
    if (this.closed) return
    this.closed = true
    this.closeError =
      err ?? new Error('WebSocket connection closed unexpectedly')
    const closeErr = this.closeError
    for (const [, p] of this.pending) p.reject(closeErr)
    this.pending.clear()
    for (const w of this.closeWaiters) w()
    this.closeWaiters.clear()
  }

  isClosed(): boolean {
    return this.closed
  }

  send(
    method: string,
    params: Record<string, unknown>,
    sessionId: string | undefined,
    timeoutMs: number,
    stage: CdpStage,
  ): Promise<Record<string, unknown>> {
    if (this.closed) {
      return Promise.reject(
        new ChromeCdpError({
          stage,
          message: `CDP connection is closed (cannot send ${method})`,
          cause: this.closeError ?? undefined,
        }),
      )
    }
    const id = this.nextId++
    const payload: Record<string, unknown> = { id, method, params }
    if (sessionId !== undefined) payload.sessionId = sessionId
    const frame = JSON.stringify(payload)

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(
            new ChromeCdpError({
              stage,
              message: `CDP call ${method} timed out after ${timeoutMs}ms`,
            }),
          )
        }
      }, timeoutMs)

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (err) => {
          clearTimeout(timer)
          if (err instanceof ChromeCdpError && err.stage === 'capture') {
            reject(
              new ChromeCdpError({
                stage,
                message: err.message,
                cdpCode: err.cdpCode,
                cdpMessage: err.cdpMessage,
              }),
            )
            return
          }
          reject(err)
        },
      })

      try {
        this.ws.send(frame)
      } catch (sendErr) {
        if (this.pending.delete(id)) {
          clearTimeout(timer)
          reject(
            new ChromeCdpError({
              stage,
              message: `Failed to send ${method}: ${
                sendErr instanceof Error ? sendErr.message : String(sendErr)
              }`,
              cause: sendErr,
            }),
          )
        }
      }
    })
  }

  onSessionEvent(
    sessionId: string,
    method: string,
    listener: (params: Record<string, unknown>) => void,
  ): () => void {
    const existingByMethod = this.sessionListeners.get(sessionId)
    const byMethod = existingByMethod ?? new Map()
    if (!existingByMethod) this.sessionListeners.set(sessionId, byMethod)
    const existingSet = byMethod.get(method)
    const set = existingSet ?? new Set()
    if (!existingSet) byMethod.set(method, set)
    set.add(listener)
    return () => {
      set.delete(listener)
      if (set.size === 0) byMethod.delete(method)
      if (byMethod.size === 0) this.sessionListeners.delete(sessionId)
    }
  }

  forgetSession(sessionId: string): void {
    this.sessionListeners.delete(sessionId)
  }

  async close(): Promise<void> {
    if (this.closed) return
    if (
      this.ws.readyState === WebSocket.CLOSED ||
      this.ws.readyState === WebSocket.CLOSING
    ) {
      if (!this.closed) await this.waitForClose()
      return
    }
    const waiter = this.waitForClose()
    try {
      this.ws.close()
    } catch {
      this.handleClose(null)
    }
    await waiter
  }

  private waitForClose(): Promise<void> {
    if (this.closed) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.closeWaiters.add(resolve)
    })
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readDevToolsPort(
  userDataDir: string,
  timeoutMs: number,
  chromeProc: ChildProcess,
): Promise<number> {
  const deadline = Date.now() + timeoutMs
  const portFile = join(userDataDir, 'DevToolsActivePort')
  let lastErr: unknown
  while (Date.now() < deadline) {
    if (chromeProc.exitCode !== null) {
      throw new ChromeCdpError({
        stage: 'launch',
        message: `Chrome exited before opening the debug port (code ${chromeProc.exitCode})`,
      })
    }
    try {
      const raw = await readFile(portFile, 'utf-8')
      const firstLine = raw.split('\n', 1)[0]?.trim() ?? ''
      const port = Number(firstLine)
      if (Number.isInteger(port) && port > 0) return port
    } catch (err) {
      lastErr = err
    }
    await sleep(50)
  }
  throw new ChromeCdpError({
    stage: 'launch',
    message: `Timed out after ${timeoutMs}ms waiting for Chrome DevToolsActivePort at ${portFile}`,
    cause: lastErr,
  })
}

interface VersionJson {
  Browser?: string
  'Protocol-Version'?: string
  Product?: string
  webSocketDebuggerUrl?: string
}

/**
 * Hand-rolled HTTP GET → JSON using `node:http`. Bypasses any global
 * `fetch` the runtime may have replaced (e.g. happy-dom during tests)
 * and stays dependency-free. The endpoint is always loopback, the body
 * is small, and we need deterministic Node-level behavior.
 */
async function fetchVersionJson(
  port: number,
  timeoutMs: number,
): Promise<VersionJson> {
  return new Promise((resolve, reject) => {
    const req = httpGet(
      {
        host: '127.0.0.1',
        port,
        path: '/json/version',
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode === undefined || res.statusCode >= 400) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode ?? '???'}`))
          return
        }
        res.setEncoding('utf-8')
        let body = ''
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as VersionJson)
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        })
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(
        new Error(`HTTP GET /json/version timed out after ${timeoutMs}ms`),
      )
    })
  })
}

async function openWebSocket(
  url: string,
  timeoutMs: number,
): Promise<WebSocket> {
  const ws = new WebSocket(url)
  return new Promise<WebSocket>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('open', onOpen)
      ws.removeEventListener('error', onError)
      try {
        ws.close()
      } catch {
        /* swallow */
      }
      reject(
        new ChromeCdpError({
          stage: 'launch',
          message: `Timed out after ${timeoutMs}ms connecting to ${url}`,
        }),
      )
    }, timeoutMs)
    const onOpen = (): void => {
      clearTimeout(timer)
      ws.removeEventListener('error', onError)
      resolve(ws)
    }
    const onError = (): void => {
      clearTimeout(timer)
      ws.removeEventListener('open', onOpen)
      reject(
        new ChromeCdpError({
          stage: 'launch',
          message: `Failed to open WebSocket to ${url}`,
        }),
      )
    }
    ws.addEventListener('open', onOpen, { once: true })
    ws.addEventListener('error', onError, { once: true })
  })
}

async function killProcess(proc: ChildProcess): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return
  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve())
  })
  proc.kill('SIGTERM')
  const killed = await Promise.race([
    exited.then(() => true),
    sleep(5000).then(() => false),
  ])
  if (!killed && proc.exitCode === null && proc.signalCode === null) {
    proc.kill('SIGKILL')
    await exited
  }
}

export class ChromeBrowser {
  readonly version: ChromeVersionInfo
  private readonly proc: ChildProcess
  private readonly connection: CdpConnection
  private readonly userDataDir: string
  private readonly ownsUserDataDir: boolean
  private readonly sessions = new Set<ChromeSession>()
  private closed = false
  private closing: Promise<void> | null = null

  private constructor(args: {
    proc: ChildProcess
    connection: CdpConnection
    userDataDir: string
    ownsUserDataDir: boolean
    version: ChromeVersionInfo
  }) {
    this.proc = args.proc
    this.connection = args.connection
    this.userDataDir = args.userDataDir
    this.ownsUserDataDir = args.ownsUserDataDir
    this.version = args.version
  }

  static async launch(opts: ChromeLaunchOptions): Promise<ChromeBrowser> {
    const timeout = opts.timeout ?? 15000
    const ownsUserDataDir = opts.userDataDir === undefined
    const userDataDir =
      opts.userDataDir ?? (await mkdtemp(join(tmpdir(), 'prez-cdp-')))
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      ...(opts.extraArgs ?? []),
      'about:blank',
    ]

    let proc: ChildProcess
    try {
      proc = spawn(opts.chromePath, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
    } catch (err) {
      if (ownsUserDataDir) {
        await rm(userDataDir, { recursive: true, force: true })
      }
      throw new ChromeCdpError({
        stage: 'launch',
        message: `Failed to spawn Chrome at ${opts.chromePath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        cause: err,
      })
    }

    const spawnError = new Promise<never>((_, reject) => {
      proc.once('error', (err) =>
        reject(
          new ChromeCdpError({
            stage: 'launch',
            message: `Chrome process error: ${err.message}`,
            cause: err,
          }),
        ),
      )
    })

    let port: number
    try {
      port = await Promise.race([
        readDevToolsPort(userDataDir, timeout, proc),
        spawnError,
      ])
    } catch (err) {
      await killProcess(proc)
      if (ownsUserDataDir) {
        await rm(userDataDir, { recursive: true, force: true })
      }
      throw err
    }

    let version: ChromeVersionInfo
    let wsUrl: string
    try {
      const json = await fetchVersionJson(port, timeout)
      if (typeof json.webSocketDebuggerUrl !== 'string') {
        throw new Error('missing webSocketDebuggerUrl in /json/version')
      }
      wsUrl = json.webSocketDebuggerUrl
      version = {
        browser: json.Browser ?? '',
        protocolVersion: json['Protocol-Version'] ?? '',
        product: json.Product ?? '',
      }
    } catch (err) {
      await killProcess(proc)
      if (ownsUserDataDir) {
        await rm(userDataDir, { recursive: true, force: true })
      }
      throw new ChromeCdpError({
        stage: 'launch',
        message: `Failed to fetch Chrome version metadata: ${
          err instanceof Error ? err.message : String(err)
        }`,
        cause: err,
      })
    }

    let ws: WebSocket
    try {
      ws = await openWebSocket(wsUrl, timeout)
    } catch (err) {
      await killProcess(proc)
      if (ownsUserDataDir) {
        await rm(userDataDir, { recursive: true, force: true })
      }
      throw err
    }

    const connection = new CdpConnection(ws)
    return new ChromeBrowser({
      proc,
      connection,
      userDataDir,
      ownsUserDataDir,
      version,
    })
  }

  /** Open a fresh tab (target) and attach to it in flat-session mode. */
  async newSession(): Promise<ChromeSession> {
    if (this.closed) {
      throw new ChromeCdpError({
        stage: 'newSession',
        message: 'ChromeBrowser is closed',
      })
    }
    let createResult: Record<string, unknown>
    try {
      createResult = await this.connection.send(
        'Target.createTarget',
        { url: 'about:blank' },
        undefined,
        15000,
        'newSession',
      )
    } catch (err) {
      if (err instanceof ChromeCdpError) throw err
      throw new ChromeCdpError({
        stage: 'newSession',
        message: `Target.createTarget failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        cause: err,
      })
    }
    const targetId = createResult.targetId
    if (typeof targetId !== 'string') {
      throw new ChromeCdpError({
        stage: 'newSession',
        message: 'Target.createTarget returned no targetId',
      })
    }

    let attachResult: Record<string, unknown>
    try {
      attachResult = await this.connection.send(
        'Target.attachToTarget',
        { targetId, flatten: true },
        undefined,
        15000,
        'newSession',
      )
    } catch (err) {
      // Best-effort close of the orphan target. Swallow its errors.
      try {
        await this.connection.send(
          'Target.closeTarget',
          { targetId },
          undefined,
          5000,
          'close',
        )
      } catch {
        /* ignore */
      }
      if (err instanceof ChromeCdpError) throw err
      throw new ChromeCdpError({
        stage: 'newSession',
        message: `Target.attachToTarget failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        cause: err,
      })
    }
    const sessionId = attachResult.sessionId
    if (typeof sessionId !== 'string') {
      throw new ChromeCdpError({
        stage: 'newSession',
        message: 'Target.attachToTarget returned no sessionId',
      })
    }

    const session = new ChromeSession({
      connection: this.connection,
      targetId,
      sessionId,
      onClose: (s) => {
        this.sessions.delete(s)
      },
    })
    this.sessions.add(session)
    return session
  }

  async close(): Promise<void> {
    if (this.closing) return this.closing
    this.closing = this.doClose()
    return this.closing
  }

  private async doClose(): Promise<void> {
    if (this.closed) return
    this.closed = true
    const sessions = [...this.sessions]
    this.sessions.clear()
    for (const s of sessions) {
      try {
        await s.close()
      } catch {
        /* best-effort */
      }
    }
    try {
      await this.connection.close()
    } catch {
      /* best-effort */
    }
    await killProcess(this.proc)
    if (this.ownsUserDataDir) {
      await rm(this.userDataDir, { recursive: true, force: true })
    }
  }
}

export class ChromeSession {
  readonly targetId: string
  private readonly connection: CdpConnection
  private readonly sessionId: string
  private readonly onClose: (s: ChromeSession) => void
  private pageEnabled = false
  private networkIdleEnabled = false
  private closed = false
  private closing: Promise<void> | null = null

  constructor(args: {
    connection: CdpConnection
    targetId: string
    sessionId: string
    onClose: (s: ChromeSession) => void
  }) {
    this.connection = args.connection
    this.targetId = args.targetId
    this.sessionId = args.sessionId
    this.onClose = args.onClose
  }

  async screenshot(
    url: string,
    outPath: string,
    opts?: Partial<ScreenshotOptions>,
  ): Promise<void> {
    if (this.closed) {
      throw new ChromeCdpError({
        stage: 'capture',
        message: 'ChromeSession is closed',
      })
    }
    const width = opts?.width ?? 1280
    const height = opts?.height ?? 720
    const deviceScaleFactor = opts?.deviceScaleFactor ?? 1
    const timeout = opts?.timeout ?? 30000
    const waitFor: 'load' | 'networkIdle' = opts?.waitFor ?? 'load'

    if (!this.pageEnabled) {
      await this.send('Page.enable', {}, 15000, 'navigate')
      this.pageEnabled = true
    }
    if (waitFor === 'networkIdle' && !this.networkIdleEnabled) {
      await this.send(
        'Page.setLifecycleEventsEnabled',
        { enabled: true },
        15000,
        'navigate',
      )
      this.networkIdleEnabled = true
    }

    await this.send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor, mobile: false },
      15000,
      'navigate',
    )

    const loadGate = this.waitForLoad(waitFor, timeout)
    try {
      await this.send('Page.navigate', { url }, timeout, 'navigate')
    } catch (err) {
      loadGate.cancel()
      throw err
    }
    await loadGate.promise

    let shotResult: Record<string, unknown>
    try {
      shotResult = await this.send(
        'Page.captureScreenshot',
        { format: 'png' },
        timeout,
        'capture',
      )
    } catch (err) {
      if (err instanceof ChromeCdpError) {
        throw new ChromeCdpError({
          stage: 'capture',
          message: err.message,
          cdpCode: err.cdpCode,
          cdpMessage: err.cdpMessage,
          cause: err,
        })
      }
      throw err
    }
    const data = shotResult.data
    if (typeof data !== 'string') {
      throw new ChromeCdpError({
        stage: 'capture',
        message: 'Page.captureScreenshot returned no data',
      })
    }
    const buf = Buffer.from(data, 'base64')
    try {
      await writeFile(outPath, buf)
    } catch (err) {
      throw new ChromeCdpError({
        stage: 'write',
        message: `Failed to write screenshot to ${outPath}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        cause: err,
      })
    }
  }

  private waitForLoad(
    waitFor: 'load' | 'networkIdle',
    timeoutMs: number,
  ): { promise: Promise<void>; cancel: () => void } {
    let unsubscribe: (() => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let settled = false
    const promise = new Promise<void>((resolve, reject) => {
      const finish = (err: Error | null): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (unsubscribe) unsubscribe()
        if (err) reject(err)
        else resolve()
      }
      timer = setTimeout(() => {
        finish(
          new ChromeCdpError({
            stage: 'loadEvent',
            message: `Timed out after ${timeoutMs}ms waiting for ${
              waitFor === 'networkIdle' ? 'networkIdle' : 'load'
            } event`,
          }),
        )
      }, timeoutMs)
      if (waitFor === 'load') {
        unsubscribe = this.connection.onSessionEvent(
          this.sessionId,
          'Page.loadEventFired',
          () => finish(null),
        )
      } else {
        unsubscribe = this.connection.onSessionEvent(
          this.sessionId,
          'Page.lifecycleEvent',
          (params) => {
            if (params.name === 'networkIdle') finish(null)
          },
        )
      }
    })
    return {
      promise,
      cancel: () => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (unsubscribe) unsubscribe()
      },
    }
  }

  async close(): Promise<void> {
    if (this.closing) return this.closing
    this.closing = this.doClose()
    return this.closing
  }

  private async doClose(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.connection.forgetSession(this.sessionId)
    this.onClose(this)
    if (!this.connection.isClosed()) {
      try {
        await this.connection.send(
          'Target.closeTarget',
          { targetId: this.targetId },
          undefined,
          5000,
          'close',
        )
      } catch {
        /* best-effort */
      }
    }
  }

  private async send(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    stage: CdpStage,
  ): Promise<Record<string, unknown>> {
    return this.connection.send(
      method,
      params,
      this.sessionId,
      timeoutMs,
      stage,
    )
  }
}
