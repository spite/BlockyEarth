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
import { mod, randomInRange } from "./modules/Maf.js";
import { SSAO } from "./SSAO.js";
import {
  BlockHeight,
  Box,
  CircleCrop,
  HalfBlockHeight,
  QuarterBlockHeight,
  HeightMap,
  Hexagon,
  HexagonCrop,
  NoCrop,
  NormalHeight,
  PlasticBrick,
  RoundedBox,
} from "./HeightMap.js";
import { EquirectangularToCubemap } from "./modules/EquirectangularToCubemap.js";
import "./ui.js";

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
const heightMap = new HeightMap(width, height, 4);
heightMap.scale = 0.5;
scene.add(heightMap.mesh);

document.querySelector("#ui").generator = heightMap;

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
// colorCanvas.style.border = "1px solid #ff00ff";
colorCtx.translate(0.5 * colorCanvas.width, 0.5 * colorCanvas.height);

async function populateColorMap(lat, lng, zoom) {
  const cx = lngToTile(lng, zoom);
  const cy = latToTile(lat, zoom);
  const bx = Math.floor(cx);
  const by = Math.floor(cy);

  const promises = [];

  const maxW = Math.pow(2, zoom);
  const maxH = Math.pow(2, zoom);

  const ox = (cx % 1) * 256;
  const oy = (cy % 1) * 256;
  const w0 = Math.ceil((-512 - ox) / 256);
  const w1 = Math.ceil((512 - ox) / 256);
  const h0 = Math.ceil((-512 - oy) / 256);
  const h1 = Math.ceil((512 - oy) / 256);

  for (let y = h0; y <= h1; y++) {
    for (let x = w0; x <= w1; x++) {
      promises.push(
        new Promise(async (resolve, reject) => {
          const c = await fetchTile(
            mod(bx - x, maxW),
            mod(by - y, maxH),
            zoom,
            generator
          );
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

  const ox = (cx % 1) * 512;
  const oy = (cy % 1) * 512;
  const w0 = Math.ceil((-512 - ox) / 512);
  const w1 = Math.ceil((512 - ox) / 512);
  const h0 = Math.ceil((-512 - oy) / 512);
  const h1 = Math.ceil((512 - oy) / 512);

  for (let y = h0; y <= h1; y++) {
    for (let x = w0; x <= w1; x++) {
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
ssao.backgroundColor.set(0xefffe0);
window.ssao = ssao;

async function populateMaps(lat, lng, zoom) {
  await Promise.all([
    populateColorMap(lat, lng, zoom),
    populateHeightMap(lat, lng, zoom),
  ]);
  heightMap.invalidate();
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

const boxBtn = document.querySelector("#boxBtn");
const roundedBoxBtn = document.querySelector("#roundedBoxBtn");
const brickBtn = document.querySelector("#brickBtn");
const hexagonBtn = document.querySelector("#hexagonBtn");

const cropNoneBtn = document.querySelector("#cropNoneBtn");
const cropCircleBtn = document.querySelector("#cropCircleBtn");
const cropHexagonBtn = document.querySelector("#cropHexagonBtn");

function resetButtons(buttons) {
  for (const button of buttons) {
    button.active = false;
  }
}

boxBtn.addEventListener("click", (e) => {
  resetButtons([boxBtn, roundedBoxBtn, brickBtn, hexagonBtn]);
  boxBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.mode = Box;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

roundedBoxBtn.addEventListener("click", (e) => {
  resetButtons([boxBtn, roundedBoxBtn, brickBtn, hexagonBtn]);
  roundedBoxBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.mode = RoundedBox;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

brickBtn.addEventListener("click", (e) => {
  resetButtons([boxBtn, roundedBoxBtn, brickBtn, hexagonBtn]);
  brickBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.mode = PlasticBrick;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

hexagonBtn.addEventListener("click", (e) => {
  resetButtons([boxBtn, roundedBoxBtn, brickBtn, hexagonBtn]);
  hexagonBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.mode = Hexagon;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

cropNoneBtn.addEventListener("click", (e) => {
  resetButtons([cropNoneBtn, cropCircleBtn, cropHexagonBtn]);
  cropNoneBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.crop = NoCrop;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

cropCircleBtn.addEventListener("click", (e) => {
  resetButtons([cropNoneBtn, cropCircleBtn, cropHexagonBtn]);
  cropCircleBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.crop = CircleCrop;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

cropHexagonBtn.addEventListener("click", (e) => {
  resetButtons([cropNoneBtn, cropCircleBtn, cropHexagonBtn]);
  cropHexagonBtn.active = true;
  scene.remove(heightMap.mesh);
  heightMap.crop = HexagonCrop;
  heightMap.generate();
  heightMap.processMaps(colorCtx, heightCtx);
  scene.add(heightMap.mesh);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#noQuantBtn").addEventListener("click", (e) => {
  heightMap.quantHeight = NormalHeight;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#blockBtn").addEventListener("click", (e) => {
  heightMap.quantHeight = BlockHeight;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#halfBlockBtn").addEventListener("click", (e) => {
  heightMap.quantHeight = HalfBlockHeight;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#quarterBlockBtn").addEventListener("click", (e) => {
  heightMap.quantHeight = QuarterBlockHeight;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#perfectAlignment").addEventListener("change", (e) => {
  heightMap.perfectAlignment = e.target.checked;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#brickPalette").addEventListener("change", (e) => {
  heightMap.brickPalette = e.target.checked;
  heightMap.processMaps(colorCtx, heightCtx);
  ssao.reset();
  e.preventDefault();
});

document.querySelector("#heightScale").addEventListener("change", (e) => {
  heightMap.scale = parseFloat(e.target.value);
  heightMap.processMaps(colorCtx, heightCtx);
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
