# Intro video

A 43-second, silent, 1920x1080 intro video. Every frame is a pure function of time: `scene.js` draws it in
headless Chrome, `render.mjs` pipes the PNG frames into ffmpeg. Nothing is typed by hand that could drift from
the product: `render.mjs` first builds the 265 flags of `country-flag-icons` with the plugin (extract mode)
and reads the symbol ids, the `sprite.svg` size and gzip size, the 265 file sizes and the import result
`{ id, viewBox, url }` from that build. The flags in the video are drawn with `<use href="sprite.svg#flag-XX">`
from that real sprite.

## Re-render

Requirements: Bun, Chrome (or Playwright's Chromium), and an ffmpeg with libx264 and libwebp.

```sh
bun run build                 # at the repository root: the video uses the built plugin
cd examples/react-rspack
FFMPEG=/path/to/ffmpeg bun run video
```

Outputs: `public/intro.mp4` (H.264, yuv420p, faststart, at most 2 MB, 43 s) and `public/intro-poster.webp`
(at most 60 KB, the full flag wall with the "1 request" badge).

Other modes (output goes to a scratch directory, `--out <dir>` to choose it):

```sh
bun run video --draft            # 960x540 at 15 fps
bun run video --stills 0,12.5    # PNG stills at those seconds
bun run video --sheet            # contact sheet, one frame every 2 seconds
```

`CHROME_PATH` selects the browser (default `/usr/bin/google-chrome`, else Playwright's Chromium). `--crf` tunes
the quality of the final render.

## Files

- `chapters.json`: the chapters (start time, title, caption). The captions are drawn into the video.
- `scene.html`, `scene.js`: the stage and the scenes. System font stacks only, so no fonts to bundle.
- `flag-order.mjs`: the 265 flags, most populous first (the order the flag wall fills in).
- `render.mjs`: build, collect, draw, encode.

Re-render when the scenes or the plugin output change.
