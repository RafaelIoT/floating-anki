# Floating Anki

An always-on-top flashcard window for macOS. Loads `.apkg` deck exports directly — no desktop Anki required — and gives you lightweight spaced repetition in an ambient panel that stays on top of your other work.

One window per deck. Click to flip, grade with three buttons, close when you're done. Reviews persist across launches. Optional launchd agent starts the app at login and reopens it within ~10s if you ever quit it.

![screenshot placeholder](docs/screenshot.png)

---

## Table of contents

- [Why](#why)
- [Features](#features)
- [Platform support](#platform-support)
- [Install](#install)
- [Usage](#usage)
  - [Getting a .apkg](#getting-a-apkg)
  - [First run](#first-run)
  - [Reviewing](#reviewing)
  - [Multiple windows](#multiple-windows)
  - [Autostart + watchdog](#autostart--watchdog-macos)
- [Where your data lives](#where-your-data-lives)
- [Scheduler](#scheduler)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Why

- You want quick passive review without opening the full Anki app every time.
- You don't have (or want) desktop Anki installed.
- You already have a `.apkg` from AnkiWeb, a shared deck, or a friend.
- You want a small window per deck that you can arrange across your screen and leave running.

This tool is intentionally minimal. It is **not** an Anki clone — it only reads `.apkg` files, keeps its own review state, and doesn't sync anywhere.

## Features

- Frameless, always-on-top window that stays visible in fullscreen apps too
- Loads any `.apkg` file (older Anki format — see [Limitations](#limitations))
- Click to flip; grade with **Don't know / Hard / Easy** and see a live preview of each button's next-due interval
- Progress persists to disk, per deck, across launches
- **Multi-window**: open one window per deck, each with its own position, size, and selected deck. Decks opened in more than one window share progress.
- **Autostart + watchdog** on macOS via launchd: starts at login and reopens the app within ~10s if you fully quit it

## Platform support

- **macOS** — primary target. Tested on Apple Silicon, macOS 15.x.
- **Linux / Windows** — the core Electron app will build, but:
  - The autostart script is macOS-only (uses launchd).
  - Nothing else is tested.
  - PRs for a systemd user unit or Windows Task Scheduler integration are welcome.

## Install

### Prebuilt `.app` (recommended)

1. Grab `Floating Anki.app` from the latest [release](https://github.com/RafaelIoT/floating-anki/releases).
2. Move it to `~/Applications/` or `/Applications/`.
3. Remove macOS's quarantine flag (required because releases are not code-signed):
   ```sh
   xattr -dr com.apple.quarantine ~/Applications/"Floating Anki.app"
   ```
4. Launch it from Finder or Spotlight.

### From source

```sh
git clone https://github.com/RafaelIoT/floating-anki
cd floating-anki
npm install
npm run build
```

The built app appears at `release/mac-<arch>/Floating Anki.app`. Move it where you like (e.g. `~/Applications/`) and remove the quarantine attribute as above.

> `npm run build` skips code signing by default (`identity: null` in `package.json`). If you have an Apple Developer cert you want to use, remove that line and set up signing via electron-builder's docs.

## Usage

### Getting a `.apkg`

- **Anki desktop**: right-click a deck → Export → `.apkg`. **Enable "Support older Anki versions"** — this app does not yet read the newer Zstd-compressed format.
- **AnkiWeb shared decks**: https://ankiweb.net/shared/decks → "Download" hands you a `.apkg`.
- **From AnkiWeb account sync**: AnkiWeb itself does not export `.apkg`. You'd need to install Anki desktop at least once to export.

### First run

1. Launch **Floating Anki**. A small dark window appears, always on top.
2. Click **Choose .apkg file…** and pick your deck.
3. The front of the first card appears. Click the card to flip it.

### Reviewing

When the back of a card is showing, three buttons appear:

| Button          | Effect on an already-reviewed card                | Initial intervals for a new card |
|-----------------|---------------------------------------------------|----------------------------------|
| **Don't know**  | Demote back to learning (10 min), ease −0.2       | 1 min                            |
| **Hard**        | Interval × 1.2, ease −0.15, min 1 day             | 1 day (graduates out of learning)|
| **Easy**        | Interval × ease × 1.3, ease +0.15                 | 4 days (graduates out of learning)|

The small text under each button ("1m", "5m", "4d") is a live preview of when that card will reappear if you press it.

When nothing is due, the window shows **All caught up** and a countdown to the next card.

### Multiple windows

- Click **+** in the title bar to open a new window. Each window gets its own deck picker.
- Drag windows around the screen; each remembers its own position and size.
- Close a window with **✕**; that window's record is deleted. The app itself stays running as a tray icon.
- Reopen from the tray icon → **New window**.
- If two windows are pointed at the same `.apkg`, their review state is shared (keyed by deck, not by window).

### Autostart + watchdog (macOS)

The prebuilt app does **not** install autostart by default — it's an opt-in step.

```sh
# from the cloned repo
bash scripts/install-autostart.sh
```

This writes a LaunchAgent to `~/Library/LaunchAgents/com.complear.floating-anki.plist` with:

- `RunAtLoad: true` — starts at login
- `KeepAlive: true` — relaunches if the app exits
- `ThrottleInterval: 10` — enforces at least ~10s between launches, so a crash loop doesn't burn CPU

Important distinction:

- **Closing a window (✕)** does *not* trigger a relaunch. The app stays running in the tray; the window is just gone.
- **Quitting the app** (Cmd+Q, tray → Quit, crash) *will* trigger a relaunch within ~10s.

To disable:
```sh
bash scripts/uninstall-autostart.sh
```

Logs: `~/Library/Logs/floating-anki.log` (stdout) and `~/Library/Logs/floating-anki.err.log` (stderr).

## Where your data lives

All data is under `~/Library/Application Support/floating-anki/`:

```
config.json                  # one entry per open window: id, selected .apkg, bounds
reviews-<sha1>.json          # per-deck review state (one file per .apkg)
```

### `config.json`

```json
{
  "windows": [
    {
      "id": "c7a8...",
      "apkgPath": "/Users/you/Decks/japanese.apkg",
      "bounds": { "x": 100, "y": 100, "width": 340, "height": 260 }
    }
  ]
}
```

### `reviews-<sha1>.json`

Keyed by Anki note ID. `interval` is days (`0` = still in the learning phase with sub-day steps). `due` is a Unix millisecond timestamp.

```json
{
  "1234567890": {
    "ease": 2.5,
    "interval": 4,
    "due": 1713552000000,
    "reps": 3,
    "lapses": 0
  }
}
```

The filename hash is taken from the **full path** of the `.apkg`, so moving or renaming a `.apkg` starts you over on that deck. Keep decks in a stable location if you care about your history.

## Scheduler

An SM-2 variant inspired by Anki's pre-FSRS scheduler. Intentionally simple; this is not a port of Anki's algorithm.

- **New cards** are in the "learning" phase with sub-day steps measured in minutes.
- **Review cards** have an ease factor starting at 2.5, bounded below at 1.3.

See [`src/scheduler.ts`](src/scheduler.ts) for the exact constants. Changes are welcome, but keep the math easy to reason about — this is meant to be a readable scheduler, not a peer-reviewed one.

## Limitations

- **Only older `.apkg` formats.** Exports containing `collection.anki2` or `collection.anki21` work. The newer `collection.anki21b` (Zstd-compressed) is rejected with a clear error. Re-export with "Support older Anki versions" enabled.
- **Simplified rendering.** This app does **not** execute Anki's card templates. It takes each note's first field as the front and the remaining fields joined as the back. Cloze deletions, conditional template blocks (`{{#cond}}...{{/cond}}`), and per-card template logic are ignored. For simple front/back decks this works; for complex templates, expect mismatches.
- **No media.** Images, audio, `[sound:...]` tags, and LaTeX are stripped or not rendered.
- **No sync.** Review state stays on this machine. Reviewing here does not update Anki or AnkiWeb.
- **Unsigned builds.** Without an Apple Developer cert, macOS Gatekeeper will block the app on first launch until you strip the quarantine attribute (see [Install](#install)).
- **macOS-only autostart.** Equivalent setup for Linux (systemd) and Windows (Task Scheduler) is not shipped.

## Troubleshooting

**Nothing happens when I click the `.apkg`.**
The picker returns a file path to the app; the app then reads it. If you see an error like "This .apkg uses the newer Zstd-compressed format", re-export with older-Anki-version support enabled.

**Cards show blank / wrong text.**
See "Simplified rendering" above. Some decks rely on template logic this app doesn't run. Try a simpler deck to confirm the app itself works.

**The autostart doesn't reopen the app after I close a window.**
That's by design. Closing a window (✕) doesn't quit the app. Quit with Cmd+Q or the tray menu's Quit if you want launchd to relaunch it.

**The app keeps relaunching after I quit it.**
Also by design — that's the watchdog. Run `bash scripts/uninstall-autostart.sh` to disable.

**`npm run dev` fails with `TypeError: Cannot read properties of undefined (reading 'handle')`.**
Your shell has `ELECTRON_RUN_AS_NODE=1` set, which makes the Electron binary act as plain Node. The `dev` script already prefixes `ELECTRON_RUN_AS_NODE=` to clear it; if you launch another way, be sure to unset it first.

**The dev window and built app show different decks / no reviews.**
Before v0.1, data lived under `anki-floating` in Application Support. `floating-anki` migrates that directory on first run. If you manually copied files around, make sure everything is under `~/Library/Application Support/floating-anki/`.

## Development

```sh
npm install
npm run dev      # hot-reload Vite + Electron window
npm run build    # produce release/mac-<arch>/Floating Anki.app
```

Renderer changes hot-reload. Changes to `electron/main.ts` or `electron/preload.ts` require an Electron restart — Ctrl-C and re-run `npm run dev`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a walk through how the pieces fit together.

### Layout

```
electron/
  main.ts          # windows, tray, IPC, persistence
  preload.ts       # contextBridge surface under window.api

src/
  main.tsx         # React entry
  App.tsx          # per-window state; routes between picker and card view
  apkg.ts          # .apkg unzip + SQLite read (sql.js + JSZip)
  scheduler.ts     # SM-2-lite grading logic
  components/
    CardView.tsx
    ApkgPicker.tsx
    TitleBar.tsx
  styles.css
  types.d.ts       # window.api type surface

scripts/
  install-autostart.sh
  uninstall-autostart.sh

docs/
  ARCHITECTURE.md
```

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).

## Acknowledgements

- [Anki](https://github.com/ankitects/anki) — the `.apkg` format and the scheduler this one is a simplified cousin of.
- [Electron](https://www.electronjs.org/), [Vite](https://vitejs.dev/), [React](https://react.dev/).
- [sql.js](https://github.com/sql-js/sql.js) for running SQLite in the renderer.
- [JSZip](https://stuk.github.io/jszip/) for reading `.apkg` archives.
