import { googleMapsKey } from "../config.js";

async function loadAPI() {
  return new Promise((resolve, reject) => {
    window.initMap = function () {
      resolve(google.maps);
    };
    const scriptElement = document.createElement("script");
    scriptElement.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&callback=initMap&libraries=places`;
    document.body.append(scriptElement);
  });
}

function GoogleMaps(x, y, z) {
  return `http://khm1.google.com/kh/v=${currentGoogleMapsVersion}&x=${x}&y=${y}&z=${z}&s=Gali&${Date.now()}`;
}

async function loadTile(x, y, z) {
  const url = `http://khm1.google.com/kh/v=${currentGoogleMapsVersion}&x=${x}&y=${y}&z=${z}&s=Gali&${Date.now()}`;
  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

export { loadAPI, GoogleMaps };
