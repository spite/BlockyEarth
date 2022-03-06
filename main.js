import "./deps/map.js";
import "./deps/progress.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
import { loadTile } from "./google-maps.js";
import {
  fetchElevationTile,
  getHeight,
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
} from "./third_party/three.module.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { twixt } from "./deps/twixt.js";

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

const scene = new Scene();
const camera = new PerspectiveCamera(75, 1, 0.01, 1000);
camera.position.set(10, 10, 10);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const directLight = new DirectionalLight(0xffffff);
directLight.position.set(2, 2, 2);
scene.add(directLight);
directLight.castShadow = true;
directLight.shadow.mapSize.width = 2048;
directLight.shadow.mapSize.height = 2048;
directLight.shadow.bias = -0.0001;
window.l = directLight;

// const light = new HemisphereLight(0xffffff, 0x888888);
// light.position.set(0, 1, 0);
// scene.add(light);

let currentLocation;

const width = 512;
const height = 512;

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

const boxScale = 0.01;
const geo = new BoxBufferGeometry(boxScale, boxScale, boxScale);
const mesh = new InstancedMesh(
  geo,
  new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 }),
  width * height
);
scene.add(mesh);
mesh.instanceMatrix.setUsage(DynamicDrawUsage);
// mesh.instanceColor.setUsage(DynamicDrawUsage);
mesh.castShadow = mesh.receiveShadow = true;

const dummy = new Object3D();
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

  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ptr = (y * width + x) * 4;
      const h =
        getHeight(
          heightData.data[ptr],
          heightData.data[ptr + 1],
          heightData.data[ptr + 2]
        ) / 100;
      const c = new Color(
        colorData.data[ptr] / 255,
        colorData.data[ptr + 1] / 255,
        colorData.data[ptr + 2] / 255
      );
      dummy.position
        .set(x - 0.5 * width, 0, y - 0.5 * height)
        .multiplyScalar(boxScale);
      dummy.position.y = h / 10;
      dummy.scale.set(1, 10, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, c);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
}

async function populateColorMap(lat, lng, zoom) {
  const cx = lngToTile(lng, zoom);
  const cy = latToTile(lat, zoom);
  const bx = Math.floor(cx);
  const by = Math.floor(cy);

  const promises = [];

  for (let y = -3; y < +3; y++) {
    for (let x = -3; x < +3; x++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          const c = await loadTile(bx - x, by - y, zoom);
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

  for (let y = -2; y < +2; y++) {
    for (let x = -2; x < +2; x++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          const c = await fetchElevationTile(bx - x, by - y, zoom);
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

  // renderer.render(scene, camera);
  renderer.render(scene, camera);
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
