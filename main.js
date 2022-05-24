import "./deps/map.js";
import "./deps/progress.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
import { GoogleMaps } from "./google-maps.js";
import {
  fetchElevationTile,
  latToTile,
  lngToTile,
  fetchTile,
  EsriWorldImagery,
  EsriWorldPhysical,
  EsriWorldTerrain,
  StamenTerrain,
  StamenWatercolor,
  StamenTonerBackground,
  USGSUSImagery,
  GeoportailFrance,
  NASAGIBSViirsEarthAtNight2012,
} from "./mapbox.js";
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
} from "./third_party/three.module.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { twixt } from "./deps/twixt.js";
import { SSAO } from "./SSAO.js";
import { HeightMap } from "./HeightMap.js";
import { EquirectangularToCubemap } from "./modules/EquirectangularToCubemap.js";
import "./ui.js";
import { debounce } from "./deps/debounce.js";

const generators = {
  "Google Maps Satellite": GoogleMaps,
  "ArcGIS World Imagery": EsriWorldImagery,
  "ArcGIS World Terrain": EsriWorldTerrain,
  "ArcGIS World Physical": EsriWorldPhysical,
  "Stamen Terrain": StamenTerrain,
  "Stamen Watercolor": StamenWatercolor,
  "Stamen Toner background": StamenTonerBackground,
  "USGS US Imagery": USGSUSImagery,
  "Geoportail France": GeoportailFrance,
  "NASA at night 2012": NASAGIBSViirsEarthAtNight2012,
};

let generator = generators["Google Maps Satellite"];
const colorTiles = document.querySelector("#colorTiles");
for (const key of Object.keys(generators)) {
  const option = document.createElement("option");
  option.textContent = key;
  colorTiles.append(option);
}
colorTiles.addEventListener("change", async (e) => {
  generator = generators[e.target.value];
  await load(map.lat, map.lng, map.zoom);
});

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
camera.position.set(0, 10, 0);
camera.lookAt(scene.position);

const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
controls.addEventListener("change", () => {
  ssao.reset();
});

const width = 1024;
const height = 1024;
const heightMap = new HeightMap(width, height, 8);
heightMap.scale = 0.5;
heightMap.generator = generator;
scene.add(heightMap.mesh);

const ui = document.querySelector("#ui");
ui.generator = heightMap;

ui.updateMesh = debounce(() => {
  scene.remove(heightMap.mesh);
  heightMap.generate();
  heightMap.processMaps();
  scene.add(heightMap.mesh);
  ssao.reset();
}, 100);

let currentLocation;

const s = 7;
//const lightCamera = new OrthographicCamera(-s, s, s, -s, 5, 30);
const lightCamera = new PerspectiveCamera(65, 1, 5, 30);
lightCamera.position.set(5, 7.5, -10);
lightCamera.lookAt(scene.position);
ssao.shader.uniforms.lightPos.value.copy(lightCamera.position);
ssao.backgroundColor.set(0xefffe0);
window.ssao = ssao;

let loadedTiles = 0;
let totalTiles = 0;

async function load(lat, lng, zoom) {
  console.log("LOAD");
  loadedTiles = 0;
  totalTiles = 6 * 6 + 4 * 4;
  progress.progress = 0;
  progress.show();
  await heightMap.populateMaps(lat, lng, zoom + 1);
  ssao.reset();
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

window.addEventListener("keydown", (e) => {
  const path = e.composedPath();
  if (path && path[0].tagName === "INPUT") {
    return;
  }

  if (e.code === "KeyR") {
    randomize();
  }
});

document.querySelector("#downloadBtn").addEventListener("click", (e) => {
  heightMap.bake();
  e.preventDefault();
});

document.querySelector("#snapBtn").addEventListener("click", (e) => {
  capture();
  e.preventDefault();
});

// document.querySelector("#noQuantBtn").addEventListener("click", (e) => {
//   heightMap.quantHeight = NormalHeight;
//   heightMap.processMaps(colorCtx, heightCtx);
//   ssao.reset();
//   e.preventDefault();
// });

// document.querySelector("#blockBtn").addEventListener("click", (e) => {
//   heightMap.quantHeight = BlockHeight;
//   heightMap.processMaps(colorCtx, heightCtx);
//   ssao.reset();
//   e.preventDefault();
// });

// document.querySelector("#halfBlockBtn").addEventListener("click", (e) => {
//   heightMap.quantHeight = HalfBlockHeight;
//   heightMap.processMaps(colorCtx, heightCtx);
//   ssao.reset();
//   e.preventDefault();
// });

// document.querySelector("#quarterBlockBtn").addEventListener("click", (e) => {
//   heightMap.quantHeight = QuarterBlockHeight;
//   heightMap.processMaps(colorCtx, heightCtx);
//   ssao.reset();
//   e.preventDefault();
// });

document
  .querySelector("#perfectAlignment")
  .addEventListener("change", async (e) => {
    heightMap.perfectAlignment = e.target.checked;
    await heightMap.processMaps();
    ssao.reset();
    e.preventDefault();
  });

document
  .querySelector("#brickPalette")
  .addEventListener("change", async (e) => {
    heightMap.brickPalette = e.target.checked;
    await heightMap.processMaps();
    ssao.reset();
    e.preventDefault();
  });

document.querySelector("#heightScale").addEventListener("change", async (e) => {
  heightMap.scale = parseFloat(e.target.value);
  await heightMap.processMaps();
  ssao.reset();
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
