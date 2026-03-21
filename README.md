# prez

Presentations from your codebase. Tell your AI agent what you want, it builds the deck.

You stay in your terminal. No PowerPoint, no Canva.

```
"Create a pitch deck for investors. Use the data from ./src/analytics
 and the logo from ./assets/logo.svg. Make it dark and minimal."
```

Your agent reads the repo, writes the slides, you present from localhost.

## How it works

prez is a slide engine with three components (`Deck`, `Slide`, `Notes`) and no opinions about design. Your AI agent gets React/HTML/CSS freedom inside each slide. Tailwind is included. Animations, charts, 3D, whatever, if a browser can render it, prez can present it.

The agent edits one file: `deck/src/slides.tsx`. That's the whole workflow.

## Setup

Scaffold a deck in any project:

```bash
curl -fsSL https://raw.githubusercontent.com/Enriquefft/prez/main/setup.sh | sh
cd deck && bun install && bun run dev
```

Teach your AI agent the API (works with Claude Code, Cursor, Copilot, Windsurf, and [20+ others](https://skills.sh)):

```bash
bunx skills add Enriquefft/prez
```

Then just ask:

```
"Create a 10-slide product demo. Read the docs in ../docs/ and
 import the PricingTable component from ../src/components/."
```

## What the output looks like

```tsx
// deck/src/slides.tsx
import { Slide, Notes } from '@enriquefft/prez'

const slides = (
  <>
    <Slide>
        <div className="flex flex-col items-center justify-center h-full
                        bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white">
          <h1 className="text-8xl font-black tracking-tighter">Acme AI</h1>
          <p className="mt-6 text-2xl text-white/40">AI infrastructure for the next million developers</p>
        </div>
        <Notes>Open strong. Pause 2 seconds before speaking.</Notes>
      </Slide>

      <Slide>
        <div className="flex flex-col justify-center h-full bg-black text-white px-24">
          <h2 className="text-5xl font-bold">
            Every company wants AI.<br/>
            <span className="text-white/30">Nobody knows how to ship it.</span>
          </h2>
        </div>
      </Slide>

    {/* as many slides as needed */}
  </>
)

export default slides
```

See [`examples/startup-pitch`](./examples/startup-pitch) for a full 8-slide investor deck.

## Navigation

All built-in, no code needed.

| Key | Action |
|---|---|
| `→` `↓` `Space` | Next slide |
| `←` `↑` | Previous slide |
| `Home` / `End` | First / last slide |
| `F` | Fullscreen |
| `Alt+Shift+P` | Presenter mode |

Presenter mode opens a second window with the current slide, next slide preview, speaker notes, and a timer. Touch swipe works on mobile.

## API

### `<Deck>`

The root container. Handles aspect-ratio scaling, navigation, and slide state.

```tsx
<Deck aspectRatio="16/9" transition="fade">
  <Slide>...</Slide>
</Deck>
```

| Prop | Default | Options |
|---|---|---|
| `aspectRatio` | `"16/9"` | Any CSS aspect-ratio value |
| `transition` | `"none"` | `"none"`, `"fade"`, `"slide"` |

### `<Slide>`

One slide. Put anything inside it: React components, raw HTML, inline styles, Tailwind classes.

### `<Notes>`

Speaker notes. Not rendered during the presentation, only visible in presenter mode.

```tsx
<Slide>
  <h1>Revenue</h1>
  <Notes>Mention the 180% YoY growth. Pause for questions.</Notes>
</Slide>
```

### `useDeck()`

Read deck state from inside a slide:

```tsx
const { currentSlide, totalSlides, next, prev, goTo } = useDeck()
```

## Image tools

`prez-image` generates, searches, and renders images for your slides.

```bash
bunx prez-image gen "a dark futuristic cityscape, minimal" -o deck/public/hero.png     # AI generation (free, via Pollinations)
bunx prez-image search "team collaboration office" -o deck/public/team.jpg             # Royalty-free photo search
bunx prez-image render diagram.svg -o deck/public/diagram.png                          # SVG to PNG
```

**When to use each:**

| Command | Use for |
|---|---|
| `gen` | Custom/conceptual images that don't exist (illustrations, abstract art, scenes) |
| `search` | Real photographs (people, places, nature). Requires `UNSPLASH_ACCESS_KEY` or `PEXELS_API_KEY` |
| `render` | Diagrams, charts, icons you've written as SVG |

Images saved to `deck/public/` are served at the root path: `<img src="/hero.png" />`.

## Export

```bash
bun run build          # static site, deploy to Vercel/Netlify/GitHub Pages
bun run export:pdf     # PDF via system Chrome (zero deps)
bun run export:pptx    # PPTX via system Chrome + pptxgenjs
```

Export uses your system Chrome/Chromium headless — no Puppeteer needed. Set `CHROME_PATH` if Chrome isn't in a standard location.

## Project structure

```
deck/
├── src/
│   ├── main.tsx      # entry point (don't edit)
│   ├── slides.tsx    # your slides (agent edits this)
│   └── styles.css    # Tailwind + any custom CSS
├── package.json
├── vite.config.ts
└── index.html
```

The `deck/` folder is self-contained with its own dependencies. It works inside any project: React, Python, Go, Rust, doesn't matter. Your existing components can be imported via relative paths.

## Why

Slide tools are built for dragging boxes around with a mouse. AI agents write code. prez gives them a 1280x720 React canvas per slide and stays out of the way.

## License

MIT
