import "./deps/map.js";
import "./deps/snackbar.js";
import "./deps/progress.js";
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  Box3,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { adjustOrthoToBB } from "./deps/adjust.js";
import { OrbitControls } from "./third_party/OrbitControls.js";
import { SSAO } from "./SSAO.js";
import { BlockyEarth } from "./BlockyEarth.js";
import { buildGui, createGuiParams, syncQuery } from "./gui.js";
import { Flight } from "./flight.js";
import { Walker } from "./walk.js";
import { PathPreview } from "./preview.js";
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
const lightBB = new Box3();
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
const sourceLabel = signal("");

function updateSourceLabel() {
  sourceLabel.set(app.attribution);
}

function updateAreaLabel() {
  const { span, spacing } = app.area;
  const km = span / 1000;
  const size = km >= 10 ? km.toFixed(0) : km.toFixed(2);
  const per = spacing >= 1000 ? `${(spacing / 1000).toFixed(1)} km` : `${spacing.toFixed(0)} m`;
  areaLabel.set(`${size} × ${size} km · ${per}/block`);
}

const flight = new Flight({
  camera,
  controls,
  onFrame: () => {
    ssao.reset();
    updateMapMarker(false);
  },
  onEnd: () => {
    map.hideWalker();
    ssao.reset();
  },
});

const FLIGHT_FIELD_RES = 64;
const flightCells = new Float32Array(FLIGHT_FIELD_RES * FLIGHT_FIELD_RES);

const pathPreview = new PathPreview(ssao);
scene.add(pathPreview.group);

let lastPeaks = [];

function buildFlight({ spots, height, banking }) {
  lastPeaks = app.findPeaks(spots);
  flight.banking = banking;
  return flight.build(
    lastPeaks,
    app.heightField(FLIGHT_FIELD_RES, flightCells),
    height * app.metresToWorldY
  );
}

function fitLight() {
  lightCamera.position.set(5, 7.5, -10).normalize().multiplyScalar(30);
  lightCamera.lookAt(scene.position);
  lightCamera.updateMatrixWorld();
  lightBB.copy(app.bb).expandByScalar(10.24 / app.area.blocks);
  if (pathPreview.visible) lightBB.union(pathPreview.bounds());
  adjustOrthoToBB(lightCamera, lightBB);
  ssao.invalidateShadow();
}

function applyFlight(options) {
  const built = buildFlight(options);
  if (options.preview && built) {
    pathPreview.show(flight.path, lastPeaks);
  } else {
    pathPreview.hide();
  }
  fitLight();
  ssao.reset();
  return built;
}

function flyOver(options) {
  if (flight.playing) {
    flight.stop();
    return;
  }
  if (!applyFlight(options)) {
    snackbar.error("Not enough distinct high points here to build a path.");
    return;
  }
  flight.start();
}

function updateFlight(options) {
  if (!flight.playing && !options.preview && !pathPreview.visible) return;
  const at = flight.playing ? flight.progress : 0;
  if (applyFlight(options) && flight.playing) flight.resume(at);
}

const tools = document.querySelector("#tools");

function applyUi() {
  const visible = params.ui();
  tools.classList.toggle("hidden", !visible);
  if (visible && map.map) {
    map.map.invalidateSize();
    map.frameArea(app.area);
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest("#tools")) return;
  e.preventDefault();
  params.ui.set(!params.ui());
  applyUi();
  syncQuery(params);
});

const DEFAULT_SPAN = 10000;
const LOOK_AHEAD = 0.6;
const OVERVIEW = new Vector3(-2, 10, 10);

const raycaster = new Raycaster();
const pointer = new Vector2();
const heading = new Vector3();

const MARKER_INTERVAL = 80;
const cameraPose = { lat: 0, lng: 0, bearing: 0 };
let lastMarker = 0;

function updateMapMarker(force) {
  const now = performance.now();
  if (!force && now - lastMarker < MARKER_INTERVAL) return;
  lastMarker = now;
  const { x, z } = camera.position;

  if (walker.active) {
    app.pose(x, z, -Math.sin(walker.yaw), -Math.cos(walker.yaw), cameraPose);
  } else if (flight.playing) {
    const heading = flight.headingAt(flight.progress);
    app.pose(x, z, Math.cos(heading), Math.sin(heading), cameraPose);
  } else {
    map.hideWalker();
    return;
  }

  map.showWalker(cameraPose.lat, cameraPose.lng, cameraPose.bearing);
}

const walker = new Walker({
  camera,
  domElement: renderer.domElement,
  onFrame: () => {
    ssao.reset();
    updateMapMarker(false);
  },
  onEnd: () => {
    map.hideWalker();
    camera.getWorldDirection(heading);
    controls.target.copy(camera.position).addScaledVector(heading, LOOK_AHEAD);
    controls.enabled = true;
    controls.update();
    ssao.reset();
  },
});

function streetView(event) {
  if (walker.active) return;
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = app.pick(raycaster.ray.origin, raycaster.ray.direction);
  if (!hit) return;

  flight.stop();
  controls.enabled = false;
  walker.enter(hit, app.groundSampler());
  walker.lock();
  updateMapMarker(true);
  ssao.reset();
}

function resetView() {
  flight.stop();
  walker.exit();
  camera.position.copy(OVERVIEW);
  camera.up.set(0, 1, 0);
  controls.enabled = true;
  controls.target.set(0, 0, 0);
  controls.update();
  ssao.reset();
}

renderer.domElement.addEventListener("dblclick", streetView);
renderer.domElement.addEventListener("pointerdown", () => {
  if (walker.active && !walker.pointerLocked) walker.lock();
});

const { flightOptions } = buildGui(app, {
  onSnapshot: () => capture(),
  areaLabel,
  sourceLabel,
  map,
  onFly: flyOver,
  onFlyUpdate: updateFlight,
  onResetView: resetView,
});

applyUi();

app.addEventListener("changed", () => {
  updateAreaLabel();
  updateSourceLabel();
  flight.stop();
  walker.exit();
  const options = flightOptions();
  if (options.preview) {
    applyFlight(options);
  } else {
    pathPreview.hide();
    fitLight();
  }
  ssao.reset();
});

app.addEventListener("tiles-unavailable", (e) => {
  const { source } = e.detail;
  snackbar.error(
    `No tiles loaded from ${source}. A browser extension or ad blocker may be blocking them — try another tile source.`
  );
});

app.addEventListener("progress", (e) => {
  const { progress, loaded, total } = e.detail;
  progressBar.progress = progress;
  progressBar.loaded = loaded;
  progressBar.total = total;
});

let currentLocation = "";

async function load(lat, lng, span) {
  currentLocation = `${lat.toFixed(5)}-${lng.toFixed(5)}-${Math.round(span)}m`;
  await app.load(lat, lng, span);
  ssao.reset();
}

function readHash() {
  const [lat, lng, span] = window.location.hash.substring(1).split(",");
  const area = {
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    span: parseFloat(span),
  };
  if (
    !Number.isFinite(area.lat) ||
    !Number.isFinite(area.lng) ||
    Math.abs(area.lat) > 90
  ) {
    return null;
  }
  if (!(area.span > 0)) area.span = DEFAULT_SPAN;
  return area;
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
  if (!writeHash(area)) {
    load(area.lat, area.lng, area.span);
  }
};

window.addEventListener("map-selection", (e) => {
  const { lat, lng } = e.detail.latLng;
  const area = map.captureArea();
  writeHash({ lat, lng, span: area ? area.span : DEFAULT_SPAN });
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
  if (!flight.update() && !walker.update()) controls.update();
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
