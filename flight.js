import { CatmullRomCurve3, Vector3 } from "three";

const MODEL_WIDTH = 10.24;

function sampleField(field, x, z, spread = 1) {
  const { res, size, cells } = field;
  const half = size / 2;
  const u = Math.floor(((x + half) / size) * res);
  const v = Math.floor(((z + half) / size) * res);
  let top = 0;
  for (let dv = -spread; dv <= spread; dv++) {
    for (let du = -spread; du <= spread; du++) {
      const cu = Math.min(res - 1, Math.max(0, u + du));
      const cv = Math.min(res - 1, Math.max(0, v + dv));
      const h = cells[cv * res + cu];
      if (h > top) top = h;
    }
  }
  return top;
}

function lowPass(points, window) {
  const n = points.length;
  return points.map((p, i) => {
    let x = 0;
    let z = 0;
    let total = 0;
    for (let k = -window; k <= window; k++) {
      const q = points[(i + k + n * 2) % n];
      const weight = 1 - Math.abs(k) / (window + 1);
      x += q.x * weight;
      z += q.z * weight;
      total += weight;
    }
    return new Vector3(x / total, p.y, z / total);
  });
}

function resample(points, count) {
  const curve = new CatmullRomCurve3(points, true, "centripetal");
  const out = [];
  for (let i = 0; i < count; i++) out.push(curve.getPointAt(i / count));
  return out;
}

function dilate(values, radius) {
  const n = values.length;
  return values.map((_, i) => {
    let top = -Infinity;
    for (let k = -radius; k <= radius; k++) {
      const v = values[(i + k + n * 2) % n];
      if (v > top) top = v;
    }
    return top;
  });
}

function smooth(values, passes) {
  let current = values;
  const n = current.length;
  for (let pass = 0; pass < passes; pass++) {
    current = current.map(
      (v, i) =>
        (current[(i - 1 + n) % n] + 2 * v + current[(i + 1) % n]) / 4
    );
  }
  return current;
}

class Flight {
  constructor({ camera, controls, onFrame, onEnd }) {
    this.camera = camera;
    this.controls = controls;
    this.onFrame = onFrame || (() => {});
    this.onEnd = onEnd || (() => {});
    this.duration = 30;
    this.clearance = 0.16;
    this.banking = true;
    this.bankGain = 7;
    this.bankLimit = 0.6;
    this.bankResponse = 2.2;
    this.lastFrame = 0;
    this.bank = 0;
    this.worldUp = new Vector3(0, 1, 0);
    this.up = new Vector3(0, 1, 0);
    this.tangent = new Vector3();
    this.before = new Vector3();
    this.after = new Vector3();
    this.smoothing = 26;
    this.dilate = 5;
    this.altitudeSmoothing = 40;
    this.aimSmoothing = 30;
    this.spread = 2;
    this.minClearance = 0.45;
    this.probes = 2048;
    this.samples = 96;
    this.controlPoints = 28;
    this.lead = 0.045;
    this.aim = 0.92;
    this.inward = 0.45;
    this.spots = [];
    this.field = null;
    this.aimGround = null;
    this.path = null;
    this.playing = false;
    this.startTime = 0;
    this.target = new Vector3();
    this.position = new Vector3();
    this.ahead = new Vector3();
  }

  build(spots, field, lift = MODEL_WIDTH * this.clearance) {
    const usable = spots.filter(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
    );
    if (usable.length < 3 || !Number.isFinite(lift)) {
      this.path = null;
      return false;
    }
    this.field = field;
    const ordered = [...usable].sort(
      (a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x)
    );
    this.spots = ordered;

    const rough = new CatmullRomCurve3(
      ordered.map((p) => new Vector3(p.x, p.y + lift, p.z)),
      true,
      "centripetal"
    );

    let points = [];
    for (let i = 0; i < this.samples; i++) {
      points.push(rough.getPointAt(i / this.samples));
    }
    points = resample(lowPass(points, this.smoothing), this.samples);

    const ground = points.map((p) =>
      sampleField(this.field, p.x, p.z, this.spread)
    );
    const envelope = dilate(ground, this.dilate);
    const cruise = smooth(
      envelope.map((h) => h + lift),
      this.altitudeSmoothing
    );
    const gap = lift * this.minClearance;
    points.forEach((p, i) => {
      p.y = Math.max(cruise[i], envelope[i] + gap);
    });

    this.path = new CatmullRomCurve3(
      resample(points, this.controlPoints),
      true,
      "centripetal"
    );
    this.path.arcLengthDivisions = 2000;
    this.clearTerrain(gap);
    this.path.updateArcLengths();

    const aimRaw = points.map((p) =>
      sampleField(this.field, p.x * (1 - this.inward), p.z * (1 - this.inward))
    );
    this.aimGround = smooth(dilate(aimRaw, this.dilate), this.aimSmoothing);
    return true;
  }

  clearTerrain(gap) {
    const control = this.path.points;
    const n = control.length;
    const probe = new Vector3();
    const need = new Float64Array(n);
    const spread = new Float64Array(n);

    for (let pass = 0; pass < 12; pass++) {
      need.fill(0);
      let worst = 0;
      for (let i = 0; i < this.probes; i++) {
        const t = i / this.probes;
        this.path.getPoint(t, probe);
        const below =
          sampleField(this.field, probe.x, probe.z, this.spread) +
          gap -
          probe.y;
        if (below <= 0) continue;
        if (below > worst) worst = below;
        const k = Math.round(t * n) % n;
        if (below > need[k]) need[k] = below;
      }
      if (worst < 1e-4) break;

      spread.fill(0);
      for (let i = 0; i < n; i++) {
        for (let k = -2; k <= 2; k++) {
          const j = (i + k + n) % n;
          const shared = need[j] * (1 - Math.abs(k) / 3);
          if (shared > spread[i]) spread[i] = shared;
        }
      }
      for (let i = 0; i < n; i++) control[i].y += spread[i];
    }
  }

  groundAt(u) {
    const n = this.aimGround.length;
    const at = u * n;
    const i0 = Math.floor(at);
    const f = at - i0;
    const a = this.aimGround[i0 % n];
    const b = this.aimGround[(i0 + 1) % n];
    return a + (b - a) * f;
  }

  get progress() {
    if (!this.playing) return 0;
    return ((performance.now() - this.startTime) / 1000 / this.duration) % 1;
  }

  resume(t) {
    this.startTime = performance.now() - t * this.duration * 1000;
  }

  headingAt(u) {
    const d = 0.012;
    this.path.getPointAt((u - d + 1) % 1, this.before);
    this.path.getPointAt((u + d) % 1, this.after);
    return Math.atan2(
      this.after.z - this.before.z,
      this.after.x - this.before.x
    );
  }

  turnRateAt(u) {
    const d = 0.022;
    let delta = this.headingAt((u + d) % 1) - this.headingAt((u - d + 1) % 1);
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  }

  start() {
    if (!this.path) return false;
    this.bank = 0;
    this.playing = true;
    this.startTime = performance.now();
    this.lastFrame = this.startTime;
    if (this.controls) this.controls.enabled = false;
    return true;
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.camera.up.copy(this.worldUp);
    if (this.controls) {
      this.controls.enabled = true;
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
    this.onEnd();
  }

  update() {
    if (!this.playing || !this.path) return false;
    const elapsed = (performance.now() - this.startTime) / 1000;
    const t = (elapsed / this.duration) % 1;

    this.path.getPointAt(t, this.position);
    this.path.getPointAt((t + this.lead) % 1, this.ahead);

    const x = this.ahead.x * (1 - this.inward);
    const z = this.ahead.z * (1 - this.inward);
    const ground = this.groundAt((t + this.lead) % 1);
    this.target.set(x, ground + (this.ahead.y - ground) * (1 - this.aim), z);

    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    if (this.banking) {
      const turn = this.turnRateAt(t) * this.bankGain;
      const wanted = Math.max(-this.bankLimit, Math.min(this.bankLimit, turn));
      const k = 1 - Math.exp(-dt / this.bankResponse);
      this.bank += (wanted - this.bank) * k;
      const heading = this.headingAt(t);
      this.tangent.set(Math.cos(heading), 0, Math.sin(heading));
      this.up.copy(this.worldUp).applyAxisAngle(this.tangent, this.bank);
      this.camera.up.copy(this.up);
    } else {
      this.bank = 0;
      this.camera.up.copy(this.worldUp);
    }

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    if (this.controls) this.controls.target.copy(this.target);

    this.onFrame();
    return true;
  }
}

export { Flight };
