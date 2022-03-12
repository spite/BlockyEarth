import { Vector3, CylinderBufferGeometry } from "./third_party/three.module.js";

function generateRoundedPrismGeometry(width) {
  const f = Math.sqrt(3);
  const geometry = new CylinderBufferGeometry(
    width / f,
    width / f,
    width,
    6,
    2
  );

  const vertices = geometry.attributes.position.array;
  const v = new Vector3();
  for (let i = 0; i < vertices.length; i += 3) {
    v.set(vertices[i], vertices[i + 1], vertices[i + 2]);
    if (v.y > 0) {
      const a = Math.atan2(v.z, v.x);
      const r = Math.sqrt(v.x * v.x + v.z * v.z) - 0.1 * width;
      v.x = r * Math.cos(a);
      v.z = r * Math.sin(a);
    }
    if (v.y === 0) {
      v.y = width / 2 - 0.1 * width;
    }
    vertices[i] = v.x;
    vertices[i + 1] = v.y;
    vertices[i + 2] = v.z;
  }

  return geometry;
}

export { generateRoundedPrismGeometry };
