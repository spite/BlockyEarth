import "./deps/map.js";
import "./deps/snackbar.js";
import "./deps/tweet-button.js";
import "./deps/progress.js";
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
} from "three";
import { adjustOrthoToBB } from "./deps/adjust.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { SSAO } from "./SSAO.js";
import { BlockyEarth } from "./BlockyEarth.js";
import { buildGui, createGuiParams, syncQuery } from "./gui.js";

const ssao = new SSAO();

const map = document.querySelector("#map-browser");
const snackbar = document.querySelector("snack-bar");
const progressBar = document.querySelector("progress-bar");
map.snackbar = snackbar;

const renderer = new WebGLRenderer({
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
controls.addEventListener("change", () => {
  ssao.reset();
});

const s = 7;
const lightCamera = new OrthographicCamera(-s, s, s, -s, 5, 30);
lightCamera.position.set(5, 7.5, -10).normalize().multiplyScalar(30);
lightCamera.lookAt(scene.position);
ssao.shader.uniforms.lightPos.value.copy(lightCamera.position);
ssao.backgroundColor.set(0xefffe0);

const params = createGuiParams();
const app = new BlockyEarth(params);
app.material = ssao.shader;
scene.add(app.group);

buildGui(app, { onSnapshot: () => capture() });

app.addEventListener("changed", () => {
  map.setFootprint(app.bounds, true);
  lightCamera.position.set(5, 7.5, -10).normalize().multiplyScalar(30);
  lightCamera.lookAt(scene.position);
  lightCamera.updateMatrixWorld();
  adjustOrthoToBB(lightCamera, app.bb);
  ssao.reset();
});

app.addEventListener("tiles-unavailable", (e) => {
  const { source } = e.detail;
  snackbar.error(
    `No tiles loaded from ${source}. A browser extension or ad blocker may be blocking them — try another tile source.`
  );
});

app.addEventListener("progress", (e) => {
  const { progress } = e.detail;
  progressBar.progress = progress;
  progressBar.style.display = progress > 0 ? "flex" : "none";
});

let currentLocation = "";

async function load(lat, lng, zoom) {
  currentLocation = `${lat.toFixed(5)}-${lng.toFixed(5)}-${zoom}`;
  map.setFootprint(app.boundsFor(lat, lng, zoom + 1), true);
  await app.load(lat, lng, zoom + 1);
  ssao.reset();
}

function readHash() {
  const [lat, lng, zoom] = window.location.hash.substring(1).split(",");
  if (!lat || !lng || !zoom) return null;
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    zoom: Math.round(parseFloat(zoom)),
  };
}

async function goToHash() {
  const location = readHash();
  if (!location) return false;
  map.moveTo(location.lat, location.lng);
  map.setSelectionZoom(location.zoom);
  await load(location.lat, location.lng, location.zoom);
  return true;
}

window.addEventListener("map-selection", (e) => {
  const { lat, lng } = e.detail.latLng;
  window.location.hash = `${lat},${lng},${map.selectionZoom}`;
});

window.addEventListener("hashchange", goToHash);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ssao.setSize(w, h, renderer.getPixelRatio());
}

window.addEventListener("resize", resize);

function capture() {
  renderer.domElement.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const downloadBtn = document.createElement("a");
    downloadBtn.setAttribute("download", `blocky-earth-${currentLocation}.png`);
    downloadBtn.setAttribute("href", url);
    downloadBtn.click();
    URL.revokeObjectURL(url);
  });
}

function render() {
  controls.update();
  ssao.render(renderer, scene, camera, lightCamera);
}

async function init() {
  await map.ready;
  syncQuery(params);
  if (!(await goToHash())) {
    map.randomLocation();
  }
  renderer.setAnimationLoop(render);
}

resize();
init();
