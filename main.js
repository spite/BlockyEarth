import "./deps/map.js";
import "./deps/progress.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
import { loadTile } from "./google-maps.js";
import {
  fetchElevationTile,
  getNextZenHeight,
  latToTile,
  lngToTile,
} from "./mapbox.js";
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Mesh,
  CanvasTexture,
  RepeatWrapping,
  TorusKnotBufferGeometry,
  DirectionalLight,
  InstancedMesh,
  BoxBufferGeometry,
  MeshNormalMaterial,
  Object3D,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  DynamicDrawUsage,
  MeshLambertMaterial,
  HemisphereLight,
  MeshPhongMaterial,
  PCFSoftShadowMap,
  AmbientLight,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  Vector3,
} from "./third_party/three.module.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { twixt } from "./deps/twixt.js";
import { mod, randomInRange } from "./modules/Maf.js";
import { SSAO } from "./SSAO.js";
import { RoundedBoxGeometry } from "./third_party/RoundedBoxGeometry.js";
import { generateRoundedPrismGeometry } from "./RoundedPrismGeomtry.js";
import { generatePlasticBrickGeometry } from "./PlasticBrickGeometry.js";

const ssao = new SSAO();

const speed = twixt.create("speed", 1);
const textureScale = twixt.create("scale", 2);
const innerScatter = twixt.create("innerScatter", 5);
const outerScatter = twixt.create("outerScatter", 0);
const normalScale = twixt.create("normalScale", 0.5);
const reflectivity = twixt.create("reflectivity", 0);
const roughness = twixt.create("roughness", 1);
const darkness = twixt.create("darkness", 0);
const smoothness = twixt.create("smoothness", 0);

const map = document.querySelector("#map-browser");
const progress = document.querySelector("progress-bar");
const snackbar = document.querySelector("snack-bar");
const description = document.querySelector("#description");
map.snackbar = snackbar;

progress.hide();

const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(window.devicePixelRatio);
document.body.append(renderer.domElement);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
const camera = new PerspectiveCamera(75, 1, 0.01, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const directLight = new DirectionalLight(0xffffff);
directLight.position.set(-2, 1, -2);
scene.add(directLight);
directLight.castShadow = true;
directLight.shadow.mapSize.width = 2048;
directLight.shadow.mapSize.height = 2048;
const d = 8;
directLight.shadow.camera.left = -d;
directLight.shadow.camera.right = d;
directLight.shadow.camera.top = d;
directLight.shadow.camera.bottom = -d;
directLight.shadow.camera.near = -10;
directLight.shadow.camera.far = 10;

directLight.shadow.bias = -0.0001;
window.l = directLight;

const light = new HemisphereLight(0xffffff, 0x888888, 0.2);
light.position.set(0, 1, 0);
scene.add(light);

const ambient = new AmbientLight(0x404040, 1);
scene.add(ambient);

let currentLocation;

const width = 1024;
const height = 1024;
const step = 8;

const colorCanvas = document.createElement("canvas");
colorCanvas.width = width;
colorCanvas.height = height;
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
colorCtx.translate(0.5 * colorCanvas.width, 0.5 * colorCanvas.height);

const boxScale = 0.01 * step;
//const geo = new BoxBufferGeometry(boxScale, boxScale, boxScale); //, 5, 5, 5);
// const geo = new RoundedBoxGeometry(
//   boxScale,
//   boxScale,
//   boxScale,
//   boxScale / 50,
//   1
// ); //, 5, 5, 5);
// const geo = generateRoundedPrismGeometry(boxScale);
const geo = generatePlasticBrickGeometry(boxScale, 2);

const points = [];
const v = new Vector3();
const dummy = new Object3D();
for (let y = 0; y < height; y += step) {
  for (let x = 0; x < width; x += step) {
    const ptr = (y * width + x) * 4;
    v.set(
      (x - 0.5 * width) / step,
      0,
      (y - 0.5 * height) / step
    ).multiplyScalar(boxScale);
    points.push({ ptr, v: v.clone() });
  }
}

// const f = Math.sqrt(3) / 2;
// const fstep = step * f;
// let row = 0;
// for (let y = 0; y < height; y += fstep) {
//   for (let x = 0; x < width; x += step) {
//     const ptr = (Math.floor(y) * width + Math.floor(x)) * 4;
//     v.set(
//       (x - 0.5 * width) / step,
//       0,
//       (y - 0.5 * height) / step
//     ).multiplyScalar(boxScale);
//     if (row % 2 === 1) {
//       v.x += boxScale / 2;
//     }
//     const d = v.length();
//     if (d < (0.5 * width * boxScale) / step) {
//       points.push({ ptr, v: v.clone() });
//     }
//   }
//   row++;
// }

const mesh = new InstancedMesh(
  geo,
  new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 }),
  points.length
);
scene.add(mesh);
// mesh.instanceMatrix.setUsage(DynamicDrawUsage);
mesh.geometry.setAttribute(
  "height",
  new InstancedBufferAttribute(new Float32Array(points.length), 1)
);
// mesh.instanceColor.setUsage(DynamicDrawUsage);
mesh.castShadow = mesh.receiveShadow = true;

const c = new Color();
for (let i = 0; i < mesh.count; i++) {
  mesh.setColorAt(i, c);
}

let verticalScale = 500 / step;
window.verticalScale = verticalScale;

let i = 0;
for (const p of points) {
  dummy.position.copy(p.v);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
  i++;
}
mesh.instanceMatrix.needsUpdate = true;

function processMaps() {
  const colorData = colorCtx.getImageData(
    0,
    0,
    colorCanvas.width,
    colorCanvas.height
  );
  const heightData = heightCtx.getImageData(
    0,
    0,
    heightCanvas.width,
    heightCanvas.height
  );

  let min = Number.MAX_SAFE_INTEGER;
  let max = Number.MIN_SAFE_INTEGER;
  for (const p of points) {
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

  const heights = mesh.geometry.attributes.height.array;
  let min2 = Number.MAX_SAFE_INTEGER;
  let max2 = Number.MIN_SAFE_INTEGER;
  let i = 0;
  for (const p of points) {
    let h = getNextZenHeight(
      heightData.data[p.ptr],
      heightData.data[p.ptr + 1],
      heightData.data[p.ptr + 2]
    );
    h = ((h - min) / (max - min)) * window.verticalScale;
    min2 = Math.min(min2, h);
    max2 = Math.max(max2, h);
    h = Math.floor(h / 0.5) * 0.5;
    h = 1 + h;
    const c = new Color(
      colorData.data[p.ptr] / 255,
      colorData.data[p.ptr + 1] / 255,
      colorData.data[p.ptr + 2] / 255
    );

    heights[i] = h * boxScale;
    mesh.setColorAt(i, c);
    i++;
  }

  mesh.instanceColor.needsUpdate = true;
  mesh.geometry.attributes.height.needsUpdate = true;
}

async function populateColorMap(lat, lng, zoom) {
  const cx = lngToTile(lng, zoom);
  const cy = latToTile(lat, zoom);
  const bx = Math.floor(cx);
  const by = Math.floor(cy);

  const promises = [];

  const maxW = Math.pow(2, zoom);
  const maxH = Math.pow(2, zoom);

  for (let y = -3; y < +3; y++) {
    for (let x = -3; x < +3; x++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          const c = await loadTile(mod(bx - x, maxW), mod(by - y, maxH), zoom);
          const dx = -(x + (cx % 1)) * c.naturalWidth;
          const dy = -(y + (cy % 1)) * c.naturalHeight;
          colorCtx.drawImage(c, dx, dy);
          resolve();
        })
      );
    }
  }

  return Promise.all(promises);
}

async function populateHeightMap(lat, lng, zoom) {
  zoom = zoom - 1;
  const cx = lngToTile(lng, zoom);
  const cy = latToTile(lat, zoom);
  const bx = Math.floor(cx);
  const by = Math.floor(cy);

  const promises = [];
  const maxW = Math.pow(2, zoom);
  const maxH = Math.pow(2, zoom);

  for (let y = -2; y < +2; y++) {
    for (let x = -2; x < +2; x++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          const c = await fetchElevationTile(
            mod(bx - x, maxW),
            mod(by - y, maxH),
            zoom
          );
          const dx = -(x + (cx % 1)) * c.naturalWidth;
          const dy = -(y + (cy % 1)) * c.naturalHeight;
          heightCtx.drawImage(c, dx, dy);
          resolve();
        })
      );
    }
  }

  return Promise.all(promises);
}

async function populateMaps(lat, lng, zoom) {
  await Promise.all([
    populateColorMap(lat, lng, zoom),
    populateHeightMap(lat, lng, zoom),
  ]);
  processMaps();
  console.log("done");
}

function load(lat, lng) {
  const bounds = map.map.getBounds();
  const zoom = map.map.getZoom();
  populateMaps(lat, lng, zoom + 1);
}

window.addEventListener("map-selection", async (e) => {
  const lat = e.detail.latLng.lat;
  const lng = e.detail.latLng.lng;
  await load(lat, lng);
});

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const dPR = renderer.getPixelRatio();
  ssao.setSize(w, h, dPR);
}

window.addEventListener("resize", resize);

function randomize() {
  textureScale.to(1 + Math.round(Math.random()) * 10, 200);
  innerScatter.to(Math.random() * 5, 200);
  outerScatter.to(Math.random() * 2, 200);
  normalScale.to(Math.random() * 2, 200);
  smoothness.to(Math.random(), 200);
  roughness.to(Math.random(), 200);
  darkness.to(Math.round(Math.random()), 200);
  reflectivity.to(Math.round(Math.random()), 200);
}

let running = true;

function capture() {
  renderer.domElement.toBlob(function (blob) {
    const url = URL.createObjectURL(blob);

    const downloadBtn = document.createElement("a");
    downloadBtn.setAttribute(
      "download",
      `fsk-${performance.now()}-${currentLocation}.png`
    );
    downloadBtn.setAttribute("href", url);
    downloadBtn.click();
  });
}

function pause() {
  running = !running;
  if (running) {
    const s = 1 + Math.random() * 2;
    speed.to(s, s * 200, "OutQuint");
  } else {
    speed.to(0, speed.value * 200, "OutQuint");
  }
}

window.addEventListener("keydown", (e) => {
  const path = e.composedPath();
  if (path && path[0].tagName === "INPUT") {
    return;
  }
  if (e.code === "Space") {
    pause();
  }
  if (e.code === "KeyR") {
    randomize();
  }
});

document.querySelector("#pauseBtn").addEventListener("click", (e) => {
  pause();
  e.preventDefault();
});

document.querySelector("#snapBtn").addEventListener("click", (e) => {
  capture();
  e.preventDefault();
});

document.querySelector("#chromeBtn").addEventListener("click", (e) => {
  textureScale.to(1);
  innerScatter.to(0, 200);
  outerScatter.to(0, 200);
  normalScale.to(0, 200);
  reflectivity.to(1, 200);
  roughness.to(0, 200);
  smoothness.to(0, 200);
  darkness.to(0, 200);
  e.preventDefault();
});

document.querySelector("#glassBtn").addEventListener("click", (e) => {
  textureScale.to(1);
  innerScatter.to(0, 200);
  outerScatter.to(0, 200);
  normalScale.to(0, 200);
  reflectivity.to(0, 200);
  smoothness.to(0, 200);
  roughness.to(0, 200);
  darkness.to(0, 200);
  e.preventDefault();
});

document.querySelector("#randomBtn").addEventListener("click", (e) => {
  randomize();
  e.preventDefault();
});

let time = 0;
let prevTime = performance.now();

function render() {
  controls.update();
  const now = performance.now();
  time += (now - prevTime) * speed.value;
  prevTime = now;

  // renderer.render(scene, directLight.shadow.camera);
  // renderer.render(scene, camera);
  ssao.render(renderer, scene, camera);

  renderer.setAnimationLoop(render);
}

async function init() {
  await map.ready;
  // const [lat, lng] = window.location.hash.substring(1).split(",");
  // if (lat && lng) {
  //   await load(parseFloat(lat), parseFloat(lng));
  // } else {
  //   map.randomLocation();
  // }
  render();
}

resize();
init();
