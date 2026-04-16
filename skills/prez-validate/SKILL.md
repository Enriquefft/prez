---
name: prez-validate
description: Visually validate prez slides by generating screenshots and inspecting them for layout or rendering issues. Use after editing slides.tsx to confirm slides render correctly.
metadata:
  author: Enriquefft
  version: "0.1.0"
  argument-hint: "optional slide number to validate one slide only"
---

# prez-validate — Visual validation for prez slides

Use this skill after editing `src/slides.tsx` to visually confirm slides render correctly. TypeScript and builds can't catch overflow, clipping, contrast problems, overlapping elements, or broken images — screenshots can.

## When to use

- After any non-trivial change to `src/slides.tsx`
- When the user reports a layout issue
- Before the user presents
- When adding new images, charts, or dynamic content that may render differently than expected

## How it works

1. Run `bunx prez-validate` (or `bunx prez-validate --slide N` for a single slide)
2. The CLI builds if needed, serves `dist/` on a temporary port, and screenshots each slide to `./screenshots/slide-NN.png`
3. Read each PNG with the Read tool (multimodal)
4. For each slide, report: `Slide N: OK` or `Slide N: <specific issue>`

The current presentation folder is the one you're in — `./screenshots/` lands next to `src/slides.tsx`, so multiple decks don't collide.

## Commands

- `bunx prez-validate` — screenshot every slide
- `bunx prez-validate --slide 3` — screenshot only slide 3 (1-indexed)
- `bunx prez-validate --build` — build first (use when `dist/` is stale)
- `bunx prez-validate --clean` — wipe `./screenshots/` before writing
- `bunx prez-validate --json` — emit machine-readable manifest to stdout

## Programmatic API

```ts
import { validateScreenshots } from '@enriquefft/prez/node'

const manifest = await validateScreenshots({
  url: 'http://localhost:5173',
  outputDir: './screenshots',
  slide: 3, // optional; 1-indexed
})
// manifest.screenshots: [{ slide: 3, path: '/abs/path/slide-03.png' }]
```

## Requires

- A built `dist/` (or pass `--build`)
- System Chrome/Chromium (same as `prez-export`)

## What to look for in each screenshot

- Text overflow or clipping past slide bounds (1280×720)
- Unreadable contrast (light text on light background, etc.)
- Broken/missing images (gray placeholder, 404 indicator)
- Overlapping elements that shouldn't overlap
- Misaligned grids, flex layouts, or absolute-positioned elements
- Empty slides (rendering failure or runtime error)
- Typos visible at presentation scale
- Inconsistent spacing or styling versus neighboring slides

## Reporting format

Report actionable findings only — `Slide 3: title overflows right edge` beats `Slide 3 looks off`.

After validation, produce a summary like:

```
Slide 1: OK
Slide 2: OK
Slide 3: title "Product Launch" overflows right edge, reduce to text-6xl
Slide 4: OK
Slide 5: chart image is 404 (public/chart.png missing)
```

Then suggest or make the concrete fix.
