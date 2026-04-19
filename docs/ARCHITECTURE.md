# Architecture

A walk-through of how the pieces fit together. Read this if you're about to change how windows are created, how review state is stored, or how `.apkg` files are parsed.

## Processes

Electron splits the app into two kinds of process:

- **Main process** ([electron/main.ts](../electron/main.ts)) — one per app. Owns the filesystem, window creation, the tray icon, IPC handlers, and all persistence. Authoritative for window list and config.
- **Renderer process** ([src/](../src/)) — one per window. Each renderer is a React tree rendered into `index.html`. Renderers talk to main via a narrow IPC surface exposed on `window.api` by the preload script ([electron/preload.ts](../electron/preload.ts)).

This separation is important: the renderer is sandboxed (no direct filesystem access). Anything that touches disk — reading `.apkg`, writing review state, reading/writing config — happens in main. The renderer asks main politely.

## Window identity

Each window has a UUID that's generated in main when the window is created. The ID is passed into the renderer two ways:

1. The main process includes `--window-id=<uuid>` in `webPreferences.additionalArguments` when constructing the `BrowserWindow`.
2. The preload script reads that argument from `process.argv` and stores it as `window.api.self.id`.

Every IPC call from the renderer that needs "this window's" state passes `self.id` as a parameter. That way the renderer code doesn't need to know anything about window management — it's just tagged with its own ID.

```
┌─────────────────── main process ───────────────────┐
│ windows: Map<id, BrowserWindow>                    │
│ config:  { windows: [{ id, apkgPath, bounds }] }   │
│                                                     │
│ IPC handlers:                                       │
│   self:state(id)         → WindowState | null      │
│   self:set-apkg(id, path)                          │
│   window:new             → opens a new window       │
│   window:close           (from the sender's window) │
│   apkg:pick              → shows dialog             │
│   apkg:read(path)        → ArrayBuffer              │
│   reviews:get(apkgPath)  → Reviews                  │
│   reviews:save(apkgPath, reviews)                   │
└─────────────────────────────────────────────────────┘
            ▲
            │  ipcRenderer.invoke
            ▼
┌────────── preload (per renderer) ──────────┐
│ const id = argv['--window-id=…']           │
│ contextBridge.exposeInMainWorld('api', …)  │
└────────────────────────────────────────────┘
            ▲
            │  window.api.*
            ▼
┌────────── renderer (per window) ──────────┐
│ <App />                                   │
│   useEffect: getState() → apkgPath        │
│   <ApkgPicker /> | <CardView />           │
└───────────────────────────────────────────┘
```

## Data flow: reviewing a card

1. **Renderer mounts** (`App.tsx`): calls `window.api.self.getState()` to learn which `.apkg` this window is supposed to show. If it's null, the deck picker is shown.
2. **Deck picker** (`ApkgPicker.tsx`) → user clicks "Choose .apkg file…" → `window.api.apkg.pick()` shows the native open dialog in main and returns a path. The renderer then calls `window.api.self.setApkg(path)` to persist the choice.
3. **CardView** (`CardView.tsx`) mounts with the apkg path. It calls:
   - `window.api.apkg.read(path)` → `ArrayBuffer` of the file
   - `window.api.reviews.get(path)` → saved review state for that deck
4. **Parsing** (`src/apkg.ts`): JSZip opens the archive; sql.js reads the `collection.anki21`/`.anki2` SQLite blob; we `SELECT id, flds FROM notes`, split each note's fields on `\x1f`, and return `{ id, front, back }` tuples.
5. **Queue build**: cards whose `due` is `<= now` (or which have no review record) are shuffled into a review queue.
6. **Click** the card → toggles `showBack`.
7. **Grade**: `onGrade('again' | 'hard' | 'easy')`
   - Runs `scheduler.grade(prev, grade)` to compute the new `CardState`.
   - Updates local `reviews` state.
   - Debounces a `window.api.reviews.save(path, reviews)` call (250ms trailing edge).
   - Re-queues the card a few slots back if it's still due within an hour (the short learning-step case).

## Persistence

Two files per deck, all under `app.getPath('userData')` (≈ `~/Library/Application Support/floating-anki/`):

- **`config.json`** — the whole `{ windows: WindowState[] }` structure. Rewritten whenever a window is created, moved, resized, has its deck changed, or is closed.
- **`reviews-<sha1>.json`** — the `Reviews` map for one deck. `<sha1>` is the first 16 hex chars of `sha1(apkgPath)`. Rewritten on each grade (debounced).

The hash is over the **path**, not the file contents. Moving or renaming a `.apkg` starts you over. This is a deliberate tradeoff: hashing contents would be slow on every launch and break if the user updates their deck. If you need identity stability across paths, use a stable directory for your decks.

## Scheduler

See [src/scheduler.ts](../src/scheduler.ts). Shape of a card's state:

```ts
type CardState = {
  ease: number;      // >= 1.3, default 2.5
  interval: number;  // days (0 => still in learning phase)
  due: number;       // Unix ms
  reps: number;
  lapses: number;
};
```

Two phases:

- **Learning** (`interval === 0`): sub-day steps in minutes. `Again` → 1 min, `Hard` → graduates to 1 day, `Easy` → graduates to 4 days.
- **Review** (`interval >= 1`): `Again` demotes back to learning (10 min relearn step, ease −0.2, lapse +1); `Hard` ×1.2, ease −0.15; `Easy` ×ease×1.3, ease +0.15.

`previewLabel(prev, grade)` shows what the next due interval would be for each button — used for the small text under the grade buttons.

## Build & launch

- `npm run dev` runs Vite with the `vite-plugin-electron` integration. Vite builds `electron/main.ts` → `dist-electron/main.js` and `electron/preload.ts` → `dist-electron/preload.js`; then Vite spawns the Electron binary pointed at the project root. Renderer changes hot-reload; main/preload changes need a manual restart.
- `npm run build` runs `tsc --noEmit`, then a production Vite build (renderer + electron), then `electron-builder` to package everything into `release/mac-<arch>/Floating Anki.app`. Signing is off by default (`identity: null` in `package.json`).

### Known caveats

- **`ELECTRON_RUN_AS_NODE=1`** in the environment makes the Electron binary behave as plain Node.js. `require('electron')` returns a path string instead of the API, and `ipcMain` is undefined. The `dev` script clears the variable with a `ELECTRON_RUN_AS_NODE=` prefix. Some harnesses (sandboxes, CI with Electron for scripting) set it globally; be aware.
- **`"type": "module"` in package.json** was removed because Node then treats `dist-electron/main.js` as ESM and Electron's CJS `require('electron')` breaks at load time. The source uses ESM syntax either way; Vite handles the transpilation.
- **userData path** is pinned via `app.setName('floating-anki')` before any `getPath` call. There's also a one-shot migration from the earlier `anki-floating` directory. Once we reach v1.0 that migration can be dropped.

## Extending

Some common modifications and where to make them:

| Goal                                       | Where                                                            |
|--------------------------------------------|------------------------------------------------------------------|
| Change grade intervals or ease bounds      | [src/scheduler.ts](../src/scheduler.ts) — top-of-file constants  |
| Render more than first-field / all-rest    | [src/apkg.ts](../src/apkg.ts) `loadCards`                        |
| Show media (images/audio)                  | extract `media` file in apkg.ts; rewrite `<img>` srcs in CardView|
| Add a keyboard shortcut                    | `CardView.tsx` (window-scoped) or `main.ts` (global via `globalShortcut`) |
| Add a new IPC method                       | Register in `main.ts`, expose in `preload.ts`, add to `types.d.ts` |
| Autostart on Linux / Windows               | New scripts in `scripts/` + README update                        |

When adding a new IPC method:

1. `ipcMain.handle('ns:action', ...)` in `electron/main.ts`
2. Add wrapper in `electron/preload.ts` under `window.api.ns.action`
3. Extend the `Window['api']` type in [src/types.d.ts](../src/types.d.ts)
