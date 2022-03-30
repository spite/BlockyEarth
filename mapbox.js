import { mapBoxKey, nextZenKey } from "../config.js";

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

async function fetchTile(x, y, z) {
  // const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/${z}/${x}/${y}?access_token=${mapBoxKey}`;
  // const url = `https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpg`;
  // const url = `https://stamen-tiles-b.a.ssl.fastly.net/watercolor/${z}/${x}/${y}.jpg`;
  // const url = `https://stamen-tiles-b.a.ssl.fastly.net/terrain-background/${z}/${x}/${y}.png`;
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

async function fetchElevationTile(x, y, z) {
  // const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${mapBoxKey}`;
  // const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}@2x.pngraw?access_token=${mapBoxKey}`;
  //const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/${z}/${x}/${y}?access_token=${mapBoxKey}`;
  //const url = `https://a.tiles.mapbox.com/styles/v1/mapbox/light-v10/tiles/${z}/${x}/${y}@2x?access_token=${mapBoxKey}`;

  const url = `https://tile.nextzen.org/tilezen/terrain/v1/512/terrarium/${z}/${x}/${y}.png?api_key=${nextZenKey}`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img; //convertHeight(img);
}

function getNextZenHeight(r, g, b) {
  return r * 1 + g / 256 + b / 65536;
}

export {
  lngToTile,
  latToTile,
  pointToTileFraction,
  fetchElevationTile,
  tileToLatLng,
  getNextZenHeight,
  getHeight,
  fetchTile,
};
