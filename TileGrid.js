import { fetchTile } from "./mapbox.js";
import { MAX_LAT, DEG } from "./geo.js";

class TileGrid {
  constructor(generator, zoom) {
    this.generator = generator;
    this.tileSize = generator.tileSize ?? 256;
    this.zoom = Math.min(zoom, generator.maxZoom ?? Infinity);
    this.tiles = Math.pow(2, this.zoom);
    this.size = this.tileSize * this.tiles;
    this.data = new Map();
    this.pending = new Set();
  }

  lngToPixel(lng) {
    return ((lng + 180) / 360) * this.size;
  }

  latToPixel(lat) {
    const clamped = Math.min(MAX_LAT, Math.max(-MAX_LAT, lat));
    const a = clamped * DEG;
    return (
      ((1 - Math.log(Math.tan(a) + 1 / Math.cos(a)) / Math.PI) / 2) * this.size
    );
  }

  covers(lat) {
    return Math.abs(lat) <= MAX_LAT;
  }

  tileKey(tx, ty) {
    return `${tx},${ty}`;
  }

  tilesFor(bounds) {
    const needed = new Set();
    const y0 = Math.floor(this.latToPixel(bounds.north) / this.tileSize);
    const y1 = Math.floor(this.latToPixel(bounds.south) / this.tileSize);
    const wrap = bounds.wrap || bounds.west > bounds.east;
    const x0 = Math.floor(this.lngToPixel(bounds.west) / this.tileSize);
    const x1 = Math.floor(this.lngToPixel(bounds.east) / this.tileSize);

    for (let ty = Math.max(0, y0); ty <= Math.min(this.tiles - 1, y1); ty++) {
      if (wrap) {
        for (let tx = 0; tx < this.tiles; tx++) needed.add(this.tileKey(tx, ty));
      } else {
        for (let tx = x0; tx <= x1; tx++) {
          const wrapped = ((tx % this.tiles) + this.tiles) % this.tiles;
          needed.add(this.tileKey(wrapped, ty));
        }
      }
    }
    return needed;
  }

  async load(bounds, { onTile, signal } = {}) {
    const needed = this.tilesFor(bounds);
    const missing = [...needed].filter((k) => !this.data.has(k));
    let failed = 0;

    await Promise.all(
      missing.map(async (key) => {
        const [tx, ty] = key.split(",").map(Number);
        const img = fetchTile(tx, ty, this.zoom, this.generator);
        this.pending.add(img);
        try {
          await img.decode();
          if (signal && signal.aborted) return;
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          this.data.set(key, {
            data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            width: canvas.width,
            height: canvas.height,
          });
        } catch (e) {
          failed++;
        } finally {
          this.pending.delete(img);
          if (onTile) onTile();
        }
      })
    );

    return { requested: missing.length, failed };
  }

  cancel() {
    for (const img of this.pending) img.src = "";
    this.pending.clear();
  }

  sample(gx, gy, out) {
    if (gy < 0 || gy >= this.size) return false;
    const x = ((gx % this.size) + this.size) % this.size;
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(gy / this.tileSize);
    const tile = this.data.get(this.tileKey(tx, ty));
    if (!tile) return false;

    const fx = (x - tx * this.tileSize) / this.tileSize;
    const fy = (gy - ty * this.tileSize) / this.tileSize;
    const px = Math.min(tile.width - 1, Math.floor(fx * tile.width));
    const py = Math.min(tile.height - 1, Math.floor(fy * tile.height));
    const p = (py * tile.width + px) * 4;
    if (tile.data[p + 3] === 0) return false;
    out[0] = tile.data[p];
    out[1] = tile.data[p + 1];
    out[2] = tile.data[p + 2];
    return true;
  }
}

export { TileGrid };
