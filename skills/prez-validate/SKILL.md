---
name: prez-validate
description: Visually validate prez slides by generating screenshots and diffing them against a baseline. Use after editing slides.tsx to confirm slides render correctly.
metadata:
  author: Enriquefft
  version: "0.2.0"
  argument-hint: "optional slide number, --diff <baseline>, --json for NDJSON"
---

# prez-validate — Visual validation for prez slides

Use this skill after editing `src/slides.tsx` to visually confirm slides render correctly. TypeScript and builds can't catch overflow, clipping, contrast problems, overlapping elements, or broken images — screenshots can.

## When to use

- After any non-trivial change to `src/slides.tsx`
- When the user reports a layout issue
- Before the user presents
- As the "has anything changed visually?" gate in an agent review loop (pair with `--diff`)

## How it works

1. Run `bunx prez-validate` (or `bunx prez-validate --slide N` for one slide)
2. The CLI builds if needed, serves `dist/` on a temp port, screenshots each slide to `./screenshots/slide-NN.png`
3. Optionally diffs against a baseline directory; writes `diff-NN.png` heatmaps for failing slides
4. Read each PNG with the Read tool (multimodal) and report per-slide findings

Screenshots land next to `src/slides.tsx` so multiple decks don't collide.

## Commands

- `bunx prez-validate` — screenshot every slide
- `bunx prez-validate --slide 3` — screenshot only slide 3 (1-based)
- `bunx prez-validate --build` — build first (use when `dist/` is stale)
- `bunx prez-validate --clean` — wipe `slide-*.png` / `diff-*.png` first
- `bunx prez-validate --json` — emit NDJSON `ValidateEvent`s to stdout
- `bunx prez-validate --json-manifest` — legacy single-blob JSON (deprecated)
- `bunx prez-validate --concurrency 4` — 4 parallel workers
- `bunx prez-validate --diff baseline/` — diff vs `baseline/slide-NN.png`
- `bunx prez-validate --threshold 0.01` — max diff ratio (default 0.005)
- `bunx prez-validate --watch --build` — re-capture on `src/` changes

## Exit codes

- `0` — all slides captured; (diff mode) all below threshold
- `1` — capture failure
- `2` — diff mode: at least one slide exceeded threshold, OR bad flags

## NDJSON event stream (`--json`)

One line per `ValidateEvent`, parseable with `jq -c .`. Typical shape:

```
{"type":"start","totalSlides":4,"outputDir":"/abs/screenshots","url":"http://127.0.0.1:xxxx/","mode":"diff"}
{"type":"slide","slide":1,"path":"/abs/screenshots/slide-01.png","durationMs":842}
{"type":"diff","slide":1,"baseline":"/abs/baseline/slide-01.png","current":"/abs/screenshots/slide-01.png","diffPath":"/abs/screenshots/diff-01.png","diffRatio":0.0003,"pass":true}
{"type":"done","outputDir":"/abs/screenshots","slidesValidated":4,"durationMs":3521,"diffFailures":0}
```

Other event types: `warn` (non-fatal), `error` (per-slide capture failure).

## Agent review loop

1. Before edits: `bunx prez-validate && cp -r screenshots baseline`
2. Edit `src/slides.tsx`
3. `bunx prez-validate --diff baseline/ --json | tee events.ndjson`
4. If exit code is 2, read each `diff-NN.png` heatmap — red pixels mark the region that changed. Act on the failures.
5. If the changes are intentional, `rm -rf baseline && cp -r screenshots baseline` to adopt the new baseline.

## Programmatic API

```ts
import { validateScreenshots, diffPng } from '@enriquefft/prez/node'

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

## Slide numbering

Every CLI flag, JSON field, and log message uses 1-based slide numbers
(slide 1 is the first slide). Internal URL hashes use 0-based indices
(e.g. `#/0` is slide 1), but this is never exposed through the CLI.
