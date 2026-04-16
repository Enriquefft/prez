# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

Foundations for the v1.2 command-surface revision. No consumer code is
modified in this release; these modules are the single-source-of-truth
dependencies that downstream workstreams (Deck render-mode fix, validate
CLI capabilities, export hardening, init/image CLI refresh, parallel
screenshot engine) build on.

### Added
- `ExternalSlideNumber` / `InternalSlideIndex` branded number types with
  `asExternal`, `asInternal`, `toExternal`, `toInternal`, and
  `assertValidExternal` helpers (`src/slide-index.ts`). Re-exported from
  both `@enriquefft/prez` and `@enriquefft/prez/node` so browser React
  code and Node API consumers share one numbering convention.
- `src/render-modes.ts`: URL contract module with `parseRenderMode`,
  `printUrl`, `presenterUrl`, and `screenshotUrl`. `RenderMode` + the
  helpers are re-exported from `@enriquefft/prez/node` for WS-F's
  parallel-screenshot engine.
- `safeCleanScreenshotsDir` (`src/scripts/safe-clean.ts`): defensive
  replacement for the recursive `rmSync` previously invoked by
  `prez-validate --clean`. Refuses cwd, `$HOME`, `/`, any ancestor of
  cwd, and any path outside `process.cwd()` / `os.tmpdir()`; only
  removes files matching `slide-<digits>.png` or `diff-<digits>.png`.
  Exported from `@enriquefft/prez/node`.
- `ValidateEvent` NDJSON event schema in `src/node.ts`. WS-C wires this
  into `validateScreenshots` via a new `onEvent` option.

### Changed
- Minimum Node version raised from 18 to 22 (LTS through April 2027).
  Enables native WebSocket for the WS-F CDP client and drops several
  `node-fetch`-era shim concerns.
- `prez init` Claude skills now install to `<target>/.claude/skills/`
  (deck-local) instead of `<cwd>/.claude/skills/`. Skills travel with
  the deck and do not leak into the parent directory when scaffolding
  from `/tmp` or a monorepo root.
- `prez-image`: `-h` is now the standard `--help` flag across every
  `prez-*` binary instead of an alias for `--height`. Passing
  `-h <number>` now exits with `"-h is reserved for --help. Use
  --height."` (exit code 2). **Breaking** for callers using
  `-h <px>` — replace with `--height <px>`.

### Added
- `prez init --no-skills`: skip the Claude-skills install step in
  non-interactive (`--yes`) and interactive runs. Pre-answers the
  interactive confirm prompt when present on argv.

### Internal
- `src/cli/_cli-kit.ts`: unified `--help` / `--version` / `die()` for
  every `prez-*` binary. `package.json` is now the sole version source,
  read once at module load via `fileURLToPath(import.meta.url)`.
- `prez init` and `prez-image` migrated to `_cli-kit.ts`. Inline USAGE
  strings removed; help is a typed `HelpSpec` with consistent section
  names across every CLI. `--version` / `-V` available everywhere.

## [1.0.0] - 2026-03-21

### Added
- Unit test suite (29 tests) covering child flattening, navigation, transitions, print mode, and component API
- CI workflow: typecheck, lint, build, test on every push/PR
- Release workflow: automatic npm publish on GitHub release
- `@page` CSS in print mode for correct 16:9 landscape PDF output
- `print-color-adjust: exact` to preserve backgrounds in PDF export
- `prepare` script for automatic build on git install
- `engines`, `homepage`, `bugs` fields in package.json

### Changed
- Package name: `prez` → `@enriquefft/prez`
- Template exports a Fragment variable instead of a component (fixes `Children.toArray` issue)
- `Deck` uses recursive `flattenChildren` to properly handle nested Fragments
- Chrome export scripts use `--headless=new`, `--virtual-time-budget`, `--run-all-compositor-stages-before-draw` for reliable rendering
- PPTX slide count detected via `--dump-dom` reading `data-prez-total` instead of PDF page parsing
- Dev warning when Deck receives a single component child

### Fixed
- Infinite update loop in `usePresenter` when notes array identity changed between renders
- GitHub install failing due to missing `dist/` folder
- `setup.sh` referencing non-existent npm version `^0.1.0`
- PDF export rendering portrait/letter instead of 16:9 landscape
- Chrome headless screenshots capturing before React hydration

## [0.1.0] - 2026-03-21

Initial release.

### Added
- `Deck`, `Slide`, `Notes` components
- `useDeck()` hook
- Keyboard/touch/hash navigation
- Presenter mode via BroadcastChannel
- `prez init` CLI with interactive wizard
- `prez-image` CLI (AI generation, photo search, SVG rendering)
- PDF export via system Chrome `--print-to-pdf`
- PPTX export via system Chrome screenshots + pptxgenjs
- Vite + React + Tailwind template
- Startup pitch example deck
