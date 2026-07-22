# Gapless — marketing site

Static landing page for [Gapless](https://github.com/navnit/gapless), the
free and open-source desktop interface for
[auto-editor](https://github.com/WyattBlue/auto-editor). It implements the
"Gapless Website v2" design (warm editorial/utilitarian, waveform data-viz
motifs) with a full **dark and light theme**.

## Files

- `index.html` — the whole page (semantic, single document)
- `assets/styles.css` — design tokens + components; both themes driven by
  `[data-theme]` on `<html>`
- `assets/app.js` — theme toggle, Homebrew copy button, scroll-reveal, and the
  procedurally-drawn waveform / timeline / fast-forward visuals
- `assets/favicon.svg` — the pause-bars brand mark

No build step. Fonts (Instrument Sans + JetBrains Mono) load from Google Fonts.

## Theming

- First paint reads a stored choice, else the OS `prefers-color-scheme`, and
  sets `data-theme` before render to avoid a flash.
- The nav toggle flips and persists the choice to `localStorage`
  (`gapless-theme`); with no stored choice the page keeps following the OS.
- All motion respects `prefers-reduced-motion`.

## Develop

```bash
python3 -m http.server 8731   # then open http://localhost:8731
```

## Deploy

Any static host. The app's `pubspec.yaml` sets `homepage: https://navnit.me/gapless`,
so that is the intended canonical URL.

## Notes

- Download buttons point to `github.com/navnit/gapless/releases/latest`; the
  version string shown in copy is `v0.1.0` (from the approved v2 design).
- macOS is the only downloadable target; Windows/Linux are marked "coming soon".
