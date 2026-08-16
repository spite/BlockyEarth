import "./deps/map.js";
import "./deps/snackbar.js";
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
import { signal } from "guspira";

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

const areaLabel = signal("");

function updateAreaLabel() {
  const { span, spacing } = app.area;
  const km = span / 1000;
  const size = km >= 10 ? km.toFixed(0) : km.toFixed(2);
  const per = spacing >= 1000 ? `${(spacing / 1000).toFixed(1)} km` : `${spacing.toFixed(0)} m`;
  areaLabel.set(`${size} × ${size} km · ${per}/block`);
}

buildGui(app, { onSnapshot: () => capture(), areaLabel, map });

app.addEventListener("changed", () => {
  updateAreaLabel();
  map.showArea(app.area);
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

async function load(lat, lng, span) {
  currentLocation = `${lat.toFixed(5)}-${lng.toFixed(5)}-${Math.round(span)}m`;
  await app.load(lat, lng, span);
  ssao.reset();
}

function readHash() {
  const [lat, lng, span] = window.location.hash.substring(1).split(",");
  if (!lat || !lng || !span) return null;
  return {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    span: parseFloat(span),
  };
}

function writeHash(area) {
  const next = `${area.lat.toFixed(5)},${area.lng.toFixed(5)},${Math.round(
    area.span
  )}`;
  if (window.location.hash.substring(1) === next) return false;
  window.location.hash = next;
  return true;
}

async function goToHash() {
  const target = readHash();
  if (!target) return false;
  map.frameArea(target);
  await load(target.lat, target.lng, target.span);
  return true;
}

map.onViewChange = () => {
  const area = map.captureArea();
  if (!area) return;
  const current = app.area;
  const moved =
    Math.abs(area.span / current.span - 1) > 0.01 ||
    Math.abs(area.lat - current.lat) > 1e-5 ||
    Math.abs(area.lng - current.lng) > 1e-5;
  if (!moved) return;
  map.showArea(area);
  if (!writeHash(area)) {
    load(area.lat, area.lng, area.span);
  }
};

window.addEventListener("map-selection", (e) => {
  const { lat, lng } = e.detail.latLng;
  const area = map.captureArea();
  writeHash({ lat, lng, span: area ? area.span : 10000 });
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
  map.map.invalidateSize();
  syncQuery(params);
  if (!(await goToHash())) {
    map.randomLocation();
  }
  renderer.setAnimationLoop(render);
}

resize();
init();
