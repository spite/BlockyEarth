import { Group } from "three";
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
  mapBounds,
} from "./mapbox.js";
import { coalesce } from "./deps/coalesce.js";

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
  "NASA at night 2012": NASAGIBSViirsEarthAtNight2012,
};

const resolutions = [
  "512x512",
  "1024x1024",
  "2048x2048",
  "256x512",
  "512x1024",
  "1024x2048",
  "512x256",
  "1024x512",
  "2048x1024",
];

const blockSizes = [1, 2, 4, 8, 16, 32, 64, 128];

function parseResolution(value) {
  const [width, height] = value.split("x").map(Number);
  return { width, height };
}

class BlockyEarth extends EventTarget {
  constructor(params) {
    super();
    this.params = params;
    this.group = new Group();

    const { width, height } = parseResolution(params.mapSize());
    this.heightMap = new HeightMap(width, height, params.blockSize());
    this.heightMap.onProgress = (progress) => {
      this.dispatchEvent(new CustomEvent("progress", { detail: { progress } }));
    };

    this.heightMap.onTilesUnavailable = (kind) => {
      this.dispatchEvent(
        new CustomEvent("tiles-unavailable", {
          detail: { kind, source: kind === "color" ? params.tiles() : "Nextzen elevation" },
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

    this.rebuild();
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

  boundsFor(lat, lng, zoom) {
    const { width, height } = this.heightMap;
    return mapBounds(lat, lng, zoom, width, height);
  }

  get bounds() {
    const { lat, lng, zoom } = this.heightMap;
    return this.boundsFor(lat, lng, zoom);
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
    heightMap.normalizeHeight = p.normalize();
    heightMap.perfectAlignment = p.align();
    heightMap.brickPalette = p.palette();
    heightMap.generator = generators[p.tiles()];
  }

  reshape() {
    this.applyParams();
    this.rebuild();
  }

  async refetch() {
    const { width, height } = parseResolution(this.params.mapSize());
    this.heightMap.setSize(width, height);
    this.heightMap.setStep(this.params.blockSize());
    this.applyParams();
    await googleMapsReady;
    await this.heightMap.populateMaps();
    this.heightMap.invalidate();
    this.rebuild();
  }

  async load(lat, lng, zoom) {
    await googleMapsReady;
    await this.heightMap.populateMaps(lat, lng, zoom);
    this.rebuild();
  }

  bake() {
    this.heightMap.bake();
  }
}

export { BlockyEarth, generators, resolutions, blockSizes };
