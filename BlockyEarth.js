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

const detailLevels = [64, 128, 256, 512, 1024];

class BlockyEarth extends EventTarget {
  constructor(params) {
    super();
    this.params = params;
    this.group = new Group();

    this.heightMap = new HeightMap(params.blocks());
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
    heightMap.handPlaced = p.handPlaced();
    heightMap.brickPalette = p.palette();
    heightMap.generator = generators[p.tiles()];
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

  bake() {
    this.heightMap.bake();
  }
}

export { BlockyEarth, generators, detailLevels };
