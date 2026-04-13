# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page web app that overlays an interactive hex/square grid on top of a background image (`PeripheryMap.png`) and lets users drop, drag, and annotate markers. There is no build system, package manager, or test suite — just open `HexMap.html` in a browser. All state is rendered to two stacked `<canvas>` elements and persisted to `localStorage` under the key `hexMapState`.

## Files

- `HexMap.html` — markup, all CSS, and the entire UI tree (side menu, edit panel, marker info panel, auth/confirm overlays, minimap). Loads `HexMap.js` at the bottom of `<body>`. Element IDs in the HTML are the contract that `HexMap.js` reaches into via `getElementById`.
- `HexMap.js` — the entire app, wrapped in an IIFE. ~1580 lines. No modules, no dependencies.
- `HexMap_new.js` — a stale/older variant of `HexMap.js` (uses `markerText` instead of `identifier`/`details`, lacks ship/planet/question shapes, no minimap or auth). It is **not loaded by `HexMap.html`** — treat it as dead code unless the user explicitly says otherwise.
- `markers.json` — example marker data matching the persisted shape; not auto-loaded, just a sample for the import textarea.
- `PeripheryMap.png` — large (~28MB) background image used as the default scene.

## Architecture notes

**Two-canvas rendering.** `#hexCanvas` draws the grid; `#markerCanvas` draws markers and is the only one that receives pointer events (`pointer-events: auto`). The background image (`#backgroundImg`) is a separate DOM `<img>` positioned underneath both canvases. All three are kept in sync by `updateImageTransform()` — pan moves the background's `transform: translate(...)`, while the grid and markers redraw from `state.gridPan`. Zoom only scales the background image; the grid and markers do not zoom (this is intentional — see `handleWheel`).

**Coordinate system.** Markers store integer `{col, row}`, never pixel coordinates. The pixel position is recomputed on every render from `gridType`, `gridWidth`, `gridHeight`, and `gridPan`. There are four hex layouts (`hexRowsOdd`, `hexRowsEven`, `hexColsOdd`, `hexColsEven`) plus `square` and `gridless`; the offset math for row-based vs column-based hex layouts is repeated in several places (`getMarkerAt`, `getHexAt`, `drawMarker`, `centerOnShip`, `finishCalibration`) — when changing the layout math, **update all of them together** or markers will visually drift from their click targets.

**Marker shapes.** `star`, `circle`, `square`, `triangle`, `question`, `planet`, `ship`. The `ship` shape is special-cased throughout: it has no color picker (always rendered with its stored color but the UI hides the swatches), it is draggable in edit mode (the only draggable marker type), it renders on top of all other markers (`renderMarkers` does two passes), and `getMarkerAt` checks ships first with a tighter hit radius.

**Edit mode gate.** `toggleMode()` opens an auth overlay; the password is the literal string `'admin'`, hardcoded in `submitAuth()`. This is not real security — it is a "don't accidentally edit the map" guard for a shared static page. Do not invest in hardening it unless asked.

**Persistence.** `saveState()` is called on most mutations and on `beforeunload`; `loadState()` runs once during `init()`. The persisted shape is `{ markers, settings: {...} }`. When adding a new piece of state that should survive reload, add it to **both** `saveState` and `loadState` (and the UI restoration block at the bottom of `loadState`).

**Calibration.** "Calibrate" mode asks the user to click three points on the background and type their `col,row` for each; `finishCalibration` then averages the residuals into `state.gridPan`. It does not solve for grid size or rotation.

## Running and iterating

- No build step. Open `HexMap.html` directly in a browser, or serve the directory with any static server (`python -m http.server`, etc.) if you need `file://` to behave.
- There are no tests, linters, or formatters configured. Manual verification means: load the page, toggle edit mode (`admin`), drop and drag markers across each grid type, hard-reload to confirm `localStorage` round-trips, and check the minimap and "Center on Ship" buttons.
- To reset persisted state during testing, clear `localStorage['hexMapState']` from devtools.

## Conventions to preserve

- Keep everything in the single IIFE in `HexMap.js`. No modules, no bundler.
- Keep all styling in `HexMap.html`'s `<style>` block. Inline `style="..."` is already used liberally for one-offs in the marker info panel and overlays — match the surrounding style rather than refactoring.
- Markers are plain objects, not class instances. The canonical fields are `{ col, row, color, shape, identifier, details }`. `loadState` and `importMarkers` both coerce legacy `text` → `identifier` for backward compat with older saves; preserve that coercion if you touch them.

## Tactical HUD reskin (2026-04-13)

The UI uses a tactical-HUD aesthetic driven by CSS custom properties on `:root` (amber palette, mono typography, chamfer/corner/scanline decoration primitives). All modal messaging goes through `showHudAlert` / `showHudConfirm` / `showHudPrompt` in `HexMap.js` — **do not re-introduce native `alert()` / `prompt()` / `confirm()`**, they break the aesthetic and the existing call-site patterns expect Promise-based dismissal. The viewport HUD overlay (`#viewportHud`) reads from existing render-loop state via `updateViewportHud()`; new render code that changes the cursor hex, zoom, or edit-mode state should call it. The radar minimap is a CSS clip-path mask over the unchanged rectangular `renderMinimap()` output — do not convert the projection to true polar coordinates without explicit user direction. The redesign loads JetBrains Mono and Inter from Google Fonts; local fallbacks handle offline `file://` use.
