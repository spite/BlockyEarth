import { mapBoxKey, nextZenKey } from "./config.js";

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

const d2r = Math.PI / 180;
const r2d = 180 / Math.PI;

function pointToTileFraction(lon, lat, z) {
  var sin = Math.sin(lat * d2r),
    z2 = Math.pow(2, z),
    x = z2 * (lon / 360 + 0.5),
    y = z2 * (0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI);

  // Wrap Tile X
  x = x % z2;
  if (x < 0) x = x + z2;
  return [x, y, z];
}

function tile2lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y, z) {
  var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tileToLatLng(x, y, z) {
  const lng = tile2lng(x, z);
  const lat = tile2lat(y, z);
  return { lng, lat };
}

function getHeight(r, g, b) {
  const height = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  return height;
}

function convertHeight(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let ptr = 0; ptr < canvas.width * canvas.height * 4; ptr += 4) {
    const r = data.data[ptr];
    const g = data.data[ptr + 1];
    const b = data.data[ptr + 2];
    const height = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    const c = height; //height / 2 ** 24;
    data.data[ptr] = c;
    data.data[ptr + 1] = c;
    data.data[ptr + 2] = c;
    data.data[ptr + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
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

function StamenTerrain(x, y, z) {
  return `https://stamen-tiles-b.a.ssl.fastly.net/terrain-background/${z}/${x}/${y}.png`; // Stamen Terrain background
}

function StamenWatercolor(x, y, z) {
  return `https://stamen-tiles-b.a.ssl.fastly.net/watercolor/${z}/${x}/${y}.png`; // Stamen Wartercolor background
}

function StamenTonerBackground(x, y, z) {
  return `https://stamen-tiles-a.a.ssl.fastly.net/toner-background/${z}/${x}/${y}.png`; // Stamen.TonerBackground
}

function USGSUSImagery(x, y, z) {
  return `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`; // USGS.USImagery
}

function GeoportailFrance(x, y, z) {
  return `https://wxs.ign.fr/choisirgeoportail/geoportail/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
}

function NASAGIBSViirsEarthAtNight2012(x, y, z) {
  return `https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpg`; // NASAGIBS.ViirsEarthAtNight2012
}

function fetchTile(x, y, z, generator = EsriWorldImagery) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = generator(x, y, z);
  return img;
}

function nextZenElevation(x, y, z) {
  return `https://tile.nextzen.org/tilezen/terrain/v1/512/terrarium/${z}/${x}/${y}.png?api_key=${nextZenKey}`;
}

function getNextZenHeight(r, g, b) {
  return r * 1 + g / 256 + b / 65536;
}

function mapBoxElevation(x, y, z) {
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}@2x.pngraw?access_token=${mapBoxKey}`;
}

function getMapBoxHeight(r, g, b) {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

export {
  lngToTile,
  latToTile,
  pointToTileFraction,
  tileToLatLng,
  getNextZenHeight,
  getHeight,
  fetchTile,
  EsriWorldImagery,
  EsriWorldTerrain,
  EsriWorldPhysical,
  StamenTerrain,
  StamenWatercolor,
  StamenTonerBackground,
  USGSUSImagery,
  GeoportailFrance,
  NASAGIBSViirsEarthAtNight2012,
  nextZenElevation,
};
