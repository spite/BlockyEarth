# BlockyEarth

A world made of blocks. Pick any place on Earth and it comes back as terrain
built out of hexagons, cubes or plastic bricks, coloured from satellite imagery
and lit with screen-space ambient occlusion.

**[Try it](https://spite.github.io/BlockyEarth/)**

## How it works

Two maps are fetched for the chosen location and drawn onto canvases of the same
size, covering the same patch of ground:

- a **colour map**, from whichever tile provider is selected
- an **elevation map**, from [Nextzen](https://www.nextzen.org/) terrarium tiles,
  which pack height into the RGB channels

`HeightMap` samples both on a square or hexagonal grid — averaging a `block size`
square of pixels per block — and drives a single `InstancedMesh`. The vertex
shader keeps each block's base on the ground and raises only its top, so blocks
are columns rather than floating cubes.

Providers stop at different zoom levels (Nextzen's 512px terrarium tiles end at
14). Past a provider's limit the deepest available tile is requested and
magnified, so the map still covers the right ground instead of coming back empty.

## Running it

Any static server, from the repo root:

```sh
python3 -m http.server 8000
```

There is no build step. Dependencies are either vendored in `third_party/` or
resolved through the import map in `index.html`.

## URLs

The location lives in the hash, the look in the query string, so a link carries
both:

```
index.html?shape=brick&crop=circle&verticalScale=400&palette=true#28.24038,-16.62999,12
```

Only settings that differ from the defaults appear. Settings also persist in
`localStorage` between visits.

## Tile proxy (optional)

Some tile hosts get blocked in the browser by privacy extensions. Privacy Badger
blocks `khm1.google.com` because it sets third-party cookies, which shows up in
the console as `net::ERR_BLOCKED_BY_CLIENT` and leaves the map grey. Nothing
server-side is wrong when that happens, and the site cannot detect it beyond
noticing that every tile failed.

`worker/` is a Cloudflare Worker that fetches tiles from an allowlist of hosts
and serves them from your own domain, which sidesteps the block. It strips
`Set-Cookie` from upstream responses, so the proxy does not become a tracking
vector itself and does not attract the same heuristics.

```sh
cd worker
npx wrangler deploy
```

Then point the app at it:

```js
const tileProxy = "https://blocky-earth-tiles.<your-subdomain>.workers.dev";
```

Leave it as `""` to fetch tiles directly. Responses are cached for a day at the
edge, so repeat views cost nothing upstream.

The proxy is locked to `https://spite.github.io` via `ALLOWED_ORIGINS` in
`wrangler.toml`, and fails closed: a request whose `Origin` is missing or does
not match exactly is refused, so it cannot be hotlinked from another site. Add
`http://localhost:8000` to that list while developing locally. Note that `Origin`
is set by the browser, so this stops other pages from using the proxy — it is
not a defence against a scripted client that forges the header.

Note that Google's satellite tiles come from an endpoint that is not a public
API; proxying them puts your domain in front of that. The other providers are
all documented public services.

## Layout

| | |
|---|---|
| `main.js` | renderer, cameras, and the wiring between the pieces |
| `BlockyEarth.js` | owns the model and the scene graph |
| `gui.js` | the [guspira](https://github.com/spite/guspira) settings panel |
| `HeightMap.js` | tile fetching, sampling, mesh building, export |
| `SSAO.js` | ambient occlusion, shadows, and the accumulation buffer |
| `mapbox.js` | tile providers and their zoom limits |
| `deps/`, `modules/` | small shared helpers |

## Exporting

**Download model** bakes the blocks into a single PLY with vertex colours.
**Snapshot** saves the current frame as a PNG.

## Credits

Built with [three.js](https://threejs.org/). Tiles from Google, Esri, USGS,
OpenTopoMap, CartoDB, IGN and NASA GIBS; elevation from Nextzen; the location
picker is [Leaflet](https://leafletjs.com/). Brick palette from
[Jenny's Crayon Collection](http://www.jennyscrayoncollection.com/2021/06/all-current-lego-colors.html).
