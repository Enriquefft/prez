# prez

A zero-opinion presentation engine for AI. You bring the content, Claude brings the design. Export anywhere.

## What it is

prez gives AI (Claude, or any LLM) the infrastructure to create presentations inside any codebase. It provides the stage — slide containers, navigation, keyboard controls, presenter mode, and export scripts. It does NOT provide layouts, themes, component libraries, or opinions on design. Claude has full React/HTML/CSS freedom inside each slide.

## What it is not

- Not a presentation framework (no predefined layouts)
- Not a design system (no theme object, no component library)
- Not a WYSIWYG editor (no drag-and-drop)
- Not a SaaS product (it's an npm package you own)

## Who it's for

Developers who use AI coding assistants (Claude Code, Cursor, etc.) and want to create presentations from their existing codebases — pitch decks, product demos, technical overviews, internal reports — without leaving their terminal or switching to Canva/Google Slides/PowerPoint.

## How it works

### Setup (once per project)

```bash
bunx @enriquefft/prez init
# creates deck/ folder in your project with a Vite + React setup
cd deck && bun install
```

### Creating a deck

Talk to Claude inside your project:

```
"Create a pitch deck for investors. Read the docs in ./docs/ and use the logo from ./src/components/Logo.tsx"
```

Claude reads your repo, creates slides as React components in `deck/src/slides.tsx`, and runs the dev server. You preview at localhost:5173.

### Iterating

```
"Make slide 3 more visual, use the RevenueChart from ../src/components/Charts.tsx"
"Add a team slide after slide 5"
"The colors feel off, make it darker"
```

Claude edits the slides directly. Full creative control — Tailwind, CSS, Framer Motion, Three.js, D3, whatever it decides is best.

### Exporting

```bash
bun run export:pdf        # deck.pdf (system Chrome --print-to-pdf)
bun run export:pptx       # deck.pptx (system Chrome screenshots + pptxgenjs)
bun run build             # static SPA, deploy anywhere
```

### Presenting

```
Open localhost:5173
Alt+Shift+P → presenter mode (second window with notes, timer, next slide)
Arrow keys / spacebar to navigate
F for fullscreen
```

## Core API

### Components

#### `<Deck>`

The root container. Handles:
- 16:9 aspect ratio scaling (CSS transform to fit any viewport)
- Current slide index state
- Keyboard/touch navigation
- URL hash sync (`#/3` = slide 3)
- Context provider for child components

```tsx
import { Deck, Slide } from '@enriquefft/prez'

<Deck>
  <Slide>...</Slide>
  <Slide>...</Slide>
</Deck>
```

Props:
- `aspectRatio?: string` — default `"16/9"`, can be `"4/3"`, `"1/1"`, or any CSS aspect-ratio value
- `transition?: 'none' | 'fade' | 'slide'` — default `'none'`, transition between slides
- `className?: string` — applied to the deck container
- `style?: CSSProperties` — applied to the deck container

#### `<Slide>`

A container for one slide. Renders its children with full freedom.

```tsx
<Slide>
  <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-900 to-black">
    <h1 className="text-8xl font-bold text-white">Hello World</h1>
  </div>
</Slide>
```

Props:
- `className?: string`
- `style?: CSSProperties`
- `children: ReactNode` — anything. Full React/HTML/CSS freedom.

#### `<Notes>`

Presenter notes. Renders nothing in the normal view. Content is displayed in the presenter mode window.

```tsx
<Slide>
  <h1>Revenue</h1>
  <Notes>Talk about Q3 growth here. Mention the 180% YoY increase.</Notes>
</Slide>
```

### Hooks

#### `useDeck()`

Access deck state from inside a slide.

```tsx
const { currentSlide, totalSlides, next, prev, goTo } = useDeck()
```

## Export Targets

### PDF (`bun run export:pdf`)

Uses system Chrome `--headless=new --print-to-pdf` with `@page { size }` CSS to produce 16:9 landscape PDF pages. Renders exactly what the browser renders — pixel-perfect. No Puppeteer dependency.

### PPTX (`bun run export:pptx`)

Uses system Chrome headless to screenshot each slide, then assembles images into a PPTX via pptxgenjs. Produces a presentation with one image per slide at native 1280x720 resolution.

### Static SPA (`bun run build`)

Standard Vite build. Produces a static site deployable to Vercel, Netlify, GitHub Pages, S3, or any static host. Includes all navigation, transitions, and presenter mode.

## Technical Details

### Engine package (`@enriquefft/prez`)
- React components + hooks
- Zero runtime dependencies beyond React
- Peer dependency: react >= 18
- Built with tsup, ships ESM + CJS + types
- MIT license

### Template (`prez init`)
- Vite + React + TypeScript
- Tailwind CSS included (but optional — Claude can use anything)
- Export scripts as package.json scripts
- Self-contained in `deck/` folder with its own package.json

### Compatibility
- Works in any project (React, Python, Go, Rust — the deck/ folder is independent)
- Existing TSX/JSX components from the parent project can be imported via relative paths
- No framework lock-in — uses plain React, not Next.js/Remix/etc.

## Design Principles

1. **Zero opinions** — The engine provides infrastructure, never design decisions. No built-in colors, fonts, layouts, or "best practices" enforced in code.

2. **AI-first** — Designed for Claude/LLMs to use, not for humans to configure. The API surface is tiny so the AI can hold it in context easily.

3. **Full freedom** — Inside a `<Slide>`, anything goes. If a browser can render it, prez can present it.

4. **Existing components** — Import your TSX/JSX components directly. No rewriting, no adapters, no conversion.

5. **Export everywhere** — Same slides export to PDF, PPTX, and web. Write once, output anywhere.

## v1 Scope

Ship with:
- [x] `<Deck>`, `<Slide>`, `<Notes>` components
- [x] Keyboard/touch navigation
- [x] Fullscreen support
- [x] URL hash sync
- [x] Presenter mode (BroadcastChannel)
- [x] `prez init` CLI
- [x] PDF export (system Chrome `--print-to-pdf`)
- [x] PPTX export (system Chrome screenshots + pptxgenjs)
- [x] Vite template with Tailwind
- [x] 1 example deck
- [x] README

## v2 (post-launch)

- [ ] Video export (Remotion)
- [ ] `prez deploy` (Vercel/Netlify one-command deploy)
- [ ] Slide overview mode (bird's eye grid)
