# Periphery Map — Tactical HUD UI Redesign

**Date:** 2026-04-13
**Status:** Approved design — pending implementation plan
**Scope:** Visual reskin of the existing Periphery Map web app + targeted layout polish, no behavioral or data-shape changes.

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Reskin depth | **B** — Reskin + light layout polish (no structural rework) |
| Visual direction | **Tactical HUD** (sci-fi command-deck) |
| Palette | **Amber on near-black** (warm orange, single accent) |
| Density | **Full HUD** (max chrome — corner brackets, scanlines, ticks, monospaced typography, heavy glow, status strips, decorative glyphs) |
| Layout polish targets | **2, 3, 4, 5, 6, 7** (skip target 1 — keep the hamburger toggle, no permanent docked panel) |

---

## 2. Approach & file-level architecture

**What changes:**

- Wholesale rewrite of the `<style>` block in `HexMap.html`.
- Additive markup changes to `HexMap.html`'s `<body>`: a new viewport HUD overlay layer, a hidden HUD modal template, restyled tabs/swatches that retain existing IDs.
- Additive JS changes to `HexMap.js`: a HUD modal helper trio replacing native `alert()`/`prompt()`/`confirm()`, an `updateViewportHud()` function called from existing render code paths, and an `updateRadarShipMarker()` helper called from `renderMinimap()` to position the radar's ship-tracking crosshair (the rest of the radar chrome is pure CSS).

**What does NOT change:**

- Marker data shape: `{ col, row, color, shape, identifier, details }`.
- Every existing element ID — every `getElementById` call in `HexMap.js` keeps working.
- Grid/marker rendering math: `drawSquareGrid`, `drawHexagon`, `drawMarker`, coordinate system, hit-testing.
- `localStorage['hexMapState']` shape — no migration; existing saves load unchanged.
- All keyboard/pointer behavior: left-click add/select, middle-click pan, ship drag, hover hex info, wheel zoom, Delete to remove marker, Enter/Esc in modals.
- The `'admin'` edit-mode password (still a guard, not security).
- `markers.json` example file.
- `HexMap_new.js` — stays dead code, not loaded.

**Files touched:**

- `HexMap.html` — `<style>` block rewritten; body markup gains viewport HUD overlay layer + HUD modal template; existing IDs preserved.
- `HexMap.js` — adds HUD modal helpers, `updateViewportHud()`, radar chrome support; minor edits at native-dialog call sites.
- `CLAUDE.md` — single-paragraph addition documenting the new tokens, helpers, and the rule against re-introducing native dialogs.

**No new files.** Single-page, single-script, no build step. The redesign respects the existing CLAUDE.md convention: keep everything in the IIFE, keep all CSS in `HexMap.html`'s `<style>` block.

---

## 3. Design tokens

All CSS custom properties live on `:root` so the palette and primitives can be swapped from a single block.

### Color tokens

```css
:root {
  --bg-deep:      #05080c;                          /* page background */
  --bg-panel:     rgba(8,14,22,0.92);               /* panel surfaces (translucent) */
  --bg-elev:      rgba(8,14,22,0.96);               /* elevated surfaces (modals) */

  --amber:        #ffaa33;                          /* primary accent */
  --amber-bright: #fff3d4;                          /* high-emphasis text on active states */
  --amber-dim:    rgba(255,170,40,0.4);             /* borders, muted labels */
  --amber-glow:   rgba(255,170,40,0.5);             /* box-shadow / text-shadow color */
  --amber-bg:     rgba(255,170,40,0.18);            /* active button fill */

  --text:         #d6e2ee;                          /* body text */
  --text-dim:     rgba(214,226,238,0.6);            /* secondary text */

  --danger:       #ff4a3d;                          /* delete buttons, error states */
  --scan:         rgba(255,170,40,0.04);            /* scanline overlay */
}
```

### Typography tokens

```css
:root {
  --font-mono: 'JetBrains Mono', 'Consolas', 'SF Mono', monospace;
  --font-sans: 'Inter', -apple-system, sans-serif;

  --fs-label: 9px;   /* uppercase labels, letter-spacing 2.5px */
  --fs-body:  11px;  /* buttons, meta */
  --fs-name:  13px;  /* marker identifiers */
  --fs-h:     8px;   /* tiny header bars, letter-spacing 2.5px */
}
```

Mono is the default for the entire UI (Full HUD density). Sans is reserved as a readability escape hatch for one specific place: marker `details` body text in the marker info panel, where long descriptions in monospace become unreadable.

### Decoration primitives

```css
:root {
  /* Top-left chamfer (12px cuts) */
  --clip-tl: polygon(12px 0, 100% 0, 100% calc(100% - 12px),
                     calc(100% - 12px) 100%, 0 100%, 0 12px);
  /* Top-right chamfer */
  --clip-tr: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%,
                     12px 100%, 0 calc(100% - 12px));
}
```

Plus utility classes used across components:

- `.hud-corners` — drops 4 corner brackets via `::before`/`::after` and child elements.
- `.scanlines` — adds the repeating-linear-gradient scanline overlay via `::before`.
- `.glow-text` — `text-shadow: 0 0 8px var(--amber-glow)` for active labels.

### Font loading

Add `<link>` tags in `<head>` for JetBrains Mono and Inter from Google Fonts. Local fallbacks in the font stack handle offline `file://` use cleanly. CLAUDE.md notes this so future maintainers know the redesign added a network dependency for full visual fidelity.

---

## 4. Component changes

Every component below preserves its existing ID, classes that JS reads, and event-handler contract. Only `<style>` and minor markup change.

### Hamburger toggle (`#menuToggle`)

Square chamfered button (40×40, same position as today). 1px amber border, scanline overlay, three short amber bars, faint amber glow on hover. Open state lights the border to full `--amber` with a glow ring.

### Side menu dropdown (`#sideMenu`)

Clip-path angular panel with `.hud-corners` + `.scanlines`, 1px amber border. Each menu button (`Edit Mode`, `Highlight`, `Center on Ship`, `Toggle Minimap`) becomes a mono-uppercase button with a `►` glyph prefix. States:

- Idle: faint amber border, `--text` color.
- Hover: border to 0.4 alpha, subtle background brighten.
- Active: `--amber-bg` fill, full amber border, inset glow + text-shadow, `--amber-bright` text, left-edge accent bar.

### Edit panel (`#editPanel`)

Main editing surface, fixed width ~280px, right-aligned. Full chamfer + `.hud-corners` + `.scanlines`, amber border. Header gets a `// EDIT INTERFACE` mono label strip.

### Tabs (`Markers` / `Grid`) — polish target 4

Currently top tabs (`.edit-tab-btn`, `.edit-tab-content`). Repainted as a HUD segmented control:

- Tab buttons become flush-fitting trapezoids (subtle clip-path), mono uppercase labels.
- Active tab gets a bottom-edge amber underline + amber text, inactive tabs are dim amber-on-transparent.
- The bottom border of the tab strip becomes a thin amber rule with two flanking corner ticks.
- Existing `data-tab` attribute handlers preserved unchanged.

### Inputs (text, number, textarea, select, file)

- Fill: `rgba(255,255,255,0.04)`.
- Border: 1px `--amber-dim`.
- Focus: full `--amber` border + `0 0 8px var(--amber-glow)`.
- Font: `--font-mono`, white text.
- Corners: sharp 1–2px, no rounding.
- Number inputs: native spin buttons hidden, replaced with subtle inset arrows.

### Range slider (grid opacity)

- Track: thin `--amber-dim` rule.
- Fill: `--amber`.
- Thumb: 12×12 amber square with a glow.
- Numeric companion input uses the same input style.

### Color pickers (native `<input type="color">`)

Browser-native widgets can't be fully styled. Wrap each in a 28×28 amber-bordered chamfered square so the user sees the swatch through the wrapper but the chrome reads as HUD.

### Shape picker (`#markerShapePicker`) — polish target 6

The 7 shape buttons (star/circle/square/triangle/question/planet/ship) become 1px `--amber-dim` bordered tiles:

- Idle: monochrome white-on-dark SVGs, mono uppercase label below.
- Hover: border brightens to mid-amber.
- Active: `--amber-bg` fill, full amber border, glow, SVG stroke shifts to `--amber`, label brightens.

### Color swatches (`#markerColorSwatches`) — polish target 6

The 10 color buttons keep their assigned colors (these are semantic — the user picks them per marker). They become 24×24 chamfered squares:

- Idle: 1px `--amber-dim` border.
- Active: 2px `--amber` border, outer glow, small amber tick mark in the corner.

### Buttons (primary / secondary / danger)

- **`.btn-primary`** — chamfer, 1px amber border, `--amber-bg` fill, `--amber-bright` mono uppercase text, glow on hover.
- **`.btn-secondary`** — same shape, no fill, `--amber-dim` border, `--text` color, fills lightly on hover.
- **`.btn-danger`** — same shape, `--danger` border and text, dim red fill on idle, full red fill + white text on hover. Used for `Delete`, `Clear All Markers`, confirm-delete.

### Marker info panel (`#markerInfoPanel`)

The right-edge hex info display. Becomes a chamfered HUD card:

- `.hud-corners` + `.scanlines` + amber border.
- Header: thin `// MARKER DETAIL` strip, then `HEX 28.19` in `--amber` mono caps.
- Each marker entry: a glowing 9×9 square in the marker's color, the identifier in `--amber-bright` mono caps, the shape name in dim mono caps right-aligned, the details text in **`--font-sans`** (the readability escape hatch).
- Multi-marker cells: thin amber separator between entries.

### Tooltip (`#markerTooltip`)

Mono uppercase text on dark panel, thin amber border, no rounded corners. Currently white-on-white; restyle to fit.

### Auth overlay (`#authOverlay`) and confirm-delete overlay (`#confirmDeleteOverlay`) — polish target 7

Both share the new `.hud-modal` class (Section 5). They keep all existing IDs, button handlers, and Enter/Esc behavior.

---

## 5. New layout polish elements

### Polish target 2 — HUD modal system

**Replaces native dialog calls at:**

- `startCalibration()` — `alert('Calibration mode: ...')`
- `handleCalibrationClick()` — `prompt('Point N/3 - enter grid coords (col,row)', '0,0')` + invalid-input `alert`
- `finishCalibration()` — `alert('Calibration complete!')`
- `importMarkers()` — `alert('Invalid JSON')`

**HTML addition:** Single hidden template `<div id="hudModal">` with the standard HUD chrome (chamfer, corner brackets, scanlines, mono header, body slot, button row slot). Repurposed by the helpers below.

**JS addition (in `HexMap.js`):** Three Promise-returning helpers:

```js
showHudAlert(title, message) → Promise<void>
showHudConfirm(title, message, { confirmText, cancelText }) → Promise<boolean>
showHudPrompt(title, message, { defaultValue, placeholder }) → Promise<string|null>
```

Each populates the shared `#hudModal` template, shows it, wires button handlers, and resolves on dismiss. Esc cancels, Enter confirms, click-outside cancels (matching the existing auth overlay's behavior).

**Call-site changes:** ~6 call sites become `await`-based. The calibration flow is already an interactive 3-step flow so async fits naturally. `importMarkers` and the standalone alerts become fire-and-forget `showHudAlert`.

**Convention:** Going forward, all modal messaging uses these helpers. Native `alert`/`prompt`/`confirm` are forbidden in this codebase. CLAUDE.md will state this explicitly.

### Polish target 3 — Viewport HUD overlay

**What it is:** A new fixed-position layer above both canvases but below the side menu / edit panel / info panel. `pointer-events: none` on the layer; readouts are read-only.

**HTML addition:**

```html
<div id="viewportHud">
  <div class="vp-corner tl"></div>
  <div class="vp-corner tr"></div>
  <div class="vp-corner bl"></div>
  <div class="vp-corner br"></div>

  <div class="vp-strip vp-tl">
    <span class="dot"></span> // PERIPHERY MAP
  </div>
  <div class="vp-pill vp-tr" id="vpEditModePill">▶ VIEW MODE</div>
  <div class="vp-readout vp-bl" id="vpHexReadout"></div>
  <div class="vp-readout vp-br" id="vpZoomReadout">ZOOM 1.00x</div>
</div>
```

**Components:**

- **Four corner brackets** (CSS, ~24px each, 2px amber lines, glow).
- **Top-left status strip** — `// PERIPHERY MAP` with a slowly pulsing amber dot (page-is-live indicator). Just inside the top-left corner bracket.
- **Top-right edit-mode pill** — `▶ VIEW MODE` (dim amber) or `● EDIT MODE` (bright amber + glow + slow pulse) depending on `isEditMode`.
- **Bottom-left coordinate readout** — `HEX 28.19` showing the cursor's current hex. Empty string when the cursor leaves the canvas.
- **Bottom-right zoom indicator** — `ZOOM 1.00x` reading from `state.zoom`.

**JS addition:** `updateViewportHud()` function called from:

- `handlePointerMove` — updates `#vpHexReadout` from existing `getHexAt()` call.
- `canvasMarkers` `pointerleave` — clears `#vpHexReadout`.
- `handleWheel` — updates `#vpZoomReadout` from `state.zoom`.
- `submitAuth` (entering edit mode) — updates `#vpEditModePill`.
- `toggleMode` (leaving edit mode) — updates `#vpEditModePill`.

Reads from existing state, writes `textContent` and toggles a CSS class on the pill. ~30 lines including the helper.

**Why it earns its complexity:** With Full HUD density, restricting chrome to the side panels would feel inconsistent — the viewport itself needs HUD framing or the panels look like they're floating on a normal webpage. The viewport HUD overlay is the cheapest way to make the entire page feel like a tactical display, not just the panels.

### Polish target 5 — Radar minimap

**Interpretation lock:** Existing rectangular projection math is preserved. We mask the existing minimap canvas into a circular viewport and add chrome around it. We do **not** rewrite `renderMinimap()` to true polar coordinates.

**Markup changes:** `#minimapCanvas` and `#minimapWrap` get restyled:

- Wrap becomes a circular HUD frame: chamfered square container, circular cutout, outer amber bezel ring, four cardinal direction tick marks (N/E/S/W as small mono labels), thin outer amber circle.
- Canvas gets `clip-path: circle(50%)` so the existing rectangular `renderMinimap()` output is masked to a disc. **No JS rendering changes for the masking itself.** Pure CSS.
- Minimap dimensions: resize `#minimapCanvas` from current 210×130 to 210×210 (square). The existing letterboxing in `renderMinimap()` already handles non-matching aspect ratios — the scene image will just letterbox inside the square; the circular mask hides the letterbox bars.

**Sweep line:** CSS-only `::after` on the wrap. A thin radial gradient (transparent → amber → transparent) rotated by:

```css
@keyframes radarSweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

over ~4 seconds. No JS, no per-frame work, GPU-composited.

**Range rings:** Two thin amber circles at 33% and 66% radius, drawn as CSS `border-radius: 50%` divs absolutely-positioned over the wrap (`pointer-events: none`).

**Ship-tracking crosshair:**

- A small crosshair element + a thin pulsing ring around it, both inside the radar wrap, absolutely positioned.
- Position is computed by a new helper `updateRadarShipMarker()` called from the existing `renderMinimap()` after the existing draw passes.
- Math: reuse the existing `worldToMinimap(wx, wy)` function from `renderMinimap()`. Find the ship marker using the same precedence as the existing `centerOnShip()` function — `selectedMarker` if it's a ship, else `markers.find(m => m.shape === 'ship')`. Translate to minimap pixel coordinates, then translate to wrap-local coordinates accounting for the canvas's position inside the wrap.
- If no ship marker exists, `display: none` the crosshair element. Falls back gracefully to "decoration-free radar."
- The pulse is a CSS animation on the ring.

**Existing minimap behavior preserved:**

- Click-to-pan (`minimapNavigate`) still works. The click handler reads from `minimapCanvas.getBoundingClientRect()` — the canvas is still a rectangle in event space, just visually clipped. Edge clicks at the corners (now hidden behind the mask) won't pan; acceptable.
- `worldToMinimap` math unchanged.
- Marker dots and viewport rectangle still draw inside the (now-clipped) canvas.

**Risk note:** This is the only place where the redesign visually loses information — the four corner regions of the previously-rectangular minimap are now hidden by the circular mask. If the user later finds this loses too much, revisit by either (a) shrinking scene rendering inside the canvas to fit fully within the inscribed circle, or (b) accepting the corners are dead space.

---

## 6. Out of scope

Explicitly NOT touching in this redesign:

- **Marker rendering** (`drawMarker`) — shapes and glow/highlight passes already look HUD-appropriate; recoloring them would break user-assigned semantic colors.
- **Grid drawing** (`drawSquareGrid`, hex draw functions, point styles) — grid color is user-configurable and serves a functional purpose.
- **Coordinate math, hit-testing, panning, zoom, calibration logic** — preserved exactly.
- **`localStorage['hexMapState']` shape** — no migration; existing saved sessions load unchanged.
- **The `'admin'` password gate** — same string, same behavior.
- **`markers.json`** — example file untouched.
- **`HexMap_new.js`** — stays dead, not loaded.
- **Permanent docked side panel** (polish target 1) — explicitly skipped per user decision; the hamburger toggle stays.

---

## 7. Preserved behavior contract

Things to grep/verify before declaring the rewrite done:

- Every existing `getElementById(...)` call in `HexMap.js` still resolves to a live element with the same role.
- Every class that JS reads or toggles still exists and toggles the same way: `.shape-btn`, `.color-swatch`, `.edit-tab-btn`, `.edit-tab-content`, `.menu-btn`, `.active`, `.open`, `.visible`.
- `localStorage['hexMapState']` round-trips unchanged.
- All keyboard shortcuts: `Delete` removes selected marker, `Enter`/`Esc` in modals.
- Pointer behavior on `#markerCanvas`: left-click add/select, middle-click pan, drag ships, hover hex info, wheel zoom.

---

## 8. Verification checklist

Run through this in a real browser before declaring the redesign complete:

1. Open `HexMap.html` in a browser. Page loads, no console errors.
2. Background image and grid render. Hover a hex — `#vpHexReadout` updates.
3. Click hamburger — `#sideMenu` opens with new HUD styling.
4. Toggle minimap — radar appears with circular mask, sweep animation, range rings; ship crosshair appears if a ship exists, hides otherwise.
5. Click "Edit Mode" → auth overlay (HUD styling) → type `admin` → Enter → edit panel (HUD styling) appears, `#vpEditModePill` flips to `● EDIT MODE`.
6. Click empty hex → pending marker appears, edit panel populates → set identifier/details, pick shape, pick color → Save → marker persists.
7. Click an existing marker → edit panel populates with its data.
8. Drag a ship marker → it follows pointer, snaps on release, position persists.
9. Click "Calibrate Grid" → HUD modal alert appears (replacing native `alert`) → click 3 hexes, each prompts a HUD modal for col,row → on third, completion HUD modal appears.
10. Switch to "Grid" tab → tab visually swaps, grid controls visible with HUD inputs. Change grid type / size / opacity / color → main canvas updates.
11. Export markers → JSON appears in textarea + clipboard. Paste different JSON, click Import → markers update.
12. "Clear All Markers" → HUD confirm-delete overlay → type `DELETE` → markers cleared.
13. Hard-reload → all state restored from `localStorage` (markers, grid settings, scene dimensions, pan/zoom).
14. Switch to View Mode → edit panel hides, `#vpEditModePill` flips to dim `▶ VIEW MODE`, clicking a hex shows the marker info panel with HUD styling.
15. Resize window → canvases and viewport HUD overlay reflow.

---

## 9. Open risks

- **Google Fonts loading.** Opening `HexMap.html` via `file://` while offline causes the font fetch to fail silently; local fallbacks (`Consolas`, `-apple-system`) take over. Acceptable degradation. Documented in CLAUDE.md.
- **Chamfered clip-paths interact with `box-shadow`.** Shadows get clipped by the same path. Mitigation: use a wrapping element with `box-shadow` on the wrapper and `clip-path` on the inner element where glow needs to escape the chamfer.
- **Scanline pseudo-elements on translucent panels** can shift the perceived background color of the panel against `PeripheryMap.png`. Keep scanline opacity ≤ 0.04 and verify against the actual map background.
- **Heavy text-shadow glow on dense mono text** can become illegible at small sizes. Tune per-component during implementation; back off the glow on small text.
- **Radar circular crop loses corner regions** of the minimap. Documented in §5; revisit if it bites.

---

## 10. CLAUDE.md update

Add a single paragraph to `CLAUDE.md` after the existing "Conventions to preserve" section:

> **Tactical HUD reskin (2026-04-13).** The UI uses a tactical-HUD aesthetic driven by CSS custom properties on `:root` (amber palette, mono typography, chamfer/corner/scanline decoration primitives). All modal messaging goes through `showHudAlert` / `showHudConfirm` / `showHudPrompt` in `HexMap.js` — **do not re-introduce native `alert()` / `prompt()` / `confirm()`**, they break the aesthetic and the existing call-site patterns expect Promise-based dismissal. The viewport HUD overlay (`#viewportHud`) reads from existing render-loop state via `updateViewportHud()`; new render code that changes the cursor hex, zoom, or edit-mode state should call it. The radar minimap is a CSS clip-path mask over the unchanged rectangular `renderMinimap()` output — do not convert the projection to true polar coordinates without explicit user direction. The redesign loads JetBrains Mono and Inter from Google Fonts; local fallbacks handle offline `file://` use.
