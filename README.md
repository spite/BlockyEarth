# BlockyEarth

A world made of blocks. Pick any place on Earth and it comes back as terrain
built out of hexagons, cubes or plastic bricks, coloured from satellite imagery
and lit with screen-space ambient occlusion.

**[Try it](https://spite.github.io/BlockyEarth/)**

## How it works

Two sets of tiles are fetched for the chosen location:

- a **colour map**, from whichever tile provider is selected
- an **elevation map**, from whichever elevation provider is selected, as
  terrarium tiles that pack height into the RGB channels

Both are chosen in the panel. Elevation defaults to **AWS terrain**
([AWS Open Data](https://registry.opendata.aws/terrain-tiles/)), which needs no
API key and reaches zoom 15. **Nextzen** serves the same Tilezen data but its
key is origin-restricted, so it only works from allowed hosts — if the terrain
comes out flat, that is why. The two agree exactly where both work: Teide across
9 km reads 1948 m of relief either way.

`HeightMap` samples both on a square or hexagonal grid — averaging a small
neighbourhood of pixels per block — and drives a single `InstancedMesh`. The vertex
shader keeps each block's base on the ground and raises only its top, so blocks
are columns rather than floating cubes.

## Geometry

The model is always flat. **Projection** switches how blocks are laid out on it.

**Mercator** takes the tile pixels as they come: one block per `block size`
square of the source. Simple, and what the tiles natively are — but Web Mercator
stretches with latitude, so the further from the equator the more the ground is
exaggerated, and the scale drifts across the map itself.

**Corrected** reprojects. Blocks sit on a grid uniform in **metres on the
ground**, and each one converts its position through an azimuthal equidistant
projection centred on the target to get a latitude and longitude, then samples
the tiles there. The tiles get resampled, so the result reads as if looked at
straight down rather than through Mercator.

Azimuthal is what makes the poles work. A local east/north frame has to divide
the east offset by `cos(lat)`, which runs to infinity at ±90° — centring on a
pole is impossible in that scheme. Azimuthal equidistant has no singularity
there, so you can point at the south pole and see the continent all the way
around it.

Sampling goes straight to tiles rather than through a canvas. A polar view spans
every longitude, which no Mercator rectangle can hold, so `TileGrid` keeps the
decoded tiles it needs and is asked for a latitude and longitude.

Measured spread in ground metres per block across a map, north edge to south:

| | Mercator | Corrected |
|---|---|---|
| Barcelona z10 | 1.61% | 0.18% |
| Tromsø z8 | 9.49% | 0.09% |
| Antarctica z6 | 45.95% | 0.66% |

Two limits worth knowing. Web Mercator stops at ±85.0511°, so a circle about
550 km across at each pole has no tiles at any zoom — it shows up as a clean hole
in the middle of a polar view. And the ground scale is taken from the source
resolution at the centre latitude, which collapses toward the poles, so it is
clamped at 85° there; zoom out to bring the whole continent into frame.

Elevation is metric in both projections, so on **Relief: True scale**,
Exaggeration is a real ratio and 1x is the world in true proportion. Teide at
zoom 13 comes out 2913 m of relief across a 17 km map, 17% of its own width,
which is what it is on the ground. 2 to 5x is the usual relief-map look.

True proportion means apparent height swings with the area you pick: at 2x,
Tenerife across 9 km stands 43% of its own width, the Himalaya across 200 km
only 8%. **Relief: Fit** (the default) removes that by scaling the measured
relief to a fixed share of the tile width, so every location and zoom arrives at
a usable height and Exaggeration stays a multiplier on top. The fit factor is
capped at 25x so genuinely flat ground is not blown up into noise — the
Netherlands across 9 km has 55 m of relief and lands at 31% rather than 40%.

## Running it

Any static server, from the repo root:

```sh
python3 -m http.server 8000
```

There is no build step. Dependencies are either vendored in `third_party/` or
resolved through the import map in `index.html`.

## Choosing an area

Whatever the picker shows is what gets built. Pan and zoom it to frame the patch
you want; there is no zoom level to line up and no rectangle to drag. **Detail**
sets how many blocks go across the model, and the readout under it gives the
ground area and metres per block. The tile zoom is worked out from those two —
the deepest zoom whose pixels are no coarser than one block — so it never needs
to be chosen.

The picker zooms continuously rather than in doubling steps, so framing lands
where you put it.

## URLs

The area lives in the hash as `latitude,longitude,span-in-metres`, the look in
the query string, so a link carries both:

```
index.html?shape=brick&crop=circle&verticalScale=4&palette=true#28.24038,-16.62999,15000
```

Only settings that differ from the defaults appear. Settings also persist in
`localStorage` between visits.

## Tile proxy (optional)

Some tile hosts get blocked in the browser by privacy extensions. Privacy Badger
blocks `khm1.google.com` on domain reputation — none of the tile endpoints set a
cookie — which shows up in the console as `net::ERR_BLOCKED_BY_CLIENT` and leaves
the map grey. Nothing server-side is wrong when that happens, and the site cannot
detect it beyond noticing that every tile failed.

`worker/` is a Cloudflare Worker that fetches tiles from an allowlist of hosts
and serves them from your own domain, which sidesteps the block. It strips
`Set-Cookie` from upstream responses so the proxy cannot become a tracking vector
itself, and caches at the edge.

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
| `geo.js` | the projections blocks are placed through |
| `TileGrid.js` | decoded tiles, sampled by latitude and longitude |
| `SSAO.js` | ambient occlusion, shadows, and the accumulation buffer |
| `mapbox.js` | tile providers and their zoom limits |
| `deps/`, `modules/` | small shared helpers |

## Flying over

**Fly over** picks the highest points in the model, keeping them a minimum
distance apart so they are separate summits rather than neighbouring blocks of
one peak. **Spots** sets how many it visits, **Altitude** how high above the
terrain it cruises in metres, and **Banking** rolls the camera into the turns —
the up vector leans toward the centre of curvature, the way the lift vector does
on an aircraft. The roll eases with a time constant in seconds rather than a
fraction per frame, so it settles at the same rate whatever the frame rate.

All three take effect while the flight is running: the path is rebuilt and
resumed at the same point in the loop, so a slider does something you can see
rather than waiting for the next takeoff.

The camera glides over the terrain rather than orbiting outside it: a loop that
passes above the summits, holding a near-constant altitude and looking ahead
along its own path, biased toward the middle so the ground stays in frame.

Altitude is held rather than tracking the ground because following the terrain
per point spikes the profile and the vertical wiggle, not the horizontal one,
dominates the curvature — it drops the median turning radius to 1.4 and reads as
bobbing. A coarse height field, dilated and smoothed, sets a single cruise
height that clears every peak by about a block and a half.

The height field is a 64-cell grid read nearest-neighbour, so querying it while
the camera moves makes the aim point snap as it crosses cells — a jump of up to
2689 times the normal per-frame step, felt as the view lurching. The ground
profile along the flight is therefore smoothed once when the path is built and
read back by interpolation, leaving the aim as continuous as the path itself.

**Fly over** is a toggle: the button reads **Stop** while a flight is running,
and pressing it again — or **Esc** — lands. Changing the model ends it too.
The renderer accumulates eight jittered samples for a still camera, so a moving
one only ever gets the first of those: expect a grainier image while flying,
resolving as soon as it stops.

## Exporting

**Download** bakes the blocks into a single mesh. **Format** picks what comes
out: **PLY** with vertex colours, or **GLB**, which most 3D tools open directly.
Every block is merged into one geometry rather than one mesh each, so the file
stays a single object and the exporters do not have to walk tens of thousands of
nodes. The button reads **Exporting…** and is disabled while it works; the page
stops responding for the duration, since the exporters run on the main thread.
**Snapshot** saves the current frame as a PNG.

## Credits

Built with [three.js](https://threejs.org/). Tiles from Google, Esri, USGS,
OpenTopoMap, CartoDB, IGN, EOX, GEBCO, EC JRC, OpenSeaMap and NASA GIBS;
elevation from AWS Open Data terrain tiles and Nextzen; the location
picker is [Leaflet](https://leafletjs.com/). Brick palette is every
non-transparent, non-metallic LEGO colour with at least 200 known parts, from
[Rebrickable](https://rebrickable.com/downloads/)'s colour data.
