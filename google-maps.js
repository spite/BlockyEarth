const VERSION_URL = "https://www.clicktorelease.com/code/mv/";
const FALLBACK_VERSION = 1013;

let currentGoogleMapsVersion = FALLBACK_VERSION;

function loadVersion() {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = VERSION_URL;
    const done = () => {
      if (typeof window.currentGoogleMapsVersion === "number") {
        currentGoogleMapsVersion = window.currentGoogleMapsVersion;
      }
      script.remove();
      resolve();
    };
    script.onload = done;
    script.onerror = () => {
      script.remove();
      resolve();
    };
    document.head.append(script);
  });
}

const ready = loadVersion();

function GoogleMaps(x, y, z) {
  return `https://khm1.google.com/kh/v=${currentGoogleMapsVersion}&x=${x}&y=${y}&z=${z}&s=Gali`;
}

GoogleMaps.maxZoom = 20;

export { GoogleMaps, ready };
