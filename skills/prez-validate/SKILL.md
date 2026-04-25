---
name: prez-validate
description: Visually validate prez slides by generating screenshots and diffing them against a baseline. Use after editing slides.tsx to confirm slides render correctly.
metadata:
  author: Enriquefft
  version: "1.0.0"
  argument-hint: "optional slide number, --diff <baseline>, --json for NDJSON"
---

# prez-validate — Visual validation for prez slides

Use this skill after editing `src/slides.tsx` to visually confirm slides render correctly. TypeScript and builds can't catch overflow, clipping, contrast problems, overlapping elements, or broken images — screenshots can.

**Slide numbering:** 1-based externally everywhere. See `skills/prez/SKILL.md#slide-numbering-convention`.

**Global flags (`-h` / `--help` / `-V` / `--version`):** shared across every `prez-*` CLI. See `skills/prez/SKILL.md#global-cli-flags`.

## Prerequisites

`bunx prez-validate` resolves `@enriquefft/prez` from the nearest `package.json`. If you don't have a deck yet, scaffold one with `bunx @enriquefft/prez init` — that adds the package as a dependency and installs all three prez skills via the `skills` CLI.

If you arrived here via `bunx skills add Enriquefft/prez` (skills-first flow), continue with `bunx @enriquefft/prez init` from the project root — re-running it is idempotent (skills CLI re-symlinks the same source).

## When to use

- After any non-trivial change to `src/slides.tsx`
- When the user reports a layout issue
- Before the user presents
- As the "has anything changed visually?" gate in an agent review loop (pair with `--diff`)
- After any image change from `prez-image` — image swaps are a common visual-regression class

## How it works

1. Run `bunx prez-validate` (or `bunx prez-validate --slide N` for one slide, 1-based)
2. The CLI builds if needed, serves `dist/` on a temp port, screenshots each slide to `./screenshots/slide-NN.png`
3. Optionally diffs against a baseline directory; writes `diff-NN.png` heatmaps for failing slides
4. Read each PNG with the Read tool (multimodal) and report per-slide findings

Screenshots default to `./screenshots/` relative to cwd (override with `-o <dir>`). When run from the deck root, they land at `./screenshots/slide-NN.png`.

## Commands

| Flag | Purpose |
| --- | --- |
| `--slide <n>` | Screenshot only slide `n` (1-based) |
| `-o, --output <dir>` | Output directory (default `./screenshots`) |
| `--url <url>` | Validate against a running server; skip auto-serve |
| `--build` | Run `build` before validating (use when `dist/` is stale) |
| `--base <path>` | Base URL path override (auto-detected from `vite.config`) |
| `--timeout <ms>` | Per-slide Chrome timeout (default `30000`) |
| `--clean` | Wipe existing `slide-*.png` / `diff-*.png` first |
| `--json` | Emit one NDJSON `ValidateEvent` per line to stdout |
| `--json-manifest` | **Legacy** — do not use in new agent pipelines. Kept for v1.1 compat only. Mutually exclusive with `--json`. |
| `--concurrency <n>` | Parallel workers (default `min(cpus, 8)`, clamp `[1, 16]`) |
| `--diff <baseline>` | Compare each screenshot to `<baseline>/slide-NN.png` |
| `--threshold <ratio>` | Max diff ratio before a slide fails (default `0.005`) |
| `--watch` | Re-capture on `src/` changes; **requires `--build`** |
| `--chrome-path <path>` | Override Chrome binary (else auto-detect) |

`--watch` requires `--build`; running `--watch` alone exits with code 2 and the message `--watch requires --build`.

Default `--concurrency` is `min(cpus, 8)`. Drop to `1` only when debugging flaky captures; the parallel and sequential paths produce byte-identical output.

## Exit codes

- `0` — all slides captured; (diff mode) all below threshold
- `1` — capture failure
- `2` — diff mode: at least one slide exceeded threshold, OR bad flags (e.g. `--watch` without `--build`, `--json` combined with `--json-manifest`)

## NDJSON event stream (`--json`)

One line per `ValidateEvent`, parseable with `jq -c .`. Typical shape:

```
{"type":"start","totalSlides":4,"outputDir":"/abs/screenshots","url":"http://127.0.0.1:xxxx/","mode":"diff"}
{"type":"slide","slide":1,"path":"/abs/screenshots/slide-01.png","durationMs":842}
{"type":"diff","slide":1,"baseline":"/abs/baseline/slide-01.png","current":"/abs/screenshots/slide-01.png","diffPath":null,"diffRatio":0.0003,"pass":true}
{"type":"diff","slide":2,"baseline":"/abs/baseline/slide-02.png","current":"/abs/screenshots/slide-02.png","diffPath":"/abs/screenshots/diff-02.png","diffRatio":0.0421,"pass":false}
{"type":"done","outputDir":"/abs/screenshots","slidesValidated":4,"durationMs":3521,"diffFailures":0}
```

`diffPath` is `null` on passing slides (no heatmap is written) and an absolute path on failing slides. Don't `stat(diffPath)` unconditionally.

Other event types: `warn` (non-fatal), `error` (per-slide capture failure).

NDJSON order is the stream — don't pipe `--json` output through any tool that reorders lines (e.g. `sort`). Use `jq -c .` to parse, `tee events.ndjson` to archive.

## Agent review loop

1. Before edits: `bunx prez-validate && cp -r screenshots baseline`
2. Edit `src/slides.tsx`
3. `bunx prez-validate --diff baseline/ --json | tee events.ndjson`
4. If exit code is 2, read each `diff-NN.png` heatmap — red pixels mark the region that changed. Act on the failures.
5. If the changes are intentional, `rm -rf baseline && cp -r screenshots baseline` to adopt the new baseline.
6. Once validation passes, export with `bunx prez-export` (see `skills/prez/SKILL.md#export`).

## Programmatic API

Import from `@enriquefft/prez/node`. Full surface:

```ts
import {
  // Orchestrators
  validateScreenshots,
  screenshotSlides,
  // Primitives
  ChromeBrowser,
  ChromeSession,
  ChromeCdpError,
  diffPng,
  safeCleanScreenshotsDir,
  // Render-mode URL helpers
  screenshotUrl,
  printUrl,
  presenterUrl,
  parseRenderMode,
  // Branded slide-index helpers
  toInternal,
  toExternal,
  asExternal,
  asInternal,
  assertValidExternal,
} from '@enriquefft/prez/node'
import type {
  ValidateOptions,
  ValidateManifest,
  ValidateEvent,
  ParallelScreenshotOptions,
  ParallelScreenshotResult,
  DiffOptions,
  DiffResult,
  SafeCleanReport,
  ExternalSlideNumber,
  InternalSlideIndex,
  RenderMode,
  ChromeLaunchOptions,
  ScreenshotOptions,
} from '@enriquefft/prez/node'

const manifest = await validateScreenshots({
  url: 'http://localhost:5173',
  outputDir: './screenshots',
  baseline: './baseline',
  diffThreshold: 0.005,
  concurrency: 4,
  onEvent: (e) => console.log(JSON.stringify(e)),
})
// manifest.diffs: [{ slide, diffRatio, pass, diffPath, ... }]
```

Key types:
- `ExternalSlideNumber` / `InternalSlideIndex` — branded-number types enforcing 1-based vs. 0-based at the type level
- `ValidateEvent` — NDJSON event union (same shape the CLI emits with `--json`)
- `DiffResult` — from `diffPng(bufferA, bufferB)`: `{ width, height, diffRatio, diffPng, differingPixels, totalPixels }`

Use `screenshotSlides` directly when you need a parallel capture pool without the full validate pipeline; use `safeCleanScreenshotsDir` before re-capturing to clear stale PNGs without nuking unrelated files.

## Requires

- A built `dist/` (or pass `--build`)
- System Chrome/Chromium (same as `prez-export`)

## What to look for in each screenshot / diff

- Text overflow or clipping past slide bounds (1280×720)
- Unreadable contrast (light text on light background, etc.)
- Broken/missing images (gray placeholder, 404 indicator)
- Overlapping elements that shouldn't overlap
- Misaligned grids, flex layouts, or absolute-positioned elements
- Empty slides (rendering failure or runtime error)
- Diff heatmap: red regions highlight pixel-level differences from the baseline

## Reporting format

Report actionable findings only — `Slide 3: title overflows right edge` beats `Slide 3 looks off`.

```
Slide 1: OK
Slide 2: OK
Slide 3: title "Product Launch" overflows right edge, reduce to text-6xl
Slide 4: OK
```

## Common mistakes

- **Don't run `--watch` without `--build`.** Exits with code 2 immediately.
- **Don't mix `--json` and `--json-manifest`.** They're mutually exclusive; `--json-manifest` is legacy and should not be used in new pipelines.
- **Don't reorder NDJSON output.** The stream's order is the reporting order — pipe through `jq -c .` or `tee`, not `sort`.
- **Don't assume `diffPath` is always a file.** It's `null` on passing slides; only `stat()` when `pass === false`.

## Companion skills

- `prez` — the engine, export pipeline, and slide-numbering SSOT (`skills/prez/SKILL.md`)
- `prez-image` — generate and search for images (`skills/prez-image/SKILL.md`). Re-run `prez-validate --diff baseline/` after any image change.
