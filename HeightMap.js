import {
  BoxBufferGeometry,
  Object3D,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  InstancedBufferAttribute,
  Vector3,
  IcosahedronBufferGeometry,
  Scene,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshNormalMaterial,
  Quaternion,
  Matrix4,
  BufferAttribute,
} from "./third_party/three.module.js";
import { RoundedBoxGeometry } from "./third_party/RoundedBoxGeometry.js";
import { generateRoundedPrismGeometry } from "./RoundedPrismGeomtry.js";
import { generatePlasticBrickGeometry } from "./PlasticBrickGeometry.js";
import { getNextZenHeight } from "./mapbox.js";
//import { GLTFExporter } from "./third_party/GLTFExporter.js";
import { PLYExporter } from "./third_party/PLYExporter.js";
import { downloadArrayBuffer, downloadStr } from "./download.js";

const RoundedBox = Symbol("RoundedBox");
const Hexagon = Symbol("Hexagon");
const PlasticBrick = Symbol("PlasticBrick");

const dummy = new Object3D();
const c = new Color();
const v = new Vector3();

class HeightMap {
  constructor(width = 1024, height = 1024, step = 2) {
    this.width = width;
    this.height = height;
    this.step = step;
    this.boxScale = 0.01 * step;
    this.points = [];
    this.verticalScale = 20;

    this.mode = PlasticBrick;
    // this.generateBoxGeometry();
    // this.generateRoundedBoxGeometry();
    this.generatePlasticBrickGeometry();
    this.generateGridPoints();
    // this.generateHexagonGeometry();
    // this.generateHexagonGrid();
    this.initMesh();
    this.updatePositions();
  }

  set mode(mode) {
    this._mode = mode;
    this.regenerate();
  }

  regenerate() {
    switch (this._mode) {
      case RoundedBox:
        break;
      case Hexagon:
        break;
      case PlasticBrick:
        break;
    }
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
    // this.geo = new IcosahedronBufferGeometry(this.boxScale / 2, 5);
  }

  generateHexagonGeometry() {
    this.geo = generateRoundedPrismGeometry(this.boxScale);
  }

  generatePlasticBrickGeometry() {
    this.geo = generatePlasticBrickGeometry(this.boxScale, 2);
  }

  filter(v) {
    return true;
    return this.filterCircle(v);
    return this.filterHexagon(v);
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
    this.mesh = new InstancedMesh(
      this.geo,
      new MeshBasicMaterial(),
      this.points.length
    );
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

  processMaps(colorCtx, heightCtx) {
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

    const heights = this.mesh.geometry.attributes.height.array;
    let min2 = Number.MAX_SAFE_INTEGER;
    let max2 = Number.MIN_SAFE_INTEGER;
    let i = 0;
    for (const p of this.points) {
      let h = this.getHeight(heightData.data, Math.floor(p.x), Math.floor(p.y));
      h = ((h - min) / (max - min)) * this.verticalScale;
      min2 = Math.min(min2, h);
      max2 = Math.max(max2, h);
      h = Math.floor(h / 0.5) * 0.5;
      h = 1 + h;

      const c = this.getColor(colorData.data, Math.floor(p.x), Math.floor(p.y));

      heights[i] = h * this.boxScale;
      this.mesh.setColorAt(i, c);
      i++;
    }

    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.height.needsUpdate = true;
  }

  bakeGLTF() {
    const exporter = new GLTFExporter();
    const scene = new Scene();
    const group = new Group();
    scene.add(group);
    for (let i = 0; i < this.mesh.instanceMatrix.count; i++) {
      const dummy = new Mesh(this.geo, new MeshStandardMaterial());
      this.mesh.getMatrixAt(i, dummy.matrix);
      this.mesh.getColorAt(i, dummy.material.color);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.position.y = this.mesh.geometry.attributes.height.array[i];
      group.add(dummy);
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

export { HeightMap };
