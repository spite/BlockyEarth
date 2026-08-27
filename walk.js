import { Euler, Vector3 } from "three";

const MODEL_WIDTH = 10.24;
const HALF_PI = Math.PI / 2;

const FORWARD_KEYS = ["KeyW", "ArrowUp"];
const BACK_KEYS = ["KeyS", "ArrowDown"];
const LEFT_KEYS = ["KeyA", "ArrowLeft"];
const RIGHT_KEYS = ["KeyD", "ArrowRight"];
const MOVE_KEYS = [
  ...FORWARD_KEYS,
  ...BACK_KEYS,
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
];

class Walker {
  constructor({ camera, domElement, onFrame, onEnd }) {
    this.camera = camera;
    this.domElement = domElement;
    this.onFrame = onFrame || (() => {});
    this.onEnd = onEnd || (() => {});

    this.active = false;
    this.eye = 0.15;
    this.speed = MODEL_WIDTH * 0.09;
    this.boost = 3.5;
    this.damping = 11;
    this.groundResponse = 14;
    this.lookSpeed = 0.0022;
    this.maxDelta = 120;
    this.maxPitch = HALF_PI * 0.95;
    this.settling = false;

    this.yaw = 0;
    this.pitch = 0;
    this.lastYaw = 0;
    this.lastPitch = 0;
    this.ground = null;
    this.eyeY = 0;
    this.lastFrame = 0;

    this.keys = new Set();
    this.velocity = new Vector3();
    this.wanted = new Vector3();
    this.euler = new Euler(0, 0, 0, "YXZ");

    this.onKeyDown = (e) => {
      if (!this.active) return;
      if (MOVE_KEYS.includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    this.onMouseMove = (e) => {
      if (!this.active || document.pointerLockElement !== this.domElement) {
        return;
      }
      if (this.settling) {
        this.settling = false;
        return;
      }
      const limit = this.maxDelta;
      const dx = Math.max(-limit, Math.min(limit, e.movementX || 0));
      const dy = Math.max(-limit, Math.min(limit, e.movementY || 0));
      this.yaw -= dx * this.lookSpeed;
      this.pitch -= dy * this.lookSpeed;
      this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
    };
    this.onLockChange = () => {
      if (!this.active) return;
      if (document.pointerLockElement === this.domElement) {
        this.settling = true;
        return;
      }
      this.exit();
    };
  }

  get pointerLocked() {
    return document.pointerLockElement === this.domElement;
  }

  enter(point, ground) {
    this.ground = ground;
    this.active = true;
    this.settling = true;
    this.keys.clear();
    this.velocity.set(0, 0, 0);

    this.euler.setFromQuaternion(this.camera.quaternion, "YXZ");
    this.yaw = this.euler.y;
    this.pitch = 0;
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;

    const start = ground(point.x, point.z);
    const base = Number.isNaN(start) ? point.y : start;
    this.camera.position.set(point.x, base + this.eye, point.z);
    this.eyeY = this.camera.position.y;
    this.lastFrame = performance.now();

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);

    this.apply();
    return true;
  }

  lock() {
    if (this.domElement.requestPointerLock) this.domElement.requestPointerLock();
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    this.velocity.set(0, 0, 0);

    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);

    if (this.pointerLocked && document.exitPointerLock) document.exitPointerLock();
    this.onEnd();
  }

  held(codes) {
    return codes.some((code) => this.keys.has(code)) ? 1 : 0;
  }

  apply() {
    this.euler.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(this.euler);
  }

  update() {
    if (!this.active) return false;

    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    const forward = this.held(FORWARD_KEYS) - this.held(BACK_KEYS);
    const strafe = this.held(RIGHT_KEYS) - this.held(LEFT_KEYS);

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.wanted.set(
      -sin * forward + cos * strafe,
      0,
      -cos * forward - sin * strafe
    );
    if (this.wanted.lengthSq() > 1) this.wanted.normalize();

    const shift = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.wanted.multiplyScalar(this.speed * (shift ? this.boost : 1));

    const k = 1 - Math.exp(-dt * this.damping);
    this.velocity.lerp(this.wanted, k);

    const before = this.camera.position.y;
    const turned =
      this.yaw !== this.lastYaw || this.pitch !== this.lastPitch;
    this.lastYaw = this.yaw;
    this.lastPitch = this.pitch;
    const moved = this.velocity.lengthSq() > 1e-8;
    const fromX = this.camera.position.x;
    const fromZ = this.camera.position.z;
    if (moved) {
      this.camera.position.addScaledVector(this.velocity, dt);
      const limit = MODEL_WIDTH / 2;
      this.camera.position.x = Math.max(
        -limit,
        Math.min(limit, this.camera.position.x)
      );
      this.camera.position.z = Math.max(
        -limit,
        Math.min(limit, this.camera.position.z)
      );
    }

    let ground = this.ground(this.camera.position.x, this.camera.position.z);
    if (Number.isNaN(ground)) {
      this.camera.position.x = fromX;
      this.camera.position.z = fromZ;
      this.velocity.set(0, 0, 0);
      ground = this.ground(fromX, fromZ);
    }
    if (Number.isNaN(ground)) ground = this.eyeY - this.eye;

    const target = ground + this.eye;
    const g = 1 - Math.exp(-dt * this.groundResponse);
    this.eyeY += (target - this.eyeY) * g;
    this.camera.position.y = this.eyeY;

    this.apply();

    if (moved || turned || Math.abs(this.camera.position.y - before) > 1e-6) {
      this.onFrame();
    }
    return true;
  }
}

export { Walker };
