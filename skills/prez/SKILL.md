---
name: prez
description: Create beautiful presentations from any codebase. Zero-opinion slide engine — you have full React/HTML/CSS freedom inside each slide.
metadata:
  author: Enriquefft
  version: "1.0.0"
  argument-hint: "describe the presentation you want"
---

# prez — Presentation Engine

Create presentations from any codebase. Users describe what they want, you build the slides.

## When to use

When the user asks you to create a presentation, pitch deck, slide deck, or any visual slide-based content from their project.

## Setup

If no `deck/` folder exists in the project, scaffold one:

```bash
bunx @enriquefft/prez init
```

Then `cd deck && bun install && bun run dev` to start the dev server at localhost:5173.

Legacy install form (kept for historical links, prefer `bunx` above):

```bash
curl -fsSL https://raw.githubusercontent.com/Enriquefft/prez/main/setup.sh | sh
```

### Scaffold flags

- `prez init <name> --yes` — non-interactive scaffold, installs Claude skills into `<name>/.claude/skills/`
- `prez init <name> --yes --no-skills` — for CI or when the parent repo manages its own skills

Skills are **deck-local**: they land inside the scaffolded deck (e.g. `deck/.claude/skills/`), not in the cwd you ran `prez init` from. This keeps skills with the presentation, not leaking into unrelated parent projects.

### Companion skills installed alongside this one

- `prez-image` — generate, search, and render images (see `skills/prez-image/SKILL.md`)
- `prez-validate` — screenshot every slide for visual validation (see `skills/prez-validate/SKILL.md`). Run it after any non-trivial change to `src/slides.tsx` to catch overflow, contrast, or broken-image issues TypeScript can't.

## API

Three components. That's it.

### `<Deck>` — Root container

```tsx
import { Deck, Slide, Notes } from '@enriquefft/prez'

<Deck>
  <Slide>...</Slide>
  <Slide>...</Slide>
</Deck>
```

Props:
- `aspectRatio?: string` — default `"16/9"`
- `transition?: 'none' | 'fade' | 'slide'` — default `'none'`
- `className?: string`
- `style?: CSSProperties`
- `showFullscreenButton?: boolean` — floating fullscreen toggle
- `downloadUrl?: string | { pdf?: string; pptx?: string }` — floating download button; string for single format, object for a multi-format popover (see Export below)

### `<Slide>` — One slide

Full creative freedom inside. Use any HTML, CSS, Tailwind, React components, animations.

```tsx
<Slide>
  <div className="flex items-center justify-center h-full bg-black text-white">
    <h1 className="text-8xl font-bold">Anything goes</h1>
  </div>
</Slide>
```

Props: `className`, `style`, `children`

### `<Notes>` — Presenter notes

Renders nothing in normal view. Shown in presenter mode (Alt+Shift+P).

```tsx
<Slide>
  <h1>Revenue</h1>
  <Notes>Talk about Q3 growth. Mention 180% YoY.</Notes>
</Slide>
```

### `useDeck()` hook

Access deck state from inside a slide:

```tsx
const { currentSlide, totalSlides, next, prev, goTo } = useDeck()
```

## How to build slides

1. Read the user's codebase to understand their project, product, data, and brand
2. Edit `deck/src/slides.tsx` — this is the ONLY file you need to touch
3. Export a default **Fragment variable** (not a component) containing `<Slide>` children:
   ```tsx
   const slides = (
     <>
       <Slide>...</Slide>
       {/* JSX comments work here */}
       <Slide>...</Slide>
     </>
   )
   export default slides
   ```
4. In `main.tsx`, use `{slides}` (not `<Slides />`):
   ```tsx
   import slides from './slides'
   <Deck>{slides}</Deck>
   ```
5. Each `<Slide>` is 1280x720 and can contain anything — full React/HTML/CSS freedom
6. Use Tailwind classes (included by default) or inline styles
7. Import components from the parent project via relative paths (e.g., `../../src/components/Chart`)

## Design guidelines

- Each slide should have ONE clear message
- Use large text (text-5xl to text-8xl for titles)
- High contrast — dark backgrounds with light text, or vice versa
- Generous whitespace and padding (p-16 to p-24)
- Consistent color palette across the deck
- Use gradients, subtle animations, and visual hierarchy
- Add `<Notes>` for speaker talking points

## File structure

```
deck/
├── src/
│   ├── main.tsx      # Entry point (don't edit)
│   ├── slides.tsx    # YOUR SLIDES — edit this file
│   └── styles.css    # Tailwind + custom CSS
├── package.json
├── vite.config.ts
└── index.html
```

## Navigation (built-in, no code needed)

- Arrow keys, spacebar, Page Up/Down — navigate slides
- Home/End — first/last slide
- F — toggle fullscreen
- Alt+Shift+P — open presenter mode (separate window with notes + timer)
- Touch swipe on mobile
- URL hash sync (#/N)

## Slide numbering convention

prez uses **1-based** slide numbers on every external surface: CLI
arguments (`--slide 3`), JSON event fields (`"slide": 3`), node-API
parameters (`validateScreenshots({ slide: 3 })`), log lines, and diff
reports. Internal URL hashes are 0-based (`#/0` renders slide 1),
and the `?screenshot=N` render mode takes a 0-based `N`. The Node
API encodes this at the type level with branded
`ExternalSlideNumber` (1-based) and `InternalSlideIndex` (0-based)
types; use `toInternal` / `toExternal` / `asExternal` / `asInternal`
to cross the boundary. Agents should emit and parse 1-based numbers
everywhere the user-visible surface demands.

## Render modes (internal)

The Deck switches behavior based on URL query params — agents should not re-implement these; `prez-validate` and `prez-export` already drive them:

- `?print=true` — all slides stacked with page-break CSS (drives PDF export)
- `?presenter=true` — presenter-mode UI (opened by Alt+Shift+P)
- `?screenshot=N` — renders only the slide at 0-based index `N`, used by `prez-validate` and the PPTX export. Agents that need a per-slide image should call `prez-validate --slide N` (1-based) instead of touching this URL directly.

## Global CLI flags

Every `prez-*` binary accepts:
- `-h`, `--help` — print usage and exit 0
- `-V`, `--version` — print `<name> <version>` and exit 0

These are emitted via a shared CLI kit (`src/cli/_cli-kit.ts`), so
agents can rely on identical behavior across `prez init`,
`prez-image`, `prez-export`, and `prez-validate`.

## Export

Single entry point — `bunx prez-export` — drives both PDF and PPTX. See `skills/prez-validate/SKILL.md` for the validate-then-export loop.

```bash
bunx prez-export              # Export both PDF and PPTX to ./dist/
bunx prez-export pdf          # PDF only
bunx prez-export pptx         # PPTX only
bunx prez-export --build      # Build first, then export
bunx prez-export --url http://localhost:5173   # Export from a running server
```

Flags:
- `--output <dir>` / `-o <dir>` — output directory (default `./dist/`)
- `--base <path>` — override Vite base when it isn't `/`
- `--timeout <ms>` — Chrome timeout, default `30000`

Because the default output is `./dist/`, the built SPA and the exported artifacts live side-by-side. Wire them up with `downloadUrl`:

```tsx
<Deck
  downloadUrl={{ pdf: 'deck.pdf', pptx: 'deck.pptx' }}
>
  {slides}
</Deck>
```

Then `bunx prez-export --build` produces a `dist/` that serves the deck and its downloads from one directory. `downloadUrl` as a plain string emits a single direct-download button; as an object it emits a popover with one link per format.

## Node API

For programmatic pipelines (custom validators, CI gates, batch screenshotters) import from `@enriquefft/prez/node`. The surface covers screenshot capture (`ChromeBrowser`, `ChromeSession`, `screenshotSlides`), diffing (`diffPng`), the full validate orchestrator (`validateScreenshots`), and the branded slide-index helpers. See `skills/prez-validate/SKILL.md` for the canonical usage pattern.

## Image tools

See `skills/prez-image/SKILL.md` for image generation (AI), royalty-free search, and SVG-to-PNG rendering.

## Common mistakes

- **Don't duplicate slide content across `main.tsx` and `slides.tsx`.** `slides.tsx` is the single source of truth; `main.tsx` just imports and renders it inside `<Deck>`.
- **Don't copy generated images into `src/`.** Put them in `deck/public/` so Vite serves them at the root, then reference via `<img src="/hero.png">` or Tailwind `bg-[url('/hero.png')]`.
- **Don't invent a `<Slides>` component.** `slides.tsx` exports a Fragment variable; render it with `{slides}`, not `<Slides />`.

## Error-first: when setup breaks

If `bun run dev` fails with `ENOENT src/slides.tsx`, the scaffold didn't complete — re-run `bunx @enriquefft/prez init`. If a CLI exits with "Error: dist/ not found", pass `--build` to have it build first.
