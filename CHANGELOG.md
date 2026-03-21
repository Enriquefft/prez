# Changelog

All notable changes to this project will be documented in this file.

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
