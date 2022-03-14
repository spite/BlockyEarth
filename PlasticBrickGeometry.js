import { mergeGeometries } from "./modules/Geometry.js";
import {
  BoxBufferGeometry,
  CylinderBufferGeometry,
} from "./third_party/three.module.js";

function generatePlasticBrickGeometry(s, studs = 1) {
  const block = new BoxBufferGeometry(s, s, s).toNonIndexed();
  const top = new CylinderBufferGeometry(
    s / (3.5 * studs),
    s / (3.5 * studs),
    0.25 * s,
    18,
    1
  ).toNonIndexed();
  const geos = [block];
  const offset = -(s / 2) + s / (2 * studs);
  for (let y = 0; y < studs; y++) {
    for (let x = 0; x < studs; x++) {
      const g = top.clone();
      g.translate((x * s) / studs + offset, s / 2, (y * s) / studs + offset);
      geos.push(g);
    }
  }
  const geometry = mergeGeometries(geos);
  return geometry;
}

export { generatePlasticBrickGeometry };
