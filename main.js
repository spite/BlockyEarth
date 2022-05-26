import "./deps/map.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
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

const ssao = new SSAO();
window.ssao = ssao;
const speed = twixt.create("speed", 1);

const map = document.querySelector("#map-browser");
const snackbar = document.querySelector("snack-bar");
map.snackbar = snackbar;

const renderer = new WebGLRenderer({
  //antialias: true,
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

const heightMap = new HeightMap(1024, 1024, 8);
heightMap.scale = 0.5;
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

async function load(lat, lng, zoom) {
  console.log("LOAD");
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
