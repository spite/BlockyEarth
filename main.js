import "./deps/map.js";
import "./deps/progress.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
import { loadTile } from "./google-maps.js";
import {
  fetchElevationTile,
  latToTile,
  lngToTile,
  fetchTile,
} from "./mapbox.js";
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
} from "./third_party/three.module.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { twixt } from "./deps/twixt.js";
import { mod, randomInRange } from "./modules/Maf.js";
import { SSAO } from "./SSAO.js";
import { HeightMap } from "./HeightMap.js";
import { EquirectangularToCubemap } from "./modules/EquirectangularToCubemap.js";

const ssao = new SSAO();
window.ssao = ssao;
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
map.snackbar = snackbar;

progress.hide();

const renderer = new WebGLRenderer({
  antialias: true,
  //alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setClearColor(0, 0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.autoClear = false;

document.body.append(renderer.domElement);

const scene = new Scene();
const camera = new PerspectiveCamera(75, 1, 0.01, 1000);
camera.position.set(-2, 10, 10);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
controls.addEventListener("change", () => {
  ssao.reset();
});

const width = 1024;
const height = 1024;
const heightMap = new HeightMap(width, height, 8);
heightMap.verticalScale = 10;
scene.add(heightMap.mesh);

let currentLocation;

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
          const c = await fetchTile(mod(bx - x, maxW), mod(by - y, maxH), zoom);
          loadedTiles++;
          progress.progress = (loadedTiles * 100) / totalTiles;
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
          loadedTiles++;
          progress.progress = (loadedTiles * 100) / totalTiles;
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

const s = 7;
//const lightCamera = new OrthographicCamera(-s, s, s, -s, 5, 30);
const lightCamera = new PerspectiveCamera(65, 1, 5, 30);
lightCamera.position.set(5, 7.5, -10);
lightCamera.lookAt(scene.position);
ssao.shader.uniforms.lightPos.value.copy(lightCamera.position);

async function populateMaps(lat, lng, zoom) {
  await Promise.all([
    populateColorMap(lat, lng, zoom),
    populateHeightMap(lat, lng, zoom),
  ]);
  heightMap.processMaps(colorCtx, heightCtx);
  //ssao.updateShadow(renderer, scene, lightCamera);
  progress.hide();
  ssao.reset();
  console.log("done");
}

let loadedTiles = 0;
let totalTiles = 0;

async function load(lat, lng, zoom) {
  console.log("LOAD");
  loadedTiles = 0;
  totalTiles = 6 * 6 + 4 * 4;
  progress.progress = 0;
  progress.show();
  populateMaps(lat, lng, zoom + 1);
}

window.addEventListener("map-selection", async (e) => {
  const lat = e.detail.latLng.lat;
  const lng = e.detail.latLng.lng;
  const zoom = map.map.getZoom();
  window.location.hash = `${lat},${lng},${zoom}`;
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

document.querySelector("#downloadBtn").addEventListener("click", (e) => {
  heightMap.bake();
  e.preventDefault();
});

document.querySelector("#snapBtn").addEventListener("click", (e) => {
  capture();
  e.preventDefault();
});

document.querySelector("#boxBtn").addEventListener("click", (e) => {
  e.preventDefault();
});

document.querySelector("#brickBtn").addEventListener("click", (e) => {
  e.preventDefault();
});

document.querySelector("#hexagonBtn").addEventListener("click", (e) => {
  e.preventDefault();
});

let time = 0;
let prevTime = performance.now();

function render() {
  controls.update();
  const now = performance.now();
  time += (now - prevTime) * speed.value;
  prevTime = now;

  ssao.render(renderer, scene, camera, lightCamera);

  renderer.setAnimationLoop(render);
}

window.addEventListener("hashchange", async (e) => {
  const [lat, lng, zoom] = window.location.hash.substring(1).split(",");
  if (lat && lng && zoom) {
    map.map.setZoom(zoom);
    map.moveTo(parseFloat(lat), parseFloat(lng));
    await load(parseFloat(lat), parseFloat(lng), parseFloat(zoom));
  }
});

async function init() {
  await Promise.all([map.ready]);
  const [lat, lng, zoom] = window.location.hash.substring(1).split(",");
  if (lat && lng && zoom) {
    map.moveTo(parseFloat(lat), parseFloat(lng));
    map.map.setZoom(zoom);
    await load(parseFloat(lat), parseFloat(lng), parseFloat(zoom));
  } else {
    map.randomLocation();
  }
  render();
}

resize();
init();
