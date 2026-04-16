---
name: prez-image
description: Generate, search, and create images for prez presentations. AI generation via Pollinations, photo search via Unsplash/Pexels, and SVG-to-PNG rendering.
metadata:
  author: Enriquefft
  version: "1.0.0"
  argument-hint: "describe the image you need"
---

# prez-image — Image tools for presentations

Get images into prez slides. Three capabilities, one CLI.

**Slide numbering:** 1-based externally everywhere. See `skills/prez/SKILL.md#slide-numbering-convention`.

**Global flags (`-h` / `--help` / `-V` / `--version`):** shared across every `prez-*` CLI. See `skills/prez/SKILL.md#global-cli-flags`.

> `-h` is `--help`, not `--height`. Use `--height <px>` for image height. `-h 720` will error with exit code 2.

## When to use

When building slides with prez and you need:
- A **custom/conceptual image** that doesn't exist (illustration, abstract art, scene) -> `gen`
- A **real photograph** (people, places, objects, nature) -> `search`
- A **diagram, chart, icon, or graphic** you can design as SVG -> `render`

If the user already has images in their repo, just reference them directly — no tool needed.

## Commands

All commands use `bunx prez-image` from the project root.

| Command | Purpose |
| --- | --- |
| `gen <prompt>` | AI image generation (Pollinations.ai) |
| `search <query>` | Royalty-free photo search (Unsplash/Pexels) |
| `render <file.svg>` | SVG-to-PNG rendering |
| `models` | List available Pollinations AI models |
| `setup` | Configure API keys (interactive or via flags) |

### Generate an image with AI

```bash
bunx prez-image gen "a dark futuristic cityscape, minimal, cinematic" -o deck/public/hero.png
```

Requires a Pollinations API key. Free to register — run `prez-image setup` or set `POLLINATIONS_API_KEY` in the environment. The CLI exits with a descriptive error if no key is present.

Options:
- `-o, --output <path>` — output file (required)
- `-w, --width <px>` — width, default 1280
- `--height <px>` — height, default 720
- `--model <name>` — Pollinations model, default `flux`. Run `bunx prez-image models` to list; unknown names error out.
- `--seed <n>` — seed for reproducible output
- `--enhance` — AI-rewrite the prompt for higher-quality output
- `--negative-prompt <s>` — things to avoid (e.g. `"blurry, text, watermark"`)
- `--quality <level>` — `low | medium | high | hd` (gptimage model only)
- `--transparent` — transparent background (gptimage model only)

### Search for a photo

```bash
bunx prez-image search "team collaboration in modern office" -o deck/public/team.jpg
```

Searches Unsplash and Pexels for royalty-free, landscape-oriented photos. Requires at least one API key:
- `UNSPLASH_ACCESS_KEY` — free at https://unsplash.com/developers
- `PEXELS_API_KEY` — free at https://www.pexels.com/api/

Options:
- `-o, --output <path>` — output file (required)
- `--provider <name>` — `unsplash` or `pexels`. **Omit unless you have a reason to pin one provider** — the default tries both and returns the first hit, which is what agents want.

### Render SVG to PNG

```bash
bunx prez-image render diagram.svg -o deck/public/diagram.png
```

Converts an SVG file to a PNG. Use this when you've written an SVG (diagram, flowchart, icon, pattern) and need a raster image.

Options:
- `-o, --output <path>` — output file (required)
- `-w, --width <px>` — output width, default 1280

### List available AI models

```bash
bunx prez-image models
```

Prints the Pollinations model catalog. Run this before passing `--model <name>` so you don't guess a name the backend has removed.

### Configure API keys

```bash
bunx prez-image setup                              # interactive prompts
bunx prez-image setup --pollinations-key <key>     # non-interactive
bunx prez-image setup --unsplash-key <key> --pexels-key <key>
```

Writes `~/.config/prez/config.json`. Environment variables (`POLLINATIONS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`) override the config file.

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

## Error-first: when generation fails

If `bunx prez-image gen` exits non-zero with `Error: No Pollinations API key configured`, either run `bunx prez-image setup` (interactive) or set `POLLINATIONS_API_KEY` in the environment before retrying.

If `--model <name>` errors with `unknown model`, run `bunx prez-image models` and pick from the printed list.

## Tips

- Save images to `deck/public/` so Vite serves them at the root path
- Use `-w 1280 --height 720` for full-bleed slide backgrounds (these are the defaults)
- Use `--seed` with `gen` to get reproducible results while iterating
- For `search`, landscape orientation is automatically requested to match slide aspect ratio
- You can generate multiple images in parallel by running several commands
- Use `--enhance` when the user's prompt is terse; skip it when they've given you a precise, composed prompt (it can drift off-brief)

## Common mistakes

- **Don't use `-h <number>` expecting height.** `-h` is help; use `--height`.
- **Don't hardcode a model you haven't verified.** Run `bunx prez-image models` first.
- **Don't pick a provider at random.** Omit `--provider` unless the user asked for a specific one — the default tries both Unsplash and Pexels.
- **Don't pass `--quality` or `--transparent` to the default `flux` model.** Those flags only affect the `gptimage` model.

## Companion skills

- `prez` — the presentation engine itself (`skills/prez/SKILL.md`)
- `prez-validate` — screenshot each slide and check for rendering issues (`skills/prez-validate/SKILL.md`). Image-heavy slides are a common visual-regression class: after swapping or regenerating an image, run `bunx prez-validate --diff baseline/` to catch layout breakage the filename change alone doesn't reveal.
