import { Group, Vector3 } from "three";
import { HeightMap } from "./HeightMap.js";
import { GoogleMaps, ready as googleMapsReady } from "./google-maps.js";
import {
  EsriWorldImagery,
  EsriWorldPhysical,
  EsriWorldTerrain,
  EsriWorldShadedRelief,
  EsriNatGeoWorldMap,
  OpenTopoMap,
  CartoLight,
  Sentinel2Cloudless,
  EsriOceanBase,
  NASABlueMarbleBathymetry,
  GEBCOBathymetry,
  USGSUSImagery,
  GeoportailFrance,
  NASAGIBSViirsEarthAtNight2012,
  NASAModisTrueColor,
  NASASeaSurfaceTemp,
  NASALandSurfaceTemp,
  NASASnowCover,
  CartoDark,
  EsriDarkGray,
  EsriOceanReference,
  EsriBoundariesPlaces,
  OpenSeaMap,
  JRCWaterOccurrence,
  JRCWaterChange,
  nextZenElevation,
  awsTerrain,
} from "./mapbox.js";
import { coalesce } from "./deps/coalesce.js";
import { DEG } from "./geo.js";

const generators = {
  "Google Maps Satellite": GoogleMaps,
  "ArcGIS World Imagery": EsriWorldImagery,
  "Sentinel-2 cloudless": Sentinel2Cloudless,
  "ArcGIS World Terrain": EsriWorldTerrain,
  "ArcGIS World Physical": EsriWorldPhysical,
  "ArcGIS Shaded Relief": EsriWorldShadedRelief,
  "National Geographic": EsriNatGeoWorldMap,
  OpenTopoMap: OpenTopoMap,
  "Carto Light": CartoLight,
  "GEBCO bathymetry": GEBCOBathymetry,
  "Ocean basemap": EsriOceanBase,
  "Blue Marble bathymetry": NASABlueMarbleBathymetry,
  "USGS US Imagery": USGSUSImagery,
  "Geoportail France": GeoportailFrance,
  "Carto Dark": CartoDark,
  "ArcGIS Dark Grey": EsriDarkGray,
  "NASA true colour": NASAModisTrueColor,
  "NASA at night 2012": NASAGIBSViirsEarthAtNight2012,
  "NASA sea surface temp": NASASeaSurfaceTemp,
  "NASA land temp": NASALandSurfaceTemp,
  "NASA snow cover": NASASnowCover,
  "Water occurrence": JRCWaterOccurrence,
  "Water change": JRCWaterChange,
  "Labels: ocean": EsriOceanReference,
  "Labels: places": EsriBoundariesPlaces,
  "Labels: OpenSeaMap": OpenSeaMap,
};

const elevations = {
  "AWS terrain": awsTerrain,
  Nextzen: nextZenElevation,
};

const detailLevels = [64, 128, 256, 512, 1024];

const here = { lat: 0, lng: 0 };
const ahead = { lat: 0, lng: 0 };

function closeGaps(cells, res, passes = 2) {
  for (let pass = 0; pass < passes; pass++) {
    let holes = 0;
    const source = cells.slice();
    for (let v = 0; v < res; v++) {
      for (let u = 0; u < res; u++) {
        const k = v * res + u;
        if (source[k] > 0) continue;
        let top = 0;
        for (let dv = -1; dv <= 1; dv++) {
          for (let du = -1; du <= 1; du++) {
            const cu = u + du;
            const cv = v + dv;
            if (cu < 0 || cu >= res || cv < 0 || cv >= res) continue;
            const h = source[cv * res + cu];
            if (h > top) top = h;
          }
        }
        if (top > 0) cells[k] = top;
        else holes++;
      }
    }
    if (holes === 0) break;
  }
}

class BlockyEarth extends EventTarget {
  constructor(params) {
    super();
    this.params = params;
    this.group = new Group();

    this.heightMap = new HeightMap(params.blocks());
    this.heightMap.onProgress = (progress, loaded, total) => {
      this.dispatchEvent(
        new CustomEvent("progress", { detail: { progress, loaded, total } })
      );
    };

    this.heightMap.onTilesUnavailable = (kind) => {
      this.dispatchEvent(
        new CustomEvent("tiles-unavailable", {
          detail: {
            kind,
            source:
              kind === "color"
                ? params.tiles()
                : `${params.elevation()} elevation`,
          },
        })
      );
    };

    this.applyParams();

    this.rebuild = coalesce(() => {
      this.group.remove(this.heightMap.mesh);
      this.heightMap.generate();
      this.heightMap.processMaps();
      this.group.add(this.heightMap.mesh);
      this.changed();
    });
  }

  get material() {
    return this.heightMap.material;
  }

  set material(material) {
    this.heightMap.material = material;
  }

  get bb() {
    return this.heightMap.bb;
  }

  get area() {
    const { lat, lng, span, spacing, blocks } = this.heightMap;
    return { lat, lng, span, spacing, blocks };
  }

  get metresToWorldY() {
    return this.heightMap.metresToWorldY;
  }

  changed() {
    this.dispatchEvent(new CustomEvent("changed"));
  }

  applyParams() {
    const p = this.params;
    const heightMap = this.heightMap;
    heightMap.mode = p.shape();
    heightMap.crop = p.crop();
    heightMap.quantHeight = p.quantize();
    heightMap.scale = p.verticalScale();
    heightMap.corrected = p.projection() === "corrected";
    heightMap.autoHeight = p.heightScale() === "fit";
    heightMap.handPlaced = p.handPlaced();
    heightMap.brickPalette = p.palette();
    heightMap.generator = generators[p.tiles()] ?? generators["ArcGIS World Imagery"];
    heightMap.elevation = elevations[p.elevation()] ?? elevations["AWS terrain"];
  }

  get attribution() {
    const heightMap = this.heightMap;
    const sources = [
      heightMap.generator?.attribution,
      heightMap.elevation?.attribution,
    ].filter(Boolean);
    return [...new Set(sources)].join(" · ");
  }

  reshape() {
    this.applyParams();
    this.rebuild();
  }

  async refetch() {
    this.heightMap.setBlocks(this.params.blocks());
    this.applyParams();
    await googleMapsReady;
    await this.heightMap.populateMaps();
    this.heightMap.invalidate();
    this.rebuild();
  }

  async load(lat, lng, span) {
    await googleMapsReady;
    await this.heightMap.populateMaps(lat, lng, span);
    this.rebuild();
  }

  findPeaks(count) {
    return this.heightMap.findPeaks(count);
  }

  heightField(res) {
    return this.heightMap.heightField(res);
  }

  pose(x, z, dirX, dirZ, out = { lat: 0, lng: 0, bearing: 0 }) {
    const heightMap = this.heightMap;
    const step = 0.05;
    const length = Math.hypot(dirX, dirZ) || 1;
    heightMap.worldToLatLng(x, z, here);
    heightMap.worldToLatLng(
      x + (dirX / length) * step,
      z + (dirZ / length) * step,
      ahead
    );

    const lat1 = here.lat * DEG;
    const lat2 = ahead.lat * DEG;
    let dLng = (ahead.lng - here.lng) * DEG;
    if (dLng > Math.PI) dLng -= 2 * Math.PI;
    else if (dLng < -Math.PI) dLng += 2 * Math.PI;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const p =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    out.lat = here.lat;
    out.lng = here.lng;
    out.bearing = Math.atan2(y, p) / DEG;
    return out;
  }

  surfaceGrid() {
    const heightMap = this.heightMap;
    const res = Math.min(512, Math.max(64, heightMap.blocks));
    const field = heightMap.heightField(res);
    closeGaps(field.cells, res);
    return { ...field, rise: 0.5 * heightMap.boxScale };
  }

  groundSampler() {
    const { cells, size, res, rise } = this.surfaceGrid();
    const half = size / 2;
    return (x, z) => {
      const u = Math.floor(((x + half) / size) * res);
      const v = Math.floor(((z + half) / size) * res);
      if (u < 0 || u >= res || v < 0 || v >= res) return NaN;
      const h = cells[v * res + u];
      return h > 0 ? h + rise : NaN;
    };
  }

  pick(origin, direction) {
    const heightMap = this.heightMap;
    if (!heightMap.mesh || !heightMap.pointCount) return null;

    const { cells, size, res, rise } = this.surfaceGrid();
    const half = size / 2;

    const o = [origin.x, origin.y, origin.z];
    const d = [direction.x, direction.y, direction.z];
    const lo = [-half, 0, -half];
    const hi = [half, heightMap.bb.max.y + rise, half];

    let t0 = 0;
    let t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < lo[i] || o[i] > hi[i]) return null;
        continue;
      }
      let a = (lo[i] - o[i]) / d[i];
      let b = (hi[i] - o[i]) / d[i];
      if (a > b) {
        const s = a;
        a = b;
        b = s;
      }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return null;
    }

    const surface = (t) => {
      const x = o[0] + d[0] * t;
      const z = o[2] + d[2] * t;
      const u = Math.floor(((x + half) / size) * res);
      const v = Math.floor(((z + half) / size) * res);
      if (u < 0 || u >= res || v < 0 || v >= res) return -Infinity;
      const h = cells[v * res + u];
      return h > 0 ? h + rise : -Infinity;
    };

    const step = size / res / 2;
    let prev = t0;
    for (let t = t0; t <= t1; t += step) {
      if (o[1] + d[1] * t <= surface(t)) {
        let a = prev;
        let b = t;
        for (let k = 0; k < 24; k++) {
          const m = 0.5 * (a + b);
          if (o[1] + d[1] * m <= surface(m)) b = m;
          else a = m;
        }
        return new Vector3(o[0] + d[0] * b, o[1] + d[1] * b, o[2] + d[2] * b);
      }
      prev = t;
    }
    return null;
  }

  bake() {
    this.heightMap.bake();
  }
}

export { BlockyEarth, generators, elevations, detailLevels };
