import {
  BoxBufferGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  InstancedBufferAttribute,
  Vector3,
  Scene,
  Mesh,
  Quaternion,
  Matrix4,
  Box3,
  BufferAttribute,
  IcosahedronBufferGeometry,
} from "./third_party/three.module.js";
import { RoundedBoxGeometry } from "./third_party/RoundedBoxGeometry.js";
import { generateRoundedPrismGeometry } from "./RoundedPrismGeometry.js";
import { generatePlasticBrickGeometry } from "./PlasticBrickGeometry.js";
import { getNextZenHeight } from "./mapbox.js";
import { GLTFExporter } from "./third_party/GLTFExporter.js";
import { PLYExporter } from "./third_party/PLYExporter.js";
import { downloadArrayBuffer, downloadStr } from "./download.js";
import { getClosestColor } from "./colors.js";
import { awsTerrain } from "./mapbox.js";
import {
  createAzimuthal,
  createMercator,
  mercatorX,
  mercatorY,
  zoomForResolution,
  MAX_LAT,
} from "./geo.js";
import { TileGrid } from "./TileGrid.js";

const Box = "box";
const RoundedBox = "rounded";
const Hexagon = "hexagon";
const PlasticBrick = "brick";
const Capsule = "capsule";

const NoCrop = "none";
const CircleCrop = "circle";
const HexagonCrop = "hexagon";

const NormalHeight = "natural";
const BlockHeight = "block";
const HalfBlockHeight = "half";
const QuarterBlockHeight = "quarter";

const shapes = [Box, RoundedBox, PlasticBrick, Hexagon, Capsule];
const crops = [NoCrop, CircleCrop, HexagonCrop];

const c = new Color();
const sampledColor = new Color();
const v = new Vector3();

const JITTER = 0.25;
const MODEL_WIDTH = 10.24;
const TARGET_FILL = 0.2;
const MIN_FIT = 0.05;
const MAX_FIT = 25;

const geo = { lat: 0, lng: 0 };
const rgb = [0, 0, 0];

class HeightMap {
  constructor(blocks = 256) {
    this.setBlocks(blocks);

    this.pointCount = 0;
    this.scale = 2;
    this.span = 10000;

    this.loadedTiles = 0;
    this.totalTiles = 0;

    this.invalidated = false;
    this.mode = Hexagon;
    this.crop = NoCrop;
    this.quantHeight = NormalHeight;
    this.handPlaced = false;
    this.brickPalette = false;
    this.corrected = true;
    this.autoHeight = true;
    this.elevation = awsTerrain;

    this.lat = 0;
    this.lng = 0;

    this.bb = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));

    this.generation = 0;
    this.revision = 0;
    this.builtPointsKey = "";
    this.builtMeshKey = "";
    this.projectorKey = "";
    this.colorGrid = null;
    this.heightGrid = null;

    this.onProgress = () => {};
    this.onTilesUnavailable = () => {};
  }

  setBlocks(blocks) {
    if (this.blocks === blocks) return;
    this.invalidated = true;
    this.blocks = blocks;
  }

  setArea(lat, lng, span) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !(span > 0)) return;
    if (this.lat === lat && this.lng === lng && this.span === span) return;
    this.invalidated = true;
    this.lat = lat;
    this.lng = lng;
    this.span = span;
  }

  get spacing() {
    return this.span / this.blocks;
  }

  get boxScale() {
    return MODEL_WIDTH / this.blocks;
  }

  get metresToWorld() {
    return this.boxScale / this.spacing;
  }

  get metresToWorldY() {
    return this.verticalScale * (this.fit ?? 1) * this.metresToWorld;
  }

  get scaleLat() {
    return Math.min(MAX_LAT, Math.max(-MAX_LAT, this.lat));
  }

  set scale(scale) {
    this.invalidated ||= this.scale !== scale;
    this.verticalScale = scale;
  }

  get scale() {
    return this.verticalScale;
  }

  set brickPalette(v) {
    this.invalidated ||= this.brickPalette !== v;
    this._brickPalette = v;
  }

  get brickPalette() {
    return this._brickPalette;
  }

  set corrected(v) {
    this.invalidated ||= this.corrected !== v;
    this._corrected = v;
  }

  get corrected() {
    return this._corrected;
  }

  set autoHeight(v) {
    this.invalidated ||= this.autoHeight !== v;
    this._autoHeight = v;
  }

  get autoHeight() {
    return this._autoHeight;
  }

  set handPlaced(v) {
    this.invalidated ||= this.handPlaced !== v;
    this._handPlaced = v;
  }

  get handPlaced() {
    return this._handPlaced;
  }

  set quantHeight(h) {
    this.invalidated ||= h !== this._quantHeight;
    this._quantHeight = h;
  }

  get quantHeight() {
    return this._quantHeight;
  }

  set mode(mode) {
    const next = shapes.includes(mode) ? mode : Hexagon;
    this.invalidated ||= next !== this.mode;
    this._mode = next;
  }

  get mode() {
    return this._mode;
  }

  set crop(crop) {
    const next = crops.includes(crop) ? crop : NoCrop;
    this.invalidated ||= next !== this.crop;
    this._crop = next;
  }

  get crop() {
    return this._crop;
  }

  invalidate() {
    this.invalidated = true;
  }

  generate() {
    if (!this.invalidated) return;
    const meshKey = `${this.pointsKey}|${this.mode}`;
    if (meshKey === this.builtMeshKey) return;
    this.builtMeshKey = meshKey;
    switch (this.mode) {
      case Box:
        this.generateBoxGeometry();
        break;
      case RoundedBox:
        this.generateRoundedBoxGeometry();
        break;
      case PlasticBrick:
        this.generatePlasticBrickGeometry();
        break;
      case Hexagon:
        this.generateHexagonGeometry();
        break;
      case Capsule:
        this.generateCapsuleGeometry();
        break;
    }
    this.generatePoints();
    this.initMesh();
    this.updatePositions();
  }

  generateBoxGeometry() {
    this.geo = new BoxBufferGeometry(
      this.boxScale,
      this.boxScale,
      this.boxScale
    );
  }

  generateRoundedBoxGeometry() {
    this.geo = new RoundedBoxGeometry(
      this.boxScale,
      this.boxScale,
      this.boxScale,
      this.boxScale / 50,
      1
    );
  }

  generateHexagonGeometry() {
    this.geo = generateRoundedPrismGeometry(
      this.boxScale,
      0.01 * this.boxScale
    );
  }

  generateCapsuleGeometry() {
    this.geo = new IcosahedronBufferGeometry(this.boxScale / 2, 3);
  }

  generatePlasticBrickGeometry() {
    this.geo = generatePlasticBrickGeometry(this.boxScale, 2);
  }

  filter(v) {
    switch (this.crop) {
      case NoCrop:
        return true;
      case CircleCrop:
        return this.filterCircle(v);
      case HexagonCrop:
        return this.filterHexagon(v);
      default:
        return true;
    }
  }

  filterCircle(v) {
    const d = Math.hypot(v.x, v.z);
    return (
      d < 0.5 * MODEL_WIDTH + 0.5 * this.boxScale
    );
  }

  filterHexagon(v) {
    const a = Math.atan2(v.z, v.x);
    const R = 0.5 * MODEL_WIDTH;
    const sides = 6;
    const r =
      (R * Math.cos(Math.PI / sides)) /
      Math.cos((2 * Math.asin(Math.sin((sides * a) / 2))) / sides);
    const d = Math.hypot(v.x, v.z);
    return d <= r;
  }

  get pointsKey() {
    const hexagonal = this.mode === Hexagon || this.mode === Capsule;
    return `${this.blocks}|${this.span}|${this.lat}|${this.lng}|${hexagonal}|${this.crop}|${this.corrected}`;
  }

  projector() {
    const key = `${this.lat}|${this.lng}|${this.corrected}`;
    if (key !== this.projectorKey) {
      this.projectorKey = key;
      this.cachedProjector = this.corrected
        ? createAzimuthal(this.lat, this.lng)
        : createMercator(this.lat, this.lng);
    }
    return this.cachedProjector;
  }

  worldToLatLng(x, z, out = { lat: 0, lng: 0 }) {
    const scale = this.metresToWorld;
    return this.projector()(x / scale, -z / scale, out);
  }

  generatePoints() {
    const key = this.pointsKey;
    if (key === this.builtPointsKey) return;
    this.builtPointsKey = key;

    const hexagonal = this.mode === Hexagon || this.mode === Capsule;
    const cols = this.blocks;
    const rows = Math.ceil(this.blocks / (hexagonal ? Math.sqrt(3) / 2 : 1));
    this.allocatePoints(cols * rows);

    const spacing = this.spacing;
    const rowSpacing = hexagonal ? spacing * (Math.sqrt(3) / 2) : spacing;
    const scale = this.metresToWorld;
    const startEast = -0.5 * (cols - 1) * spacing;
    const startNorth = 0.5 * (rows - 1) * rowSpacing;
    const project = this.projector();

    let n = 0;
    for (let row = 0; row < rows; row++) {
      const north = startNorth - row * rowSpacing;
      for (let col = 0; col < cols; col++) {
        let east = startEast + col * spacing;
        if (hexagonal && row % 2 === 1) east += 0.5 * spacing;

        v.set(east * scale, 0, -north * scale);
        if (!this.filter(v)) continue;

        project(east, north, geo);
        this.pointLat[n] = geo.lat;
        this.pointLng[n] = geo.lng;
        const inRange = Math.abs(geo.lat) <= MAX_LAT;
        this.pointU[n] = inRange ? mercatorX(geo.lng) : NaN;
        this.pointV[n] = inRange ? mercatorY(geo.lat) : NaN;
        this.pointX[n] = v.x;
        this.pointZ[n] = v.z;
        n++;
      }
    }
    this.pointCount = n;
  }

  allocatePoints(max) {
    if (!this.pointX || this.pointX.length < max) {
      this.pointX = new Float32Array(max);
      this.pointZ = new Float32Array(max);
      this.pointLat = new Float64Array(max);
      this.pointLng = new Float64Array(max);
      this.pointU = new Float64Array(max);
      this.pointV = new Float64Array(max);
    }
  }

  disposeMesh() {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.mesh = null;
  }

  initMesh() {
    this.disposeMesh();
    this.mesh = new InstancedMesh(this.geo, this.material, this.pointCount);
    this.mesh.geometry.setAttribute(
      "height",
      new InstancedBufferAttribute(new Float32Array(this.pointCount), 1)
    );
    this.mesh.castShadow = this.mesh.receiveShadow = true;

    for (let i = 0; i < this.mesh.count; i++) {
      this.mesh.setColorAt(i, c);
    }
  }

  updatePositions() {
    this.mesh.count = this.pointCount;
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.pointCount; i++) {
      const o = i * 16;
      m[o] = 1;
      m[o + 1] = 0;
      m[o + 2] = 0;
      m[o + 3] = 0;
      m[o + 4] = 0;
      m[o + 5] = 1;
      m[o + 6] = 0;
      m[o + 7] = 0;
      m[o + 8] = 0;
      m[o + 9] = 0;
      m[o + 10] = 1;
      m[o + 11] = 0;
      m[o + 12] = this.pointX[i];
      m[o + 13] = 0;
      m[o + 14] = this.pointZ[i];
      m[o + 15] = 1;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  averageSamples(grid, index, span) {
    if (!grid) return 0;
    const u = this.pointU[index];
    if (Number.isNaN(u)) return 0;
    const gx = u * grid.size;
    const gy = this.pointV[index] * grid.size;
    if (span === 1) return grid.sample(gx, gy, rgb) ? 1 : 0;

    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    const half = (span - 1) / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (let dy = 0; dy < span; dy++) {
      for (let dx = 0; dx < span; dx++) {
        if (grid.texel(cx + dx - half, cy + dy - half, rgb)) {
          r += rgb[0];
          g += rgb[1];
          b += rgb[2];
          total++;
        }
      }
    }
    if (total === 0) return 0;
    rgb[0] = r / total;
    rgb[1] = g / total;
    rgb[2] = b / total;
    return total;
  }

  sampleSpan(grid, lat) {
    if (!grid) return 1;
    const worldMetres = 2 * Math.PI * 6371008.8 * Math.cos((lat * Math.PI) / 180);
    const gridMetres = worldMetres / grid.size;
    const blockMetres = this.spacing;
    const span = Math.min(9, Math.max(1, Math.round(blockMetres / gridMetres)));
    return span <= 1 ? 1 : span | 1;
  }

  tallest(heights, n, k) {
    const heap = new Int32Array(k);
    let size = 0;

    for (let i = 0; i < n; i++) {
      if (size === k) {
        if (heights[i] <= heights[heap[0]]) continue;
        heap[0] = i;
        let parent = 0;
        for (;;) {
          const left = 2 * parent + 1;
          const right = left + 1;
          let small = parent;
          if (left < k && heights[heap[left]] < heights[heap[small]]) small = left;
          if (right < k && heights[heap[right]] < heights[heap[small]]) small = right;
          if (small === parent) break;
          const swap = heap[parent];
          heap[parent] = heap[small];
          heap[small] = swap;
          parent = small;
        }
        continue;
      }
      heap[size] = i;
      let child = size++;
      while (child > 0) {
        const parent = (child - 1) >> 1;
        if (heights[heap[parent]] <= heights[heap[child]]) break;
        const swap = heap[parent];
        heap[parent] = heap[child];
        heap[child] = swap;
        child = parent;
      }
    }

    const out = Array.from(heap.subarray(0, size));
    out.sort((a, b) => heights[b] - heights[a] || a - b);
    return out;
  }

  findPeaks(count = 6, separation = 0.18) {
    if (!this.mesh || !this.pointCount) return [];
    const heights = this.mesh.geometry.attributes.height.array;
    const n = this.pointCount;
    const minDistance = separation * MODEL_WIDTH;

    let slice = Math.min(n, Math.max(64, count * 64));
    for (;;) {
      const picked = [];
      for (const i of this.tallest(heights, n, slice)) {
        if (picked.length >= count) break;
        const x = this.pointX[i];
        const z = this.pointZ[i];
        let clear = true;
        for (const p of picked) {
          if (Math.hypot(p.x - x, p.z - z) < minDistance) {
            clear = false;
            break;
          }
        }
        if (clear) picked.push({ x, y: heights[i], z });
      }
      if (picked.length >= count || slice >= n) return picked;
      slice = Math.min(n, slice * 4);
    }
  }

  heightField(res = 64, out = null) {
    const count = res * res;
    const cells = out && out.length === count ? out : new Float32Array(count);
    if (cells === out) cells.fill(0);
    if (!this.mesh || !this.pointCount) return { res, size: MODEL_WIDTH, cells };
    const heights = this.mesh.geometry.attributes.height.array;
    const half = MODEL_WIDTH / 2;
    for (let i = 0; i < this.pointCount; i++) {
      const u = Math.min(
        res - 1,
        Math.max(0, Math.floor(((this.pointX[i] + half) / MODEL_WIDTH) * res))
      );
      const v = Math.min(
        res - 1,
        Math.max(0, Math.floor(((this.pointZ[i] + half) / MODEL_WIDTH) * res))
      );
      const k = v * res + u;
      if (heights[i] > cells[k]) cells[k] = heights[i];
    }
    return { res, size: MODEL_WIDTH, cells };
  }

  sampleBounds() {
    let north = -90;
    let south = 90;
    let minOffset = Infinity;
    let maxOffset = -Infinity;
    const centre = this.lng;
    for (let i = 0; i < this.pointCount; i++) {
      const lat = this.pointLat[i];
      if (lat > north) north = lat;
      if (lat < south) south = lat;
      let offset = this.pointLng[i] - centre;
      if (offset > 180) offset -= 360;
      else if (offset < -180) offset += 360;
      if (offset < minOffset) minOffset = offset;
      if (offset > maxOffset) maxOffset = offset;
    }
    const spread = maxOffset - minOffset;
    const wrap = north > MAX_LAT || south < -MAX_LAT || spread > 180;
    return {
      north,
      south,
      west: centre + minOffset,
      east: centre + maxOffset,
      wrap,
    };
  }

  cancel() {
    this.generation++;
    if (this.colorGrid) this.colorGrid.cancel();
    if (this.heightGrid) this.heightGrid.cancel();
  }

  async populateMaps(lat = this.lat, lng = this.lng, span = this.span) {
    this.cancel();
    this.setArea(lat, lng, span);
    this.invalidate();
    this.generatePoints();

    const bounds = this.sampleBounds();
    this.colorGrid = new TileGrid(this.generator, this.zoomFor(this.generator));
    this.heightGrid = new TileGrid(
      this.elevation,
      this.zoomFor(this.elevation)
    );

    this.loadedTiles = 0;
    this.totalTiles =
      this.colorGrid.tilesFor(bounds).size +
      this.heightGrid.tilesFor(bounds).size;
    this.onProgress(0, 0, this.totalTiles);
    const onTile = () => {
      this.loadedTiles++;
      this.onProgress(
        (this.loadedTiles * 100) / this.totalTiles,
        this.loadedTiles,
        this.totalTiles
      );
    };

    const [color, elevation] = await Promise.all([
      this.colorGrid.load(bounds, { onTile }),
      this.heightGrid.load(bounds, { onTile }),
    ]);

    this.loadedTiles = 0;
    this.totalTiles = 0;
    this.onProgress(0, 0, 0);

    if (color.requested > 0 && color.failed === color.requested) {
      this.onTilesUnavailable("color");
    } else if (
      elevation.requested > 0 &&
      elevation.failed === elevation.requested
    ) {
      this.onTilesUnavailable("elevation");
    }
    this.invalidate();
  }

  zoomFor(generator) {
    const tileSize = generator.tileSize ?? 256;
    const wanted = zoomForResolution(this.scaleLat, this.spacing, tileSize);
    const max = generator.maxZoom ?? 22;
    return Math.max(0, Math.min(max, Math.ceil(wanted)));
  }

  processMaps() {
    if (!this.mesh) return;
    if (!this.invalidated) return;
    this.bb.makeEmpty();
    this.invalidated = false;

    const count = this.pointCount;
    if (!this.sampledHeights || this.sampledHeights.length < count) {
      this.sampledHeights = new Float32Array(count);
    }
    const sampled = this.sampledHeights;
    const heightSpan = this.sampleSpan(this.heightGrid, this.lat);
    const colorSpan = this.sampleSpan(this.colorGrid, this.lat);

    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (let i = 0; i < count; i++) {
      let h = NaN;
      if (
        this.averageSamples(this.heightGrid, i, heightSpan)
      ) {
        h = getNextZenHeight(rgb[0], rgb[1], rgb[2]);
      }
      sampled[i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
    if (min > max) {
      min = 0;
      max = 0;
    }

    const metresToWorld = this.metresToWorld;
    this.relief = (max - min) * 256;
    this.fit =
      this._autoHeight && this.relief > 0
        ? Math.min(
            MAX_FIT,
            Math.max(MIN_FIT, (TARGET_FILL * this.span) / this.relief)
          )
        : 1;
    const exaggeration = this.verticalScale * this.fit * metresToWorld * 256;
    const base = 0.01;
    const unit = this.boxScale;

    const tmp = new Vector3();
    const heights = this.mesh.geometry.attributes.height.array;
    for (let i = 0; i < count; i++) {
      const raw = sampled[i];
      let h = ((Number.isNaN(raw) ? min : raw) - min) * exaggeration;

      switch (this._quantHeight) {
        case NormalHeight:
          break;
        case BlockHeight:
          h = Math.floor(h / unit) * unit;
          break;
        case HalfBlockHeight:
          h = Math.floor(h / (0.5 * unit)) * 0.5 * unit;
          break;
        case QuarterBlockHeight:
          h = Math.floor(h / (0.25 * unit)) * 0.25 * unit;
          break;
      }
      h += base;
      if (this._handPlaced) {
        h += (0.5 - Math.random()) * JITTER * unit;
      }

      tmp.set(this.pointX[i], h, this.pointZ[i]);
      this.bb.expandByPoint(tmp);

      if (
        this.averageSamples(this.colorGrid, i, colorSpan)
      ) {
        sampledColor.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
      } else {
        sampledColor.setRGB(0.5, 0.5, 0.5);
      }
      const c = sampledColor;

      heights[i] = h;
      if (this.brickPalette) {
        this.mesh.setColorAt(i, getClosestColor(c));
      } else {
        this.mesh.setColorAt(i, c);
      }
    }

    this.revision++;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.height.needsUpdate = true;
  }

  buildExportScene() {
    const scene = new Scene();
    const material = new MeshBasicMaterial({ vertexColors: true });
    const mat = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const c = new Color();
    const heights = this.mesh.geometry.attributes.height.array;

    for (let i = 0; i < this.mesh.count; i++) {
      const geo = this.geo.clone();
      geo.deleteAttribute("height");
      this.mesh.getMatrixAt(i, mat);
      this.mesh.getColorAt(i, c);

      const colors = new Float32Array(geo.attributes.position.count * 3);
      for (let j = 0; j < colors.length; j += 3) {
        colors[j] = c.r;
        colors[j + 1] = c.g;
        colors[j + 2] = c.b;
      }
      geo.setAttribute("color", new BufferAttribute(colors, 3));

      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        if (pos.getY(j) >= 0) {
          pos.setY(j, pos.getY(j) + heights[i]);
        }
      }

      mat.decompose(position, quaternion, scale);
      geo.translate(position.x, position.y, position.z);
      scene.add(new Mesh(geo, material));
    }

    return scene;
  }

  get exportName() {
    return `blocky-earth-${this.lat.toFixed(5)}-${this.lng.toFixed(5)}-${Math.round(
      this.span
    )}m`;
  }

  bake() {
    this.bakePLY();
    // this.bakeGLTF();
  }

  bakeGLTF() {
    const exporter = new GLTFExporter();
    exporter.parse(
      this.buildExportScene(),
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadArrayBuffer(result, `${this.exportName}.glb`);
        } else {
          downloadStr(JSON.stringify(result, null, 2), `${this.exportName}.gltf`);
        }
      },
      { binary: true }
    );
  }

  bakePLY() {
    const exporter = new PLYExporter();
    exporter.parse(
      this.buildExportScene(),
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadArrayBuffer(result, `${this.exportName}.ply`);
        } else {
          downloadStr(result, `${this.exportName}.ply`);
        }
      },
      { binary: true }
    );
  }
}

export {
  HeightMap,
  Box,
  RoundedBox,
  PlasticBrick,
  Hexagon,
  Capsule,
  NoCrop,
  CircleCrop,
  HexagonCrop,
  NormalHeight,
  BlockHeight,
  HalfBlockHeight,
  QuarterBlockHeight,
};
