---
name: prez-image
description: Generate, search, and create images for prez presentations. AI generation via Pollinations, photo search via Unsplash/Pexels, and SVG-to-PNG rendering.
metadata:
  author: Enriquefft
  version: "0.1.0"
  argument-hint: "describe the image you need"
---

# prez-image — Image tools for presentations

Get images into prez slides. Three capabilities, one CLI.

## When to use

When building slides with prez and you need:
- A **custom/conceptual image** that doesn't exist (illustration, abstract art, scene) -> `gen`
- A **real photograph** (people, places, objects, nature) -> `search`
- A **diagram, chart, icon, or graphic** you can design as SVG -> `render`

If the user already has images in their repo, just reference them directly — no tool needed.

## Commands

All commands use `bunx prez-image` from the project root (or `node deck/node_modules/.bin/prez-image` if installed locally).

### Generate an image with AI

```bash
bunx prez-image gen "a dark futuristic cityscape, minimal, cinematic" -o deck/public/hero.png
```

Uses Pollinations.ai (free, no API key required). For higher rate limits, set `POLLINATIONS_API_KEY`.

Options:
- `-o, --output <path>` — output file (required)
- `-w, --width <px>` — width, default 1280
- `-h, --height <px>` — height, default 720
- `--model <name>` — Pollinations model, default "flux"
- `--seed <n>` — seed for reproducible output

### Search for a photo

```bash
bunx prez-image search "team collaboration in modern office" -o deck/public/team.jpg
```

Searches Unsplash and Pexels for royalty-free, landscape-oriented photos. Requires at least one API key:
- `UNSPLASH_ACCESS_KEY` — free at https://unsplash.com/developers
- `PEXELS_API_KEY` — free at https://www.pexels.com/api/

Options:
- `-o, --output <path>` — output file (required)
- `--provider <name>` — force "unsplash" or "pexels" (default: tries both)

### Render SVG to PNG

```bash
bunx prez-image render diagram.svg -o deck/public/diagram.png
```

Converts an SVG file to a PNG. Use this when you've written an SVG (diagram, flowchart, icon, pattern) and need a raster image.

Options:
- `-o, --output <path>` — output file (required)
- `-w, --width <px>` — output width, default 1280

## Workflow

1. Decide what kind of image you need (see "When to use" above)
2. Run the appropriate command, saving to `deck/public/`
3. Reference in slides as `<img src="/filename.png" />`

## Example: full slide with generated background

```bash
bunx prez-image gen "abstract dark gradient with subtle geometric shapes" -o deck/public/bg-hero.png
```

```tsx
<Slide>
  <div className="relative h-full w-full">
    <img src="/bg-hero.png" className="absolute inset-0 w-full h-full object-cover" />
    <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
      <h1 className="text-8xl font-black">Launch Day</h1>
    </div>
  </div>
</Slide>
```

## Example: SVG diagram rendered to PNG

Write an SVG file, render it, use it:

```bash
bunx prez-image render /tmp/architecture.svg -o deck/public/architecture.png
```

```tsx
<Slide>
  <div className="flex items-center justify-center h-full bg-white p-16">
    <img src="/architecture.png" className="max-h-full" />
  </div>
</Slide>
```

## Tips

- Save images to `deck/public/` so Vite serves them at the root path
- Use `-w 1280 -h 720` for full-bleed slide backgrounds (this is the default)
- Use `--seed` with gen to get reproducible results while iterating
- For search, landscape orientation is automatically requested to match slide aspect ratio
- You can generate multiple images in parallel by running several commands
