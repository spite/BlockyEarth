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

function NASAGIBSViirsEarthAtNight2012(x, y, z) {
  return `https://gitc.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpg`; // NASAGIBS.ViirsEarthAtNight2012
}

EsriWorldImagery.maxZoom = 19;
EsriWorldTerrain.maxZoom = 13;
EsriWorldPhysical.maxZoom = 8;
EsriWorldShadedRelief.maxZoom = 13;
EsriNatGeoWorldMap.maxZoom = 16;
OpenTopoMap.maxZoom = 17;
CartoLight.maxZoom = 20;
USGSUSImagery.maxZoom = 16;
GeoportailFrance.maxZoom = 19;
NASAGIBSViirsEarthAtNight2012.maxZoom = 8;
Sentinel2Cloudless.maxZoom = 16;
EsriOceanBase.maxZoom = 16;
NASABlueMarbleBathymetry.maxZoom = 8;

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

nextZenElevation.maxZoom = 14;
nextZenElevation.tileSize = 512;

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
  nextZenElevation,
};
