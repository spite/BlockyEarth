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
    s / 2,
    18,
    1
  ).toNonIndexed();
  const geos = [block];
  for (let y = 0; y < studs; y++) {
    for (let x = 0; x < studs; x++) {
      const g = top.clone();
      g.translate(
        0 + (x * s) / studs - (0.5 * s) / studs,
        s / 2,
        0 + (y * s) / studs - (0.5 * s) / studs
      );
      geos.push(g);
    }
  }
  const geometry = mergeGeometries(geos);
  return geometry;
}

export { generatePlasticBrickGeometry };
