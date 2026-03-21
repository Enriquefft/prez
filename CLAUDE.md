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

1. **Library** (`src/index.ts` → `dist/`): React components, hooks, and utilities consumed by end users via `import { Deck, Slide, Notes, useDeck, symbols } from '@enriquefft/prez'`
2. **CLIs** (`src/cli/*.ts` → `dist/cli/`):
   - `prez init` — scaffolds a `deck/` folder from `template/` via interactive wizard. Supports `--yes` for CI.
   - `prez-image` — AI image generation, photo search, SVG rendering.
   - `prez-export` — Export deck to PDF/PPTX. Auto-serves dist/, runs Chrome headless.

### Build

tsup produces two bundles (configured in `tsup.config.ts`):
- Library entry: `src/index.ts` → ESM + CJS + `.d.ts` (React is external)
- CLI entries: `src/cli/init.ts` + `src/cli/image.ts` + `src/cli/export.ts` → ESM with node shebang, separate `dist/cli/` output

### Source layout

- `src/symbols.ts` — `symbols` constant: Unicode characters for common presentation glyphs (check, cross, arrows, etc.). Use instead of HTML entities which don't work in JSX.
- `src/components/Deck.tsx` — Root container: aspect-ratio scaling (1280x720 base), slide transitions (none/fade/slide), context provider, notes extraction, presenter mode branching, print mode (`?print=true`), optional fullscreen button (`showFullscreenButton` prop), optional download button (`downloadUrl` prop)
- `src/cli/export.ts` — `prez-export` CLI: auto-serves dist/, exports PDF/PPTX via Chrome headless
- `src/components/Slide.tsx` — Simple wrapper div, no logic
- `src/components/Notes.tsx` — Renders `null`; Deck extracts its children for presenter mode
- `src/context.ts` — `DeckContext` and `useDeck()` hook exposing `currentSlide`, `totalSlides`, `next`, `prev`, `goTo`
- `src/hooks/use-navigation.ts` — Keyboard/touch/hash navigation. URL hash sync (`#/N`). Alt+Shift+P opens presenter window
- `src/hooks/use-presenter.ts` — BroadcastChannel (`prez-sync`) for presenter ↔ deck sync
- `src/presenter/Presenter.tsx` — Presenter mode UI: current slide, next slide preview, notes, timer
- `src/scripts/export-pdf.ts` — `exportPdf()` function: Chrome `--print-to-pdf` (no Puppeteer). Used by `prez-export` CLI.
- `src/scripts/export-pptx.ts` — `exportPptx()` function: screenshots each slide with Chrome headless, assembles with pptxgenjs. Used by `prez-export` CLI.
- `src/scripts/find-chrome.ts` — Detects system Chrome/Chromium installation
- `src/cli/image.ts` — `prez-image` CLI for image generation, search, and SVG rendering

### Image CLI (`prez-image`)

Commands for getting images into slides:

- `prez-image gen "prompt" -o output.png` — AI image generation via Pollinations.ai (requires API key, run `prez-image setup`)
- `prez-image search "query" -o output.jpg` — Royalty-free photo search (Unsplash/Pexels, requires API key)
- `prez-image render input.svg -o output.png` — SVG to PNG rendering via @resvg/resvg-js
- `prez-image models` — List available Pollinations AI models
- `prez-image setup` — Configure API keys (interactive or via `--pollinations-key`, `--unsplash-key`, `--pexels-key` flags)

Generation flags: `--enhance` (AI prompt rewriting), `--negative-prompt`, `--quality` (low/medium/high/hd), `--transparent` (gptimage only), `--model`, `--seed`

### Export CLI (`prez-export`)

Single command to export presentations to PDF and PPTX. Eliminates the two-terminal workflow.

- `prez-export` — Export both PDF and PPTX to `./public/`
- `prez-export pdf` — Export only PDF
- `prez-export pptx` — Export only PPTX
- `prez-export --build` — Build first, then export
- `prez-export --url http://localhost:5173` — Export from running server

Flags: `--output <dir>` (default: `./public/`), `--base <path>`, `--timeout <ms>` (default: 30000)

Auto-serve mode: when no `--url`, starts a temp static server from `dist/`, runs Chrome, stops server. Requires system Chrome.

### Download button (`downloadUrl` prop)

Optional prop on `<Deck>` to show a floating download button:
- `downloadUrl="/deck.pptx"` — single format, direct download
- `downloadUrl={{ pdf: "/deck.pdf", pptx: "/deck.pptx" }}` — multi-format with popover menu

Typical workflow: `bun run build:export` builds the app, then exports PDF/PPTX directly into `dist/`. The `downloadUrl` prop links to those files. Single command, single source of truth (`slides.tsx`).

### Template (`template/`)

Scaffolded by `prez init`. Self-contained Vite + React + Tailwind project with PWA support (manifest.json, fullscreen display, landscape orientation). Users edit `src/slides.tsx` — that's the single file workflow. The template has its own `package.json` with `@enriquefft/prez` as a dependency.

### Export pipeline

Export uses system Chrome headless (no Puppeteer dependency), orchestrated by `prez-export` CLI:
- PDF: Deck renders `?print=true` mode (all slides stacked with page-break CSS in mm units), Chrome `--print-to-pdf` captures it
- PPTX: Chrome screenshots each slide via `--screenshot`, then pptxgenjs assembles the PPTX
- Chrome detection: `find-chrome.ts` checks standard paths, respects `CHROME_PATH` env var
- Auto-serve: `prez-export` starts a temp static server from `dist/` on a random port, no manual server needed

### Key design decisions

- Slides are 1280px wide, height derived from aspect ratio. Scaled via CSS `transform: scale()` with ResizeObserver
- Notes are extracted by Deck walking children and matching `child.type === Notes`
- Presenter mode detected via `?presenter=true` URL param; sync uses BroadcastChannel, not WebSocket
- Print mode detected via `?print=true` URL param; renders all slides stacked with page-break CSS. Uses mm units in `@page` for correct Chrome PDF pagination
- Export uses system Chrome instead of Puppeteer — zero heavy npm dependencies
- No runtime dependencies beyond React (peer dep)
- Uses bun as package manager, biome for linting/formatting
