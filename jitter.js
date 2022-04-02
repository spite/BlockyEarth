import { Vector2, MathUtils } from "three";

const jitterTable = [
  [0.5625, 0.4375],
  [0.0625, 0.9375],
  [0.3125, 0.6875],
  [0.6875, 0.8124],
  [0.8125, 0.1875],
  [0.9375, 0.5625],
  [0.4375, 0.0625],
  [0.1875, 0.3125],
];
let jitterPointer = 0;

function makePerspectiveJitter(
  mat,
  left,
  right,
  top,
  bottom,
  near,
  far,
  offsetX,
  offsetY,
  w,
  h
) {
  if (far === undefined) {
    console.warn(
      "THREE.Matrix4: .makePerspective() has been redefined and has a new signature. Please check the docs."
    );
  }

  const scaleX = (left - right) / w;
  const scaleY = (top - bottom) / h;

  left -= offsetX * scaleX;
  top -= offsetY * scaleY;
  right -= offsetX * scaleX;
  bottom -= offsetY * scaleY;

  var te = mat.elements;
  var x = (2 * near) / (right - left);
  var y = (2 * near) / (top - bottom);

  var a = (right + left) / (right - left);
  var b = (top + bottom) / (top - bottom);
  var c = -(far + near) / (far - near);
  var d = (-2 * far * near) / (far - near);

  te[0] = x;
  te[4] = 0;
  te[8] = a;
  te[12] = 0;
  te[1] = 0;
  te[5] = y;
  te[9] = b;
  te[13] = 0;
  te[2] = 0;
  te[6] = 0;
  te[10] = c;
  te[14] = d;
  te[3] = 0;
  te[7] = 0;
  te[11] = -1;
  te[15] = 0;

  return mat;
}

const size = new Vector2();

function updateProjectionMatrixJitter(camera, renderer) {
  const [offsetX, offsetY] = jitterTable[jitterPointer];
  jitterPointer = (jitterPointer + 1) % jitterTable.length;

  var near = camera.near,
    top = (near * Math.tan(MathUtils.DEG2RAD * 0.5 * camera.fov)) / camera.zoom,
    height = 2 * top,
    width = camera.aspect * height,
    left = -0.5 * width,
    view = camera.view;

  if (camera.view !== null && camera.view.enabled) {
    var fullWidth = view.fullWidth,
      fullHeight = view.fullHeight;

    left += (view.offsetX * width) / fullWidth;
    top -= (view.offsetY * height) / fullHeight;
    width *= view.width / fullWidth;
    height *= view.height / fullHeight;
  }

  var skew = camera.filmOffset;
  if (skew !== 0) left += (near * skew) / camera.getFilmWidth();

  renderer.getSize(size);
  size.multiplyScalar(renderer.getPixelRatio());

  makePerspectiveJitter(
    camera.projectionMatrix,
    left,
    left + width,
    top,
    top - height,
    near,
    camera.far,
    offsetX,
    offsetY,
    size.x,
    size.y
  );

  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  // camera.projectionMatrixInverse.getInverse(camera.projectionMatrix);
}

export { updateProjectionMatrixJitter };
