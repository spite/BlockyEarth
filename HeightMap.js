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
import { generateRoundedPrismGeometry } from "./RoundedPrismGeomtry.js";
import { generatePlasticBrickGeometry } from "./PlasticBrickGeometry.js";
import { getNextZenHeight } from "./mapbox.js";
import { GLTFExporter } from "./third_party/GLTFExporter.js";
import { PLYExporter } from "./third_party/PLYExporter.js";
import { downloadArrayBuffer, downloadStr } from "./download.js";
import { getClosestColor } from "./colors.js";
import { nextZenElevation, latToTile, lngToTile, fetchTile } from "./mapbox.js";
import { mod } from "./modules/Maf.js";

const Box = Symbol("Box");
const RoundedBox = Symbol("RoundedBox");
const Hexagon = Symbol("Hexagon");
const PlasticBrick = Symbol("PlasticBrick");
const Capsule = Symbol("Capsule");

const NoCrop = Symbol("NoCrop");
const CircleCrop = Symbol("CircleCrop");
const HexagonCrop = Symbol("HexagonCrop");

const NormalHeight = Symbol("NormalHeight");
const BlockHeight = Symbol("BlockHeight");
const HalfBlockHeight = Symbol("HalfBlockHeight");
const QuarterBlockHeight = Symbol("QuarterBlockHeight");

const dummy = new Object3D();
const c = new Color();
const v = new Vector3();

class HeightMap {
  constructor(width = 1024, height = 1024, step = 2) {
    this.setSize(width, height);
    this.step = step;

    this.points = [];
    this.scale = 80;

    this.loadedTiles = 0;
    this.totalTiles = 0;

    this.invalidated = false;
    this.mode = Hexagon;
    this.crop = NoCrop;
    this.quantHeight = NormalHeight;
    this.perfectAlignment = true;
    this.brickPalette = false;

    this.lat = 0;
    this.lng = 0;
    this.zoom = 0;

    this.bb = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));

    this.tiles = new Set();

    this.onProgress = () => {};
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
    this.invalidated = this.scale !== scale;
    this.verticalScale = scale;
  }

  get scale() {
    return this.verticalScale;
  }

  set brickPalette(v) {
    this.invalidated = this.brickPalette !== v;
    this._brickPalette = v;
  }

  get brickPalette() {
    return this._brickPalette;
  }

  set perfectAlignment(v) {
    this.invalidated = this.perfectAlignment !== v;
    this._perfectAlignment = v;
  }

  get perfectAlignment() {
    return this._perfectAlignment;
  }

  set quantHeight(h) {
    this.invalidated = h !== this._quantHeight;
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
    this.invalidated = mode !== this.mode;
    this._mode = mode;
  }

  get mode() {
    return this._mode;
  }

  set crop(crop) {
    this.invalidated = crop !== this.crop;
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
    console.log("GENERATE");
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
    switch (this.mode) {
      case Box:
      case RoundedBox:
      case PlasticBrick:
        this.generateGridPoints();
        break;
      case Capsule:
      case Hexagon:
        this.generateHexagonGrid();
        break;
    }
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

  generateGridPoints() {
    this.points.length = 0;
    const uW = this.width / this.step;
    const uH = this.height / this.step;
    const offsetW = 0.5 * ((uW + 1) % 2) * this.step;
    const offsetH = 0.5 * ((uH + 1) % 2) * this.step;
    for (let y = 0; y < this.height; y += this.step) {
      for (let x = 0; x < this.width; x += this.step) {
        const ptr = (y * this.width + x) * 4;
        v.set(
          (x + offsetW - 0.5 * this.width) / this.step,
          0,
          (y + offsetH - 0.5 * this.height) / this.step
        ).multiplyScalar(this.boxScale);
        if (this.filter(v)) {
          this.points.push({ ptr, x, y, v: v.clone() });
        }
      }
    }
  }

  generateHexagonGrid() {
    this.points.length = 0;
    const f = Math.sqrt(3) / 2;
    const fstep = this.step * f;
    const uW = this.width / this.step;
    const uH = this.height / this.step;
    const offsetW = 0.5 * ((uW + 1) % 2) * this.step;
    const offsetH = 0.5 * ((uH + 1) % 2) * this.step;
    let row = 0;
    for (let y = 0; y < this.height; y += fstep) {
      for (let x = 0; x < this.width; x += this.step) {
        const ptr = (Math.floor(y) * this.width + Math.floor(x)) * 4;
        v.set(
          (x + offsetW - 0.5 * this.width) / this.step,
          0,
          (y + offsetH - 0.5 * this.height) / this.step
        ).multiplyScalar(this.boxScale);
        if (row % 2 === 1) {
          v.x += this.boxScale / 2;
        }
        if (this.filter(v)) {
          this.points.push({ ptr, x, y, v: v.clone() });
        }
      }
      row++;
    }
  }

  initMesh() {
    this.mesh = new InstancedMesh(this.geo, this.material, this.points.length);
    this.mesh.geometry.setAttribute(
      "height",
      new InstancedBufferAttribute(new Float32Array(this.points.length), 1)
    );
    this.mesh.castShadow = this.mesh.receiveShadow = true;

    for (let i = 0; i < this.mesh.count; i++) {
      this.mesh.setColorAt(i, c);
    }
  }

  updatePositions() {
    let i = 0;
    this.mesh.count = this.points.length;
    console.log(this.points.length);
    for (const p of this.points) {
      dummy.position.copy(p.v);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      i++;
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
          let h = getNextZenHeight(data[p], data[p + 1], data[p + 2]);
          if (isNaN(h)) {
            debugger;
          }
          accum += h;
          total++;
        }
      }
    }
    return accum / total;
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
          r += data[p];
          g += data[p + 1];
          b += data[p + 2];
          total++;
        }
      }
    }
    total *= 255;
    return new Color(r / total, g / total, b / total);
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

  async populateColorMap(lat = this.lat, lng = this.lng, zoom = this.zoom) {
    this.lat = lat;
    this.lng = lng;
    this.zoom = zoom;

    const cx = lngToTile(lng, zoom);
    const cy = latToTile(lat, zoom);
    const bx = Math.floor(cx);
    const by = Math.floor(cy);

    const promises = [];

    const maxW = Math.pow(2, zoom);
    const maxH = Math.pow(2, zoom);

    const ox = (cx % 1) * 256;
    const oy = (cy % 1) * 256;
    const w0 = Math.ceil((-0.5 * this.width - ox) / 256);
    const w1 = Math.ceil((0.5 * this.width - ox) / 256);
    const h0 = Math.ceil((-0.5 * this.height - oy) / 256);
    const h1 = Math.ceil((0.5 * this.height - oy) / 256);

    this.totalTiles += (h1 - h0 + 1) * (w1 - w0 + 1);

    for (let y = h0; y <= h1; y++) {
      for (let x = w0; x <= w1; x++) {
        promises.push(
          new Promise(async (resolve, reject) => {
            const img = fetchTile(
              mod(bx - x, maxW),
              mod(by - y, maxH),
              zoom,
              this.generator
            );
            this.tiles.add(img);
            try {
              await img.decode();
              this.loadedTiles++;
              this.onProgress((this.loadedTiles * 100) / this.totalTiles);
              const dx = -(x + (cx % 1)) * img.naturalWidth;
              const dy = -(y + (cy % 1)) * img.naturalHeight;
              this.colorCtx.drawImage(img, dx, dy);
              this.tiles.delete(img);
              resolve();
            } catch (e) {
              console.log(e);
              this.tiles.delete(img);
              reject();
            }
          })
        );
      }
    }

    return Promise.all(promises);
  }

  async populateHeightMap(lat, lng, zoom) {
    zoom = zoom - 1;
    const cx = lngToTile(lng, zoom);
    const cy = latToTile(lat, zoom);
    const bx = Math.floor(cx);
    const by = Math.floor(cy);

    const promises = [];
    const maxW = Math.pow(2, zoom);
    const maxH = Math.pow(2, zoom);

    const ox = (cx % 1) * 512;
    const oy = (cy % 1) * 512;
    const w0 = Math.ceil((-0.5 * this.width - ox) / 512);
    const w1 = Math.ceil((0.5 * this.width - ox) / 512);
    const h0 = Math.ceil((-0.5 * this.height - oy) / 512);
    const h1 = Math.ceil((0.5 * this.height - oy) / 512);

    this.totalTiles += (h1 - h0 + 1) * (w1 - w0 + 1);

    for (let y = h0; y <= h1; y++) {
      for (let x = w0; x <= w1; x++) {
        promises.push(
          new Promise(async (resolve, reject) => {
            const img = fetchTile(
              mod(bx - x, maxW),
              mod(by - y, maxH),
              zoom,
              nextZenElevation
            );
            this.tiles.add(img);
            try {
              await img.decode();
              this.loadedTiles++;
              this.onProgress((this.loadedTiles * 100) / this.totalTiles);
              const dx = -(x + (cx % 1)) * img.naturalWidth;
              const dy = -(y + (cy % 1)) * img.naturalHeight;
              this.heightCtx.drawImage(img, dx, dy);
              this.tiles.delete(img);
              resolve();
            } catch (e) {
              console.log(e);
              this.tiles.delete(img);
              reject();
            }
          })
        );
      }
    }

    return Promise.all(promises);
  }

  cancel() {
    const pending = this.tiles.values();
    for (const tile of pending) {
      tile.src = null;
      this.tiles.delete(tile);
    }
  }

  async populateMaps(lat = this.lat, lng = this.lng, zoom = this.zoom) {
    this.cancel();
    this.loadedTiles = 0;
    this.totalTiles = 0;
    await Promise.all([
      this.populateColorMap(lat, lng, zoom),
      this.populateHeightMap(lat, lng, zoom),
    ]);
    this.loadedTiles = 0;
    this.totalTiles = 0;
    this.onProgress(0);
    this.invalidate();
    this.processMaps();
    console.log("done");
  }

  processMaps() {
    if (!this.invalidated) return;
    this.bb.makeEmpty();
    console.time("process");
    this.invalidated = false;
    const colorCtx = this.colorCtx;
    const heightCtx = this.heightCtx;
    console.log("PROCESS");
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

    let min = Number.MAX_SAFE_INTEGER;
    let max = Number.MIN_SAFE_INTEGER;
    for (const p of this.points) {
      const h = this.getHeight(
        heightData.data,
        Math.floor(p.x),
        Math.floor(p.y)
      );
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    console.log(min, max);

    const tmp = new Vector3();
    const heights = this.mesh.geometry.attributes.height.array;
    let i = 0;
    for (const p of this.points) {
      let h = this.getHeight(heightData.data, Math.floor(p.x), Math.floor(p.y));
      //h = ((h - min) / (max - min)) * this.verticalScale;
      h = (h - min) * this.verticalScale;
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

      tmp.set(p.v.x, h * this.boxScale, p.v.z);
      this.bb.expandByPoint(tmp);
      const c = this.getColor(colorData.data, Math.floor(p.x), Math.floor(p.y));

      heights[i] = h * this.boxScale;
      if (this.brickPalette) {
        this.mesh.setColorAt(i, getClosestColor(c));
      } else {
        this.mesh.setColorAt(i, c);
      }
      i++;
    }
    console.timeEnd("process");

    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.height.needsUpdate = true;
  }

  bakeGLTF() {
    const exporter = new GLTFExporter();
    const scene = new Scene();
    const material = new MeshBasicMaterial({ vertexColors: true });
    const mat = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const c = new Color();

    for (let i = 0; i < this.mesh.instanceMatrix.count; i++) {
      const geo = this.geo.clone();
      geo.setAttribute(
        "color",
        new BufferAttribute(
          new Float32Array(geo.attributes.position.count * 3),
          3
        )
      );
      this.mesh.getMatrixAt(i, mat);
      this.mesh.getColorAt(i, c);
      for (let i = 0; i < geo.attributes.position.count * 3; i += 3) {
        geo.attributes.color.array[i] = c.r;
        geo.attributes.color.array[i + 1] = c.g;
        geo.attributes.color.array[i + 2] = c.b;
      }
      mat.decompose(position, quaternion, scale);
      position.y = this.mesh.geometry.attributes.height.array[i];
      geo.translate(position.x, position.y, position.z);
      geo.scale(scale.x, scale.y, scale.z);
      const mesh = new Mesh(geo, material);
      scene.add(mesh);
    }
    const options = {
      binary: true,
    };
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadArrayBuffer(result, `blocky-earth-.glb`);
        } else {
          const output = JSON.stringify(result, null, 2);
          downloadStr(output, `blocky-earth-.gltf`);
        }
      },
      options
    );
  }

  bake() {
    this.bakePLY();
    // this.bakeGLTF();
  }

  bakePLY() {
    const exporter = new PLYExporter();
    const scene = new Scene();
    const material = new MeshBasicMaterial({ vertexColors: true });
    const mat = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const c = new Color();

    for (let i = 0; i < this.mesh.instanceMatrix.count; i++) {
      const geo = this.geo.clone();
      geo.setAttribute(
        "color",
        new BufferAttribute(
          new Float32Array(geo.attributes.position.count * 3),
          3
        )
      );
      this.mesh.getMatrixAt(i, mat);
      this.mesh.getColorAt(i, c);
      for (let i = 0; i < geo.attributes.position.count * 3; i += 3) {
        geo.attributes.color.array[i] = c.r;
        geo.attributes.color.array[i + 1] = c.g;
        geo.attributes.color.array[i + 2] = c.b;
      }
      mat.decompose(position, quaternion, scale);
      position.y = this.mesh.geometry.attributes.height.array[i];
      geo.translate(position.x, position.y, position.z);
      geo.scale(scale.x, scale.y, scale.z);
      const mesh = new Mesh(geo, material);
      scene.add(mesh);
    }
    const options = { binary: true };
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          downloadArrayBuffer(result, `blocky-earth-.ply`);
        } else {
          // const output = JSON.stringify(result, null, 2);
          downloadStr(result, `blocky-earth-.ply`);
        }
      },
      options
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
