import { fetchTile } from "./mapbox.js";
import { MAX_LAT, mercatorX, mercatorY } from "./geo.js";

const tap = [0, 0, 0];

class TileGrid {
  constructor(generator, zoom) {
    this.generator = generator;
    this.tileSize = generator.tileSize ?? 256;
    this.zoom = Math.min(zoom, generator.maxZoom ?? Infinity);
    this.tiles = Math.pow(2, this.zoom);
    this.size = this.tileSize * this.tiles;
    this.data = new Map();
    this.pending = new Set();
    this.lastKey = -1;
    this.lastTile = null;
  }

  tileAt(tx, ty) {
    const key = tx * this.tiles + ty;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastTile = this.data.get(key) ?? null;
    }
    return this.lastTile;
  }

  lngToPixel(lng) {
    return mercatorX(lng) * this.size;
  }

  latToPixel(lat) {
    return mercatorY(lat) * this.size;
  }

  covers(lat) {
    return Math.abs(lat) <= MAX_LAT;
  }

  tileKey(tx, ty) {
    return tx * this.tiles + ty;
  }

  tilesFor(bounds) {
    const needed = new Set();
    const row = (lat) =>
      Math.max(
        0,
        Math.min(
          this.tiles - 1,
          Math.floor(this.latToPixel(lat) / this.tileSize)
        )
      );
    const y0 = row(bounds.north);
    const y1 = row(bounds.south);
    const wrap = bounds.wrap || bounds.west > bounds.east;
    const x0 = Math.floor(this.lngToPixel(bounds.west) / this.tileSize);
    const x1 = Math.floor(this.lngToPixel(bounds.east) / this.tileSize);

    for (let ty = Math.min(y0, y1); ty <= Math.max(y0, y1); ty++) {
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
        const tx = Math.floor(key / this.tiles);
        const ty = key % this.tiles;
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
          this.lastKey = -1;
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

  texel(ix, iy, out) {
    if (iy < 0 || iy >= this.size) return false;
    const x = ((ix % this.size) + this.size) % this.size;
    const tx = (x / this.tileSize) | 0;
    const ty = (iy / this.tileSize) | 0;
    const tile = this.tileAt(tx, ty);
    if (!tile) return false;

    const sx = x - tx * this.tileSize;
    const sy = iy - ty * this.tileSize;
    const scale = tile.width / this.tileSize;
    const px = Math.min(tile.width - 1, (sx * scale) | 0);
    const py = Math.min(tile.height - 1, (sy * (tile.height / this.tileSize)) | 0);
    const p = (py * tile.width + px) * 4;
    if (tile.data[p + 3] === 0) return false;
    out[0] = tile.data[p];
    out[1] = tile.data[p + 1];
    out[2] = tile.data[p + 2];
    return true;
  }

  sample(gx, gy, out) {
    const x = gx - 0.5;
    const y = gy - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;

    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (let j = 0; j < 2; j++) {
      const wy = j ? fy : 1 - fy;
      if (wy === 0) continue;
      for (let i = 0; i < 2; i++) {
        const w = wy * (i ? fx : 1 - fx);
        if (w === 0) continue;
        if (!this.texel(x0 + i, y0 + j, tap)) continue;
        r += tap[0] * w;
        g += tap[1] * w;
        b += tap[2] * w;
        total += w;
      }
    }
    if (total === 0) return false;
    out[0] = r / total;
    out[1] = g / total;
    out[2] = b / total;
    return true;
  }
}

export { TileGrid };
