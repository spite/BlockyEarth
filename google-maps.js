const FALLBACK_VERSION = 1013;

let currentGoogleMapsVersion = FALLBACK_VERSION;

async function loadVersion() {
  try {
    const res = await fetch("https://www.clicktorelease.com/code/mv/");
    const src = await res.text();
    const version = parseInt(src.match(/=\s*(\d+)/)?.[1], 10);
    if (!isNaN(version)) {
      currentGoogleMapsVersion = version;
    }
  } catch (e) {
    console.warn(`Could not fetch Google Maps version, using fallback.`, e);
  }
}

const ready = loadVersion();

function GoogleMaps(x, y, z) {
  return `https://khm1.google.com/kh/v=${currentGoogleMapsVersion}&x=${x}&y=${y}&z=${z}&s=Gali`;
}

GoogleMaps.maxZoom = 20;

export { GoogleMaps, ready };
