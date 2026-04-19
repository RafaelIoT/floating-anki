# Contributing to Floating Anki

Thanks for considering a contribution. This is a small project with a small surface area — a single Electron app, a simple scheduler, a narrow IPC surface. That's the style to preserve.

## Before you start

- For anything non-trivial (a new feature, a scheduler change, a new dependency), **open an issue first** so we can agree on direction. A 30-line comment is cheaper than a 500-line PR rewrite.
- Bug fixes, doc improvements, and small quality-of-life tweaks don't need a pre-discussion — just open a PR.

## Setup

```sh
git clone https://github.com/RafaelIoT/floating-anki
cd floating-anki
npm install
npm run dev
```

If the Electron window doesn't appear, check `echo $ELECTRON_RUN_AS_NODE` — if that's set, clear it. The `dev` script already does so for you, but some shell configs or wrappers can re-set it.

## Conventions

- **TypeScript strict mode.** `npm run build` runs `tsc --noEmit` — it has to pass.
- **No new dependencies** unless you've justified them in the issue. Every dependency is a future maintenance cost.
- **Small files, readable code.** This project has no tests (yet) and intentionally few abstractions. Prefer adding 20 lines of plain code to adding a utility module.
- **Don't add comments that describe what the code does** — well-named identifiers should carry that weight. Only comment on *why* something non-obvious is the way it is (a workaround, a subtle invariant, a gotcha the reader would otherwise step into).
- **Don't add emojis to source unless they're functional UI** (the tray label, the "all caught up" indicator — those are already there).

## Scope of changes

Good fits:

- Bug fixes, especially around `.apkg` parsing edge cases
- Rendering improvements (images, audio, basic template fields)
- Linux / Windows autostart scripts
- Keyboard shortcuts
- Performance or memory improvements

Less likely to be accepted without heavy discussion:

- A full Anki-template rendering engine
- FSRS scheduler port
- Syncing back to Anki / AnkiWeb
- A settings UI bigger than a modal

These are all reasonable ideas, but they also each multiply the project's complexity — please flag early before you start writing.

## Testing your change

There's no automated test suite right now. At minimum:

1. `npm run build` passes (type-check + production Vite + electron-builder).
2. `npm run dev` — launch, pick a deck, flip a card, grade with each of the three buttons, close and reopen the app, confirm reviews persist.
3. Open a second window via the **+** button, pick a different deck, confirm the two windows are independent.
4. If you touched persistence: check `~/Library/Application Support/floating-anki/config.json` and a `reviews-*.json` look sensible.

## Commit style

- Present-tense, imperative subject: "add Zstd support", not "added Zstd support" or "adding Zstd support".
- One logical change per commit. Refactors and feature work go in separate commits.
- Reference issue numbers where relevant: `fix: handle empty deck (#42)`.

## PR checklist

- [ ] `npm run build` passes
- [ ] Manually exercised the change in `npm run dev`
- [ ] Updated [`README.md`](README.md) or [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) if behavior, layout, or interfaces changed
- [ ] No new dependencies (or, if there are, justified in the PR description)

## License

By contributing you agree your contribution is licensed under the MIT License (see [LICENSE](LICENSE)).
