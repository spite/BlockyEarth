import {
  BoxBufferGeometry,
  Object3D,
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
import { nextZenElevation, latToTile, lngToTile, fetchTile } from "./mapbox.js";
import { mod } from "./modules/Maf.js";

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

const dummy = new Object3D();
const c = new Color();
const sampledColor = new Color();
const v = new Vector3();

class HeightMap {
  constructor(width = 1024, height = 1024, step = 2) {
    this.setSize(width, height);
    this.step = step;

    this.pointCount = 0;
    this.scale = 150;

    this.loadedTiles = 0;
    this.totalTiles = 0;

    this.invalidated = false;
    this.mode = Hexagon;
    this.crop = NoCrop;
    this.quantHeight = NormalHeight;
    this.perfectAlignment = true;
    this.brickPalette = false;
    this.normalizeHeight = true;

    this.lat = 0;
    this.lng = 0;
    this.zoom = 0;

    this.bb = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));

    this.tiles = new Set();
    this.generation = 0;

    this.onProgress = () => {};
    this.onTilesUnavailable = () => {};
  }

  setSize(width, height) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.invalidated = true;
    this.width = width;
    this.height = height;
    this.initCanvases();
  }

  setStep(step) {
    if (this.step === step) {
      return;
    }
    this.invalidated = true;
    this.step = step;
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

  set normalizeHeight(v) {
    this.invalidated ||= this.normalizeHeight !== v;
    this._normalizeHeight = v;
  }

  get normalizeHeight() {
    return this._normalizeHeight;
  }

  set perfectAlignment(v) {
    this.invalidated ||= this.perfectAlignment !== v;
    this._perfectAlignment = v;
  }

  get perfectAlignment() {
    return this._perfectAlignment;
  }

  set quantHeight(h) {
    this.invalidated ||= h !== this._quantHeight;
    this._quantHeight = h;
  }

  get quantHeight() {
    return this._quantHeight;
  }

  set step(step) {
    this._step = step;
    this.boxScale = 0.01 * this._step;
  }

  get step() {
    return this._step;
  }

  set mode(mode) {
    this.invalidated ||= mode !== this.mode;
    this._mode = mode;
  }

  get mode() {
    return this._mode;
  }

  set crop(crop) {
    this.invalidated ||= crop !== this.crop;
    this._crop = crop;
  }

  get crop() {
    return this._crop;
  }

  invalidate() {
    this.invalidated = true;
  }

  generate() {
    if (!this.invalidated) return;
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
    }
  }

  filterCircle(v) {
    const d = v.length();
    return (
      d < (0.5 * this.width * this.boxScale) / this.step + 0.5 * this.boxScale
    );
  }

  filterHexagon(v) {
    const a = Math.atan2(v.z, v.x);
    const R = (0.5 * this.width * this.boxScale) / this.step;
    const sides = 6;
    const r =
      (R * Math.cos(Math.PI / sides)) /
      Math.cos((2 * Math.asin(Math.sin((sides * a) / 2))) / sides);
    const d = v.length();
    return d <= r;
  }

  generatePoints() {
    const hexagonal = this.mode === Hexagon || this.mode === Capsule;
    const rowStep = hexagonal ? this.step * (Math.sqrt(3) / 2) : this.step;

    const cols = Math.ceil(this.width / this.step);
    const rows = Math.ceil(this.height / rowStep);
    const max = cols * rows;
    if (!this.sampleIndex || this.sampleIndex.length < max) {
      this.sampleIndex = new Int32Array(max);
      this.pointX = new Float32Array(max);
      this.pointZ = new Float32Array(max);
    }

    const uW = this.width / this.step;
    const uH = this.height / this.step;
    const offsetW = 0.5 * ((uW + 1) % 2) * this.step;
    const offsetH = 0.5 * ((uH + 1) % 2) * this.step;

    let n = 0;
    let row = 0;
    for (let y = 0; y < this.height; y += rowStep) {
      for (let x = 0; x < this.width; x += this.step) {
        v.set(
          (x + offsetW - 0.5 * this.width) / this.step,
          0,
          (y + offsetH - 0.5 * this.height) / this.step
        ).multiplyScalar(this.boxScale);
        if (hexagonal && row % 2 === 1) {
          v.x += this.boxScale / 2;
        }
        if (this.filter(v)) {
          this.sampleIndex[n] = Math.floor(y) * this.width + Math.floor(x);
          this.pointX[n] = v.x;
          this.pointZ[n] = v.z;
          n++;
        }
      }
      row++;
    }
    this.pointCount = n;
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
    for (let i = 0; i < this.pointCount; i++) {
      dummy.position.set(this.pointX[i], 0, this.pointZ[i]);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  getHeight(data, x0, y0) {
    let p;
    let accum = 0;
    let total = 0;
    for (let y = y0; y < y0 + this.step; y++) {
      for (let x = x0; x < x0 + this.step; x++) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          p = (y * this.width + x) * 4;
          if (data[p + 3] === 0) continue;
          const h = getNextZenHeight(data[p], data[p + 1], data[p + 2]);
          accum += h;
          total++;
        }
      }
    }
    return total === 0 ? NaN : accum / total;
  }

  getColor(data, x0, y0) {
    let p;
    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (let y = y0; y < y0 + this.step; y++) {
      for (let x = x0; x < x0 + this.step; x++) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          p = (y * this.width + x) * 4;
          if (data[p + 3] === 0) continue;
          r += data[p];
          g += data[p + 1];
          b += data[p + 2];
          total++;
        }
      }
    }
    if (total === 0) {
      return sampledColor.setRGB(0.5, 0.5, 0.5);
    }
    total *= 255;
    return sampledColor.setRGB(r / total, g / total, b / total);
  }

  initCanvases() {
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = this.width;
    colorCanvas.height = this.height;
    const colorCtx = colorCanvas.getContext("2d");
    const heightCanvas = document.createElement("canvas");
    heightCanvas.width = colorCanvas.width;
    heightCanvas.height = colorCanvas.height;
    const heightCtx = heightCanvas.getContext("2d");

    // document.body.append(heightCanvas);
    heightCanvas.style.position = "absolute";
    heightCanvas.style.left = "0";
    heightCanvas.style.top = "0";
    heightCanvas.style.zIndex = "10";
    heightCanvas.style.width = "512px";
    heightCtx.translate(0.5 * heightCanvas.width, 0.5 * heightCanvas.height);
    heightCtx.imageSmoothingEnabled = false;

    // document.body.append(colorCanvas);
    colorCanvas.style.position = "absolute";
    colorCanvas.style.left = "512px";
    colorCanvas.style.top = "0";
    colorCanvas.style.zIndex = "10";
    colorCanvas.style.width = "512px";
    // colorCanvas.style.border = "1px solid #ff00ff";
    colorCtx.translate(0.5 * colorCanvas.width, 0.5 * colorCanvas.height);

    this.colorCanvas = colorCanvas;
    this.colorCtx = colorCtx;
    this.heightCanvas = heightCanvas;
    this.heightCtx = heightCtx;
  }

  async populateMap(ctx, generator, lat, lng, zoom) {
    const maxZoom = generator.maxZoom ?? Infinity;
    const z = Math.min(zoom, maxZoom);
    const tileSize = (generator.tileSize ?? 256) * Math.pow(2, zoom - z);

    const tiles = Math.pow(2, z);

    const cx = lngToTile(lng, z);
    const cy = latToTile(lat, z);
    const bx = Math.floor(cx);
    const by = Math.floor(cy);
    const fx = cx - bx;
    const fy = cy - by;

    const ox = fx * tileSize;
    const oy = fy * tileSize;
    const w0 = Math.ceil((-0.5 * this.width - ox) / tileSize);
    const w1 = Math.ceil((0.5 * this.width - ox) / tileSize);
    const h0 = Math.ceil((-0.5 * this.height - oy) / tileSize);
    const h1 = Math.ceil((0.5 * this.height - oy) / tileSize);

    const requests = [];
    for (let y = h0; y <= h1; y++) {
      const ty = by - y;
      if (ty < 0 || ty >= tiles) continue;
      for (let x = w0; x <= w1; x++) {
        requests.push({ tx: mod(bx - x, tiles), ty, x, y });
      }
    }

    this.totalTiles += requests.length;

    const generation = this.generation;
    let failed = 0;

    await Promise.all(
      requests.map(async ({ tx, ty, x, y }) => {
        const img = fetchTile(tx, ty, z, generator);
        this.tiles.add(img);
        try {
          await img.decode();
          if (generation !== this.generation) return;
          this.loadedTiles++;
          this.onProgress((this.loadedTiles * 100) / this.totalTiles);
          const dx = Math.round(-(x + fx) * tileSize);
          const dy = Math.round(-(y + fy) * tileSize);
          ctx.drawImage(img, dx, dy, tileSize, tileSize);
        } catch (e) {
          failed++;
          console.warn(`Could not load tile ${img.src}`, e);
        } finally {
          this.tiles.delete(img);
        }
      })
    );

    return { requested: requests.length, failed };
  }

  cancel() {
    this.generation++;
    for (const tile of this.tiles) {
      tile.src = "";
    }
    this.tiles.clear();
  }

  clearCanvases() {
    const x = -0.5 * this.width;
    const y = -0.5 * this.height;
    this.colorCtx.clearRect(x, y, this.width, this.height);
    this.heightCtx.clearRect(x, y, this.width, this.height);
  }

  async populateMaps(lat = this.lat, lng = this.lng, zoom = this.zoom) {
    this.cancel();
    this.clearCanvases();
    this.lat = lat;
    this.lng = lng;
    this.zoom = zoom;
    this.loadedTiles = 0;
    this.totalTiles = 0;
    const [color, elevation] = await Promise.all([
      this.populateMap(this.colorCtx, this.generator, lat, lng, zoom),
      this.populateMap(this.heightCtx, nextZenElevation, lat, lng, zoom - 1),
    ]);
    this.loadedTiles = 0;
    this.totalTiles = 0;
    this.onProgress(0);
    if (color.requested > 0 && color.failed === color.requested) {
      this.onTilesUnavailable("color");
    } else if (elevation.requested > 0 && elevation.failed === elevation.requested) {
      this.onTilesUnavailable("elevation");
    }
    this.invalidate();
    this.processMaps();
  }

  processMaps() {
    if (!this.mesh) return;
    if (!this.invalidated) return;
    this.bb.makeEmpty();
    this.invalidated = false;
    const colorCtx = this.colorCtx;
    const heightCtx = this.heightCtx;
    const colorData = colorCtx.getImageData(
      0,
      0,
      colorCtx.canvas.width,
      colorCtx.canvas.height
    );
    const heightData = heightCtx.getImageData(
      0,
      0,
      heightCtx.canvas.width,
      heightCtx.canvas.height
    );

    const count = this.pointCount;
    if (!this.sampledHeights || this.sampledHeights.length < count) {
      this.sampledHeights = new Float32Array(count);
    }
    const sampled = this.sampledHeights;

    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (let i = 0; i < count; i++) {
      const index = this.sampleIndex[i];
      const h = this.getHeight(
        heightData.data,
        index % this.width,
        Math.floor(index / this.width)
      );
      sampled[i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
    const range = max > min ? max - min : 1;
    if (min > max) min = 0;

    const tmp = new Vector3();
    const heights = this.mesh.geometry.attributes.height.array;
    for (let i = 0; i < count; i++) {
      const index = this.sampleIndex[i];
      const sx = index % this.width;
      const sy = Math.floor(index / this.width);
      let h = sampled[i];
      if (Number.isNaN(h)) h = min;
      if (this._normalizeHeight) {
        h = ((h - min) / range) * this.verticalScale;
      } else {
        h = (h - min) * this.verticalScale;
      }
      h /= this.step;
      switch (this._quantHeight) {
        case NormalHeight:
          break;
        case BlockHeight:
          h = Math.floor(h);
          break;
        case HalfBlockHeight:
          h = Math.floor(h / 0.5) * 0.5;
          break;
        case QuarterBlockHeight:
          h = Math.floor(h / 0.25) * 0.25;
          break;
      }
      h = 1 / this.step + h;
      if (!this._perfectAlignment) {
        h += 0.005 - 0.01 * Math.random();
      }

      tmp.set(this.pointX[i], h * this.boxScale, this.pointZ[i]);
      this.bb.expandByPoint(tmp);
      const c = this.getColor(colorData.data, sx, sy);

      heights[i] = h * this.boxScale;
      if (this.brickPalette) {
        this.mesh.setColorAt(i, getClosestColor(c));
      } else {
        this.mesh.setColorAt(i, c);
      }
    }

    this.mesh.instanceColor.needsUpdate = true;
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
    return `blocky-earth-${this.lat.toFixed(5)}-${this.lng.toFixed(5)}-${
      this.zoom
    }`;
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
