const EARTH_RADIUS = 6371008.8;
const DEG = Math.PI / 180;
const EQUATOR_METRES_PER_PIXEL = 156543.03392804097;
const MAX_LAT = 85.0511287798066;

function metresPerPixel(lat, zoom) {
  return (EQUATOR_METRES_PER_PIXEL * Math.cos(lat * DEG)) / Math.pow(2, zoom);
}

function mercatorY(lat) {
  const clamped = Math.min(MAX_LAT, Math.max(-MAX_LAT, lat));
  const a = clamped * DEG;
  return (1 - Math.log(Math.tan(a) + 1 / Math.cos(a)) / Math.PI) / 2;
}

function mercatorX(lng) {
  return (lng + 180) / 360;
}

function zoomForResolution(lat, metres, tileSize = 256) {
  const world = 2 * Math.PI * EARTH_RADIUS * Math.cos(lat * DEG);
  return Math.log2(world / (tileSize * metres));
}

function createAzimuthal(lat0, lng0) {
  const p0 = lat0 * DEG;
  const l0 = lng0 * DEG;
  const sinP0 = Math.sin(p0);
  const cosP0 = Math.cos(p0);

  return function inverse(east, north, out) {
    const rho = Math.hypot(east, north);
    if (rho < 1e-9) {
      out.lat = lat0;
      out.lng = lng0;
      return out;
    }
    const c = rho / EARTH_RADIUS;
    const sinC = Math.sin(c);
    const cosC = Math.cos(c);
    const lat = Math.asin(cosC * sinP0 + (north * sinC * cosP0) / rho);
    const lng =
      l0 + Math.atan2(east * sinC, rho * cosP0 * cosC - north * sinP0 * sinC);
    out.lat = lat / DEG;
    out.lng = ((((lng / DEG + 180) % 360) + 360) % 360) - 180;
    return out;
  };
}

function createMercator(lat0, lng0) {
  const p0 = lat0 * DEG;
  const y0 = Math.log(Math.tan(Math.PI / 4 + p0 / 2));
  const scale = EARTH_RADIUS * Math.cos(p0);

  return function inverse(east, north, out) {
    const y = y0 + north / scale;
    out.lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / DEG;
    out.lng = lng0 + east / scale / DEG;
    return out;
  };
}

export {
  EARTH_RADIUS,
  DEG,
  MAX_LAT,
  metresPerPixel,
  mercatorX,
  mercatorY,
  zoomForResolution,
  createAzimuthal,
  createMercator,
};
