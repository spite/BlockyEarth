import { nextZenKey, tileProxy } from "./config.js";

// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#ECMAScript_.28JavaScript.2FActionScript.2C_etc..29

function lngToTile(l, z) {
  let result = ((l + 180) / 360) * Math.pow(2, z);
  return result;
}

function latToTile(l, z) {
  let angle = (l * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(angle) + 1 / Math.cos(angle)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

// https://leaflet-extras.github.io/leaflet-providers/preview/

function EsriWorldImagery(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`; // Esri.WorldImagery
}

function EsriWorldTerrain(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/${z}/${y}/${x}`; // Esri.WorldImagery
}

function EsriWorldPhysical(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/${z}/${y}/${x}`; // Esri.WorldImagery
}

function EsriWorldShadedRelief(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/${z}/${y}/${x}`; // Esri.WorldShadedRelief
}

function EsriNatGeoWorldMap(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/${z}/${y}/${x}`; // Esri.NatGeoWorldMap
}

function OpenTopoMap(x, y, z) {
  return `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`; // OpenTopoMap
}

function CartoLight(x, y, z) {
  return `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`; // CartoDB.Positron
}

function Sentinel2Cloudless(x, y, z) {
  return `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`;
}

function EsriOceanBase(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${x}`;
}

function NASABlueMarbleBathymetry(x, y, z) {
  return `https://gitc.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-01-01/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
}

const WEB_MERCATOR_HALF = 20037508.342789244;

function tileBBox(x, y, z) {
  const span = (2 * WEB_MERCATOR_HALF) / Math.pow(2, z);
  const minX = -WEB_MERCATOR_HALF + x * span;
  const maxY = WEB_MERCATOR_HALF - y * span;
  return `${minX},${maxY - span},${minX + span},${maxY}`;
}

function GEBCOBathymetry(x, y, z) {
  return `https://wms.gebco.net/mapserv?request=getmap&service=wms&crs=EPSG:3857&format=image/png&layers=gebco_latest&width=256&height=256&version=1.3.0&bbox=${tileBBox(
    x,
    y,
    z
  )}`;
}

function USGSUSImagery(x, y, z) {
  return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`; // USGS.USImagery
}

function GeoportailFrance(x, y, z) {
  return `https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
}

function gibs(layer, date, level, format, x, y, z) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}` +
    `/GoogleMapsCompatible_Level${level}/${z}/${y}/${x}.${format}`
  );
}

function NASAGIBSViirsEarthAtNight2012(x, y, z) {
  return gibs("VIIRS_CityLights_2012", "2012-01-01", 8, "jpg", x, y, z);
}

function NASAModisTrueColor(x, y, z) {
  return gibs(
    "MODIS_Terra_CorrectedReflectance_TrueColor",
    "2024-06-01",
    9,
    "jpg",
    x,
    y,
    z
  );
}

function NASASeaSurfaceTemp(x, y, z) {
  return gibs(
    "GHRSST_L4_MUR_Sea_Surface_Temperature",
    "2024-06-01",
    7,
    "png",
    x,
    y,
    z
  );
}

function NASALandSurfaceTemp(x, y, z) {
  return gibs(
    "MODIS_Terra_Land_Surface_Temp_Day",
    "2024-06-01",
    7,
    "png",
    x,
    y,
    z
  );
}

function NASASnowCover(x, y, z) {
  return gibs("MODIS_Terra_NDSI_Snow_Cover", "2024-02-01", 8, "png", x, y, z);
}

function CartoDark(x, y, z) {
  return `https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
}

function EsriDarkGray(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
}

function JRCWaterOccurrence(x, y, z) {
  return `https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/${z}/${x}/${y}.png`;
}

function JRCWaterChange(x, y, z) {
  return `https://storage.googleapis.com/global-surface-water/tiles2021/transitions/${z}/${x}/${y}.png`;
}

function EsriOceanReference(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/${z}/${y}/${x}`;
}

function EsriBoundariesPlaces(x, y, z) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;
}

function OpenSeaMap(x, y, z) {
  return `https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`;
}

const ESRI = "Esri, Maxar, Earthstar Geographics";
const CARTO = "CARTO, OpenStreetMap contributors";
const GIBS = "NASA EOSDIS GIBS";
const JRC = "EC JRC / Google, Global Surface Water";

function describe(generator, maxZoom, attribution) {
  generator.maxZoom = maxZoom;
  generator.attribution = attribution;
}

describe(EsriWorldImagery, 19, ESRI);
describe(EsriWorldTerrain, 13, "Esri, USGS, NOAA");
describe(EsriWorldPhysical, 8, "Esri, US National Park Service");
describe(EsriWorldShadedRelief, 13, "Esri");
describe(EsriNatGeoWorldMap, 16, "Esri, National Geographic");
describe(EsriDarkGray, 16, "Esri, HERE, Garmin");
describe(EsriOceanBase, 16, "Esri, GEBCO, NOAA, National Geographic");
describe(EsriOceanReference, 16, "Esri, GEBCO, NOAA");
describe(EsriBoundariesPlaces, 16, "Esri, HERE, Garmin");
describe(OpenTopoMap, 17, "OpenTopoMap, OpenStreetMap contributors");
describe(OpenSeaMap, 18, "OpenSeaMap, OpenStreetMap contributors");
describe(CartoLight, 20, CARTO);
describe(CartoDark, 20, CARTO);
describe(USGSUSImagery, 16, "USGS The National Map");
describe(GeoportailFrance, 19, "IGN France");
describe(Sentinel2Cloudless, 16, "Sentinel-2 cloudless 2020 by EOX IT Services");
describe(GEBCOBathymetry, 9, "GEBCO Compilation Group");
describe(NASABlueMarbleBathymetry, 8, GIBS);
describe(NASAGIBSViirsEarthAtNight2012, 8, `${GIBS}, VIIRS`);
describe(NASAModisTrueColor, 9, `${GIBS}, MODIS Terra`);
describe(NASASeaSurfaceTemp, 7, `${GIBS}, GHRSST MUR`);
describe(NASALandSurfaceTemp, 7, `${GIBS}, MODIS Terra`);
describe(NASASnowCover, 8, `${GIBS}, MODIS Terra`);
describe(JRCWaterOccurrence, 12, JRC);
describe(JRCWaterChange, 12, JRC);

function proxied(url) {
  if (!tileProxy) return url;
  return `${tileProxy.replace(/\/$/, "")}/?u=${encodeURIComponent(url)}`;
}

function fetchTile(x, y, z, generator = EsriWorldImagery) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = proxied(generator(x, y, z));
  return img;
}

function nextZenElevation(x, y, z) {
  return `https://tile.nextzen.org/tilezen/terrain/v1/512/terrarium/${z}/${x}/${y}.png?api_key=${nextZenKey}`;
}

describe(nextZenElevation, 14, "Nextzen, USGS, NASA");
nextZenElevation.tileSize = 512;

function awsTerrain(x, y, z) {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

describe(awsTerrain, 15, "AWS Open Data, Tilezen, USGS, NASA");
awsTerrain.tileSize = 256;

function getNextZenHeight(r, g, b) {
  return r * 1 + g / 256 + b / 65536;
}

export {
  lngToTile,
  latToTile,
  getNextZenHeight,
  fetchTile,
  EsriWorldImagery,
  EsriWorldTerrain,
  EsriWorldPhysical,
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
};
