import { execSync } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import type { Server } from 'node:http'
import { cpus } from 'node:os'
import { relative, resolve } from 'node:path'
import type { ValidateEvent } from '../node.js'
import {
  detectBasePath,
  detectPackageManager,
  startStaticServer,
  waitForServer,
} from '../scripts/serve-dist.js'
import type { ValidateManifest } from '../scripts/validate-screenshots.js'
import { validateScreenshots } from '../scripts/validate-screenshots.js'
import { SLIDE_INDEX_DOCS } from '../slide-index.js'
import { die, type HelpSpec, handleGlobalFlags, warn } from './_cli-kit.js'

const VALIDATE_HELP_SPEC: HelpSpec = {
  name: 'prez-validate',
  summary: 'Screenshot, diff, and watch prez slides for visual validation',
  usage: ['prez-validate [options]'],
  sections: [
    {
      title: 'Options',
      rows: [
        ['--slide <n>', 'Validate only slide n (1-based)'],
        ['-o, --output <dir>', 'Output directory (default: ./screenshots)'],
        ['--url <url>', 'URL of running server (skip auto-serve)'],
        ['--build', 'Run build before validating'],
        ['--base <path>', 'Base URL path override (auto-detected from vite)'],
        ['--timeout <ms>', 'Per-slide Chrome timeout (default: 30000)'],
        ['--clean', 'Remove existing slide-*.png and diff-*.png first'],
        ['--json', 'Emit one NDJSON ValidateEvent per line to stdout'],
        [
          '--json-manifest',
          'Legacy: emit a single final JSON manifest (deprecated)',
        ],
        [
          '--concurrency <n>',
          'Parallel workers (default: min(cpus, 8), clamp [1, 16])',
        ],
        [
          '--diff <baseline-dir>',
          'Compare each screenshot to <baseline>/slide-NN.png',
        ],
        [
          '--threshold <ratio>',
          'Max diff ratio before a slide fails (default: 0.005)',
        ],
        ['--watch', 'Re-capture on src/ changes (requires --build)'],
        ['--chrome-path <path>', 'Override Chrome binary (else getChrome())'],
        ['-h, --help', 'Show this help and exit'],
        ['-V, --version', 'Print version and exit'],
      ],
    },
    {
      title: 'Examples',
      rows: [
        ['prez-validate', 'Screenshot every slide to ./screenshots/'],
        ['prez-validate --slide 3', 'Screenshot only slide 3 (1-based)'],
        ['prez-validate --build', 'Build first, then validate'],
        ['prez-validate --json', 'Stream NDJSON events (agent mode)'],
        [
          'prez-validate --diff baseline/',
          'Diff against baseline/; exit 2 on failure',
        ],
        ['prez-validate --concurrency 4', 'Capture 4 slides at a time'],
        ['prez-validate --watch --build', 'Re-capture on src/ changes'],
      ],
    },
  ],
  footer: SLIDE_INDEX_DOCS,
}

export interface ValidateArgs {
  slide?: number
  output: string
  url?: string
  build: boolean
  base?: string
  timeout: number
  clean: boolean
  json: boolean
  jsonManifest: boolean
  concurrency: number
  diff?: string
  threshold: number
  watch: boolean
  chromePath?: string
}

function defaultConcurrency(): number {
  const raw = cpus().length || 1
  return Math.max(1, Math.min(raw, 8))
}

function clampConcurrency(n: number): number {
  return Math.max(1, Math.min(16, n))
}

function parsePositiveInt(raw: string | undefined, flag: string): number {
  if (raw === undefined) die(`Error: ${flag} requires a value`)
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1) {
    die(`Error: ${flag} requires a positive integer, got '${raw}'`)
  }
  return n
}

function parseRatio(raw: string | undefined, flag: string): number {
  if (raw === undefined) die(`Error: ${flag} requires a value`)
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    die(`Error: ${flag} requires a number in [0, 1], got '${raw}'`)
  }
  return n
}

/**
 * Pure argv parser. Exported for unit tests. Global flags
 * (`--help` / `--version`) are acknowledged silently here because
 * `handleGlobalFlags` exits before this function runs.
 */
export function parseValidateArgs(argv: string[]): ValidateArgs {
  const args = argv.slice(2)

  let slide: number | undefined
  let output = './screenshots'
  let url: string | undefined
  let build = false
  let base: string | undefined
  let timeout = 30000
  let clean = false
  let json = false
  let jsonManifest = false
  let concurrency = defaultConcurrency()
  let diff: string | undefined
  let threshold = 0.005
  let watchFlag = false
  let chromePath: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--slide':
        slide = parsePositiveInt(args[++i], '--slide')
        break
      case '-o':
      case '--output':
        if (args[i + 1] === undefined) die(`Error: ${arg} requires a value`)
        output = args[++i]
        break
      case '--url':
        if (args[i + 1] === undefined) die('Error: --url requires a value')
        url = args[++i]
        break
      case '--build':
        build = true
        break
      case '--base':
        if (args[i + 1] === undefined) die('Error: --base requires a value')
        base = args[++i]
        break
      case '--timeout':
        timeout = parsePositiveInt(args[++i], '--timeout')
        break
      case '--clean':
        clean = true
        break
      case '--json':
        json = true
        break
      case '--json-manifest':
        jsonManifest = true
        break
      case '--concurrency':
        concurrency = clampConcurrency(
          parsePositiveInt(args[++i], '--concurrency'),
        )
        break
      case '--diff':
        if (args[i + 1] === undefined) die('Error: --diff requires a value')
        diff = args[++i]
        break
      case '--threshold':
        threshold = parseRatio(args[++i], '--threshold')
        break
      case '--watch':
        watchFlag = true
        break
      case '--chrome-path':
        if (args[i + 1] === undefined)
          die('Error: --chrome-path requires a value')
        chromePath = args[++i]
        break
      case '--help':
      case '-h':
      case '--version':
      case '-V':
        // Handled by handleGlobalFlags at main() entry.
        break
      default:
        die(`Error: unknown argument '${arg}' (see --help)`)
    }
  }

  if (json && jsonManifest) {
    die('Error: --json and --json-manifest are mutually exclusive', 2)
  }

  return {
    slide,
    output,
    url,
    build,
    base,
    timeout,
    clean,
    json,
    jsonManifest,
    concurrency,
    diff,
    threshold,
    watch: watchFlag,
    chromePath,
  }
}

function formatRatio(r: number): string {
  return `${(r * 100).toFixed(2)}%`
}

/**
 * Build the `onEvent` handler for a given run. Non-JSON mode produces
 * human-readable prose on stdout; JSON mode emits one NDJSON line per
 * event. The handler is the single point of I/O — the screenshot
 * engine and diff loop never print anything themselves.
 */
function buildEventHandler(args: ValidateArgs): {
  onEvent: (e: ValidateEvent) => void
  readDiffFailures: () => number
  readSlidesCaptured: () => number
} {
  let captured = 0
  let diffFailures = 0
  let totalSlides = 0

  const onEvent = (e: ValidateEvent): void => {
    if (args.json) {
      process.stdout.write(`${JSON.stringify(e)}\n`)
      return
    }
    switch (e.type) {
      case 'start':
        totalSlides = e.totalSlides
        console.log(
          `Capturing ${totalSlides} slide(s) to ${relative(process.cwd(), e.outputDir) || e.outputDir}${e.mode === 'diff' ? ' (diff mode)' : ''}`,
        )
        break
      case 'slide':
        captured++
        console.log(
          `Slide ${e.slide}${totalSlides ? `/${totalSlides}` : ''} captured in ${e.durationMs}ms`,
        )
        break
      case 'diff': {
        const label = e.pass ? 'pass' : 'FAIL'
        if (!e.pass) diffFailures++
        console.log(
          `Slide ${e.slide} diff: ${formatRatio(e.diffRatio)} ${label}`,
        )
        break
      }
      case 'warn':
        warn(
          `warn${e.slide !== undefined ? ` (slide ${e.slide})` : ''}: ${e.message}`,
        )
        break
      case 'error':
        warn(
          `error${e.slide !== undefined ? ` (slide ${e.slide})` : ''}: ${e.message}`,
        )
        break
      case 'done': {
        const diffNote =
          e.diffFailures > 0
            ? ` · ${e.diffFailures} diff failure${e.diffFailures === 1 ? '' : 's'}`
            : ''
        console.log(
          `Validated ${e.slidesValidated} slide(s) in ${e.durationMs}ms${diffNote}`,
        )
        break
      }
    }
  }

  // In JSON mode we still want to track the captured count and diff failures
  // from the events themselves, independently of the human-mode counters
  // above. Recompute from the raw event stream so both modes agree.
  const wrapped = (e: ValidateEvent): void => {
    if (args.json) {
      if (e.type === 'slide') captured++
      if (e.type === 'diff' && !e.pass) diffFailures++
    }
    onEvent(e)
  }

  return {
    onEvent: wrapped,
    readDiffFailures: () => diffFailures,
    readSlidesCaptured: () => captured,
  }
}

interface RunResources {
  server: Server | null
}

async function runOnce(
  args: ValidateArgs,
  serverUrl: string,
): Promise<{
  manifest: ValidateManifest
  diffFailures: number
}> {
  const handler = buildEventHandler(args)
  const manifest = await validateScreenshots({
    url: serverUrl,
    outputDir: resolve(process.cwd(), args.output),
    slide: args.slide,
    timeout: args.timeout,
    clean: args.clean,
    concurrency: args.concurrency,
    chromePath: args.chromePath,
    baseline: args.diff ? resolve(process.cwd(), args.diff) : undefined,
    diffThreshold: args.threshold,
    onEvent: handler.onEvent,
  })

  if (args.jsonManifest) {
    warn(
      'Notice: --json-manifest is deprecated; use --json for per-event NDJSON streaming.',
    )
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
  }

  return { manifest, diffFailures: handler.readDiffFailures() }
}

function runBuild(jsonMode: boolean): void {
  const pm = detectPackageManager()
  const buildCmd = pm === 'bun' ? 'bun run build' : `${pm} run build`
  if (!jsonMode) console.log(`Building with: ${buildCmd}`)
  execSync(buildCmd, {
    stdio: jsonMode ? 'pipe' : 'inherit',
    cwd: process.cwd(),
  })
}

async function ensureServer(
  args: ValidateArgs,
  resources: RunResources,
): Promise<string> {
  if (args.url) return args.url
  const distDir = resolve(process.cwd(), 'dist')
  if (!existsSync(distDir)) {
    die(
      'Error: dist/ not found.\n  Run "bun run build" first, or pass --build to build automatically.',
    )
  }
  const basePath = args.base || detectBasePath()
  if (!args.json) console.log(`Serving dist/ with base path: ${basePath}`)
  const result = await startStaticServer(distDir, basePath)
  resources.server = result.server
  if (!args.json) console.log(`Static server running at ${result.url}`)
  await waitForServer(result.url)
  return result.url
}

function stopServer(resources: RunResources): void {
  if (resources.server) {
    resources.server.closeAllConnections()
    resources.server.close()
    resources.server = null
  }
}

async function runWatch(args: ValidateArgs): Promise<never> {
  if (!args.build) {
    die('Error: --watch requires --build', 2)
  }
  const srcDir = resolve(process.cwd(), 'src')
  if (!existsSync(srcDir)) {
    die(`Error: --watch needs a src/ directory at ${srcDir}`, 2)
  }

  let pending: ReturnType<typeof setTimeout> | null = null
  let running = false
  let shuttingDown = false
  const resources: RunResources = { server: null }

  let serverUrl: string | null = null

  const cycle = async (): Promise<void> => {
    if (running || shuttingDown) return
    running = true
    try {
      runBuild(args.json)
      // Static server reads files on demand from dist/, so a fresh build
      // is visible without a restart of the server.
      if (serverUrl === null) {
        serverUrl = await ensureServer(args, resources)
      }
      await runOnce(args, serverUrl)
    } catch (err) {
      warn(
        `Validate cycle failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      running = false
    }
  }

  // First run — if this fails, we still enter watch mode; the user can fix
  // the build and re-save.
  await cycle()

  const watcher = watch(srcDir, { recursive: true }, () => {
    if (shuttingDown) return
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      void cycle()
    }, 500)
  })

  if (!args.json) {
    console.log(`Watching ${relative(process.cwd(), srcDir)}/ for changes...`)
  }

  const shutdown = (): void => {
    if (shuttingDown) return
    shuttingDown = true
    if (pending) clearTimeout(pending)
    try {
      watcher.close()
    } catch {
      /* best-effort */
    }
    stopServer(resources)
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Block the event loop forever; the SIGINT handler is the only exit.
  await new Promise(() => {})
  // Unreachable.
  process.exit(0)
}

async function main(): Promise<void> {
  handleGlobalFlags(process.argv, VALIDATE_HELP_SPEC)
  const args = parseValidateArgs(process.argv)

  if (args.watch) {
    // Watch mode has its own run loop + shutdown semantics.
    await runWatch(args)
    return
  }

  const resources: RunResources = { server: null }
  const shutdown = (signal: NodeJS.Signals): void => {
    stopServer(resources)
    // 128 + signal number convention: SIGINT = 2, SIGTERM = 15.
    const code = signal === 'SIGINT' ? 130 : 143
    process.exit(code)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  try {
    if (args.build) runBuild(args.json)
    const serverUrl = await ensureServer(args, resources)
    const { manifest, diffFailures } = await runOnce(args, serverUrl)

    if (!args.json && !args.jsonManifest) {
      // Final human summary was already printed by the 'done' handler;
      // also surface the per-file paths for convenience (the v1.1 behavior).
      if (args.diff === undefined) {
        const label = args.slide
          ? `slide ${args.slide}`
          : `${manifest.totalSlides} slide(s)`
        console.log(`\nValidated ${label}:`)
        for (const { path } of manifest.screenshots) {
          console.log(`  ${relative(process.cwd(), path)}`)
        }
      }
    }

    if (args.diff !== undefined && diffFailures > 0) {
      process.exit(2)
    }
  } finally {
    stopServer(resources)
  }
}

main().catch((err) => {
  die(`Validate failed: ${err instanceof Error ? err.message : String(err)}`)
})
