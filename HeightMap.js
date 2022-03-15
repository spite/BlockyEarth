import {
  BoxBufferGeometry,
  Object3D,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  InstancedBufferAttribute,
  Vector3,
  IcosahedronBufferGeometry,
} from "./third_party/three.module.js";
import { RoundedBoxGeometry } from "./third_party/RoundedBoxGeometry.js";
import { generateRoundedPrismGeometry } from "./RoundedPrismGeomtry.js";
import { generatePlasticBrickGeometry } from "./PlasticBrickGeometry.js";
import { getNextZenHeight } from "./mapbox.js";

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

  generateGridPoints() {
    this.points.length = 0;
    const v = new Vector3();
    for (let y = 0; y < this.height; y += this.step) {
      for (let x = 0; x < this.width; x += this.step) {
        const ptr = (y * this.width + x) * 4;
        v.set(
          (x - 0.5 * this.width) / this.step,
          0,
          (y - 0.5 * this.height) / this.step
        ).multiplyScalar(this.boxScale);
        this.points.push({ ptr, v: v.clone() });
      }
    }
  }

  generateHexagonGrid() {
    this.points.length = 0;
    const f = Math.sqrt(3) / 2;
    const fstep = this.step * f;
    let row = 0;
    for (let y = 0; y < this.height; y += fstep) {
      for (let x = 0; x < this.width; x += this.step) {
        const ptr = (Math.floor(y) * this.width + Math.floor(x)) * 4;
        v.set(
          (x - 0.5 * this.width) / this.step,
          0,
          (y - 0.5 * this.height) / this.step
        ).multiplyScalar(this.boxScale);
        if (row % 2 === 1) {
          v.x += this.boxScale / 2;
        }
        const d = v.length();
        if (d < (0.5 * this.width * this.boxScale) / this.step) {
          this.points.push({ ptr, v: v.clone() });
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
      const h = getNextZenHeight(
        heightData.data[p.ptr],
        heightData.data[p.ptr + 1],
        heightData.data[p.ptr + 2]
      );
      if (isNaN(h)) {
        debugger;
      }
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    console.log(min, max);

    const heights = this.mesh.geometry.attributes.height.array;
    let min2 = Number.MAX_SAFE_INTEGER;
    let max2 = Number.MIN_SAFE_INTEGER;
    let i = 0;
    for (const p of this.points) {
      let h = getNextZenHeight(
        heightData.data[p.ptr],
        heightData.data[p.ptr + 1],
        heightData.data[p.ptr + 2]
      );
      h = ((h - min) / (max - min)) * this.verticalScale;
      min2 = Math.min(min2, h);
      max2 = Math.max(max2, h);
      h = Math.floor(h / 0.5) * 0.5;
      h = 1 + h;
      const c = new Color(
        colorData.data[p.ptr] / 255,
        colorData.data[p.ptr + 1] / 255,
        colorData.data[p.ptr + 2] / 255
      );

      heights[i] = h * this.boxScale;
      this.mesh.setColorAt(i, c);
      i++;
    }

    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.geometry.attributes.height.needsUpdate = true;
  }
}

export { HeightMap };