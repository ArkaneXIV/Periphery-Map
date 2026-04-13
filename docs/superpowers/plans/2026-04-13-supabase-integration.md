# Supabase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded password with a SHA-256 hash stored in Supabase, and sync marker data + grid settings to Supabase so the map is shared across browsers, with localStorage as offline fallback.

**Architecture:** Supabase JS v2 loaded via CDN `<script>` tag. A `sb` client is initialized inside the IIFE with a guard (`typeof supabase !== 'undefined'`). On page load, `init()` tries to fetch from Supabase first; on failure it falls back to `loadState()` from localStorage. Saves always write localStorage first, then fire-and-forget sync to Supabase when in edit mode. Auth hashes the user's input with SHA-256 and compares against a hash fetched from Supabase (cached in localStorage for offline use).

**Tech Stack:** Supabase JS v2 (CDN UMD), Web Crypto API (`crypto.subtle.digest`), existing vanilla JS IIFE in `HexMap.js`

**Spec:** `docs/superpowers/specs/2026-04-13-supabase-integration-design.md`

---

### Task 1: Add Supabase CDN Script and Client Initialization

**Files:**
- Modify: `HexMap.html:8` (after Google Fonts link, before `<style>`)
- Modify: `HexMap.js:1` (inside IIFE, before DOM refs)

- [ ] **Step 1: Add the supabase-js CDN script tag to HexMap.html**

In `HexMap.html`, insert a new line after line 8 (the Google Fonts `<link>`) and before line 9 (`<style>`):

```html
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

- [ ] **Step 2: Add Supabase client initialization at the top of the IIFE in HexMap.js**

In `HexMap.js`, insert immediately after line 1 `(function () {` and before line 2 `const canvasHex = ...`:

```js
    const SUPABASE_URL = 'https://bnxxvbpjyuvjuqdjsxaw.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_7Es2Dkzgh3iKMuFGpiyFgw_RubTfAt_';
    const sb = (typeof supabase !== 'undefined')
        ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

```

- [ ] **Step 3: Verify no syntax errors**

Open `HexMap.html` in a browser. Open devtools console. Confirm:
- No JavaScript errors on load
- If online: `sb` is a Supabase client object (type `sb` in console — it won't be accessible because it's inside the IIFE, but the absence of errors confirms the CDN loaded and `createClient` succeeded)
- The map renders and functions exactly as before

- [ ] **Step 4: Commit**

```bash
git add HexMap.html HexMap.js
git commit -m "feat: add supabase-js CDN and client initialization"
```

---

### Task 2: Add hashString Helper Function

**Files:**
- Modify: `HexMap.js` (insert before `saveState()` at line ~1449, after line numbers shift from Task 1)

- [ ] **Step 1: Add the hashString function**

In `HexMap.js`, insert immediately before the `function saveState() {` line (currently line 1443, shifted to ~1449 after Task 1 insertions):

```js
    async function hashString(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

```

- [ ] **Step 2: Verify the function works**

Open `HexMap.html` in a browser. In devtools console, run:

```js
// Can't call hashString directly (IIFE scope), but verify crypto.subtle works:
crypto.subtle.digest('SHA-256', new TextEncoder().encode('admin'))
  .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
  .then(h => console.log(h));
```

Expected output: `8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918`

Confirm no errors on page load.

- [ ] **Step 3: Commit**

```bash
git add HexMap.js
git commit -m "feat: add SHA-256 hashString helper for password verification"
```

---

### Task 3: Add loadFromSupabase Function

**Files:**
- Modify: `HexMap.js` (insert after `hashString`, before `saveState()`)

- [ ] **Step 1: Add the loadFromSupabase function**

In `HexMap.js`, insert immediately after the `hashString` function (added in Task 2) and before `function saveState()`:

```js
    async function loadFromSupabase() {
        if (!sb) throw new Error('No Supabase client');
        const [configRes, markersRes] = await Promise.all([
            sb.from('config').select('*').eq('id', 1).single(),
            sb.from('markers').select('*')
        ]);
        if (configRes.error) throw configRes.error;
        if (markersRes.error) throw markersRes.error;
        return { config: configRes.data, markers: markersRes.data };
    }

```

- [ ] **Step 2: Verify no syntax errors**

Open `HexMap.html` in a browser. Confirm no JavaScript errors in console and the map renders normally. The function exists but is not called yet.

- [ ] **Step 3: Commit**

```bash
git add HexMap.js
git commit -m "feat: add loadFromSupabase to fetch config and markers"
```

---

### Task 4: Add syncToSupabase Function

**Files:**
- Modify: `HexMap.js` (insert after `loadFromSupabase`, before `saveState()`)

- [ ] **Step 1: Add the syncToSupabase function**

In `HexMap.js`, insert immediately after the `loadFromSupabase` function (added in Task 3) and before `function saveState()`:

```js
    async function syncToSupabase() {
        if (!sb) return;
        try {
            const { error: configErr } = await sb.from('config').upsert({
                id: 1,
                grid_type: state.gridType,
                grid_width: state.gridWidth,
                grid_height: state.gridHeight,
                grid_style: state.gridStyle,
                grid_thickness: state.gridThickness,
                grid_color: state.gridColor,
                grid_opacity: state.gridOpacity,
                zoom: state.zoom,
                grid_pan_x: state.gridPan.x,
                grid_pan_y: state.gridPan.y,
                scene_width: sceneWidth.value,
                scene_height: sceneHeight.value,
                offset_bg_horizontal: offsetBgHorizontal.value,
                offset_bg_vertical: offsetBgVertical.value,
            });
            if (configErr) throw configErr;
            const { error: delErr } = await sb.from('markers').delete().gt('id', 0);
            if (delErr) throw delErr;
            if (markers.length > 0) {
                const { error: insErr } = await sb.from('markers').insert(
                    markers.map(m => ({
                        col: m.col,
                        row: m.row,
                        color: m.color,
                        shape: m.shape,
                        identifier: m.identifier,
                        details: m.details,
                    }))
                );
                if (insErr) throw insErr;
            }
        } catch (e) {
            console.warn('Supabase sync failed:', e);
        }
    }

```

- [ ] **Step 2: Verify no syntax errors**

Open `HexMap.html` in a browser. Confirm no JavaScript errors in console and the map renders normally. The function exists but is not called yet.

- [ ] **Step 3: Commit**

```bash
git add HexMap.js
git commit -m "feat: add syncToSupabase for config upsert and marker sync"
```

---

### Task 5: Add Offline Notice HTML and CSS

**Files:**
- Modify: `HexMap.html` (add CSS rule after `.vp-readout:empty` rule, add HTML inside `#viewportHud`)

- [ ] **Step 1: Add the .vp-notice CSS rule**

In `HexMap.html`, find the line containing `.vp-readout:empty { display: none; }` (currently line 126). Insert the following CSS immediately after that line:

```css
        .vp-notice {
          position: absolute;
          top: 46px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--amber-bright);
          background: var(--bg-panel);
          border: 1px solid var(--amber-dim);
          padding: 5px 16px;
          z-index: 11;
          pointer-events: auto;
          cursor: pointer;
          animation: vpPulse 2s ease-in-out 3;
        }
```

- [ ] **Step 2: Add the offline notice element inside the viewport HUD**

In `HexMap.html`, find the `#viewportHud` div. Immediately before the closing `</div>` of `#viewportHud` (after the `vpZoomReadout` line, currently line 1079), insert:

```html
          <div class="vp-notice" id="vpOfflineNotice" style="display:none;">OFFLINE — SHOWING CACHED DATA</div>
```

The `#viewportHud` block should now look like:

```html
        <div id="viewportHud">
          <div class="vp-corner tl"></div>
          <div class="vp-corner tr"></div>
          <div class="vp-corner bl"></div>
          <div class="vp-corner br"></div>
          <div class="vp-pill vp-tr" id="vpEditModePill">▶ VIEW MODE</div>
          <div class="vp-readout vp-bl" id="vpHexReadout"></div>
          <div class="vp-readout vp-br" id="vpZoomReadout">ZOOM 1.00x</div>
          <div class="vp-notice" id="vpOfflineNotice" style="display:none;">OFFLINE — SHOWING CACHED DATA</div>
        </div>
```

- [ ] **Step 3: Verify the notice element exists but is hidden**

Open `HexMap.html` in a browser. In devtools Elements panel, confirm `#vpOfflineNotice` exists inside `#viewportHud` with `display:none`. The notice should not be visible. The map should render normally.

- [ ] **Step 4: Commit**

```bash
git add HexMap.html
git commit -m "feat: add offline notice banner HTML and CSS"
```

---

### Task 6: Modify init() to Load from Supabase First

**Files:**
- Modify: `HexMap.js` (rewrite `init()` to be async, add offline notice show/hide logic)

- [ ] **Step 1: Add offline notice show/hide helper**

In `HexMap.js`, insert immediately before the `function init() {` line:

```js
    function showOfflineNotice() {
        const el = document.getElementById('vpOfflineNotice');
        if (!el) return;
        el.style.display = '';
        el.addEventListener('click', () => { el.style.display = 'none'; }, { once: true });
        setTimeout(() => { el.style.display = 'none'; }, 8000);
    }

```

- [ ] **Step 2: Make init() async and add Supabase load**

Replace the opening of `init()` from:

```js
    function init() {
```

to:

```js
    async function init() {
```

Then, find the line `loadState();` inside `init()` (currently the second-to-last logic line before `window.addEventListener('beforeunload', saveState);`). Replace the block:

```js
        loadState();
        window.addEventListener('beforeunload', saveState);
        resizeCanvas();
        updateViewportHud({ zoom: state.zoom, editMode: false });
```

with:

```js
        let offline = false;
        try {
            const remote = await loadFromSupabase();
            const store = {
                markers: remote.markers.map(m => ({
                    col: m.col, row: m.row, color: m.color,
                    shape: m.shape, identifier: m.identifier, details: m.details
                })),
                settings: {
                    gridType: remote.config.grid_type,
                    gridWidth: remote.config.grid_width,
                    gridHeight: remote.config.grid_height,
                    gridStyle: remote.config.grid_style,
                    gridThickness: remote.config.grid_thickness,
                    gridColor: remote.config.grid_color,
                    gridOpacity: remote.config.grid_opacity,
                    zoom: remote.config.zoom,
                    gridPan: { x: remote.config.grid_pan_x, y: remote.config.grid_pan_y },
                    sceneWidth: remote.config.scene_width,
                    sceneHeight: remote.config.scene_height,
                    offsetBgHorizontal: remote.config.offset_bg_horizontal,
                    offsetBgVertical: remote.config.offset_bg_vertical,
                }
            };
            localStorage.setItem('hexMapState', JSON.stringify(store));
        } catch (e) {
            console.warn('Supabase load failed, using localStorage:', e);
            offline = true;
        }
        loadState();
        window.addEventListener('beforeunload', saveState);
        resizeCanvas();
        updateViewportHud({ zoom: state.zoom, editMode: false });
        if (offline) showOfflineNotice();
```

This flow:
1. Tries to fetch from Supabase. On success, writes the remote data to localStorage in the format `loadState()` expects.
2. On failure (Supabase unreachable, `sb` is null, network error), sets `offline = true`.
3. Always calls `loadState()` — it reads from localStorage regardless. If Supabase succeeded, localStorage now has the fresh remote data. If Supabase failed, localStorage has whatever was cached from previous sessions.
4. Shows the offline notice banner if the Supabase load failed.

- [ ] **Step 3: Verify online behavior**

Open `HexMap.html` served from a local HTTP server (not `file://`) with network connected. If the Supabase tables exist and have data, the data should load. If the tables are empty or don't exist yet, the Supabase call will error and the app falls back to localStorage — check for the offline notice appearing briefly and the console warning `Supabase load failed`.

Confirm:
- No JavaScript errors besides the expected Supabase 404 if tables don't exist yet
- The map renders correctly with existing localStorage data
- If tables exist: the offline notice does NOT appear

- [ ] **Step 4: Verify offline / file:// behavior**

Open `HexMap.html` as a local file (`file://` protocol). Confirm:
- The supabase-js CDN script fails to load (expected on `file://`)
- The console shows `Supabase load failed, using localStorage:` warning
- The offline notice appears, auto-dismisses after 8 seconds
- Click the notice to dismiss it immediately
- The map renders correctly from localStorage
- No other JavaScript errors

- [ ] **Step 5: Commit**

```bash
git add HexMap.js
git commit -m "feat: init loads from Supabase first with localStorage fallback"
```

---

### Task 7: Modify saveState() to Sync to Supabase

**Files:**
- Modify: `HexMap.js` (add `syncToSupabase()` call inside `saveState()`)

- [ ] **Step 1: Add the sync call to saveState()**

In `HexMap.js`, find the `saveState()` function. Currently it ends with:

```js
            localStorage.setItem('hexMapState', JSON.stringify(store));
        } catch (err) {}
    }
```

Replace those last three lines with:

```js
            localStorage.setItem('hexMapState', JSON.stringify(store));
        } catch (err) {}
        if (sb && isEditMode) syncToSupabase();
    }
```

The `syncToSupabase()` call is fire-and-forget (no `await`). It only fires when:
- `sb` is available (Supabase CDN loaded, not `file://` mode)
- `isEditMode` is true (the user is authenticated and editing)

Viewers never trigger Supabase writes.

- [ ] **Step 2: Verify behavior**

Open `HexMap.html` in a browser. Confirm:
- In view mode: no network requests to Supabase on interactions
- After entering edit mode (requires Task 8 for hash-based auth, so for now test with the old `admin` password if Task 8 is not yet done): changes to grid settings or markers trigger Supabase writes visible in the Network tab as POST requests to `rest/v1/config` and `rest/v1/markers`
- localStorage still updates on every save (existing behavior preserved)

- [ ] **Step 3: Commit**

```bash
git add HexMap.js
git commit -m "feat: saveState syncs to Supabase in edit mode"
```

---

### Task 8: Modify submitAuth() for Hash-Based Authentication

**Files:**
- Modify: `HexMap.js` (rewrite `submitAuth()` to be async, use Supabase hash)

- [ ] **Step 1: Rewrite submitAuth()**

In `HexMap.js`, find the `submitAuth()` function (currently around line 1203 after earlier insertions). Replace the entire function:

```js
    function submitAuth() {
        const input = document.getElementById('authInput');
        const error = document.getElementById('authError');
        if (input.value !== 'admin') {
            error.textContent = 'Incorrect code. Access denied.';
            input.value = '';
            input.focus();
            return;
        }
        document.getElementById('authOverlay').classList.remove('visible');
        isEditMode = true;
        updateViewportHud({ editMode: true });
        document.getElementById('modeToggleLabel').textContent = 'Switch to View Mode';
        editPanel.style.display = 'block';
        hideMarkerInfo();
        openEditPanelFor(selectedMarker);
        tooltip.style.display = 'none';
        render();
    }
```

with:

```js
    async function submitAuth() {
        const input = document.getElementById('authInput');
        const error = document.getElementById('authError');
        error.textContent = '';
        let storedHash = null;
        if (sb) {
            try {
                const { data, error: fetchErr } = await sb
                    .from('config').select('password_hash').eq('id', 1).single();
                if (!fetchErr && data && data.password_hash) {
                    storedHash = data.password_hash;
                    localStorage.setItem('hexMapPasswordHash', storedHash);
                }
            } catch (e) {
                console.warn('Failed to fetch password hash from Supabase:', e);
            }
        }
        if (!storedHash) {
            storedHash = localStorage.getItem('hexMapPasswordHash');
        }
        if (!storedHash) {
            error.textContent = 'Connection required for first-time setup.';
            input.value = '';
            input.focus();
            return;
        }
        const inputHash = await hashString(input.value);
        if (inputHash !== storedHash) {
            error.textContent = 'Incorrect code. Access denied.';
            input.value = '';
            input.focus();
            return;
        }
        document.getElementById('authOverlay').classList.remove('visible');
        isEditMode = true;
        updateViewportHud({ editMode: true });
        document.getElementById('modeToggleLabel').textContent = 'Switch to View Mode';
        editPanel.style.display = 'block';
        hideMarkerInfo();
        openEditPanelFor(selectedMarker);
        tooltip.style.display = 'none';
        render();
    }
```

This function now:
1. Tries to fetch `password_hash` from Supabase. On success, caches it in localStorage under key `hexMapPasswordHash`.
2. If Supabase fetch fails, reads the cached hash from `localStorage.getItem('hexMapPasswordHash')`.
3. If no hash is available at all (first load, never connected), shows "Connection required for first-time setup."
4. Hashes the user's input with SHA-256 via `hashString()`.
5. Compares hex strings. Match: enters edit mode. Mismatch: shows error.

The function is now `async` — the existing event listeners (`addEventListener('click', submitAuth)` and the Enter key handler) will call it and get a Promise back, which is fine since they don't use the return value.

- [ ] **Step 2: Set the password hash in Supabase**

Before testing, you need a password hash in the `config` table. Run this in the Supabase SQL editor to set the password to `admin` (for testing):

```sql
UPDATE config SET password_hash = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' WHERE id = 1;
```

(That hash is SHA-256 of the string `admin`.)

- [ ] **Step 3: Verify online auth**

Open `HexMap.html` served from HTTP with network connected. Click "Switch to Edit Mode":
- Type `admin` → should enter edit mode
- Type `wrong` → should show "Incorrect code. Access denied."
- Check devtools Network tab: a GET request to `rest/v1/config?select=password_hash&id=eq.1` should appear

- [ ] **Step 4: Verify offline auth (cached hash)**

After one successful online auth, disconnect the network. Reload the page. Try to enter edit mode:
- Type `admin` → should still work (hash is cached in localStorage under `hexMapPasswordHash`)
- Type `wrong` → should show error

- [ ] **Step 5: Verify offline auth (no cache)**

Clear localStorage (`localStorage.clear()` in console). With network disconnected, try to enter edit mode:
- Should show "Connection required for first-time setup."

- [ ] **Step 6: Commit**

```bash
git add HexMap.js
git commit -m "feat: submitAuth uses SHA-256 hash from Supabase with offline cache"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (append Supabase integration section)

- [ ] **Step 1: Add Supabase integration documentation**

Append the following to the end of `CLAUDE.md`:

```markdown

## Supabase integration (2026-04-13)

The app syncs marker data and grid settings to a Supabase project (`config` table for settings + password hash, `markers` table for marker data). The supabase-js v2 CDN script is loaded in `HexMap.html`; the client (`sb`) is initialized at the top of the IIFE with a `typeof supabase !== 'undefined'` guard so the app still works on `file://` or offline (falls back to pure localStorage). On load, `init()` (now async) tries `loadFromSupabase()` first, writes the result to localStorage, then calls `loadState()` as before — if Supabase fails, `loadState()` reads whatever was cached. `saveState()` still writes localStorage on every mutation; when `isEditMode` is true and `sb` is available, it also fire-and-forgets `syncToSupabase()`, which upserts the `config` row (excluding `password_hash`) and does a delete-all + re-insert on `markers`. Auth uses `submitAuth()` (now async): it fetches `password_hash` from Supabase, caches it in localStorage under key `hexMapPasswordHash`, hashes the user's input with SHA-256 via `hashString()`, and compares. The `password_hash` is set via the Supabase SQL editor, never from the app.
```

- [ ] **Step 2: Update the Edit mode gate paragraph**

In `CLAUDE.md`, find the paragraph starting with `**Edit mode gate.**` and replace it with:

```markdown
**Edit mode gate.** `toggleMode()` opens an auth overlay; `submitAuth()` (async) fetches a SHA-256 password hash from Supabase (cached in localStorage for offline use) and compares it against the hash of the user's input. The hash is set via the Supabase SQL editor — the app never writes `password_hash`. This is not real security (anon key, no RLS) — it is a "don't accidentally edit the map" guard.
```

- [ ] **Step 3: Update the Persistence paragraph**

In `CLAUDE.md`, find the paragraph starting with `**Persistence.**` and replace it with:

```markdown
**Persistence.** `saveState()` writes `{markers, settings}` to localStorage on most mutations and on `beforeunload`; when `isEditMode` and Supabase is available, it also fire-and-forgets `syncToSupabase()`. `init()` (async) tries `loadFromSupabase()` first, writes the result to localStorage, then calls `loadState()`. If Supabase is unreachable, `loadState()` reads from whatever localStorage has cached. When adding new state: add it to `saveState`, `loadState`, and the Supabase column mapping in both `loadFromSupabase` (read) and `syncToSupabase` (write).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Supabase integration notes"
```

---

### Task 10: End-to-End Verification

This task has no code changes. It is a manual verification checklist matching the spec's section 6.

- [ ] **Step 1: Online load**

Open the page with Supabase reachable. Markers and settings load from Supabase. No offline notice.

- [ ] **Step 2: Offline load**

Disconnect network (or use `file://`). Page loads from localStorage. Offline notice appears, auto-dismisses after 8 seconds.

- [ ] **Step 3: Auth (online)**

Type correct password → edit mode. Type wrong password → error. Password is never visible in source (only the hash is fetched).

- [ ] **Step 4: Auth (offline, cached)**

Disconnect after one successful load. Auth still works using cached hash.

- [ ] **Step 5: Auth (offline, no cache)**

Clear localStorage, disconnect. Auth shows "Connection required for first-time setup."

- [ ] **Step 6: Save markers**

Add/edit/delete a marker in edit mode. Reload page → marker changes persist (both Supabase and localStorage).

- [ ] **Step 7: Save settings**

Change grid type, dimensions, zoom. Reload → settings persist.

- [ ] **Step 8: Cross-browser sync**

Edit on browser A. Open browser B → sees the same markers and settings.

- [ ] **Step 9: file:// mode**

Open `HexMap.html` as a local file. App works exactly as before (localStorage only, supabase-js CDN doesn't load, no errors in console).

- [ ] **Step 10: No native dialogs**

Grep `HexMap.js` for `\b(alert|prompt|confirm)\(` — zero matches outside comments.
