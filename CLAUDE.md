# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

prez is a zero-opinion React presentation engine designed for AI agents. It provides `Deck`, `Slide`, and `Notes` components with built-in navigation, scaling, and presenter mode. AI agents get full React/HTML/CSS freedom inside each slide — the engine handles infrastructure only.

## Commands

```bash
bun run build        # Build with tsup (ESM + CJS + types)
bun run dev          # Build in watch mode
bun run typecheck    # TypeScript type checking (tsc --noEmit)
bun run lint         # Lint with biome
bun run lint:fix     # Lint + auto-fix
bun run format       # Format with biome
```

## Architecture

This is an **npm package** (not an app). It ships two things:

1. **Library** (`src/index.ts` → `dist/`): React components and hooks consumed by end users via `import { Deck, Slide, Notes, useDeck } from 'prez'`
2. **CLI** (`src/cli/init.ts` → `dist/cli/`): `prez init` scaffolds a `deck/` folder from `template/` via interactive wizard (@clack/prompts). Supports `--yes` for non-interactive CI usage.

### Build

tsup produces two bundles (configured in `tsup.config.ts`):
- Library entry: `src/index.ts` → ESM + CJS + `.d.ts` (React is external)
- CLI entries: `src/cli/init.ts` + `src/cli/image.ts` → ESM with node shebang, separate `dist/cli/` output

### Source layout

- `src/components/Deck.tsx` — Root container: aspect-ratio scaling (1280x720 base), slide transitions (none/fade/slide), context provider, notes extraction, presenter mode branching, print mode (`?print=true`)
- `src/components/Slide.tsx` — Simple wrapper div, no logic
- `src/components/Notes.tsx` — Renders `null`; Deck extracts its children for presenter mode
- `src/context.ts` — `DeckContext` and `useDeck()` hook exposing `currentSlide`, `totalSlides`, `next`, `prev`, `goTo`
- `src/hooks/use-navigation.ts` — Keyboard/touch/hash navigation. URL hash sync (`#/N`). Alt+Shift+P opens presenter window
- `src/hooks/use-presenter.ts` — BroadcastChannel (`prez-sync`) for presenter ↔ deck sync
- `src/presenter/Presenter.tsx` — Presenter mode UI: current slide, next slide preview, notes, timer
- `src/scripts/export-pdf.ts` — PDF export using system Chrome `--print-to-pdf` (no Puppeteer)
- `src/scripts/export-pptx.ts` — PPTX export: screenshots each slide with Chrome headless, assembles with pptxgenjs
- `src/scripts/find-chrome.ts` — Detects system Chrome/Chromium installation
- `src/cli/image.ts` — `prez-image` CLI for image generation, search, and SVG rendering

### Image CLI (`prez-image`)

Three commands for getting images into slides:

- `prez-image gen "prompt" -o output.png` — AI image generation via Pollinations.ai (free, no key required)
- `prez-image search "query" -o output.jpg` — Royalty-free photo search (Unsplash/Pexels, requires API key)
- `prez-image render input.svg -o output.png` — SVG to PNG rendering via @resvg/resvg-js

### Template (`template/`)

Scaffolded by `prez init`. Self-contained Vite + React + Tailwind project. Users edit `src/slides.tsx` — that's the single file workflow. The template has its own `package.json` with `prez` as a dependency.

### Export pipeline

Export uses system Chrome headless (no Puppeteer dependency):
- PDF: Deck renders `?print=true` mode (all slides stacked with page-break CSS), Chrome `--print-to-pdf` captures it
- PPTX: Chrome screenshots each slide via `--screenshot`, then pptxgenjs assembles the PPTX
- Chrome detection: `find-chrome.ts` checks standard paths, respects `CHROME_PATH` env var

### Key design decisions

- Slides are 1280px wide, height derived from aspect ratio. Scaled via CSS `transform: scale()` with ResizeObserver
- Notes are extracted by Deck walking children and matching `child.type === Notes`
- Presenter mode detected via `?presenter=true` URL param; sync uses BroadcastChannel, not WebSocket
- Print mode detected via `?print=true` URL param; renders all slides stacked with page-break CSS
- Export uses system Chrome instead of Puppeteer — zero heavy npm dependencies
- No runtime dependencies beyond React (peer dep)
- Uses bun as package manager, biome for linting/formatting
