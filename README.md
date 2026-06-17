# Tier List

A fully client-side tier list maker. There is **no backend and no database**: the entire tier list (rows, labels, colors, and items with their image links) is compressed and stored in the URL. Share the link, share the list.

## How it works

- State is serialized into a compact, index-based JSON shape, compressed with [`lz-string`](https://github.com/pieroxy/lz-string), and stored in the URL **hash** (`#d=...`).
- The hash is never sent to the server, so this works on any static host with no server logic.
- The URL updates live as you edit (debounced). Use **Copy share link** to grab it.

## Features

- Add/rename/recolor/reorder/delete tier rows.
- Add items by image URL with an optional text label.
- Drag and drop items between rows and the unranked pool.
- Mobile-friendly, dark UI.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # output in dist/
npm run preview    # preview the production build
```

## Deploy to Vercel

This is a static Vite app.

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`

`vercel.json` rewrites all routes to `index.html` so deep links work.

```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production
```

## Notes / limits

- All data lives in the URL. Very large lists with many long image URLs can hit
  browser/platform URL length limits (compression helps a lot, but some chat apps
  truncate links around ~2,000 characters).
- Images are hotlinked from the URLs you provide. If a host blocks hotlinking or the
  link dies, the image won't load (a striped placeholder is shown instead).
