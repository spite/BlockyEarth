import { LitElement, html } from "lit";
import { mapBoxKey } from "../config.js";

const locations = [
  { lat: 51.50811493725607, lng: -0.1280283413492745 },
  { lat: 32.6144404, lng: -108.9852017 },
  { lat: 39.36382677360614, lng: 8.431220278759724 },
  { lat: 59.30571937680209, lng: 4.879402148657164 },
  { lat: 28.240385123352873, lng: -16.629988706884774 },
  { lat: 50.09072314148827, lng: 14.393133454556278 },
  { lat: 41.413416092316275, lng: 2.1531126527786455 },
  { lat: 35.71445889443406, lng: 139.7966938981724 },
  { lat: 54.552083679428065, lng: -3.297380963134742 },
];

class MapBrowser extends LitElement {
  constructor() {
    super();
    this.lat = 0;
    this.lng = 0;
    this.snackbar = null;
    this.marker = null;
    this.walker = null;
    this.onReady = null;
    this.ready = new Promise((resolve, reject) => {
      this.onReady = resolve;
    });
  }

  async loadResources() {
    const cssPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.setAttribute("rel", "stylesheet");
      css.setAttribute(
        "href",
        "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
      );
      css.setAttribute(
        "integrity",
        "sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
      );
      css.setAttribute("crossorigin", "");
      css.addEventListener("load", (e) => {
        resolve();
      });
      document.head.append(css);
    });

    const scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.setAttribute(
        "src",
        "https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"
      );
      script.setAttribute(
        "integrity",
        "sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA=="
      );
      script.setAttribute("crossorigin", "");
      script.addEventListener("load", (e) => {
        resolve();
      });
      document.head.append(script);
    });

    return Promise.all([cssPromise, scriptPromise]);
  }

  async firstUpdated() {
    await this.loadResources();
    this.onReady();
    const mapDiv = this.shadowRoot.querySelector("#map");
    this.map = L.map(mapDiv, { zoomSnap: 0, zoomDelta: 0.35 }).setView(
      [51.505, -0.09],
      13
    );

    L.tileLayer(
      "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: "mapbox/streets-v11",
        tileSize: 512,
        zoomOffset: -1,
        accessToken: mapBoxKey,
      }
    ).addTo(this.map);

    this.map.on("click", (e) => this.onMapClick(e));
    this.map.on("moveend", () => {
      if (!this.adjustingView) this.onViewChange();
    });
  }

  get zoom() {
    return this.map.getZoom();
  }

  onMapClick(e) {
    this.addMarker(e.latlng.lat, e.latlng.lng);
  }

  moveTo(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.removeMarker();
    this.marker = L.marker([lat, lng]).addTo(this.map);
    this.suppressView();
    this.map.panTo([lat, lng], { animate: false });
  }

  onViewChange() {}

  suppressView() {
    this.adjustingView = true;
    clearTimeout(this.suppressTimer);
    this.suppressTimer = setTimeout(() => {
      this.adjustingView = false;
    }, 0);
  }

  areaCorners(area) {
    const half = area.span / 2;
    const dLat = (half / 6371008.8) * (180 / Math.PI);
    const dLng =
      (half / (6371008.8 * Math.cos((area.lat * Math.PI) / 180))) *
      (180 / Math.PI);
    return [
      [area.lat - dLat, area.lng - dLng],
      [area.lat + dLat, area.lng + dLng],
    ];
  }

  frameArea(area) {
    if (!this.map || !area) return;
    this.lat = area.lat;
    this.lng = area.lng;
    this.suppressView();
    this.map.fitBounds(this.areaCorners(area), { animate: false });
    this.removeMarker();
    this.marker = L.marker([area.lat, area.lng]).addTo(this.map);
  }

  captureArea() {
    if (!this.map) return null;
    const size = this.map.getSize();
    if (!size || size.x < 2 || size.y < 2) return null;
    const bounds = this.map.getBounds();
    const centre = bounds.getCenter();
    const width = this.map
      .distance(
        [centre.lat, bounds.getWest()],
        [centre.lat, bounds.getEast()]
      );
    const height = this.map.distance(
      [bounds.getSouth(), centre.lng],
      [bounds.getNorth(), centre.lng]
    );
    const span = Math.min(width, height);
    if (!(span > 0)) return null;
    return { lat: centre.lat, lng: centre.lng, span };
  }

  removeMarker() {
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }
  }

  showWalker(lat, lng, bearing) {
    if (!this.map) return;
    if (!this.walker) {
      const icon = L.divIcon({
        className: "walker-icon",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        html: `<svg viewBox="-17 -17 34 34" width="34" height="34">
                 <path d="M0 0 L-9 -15 A 17.5 17.5 0 0 1 9 -15 Z" fill="#0f5ea2" fill-opacity=".3"/>
                 <circle r="5" fill="#0f5ea2" stroke="#fff" stroke-width="2.5"/>
               </svg>`,
      });
      this.walker = L.marker([lat, lng], {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(this.map);
    } else {
      this.walker.setLatLng([lat, lng]);
    }
    const el = this.walker.getElement();
    if (el) el.style.setProperty("--walker-bearing", `${bearing}deg`);
  }

  hideWalker() {
    if (this.walker) {
      this.map.removeLayer(this.walker);
      this.walker = null;
    }
  }

  addMarker(lat, lng) {
    this.moveTo(lat, lng);
    const e = new CustomEvent("map-selection", {
      bubbles: true,
      detail: { latLng: { lat, lng } },
    });
    this.dispatchEvent(e);
  }

  async search(str) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${str}`;
    const res = await fetch(url, { mode: "cors" });
    const data = await res.json();
    if (!data.length) {
      this.snackbar.error(
        `Could not find a result for the specified location.`
      );
      return;
    }
    const city = data[0];
    const bb = city.boundingbox;
    this.map.fitBounds([
      [parseFloat(bb[0]), parseFloat(bb[2])],
      [parseFloat(bb[1]), parseFloat(bb[3])],
    ]);
    this.addMarker(parseFloat(city.lat), parseFloat(city.lon));
  }

  onLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.addMarker(pos.coords.latitude, pos.coords.longitude);
      },
      (e) => {
        this.snackbar.error(`Could not acquire geolocation: ${e.message}`);
      },
      { enableHighAccuracy: true }
    );
  }

  randomLocation() {
    const location = locations[Math.floor(Math.random() * locations.length)];
    this.addMarker(location.lat, location.lng);
  }

  render() {
    return html`
      <style>
        :host {
          display: block;
          position: relative;
          overflow: hidden;
          border-radius: 4px;
        }
        #map {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
        }
        .walker-icon svg {
          display: block;
          transform: rotate(var(--walker-bearing, 0deg));
          transform-origin: 50% 50%;
        }
      </style>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
        integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
        crossorigin=""
      />
      <div id="map"></div>
    `;
  }
}

customElements.define("map-browser", MapBrowser);
