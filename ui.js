import { LitElement, html } from "https://unpkg.com/lit?module";
import {
  BlockHeight,
  Box,
  CircleCrop,
  HalfBlockHeight,
  QuarterBlockHeight,
  HeightMap,
  Hexagon,
  HexagonCrop,
  NoCrop,
  NormalHeight,
  PlasticBrick,
  RoundedBox,
} from "./HeightMap.js";
import { GoogleMaps } from "./google-maps.js";
import {
  EsriWorldImagery,
  EsriWorldPhysical,
  EsriWorldTerrain,
  StamenTerrain,
  StamenWatercolor,
  StamenTonerBackground,
  USGSUSImagery,
  GeoportailFrance,
  NASAGIBSViirsEarthAtNight2012,
} from "./mapbox.js";
import "./deps/progress.js";

const generators = {
  "Google Maps Satellite": GoogleMaps,
  "ArcGIS World Imagery": EsriWorldImagery,
  "ArcGIS World Terrain": EsriWorldTerrain,
  "ArcGIS World Physical": EsriWorldPhysical,
  "Stamen Terrain": StamenTerrain,
  "Stamen Watercolor": StamenWatercolor,
  "Stamen Toner background": StamenTonerBackground,
  "USGS US Imagery": USGSUSImagery,
  "Geoportail France": GeoportailFrance,
  "NASA at night 2012": NASAGIBSViirsEarthAtNight2012,
};

const resolutions = [
  { width: 512, height: 512 },
  { width: 1024, height: 1024 },
  { width: 2048, height: 2048 },
  { width: 256, height: 512 },
  { width: 512, height: 1024 },
  { width: 1024, height: 2048 },
  { width: 512, height: 256 },
  { width: 1024, height: 512 },
  { width: 2048, height: 1024 },
];

const steps = [1, 2, 4, 8, 16, 32, 64, 128];

class BlockyEarthUI extends LitElement {
  static get properties() {
    return {
      mode: Symbol,
      crop: Symbol,
      height: Symbol,
      progress: Number,
    };
  }

  constructor() {
    super();
    this._generator = null;
  }

  set generator(g) {
    this._generator = g;
    this._generator.generator = generators["Google Maps Satellite"];
    this._generator.onProgress = (progress) => {
      this.progress = progress;
    };
    this.mode = this._generator.mode;
    this.crop = this._generator.crop;
    this.height = this._generator.quantHeight;
  }

  async fetch() {
    await this._generator.populateMaps();
    this._generator.invalidated = true;
    this.updateMesh();
    this.done();
  }

  setMode(mode) {
    this._generator.mode = mode;
    this.mode = mode;
    this.updateMesh();
    this.done();
  }

  setCrop(crop) {
    this._generator.crop = crop;
    this.crop = crop;
    this.updateMesh();
    this.done();
  }

  setHeight(height) {
    this._generator.quantHeight = height;
    this.height = height;
    this.updateMesh();
    this.done();
  }

  onTileChange(e) {
    this._generator.generator = generators[e.target.value];
    this.fetch();
  }

  onSizeChange(e) {
    const { width, height } = resolutions[e.target.selectedIndex];
    this._generator.setSize(width, height);
    this.fetch();
  }

  onStepChange(e) {
    const step = steps[e.target.selectedIndex];
    this._generator.setStep(step);
    this.fetch();
  }

  async onAlignmentChange(e) {
    this._generator.perfectAlignment = e.target.checked;
    await this._generator.processMaps();
    this.done();
  }

  async onPaletteChange(e) {
    this._generator.brickPalette = e.target.checked;
    await this._generator.processMaps();
    this.done();
  }

  async onHeightChange(e) {
    this._generator.scale = parseFloat(e.target.value);
    await this._generator.processMaps();
    this.done();
  }

  onBake() {
    this._generator.bake();
  }

  updateMesh() {}

  done() {}

  capture() {}

  render() {
    if (!this._generator) return;
    return html`
      <style>
        * {
          box-sizing: border-box;
          padding: 0;
          margin: 0;
        }
        #tools {
          pointer-events: auto;
          display: flex;
          flex-wrap: wrap;
          flex-direction: column;
          gap: 0.5em;
          margin-bottom: 0.5em;
        }
        #tools div {
          display: flex;
          align-items: center;
        }
        #tools div span {
          margin-right: 0.5em;
        }
        select {
          padding: 0.5em;
          font-weight: bold;
          border-radius: 3px;
        }
        progress-bar {
          position: fixed;
          z-index: 100;
        }
        input[type=checkbox]  {
          content: '';
    -webkit-appearance: none;
    background-color: white;
    border: 1px solid;
    border-radius: 3px;
    box-shadow: 0 1px 2px rgb(0 0 0 / 5%), inset 0px -15px 10px -12px rgb(0 0 0 / 5%);
    padding: 10px;
    display: inline-block;
    position: relative;
    vertical-align: middle;
    cursor: pointer;
    margin-right: 5px;
        }
        input[type=checkbox]:checked + label:after {
          content: '';
          display: block;
          position: absolute;
          top: 0px;
          left: -20px;
          width: 6px;
          height: 14px;
          border: solid #0f5ea2;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        label {
          position: relative;
          cursor: pointer;
        }
      </style>
      ${
        this.progress > 0
          ? html`<progress-bar progress="${this.progress}"></progress-bar>`
          : ``
      }
      <div id="tools">
        <div>
          Size: 
          <select @change="${this.onSizeChange}">
            ${resolutions.map(
              (v) => html`<option>${v.width}x${v.height}</option>`
            )}
          </select>
          Step: 
          <select @change="${this.onStepChange}">
            ${steps.map((v) => html`<option>${v}</option>`)}
          </select></div>
          <div>
            <span>Shape</span>
            <x-button
              @click=${() => this.setMode(Box)}
              ?active=${this.mode === Box}
              left
              >Box</x-button
            >
            <x-button
              @click=${() => this.setMode(RoundedBox)}
              ?active=${this.mode === RoundedBox}
              middle
              >Rounded Box</x-button
            >
            <x-button
              @click=${() => this.setMode(PlasticBrick)}
              ?active=${this.mode === PlasticBrick}
              middle
              >Brick</x-button
            >
            <x-button
              @click=${() => this.setMode(Hexagon)}
              ?active=${this.mode === Hexagon}
              right
              >Hexagon</x-button
            >
          </div>
          <div>
            <span>Crop</span>
            <x-button
              @click=${() => this.setCrop(NoCrop)}
              ?active=${this.crop === NoCrop}
              left
              >None</x-button
            >
            <x-button
              @click=${() => this.setCrop(CircleCrop)}
              ?active=${this.crop === CircleCrop}
              middle
              >Circle</x-button
            >
            <x-button
              @click=${() => this.setCrop(HexagonCrop)}
              ?active=${this.crop === HexagonCrop}
              right
              >Hexagon</x-button
            >
          </div>
          <div>
            <span>Height</span>
            <x-button
              @click=${() => this.setHeight(NormalHeight)}
              ?active=${this.height === NormalHeight}
              left
              >Natural</x-button
            >
            <x-button
              @click=${() => this.setHeight(BlockHeight)}
              ?active=${this.height === BlockHeight}
              middle
              >Block</x-button
            >
            <x-button
              @click=${() => this.setHeight(HalfBlockHeight)}
              ?active=${this.height === HalfBlockHeight}
              middle
              >Half-block</x-button
            >
            <x-button
              @click=${() => this.setHeight(QuarterBlockHeight)}
              ?active=${this.height === QuarterBlockHeight}
              right
              >Quarter-block</x-button
            >
          </div>
          <div>
            <input type="checkbox" id="perfectAlignment" @change="${
              this.onAlignmentChange
            }" />
            <label for="perfectAlignment">Align</label>
            <input type="checkbox" id="brickPalette" @change="${
              this.onPaletteChange
            }" />
            <label for="brickPalette">Palette</label>
            <input type="range" id="heightScale" min="0" max="10" step=".1" @change="${
              this.onHeightChange
            }" />
            <select @change="${this.onTileChange}">
              ${Object.keys(generators).map(
                (name) => html`<option>${name}</option>`
              )}
            </select>
          </div>
          <div>
            <x-button id="downloadBtn" icon left @click="${this.onBake}"
              ><svg
                id="Layer_2"
                width="20px"
                height="20px"
                version="1.1"
                viewBox="0 0 32 32"
                xml:space="preserve"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
              >
                <path
                  d="M31.5,7.8408c-0.00353-0.62661-0.41183-1.19667-0.99562-1.41307c0.00002-0.00001-13.99998-5.00001-13.99998-5.00001  c-0.32617-0.11523-0.68262-0.11523-1.00879,0l-14,5C0.91327,6.64527,0.5021,7.2131,0.50001,7.84082  C0.5,7.8408,0.5,24.16307,0.5,24.16307c0.00725,0.62234,0.40818,1.19899,0.99563,1.41112  C1.49561,25.5742,15.49561,30.5742,15.49561,30.5742c0.32012,0.11164,0.68868,0.11371,1.00879-0.00003  c0,0.00003,14-4.99997,14-4.99997c0.37621-0.14334,0.69083-0.4261,0.8593-0.79347c0.08542-0.1953,0.12606-0.4052,0.13629-0.61767  C31.5,24.16307,31.5,7.8408,31.5,7.8408z M3.5,9.96977l11,3.92853v13.13428l-11-3.92896V9.96977z M17.5,13.8983l11-3.92853v13.13385  l-11,3.92896V13.8983z M16,4.43358l9.54004,3.40723L16,11.24803L6.45996,7.8408L16,4.43358z"
                /></svg
            ></x-button>
            <x-button id="snapBtn" icon right @click="${this.capture}"
              ><svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 0 24 24"
                width="24px"
                fill="#000000"
              >
                <path d="M0 0h24v24H0V0z" fill="none" />
                <path
                  d="M14.12 4l1.83 2H20v12H4V6h4.05l1.83-2h4.24M15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2zm-3 7c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"
                /></svg
            ></x-button>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("blockyearth-ui", BlockyEarthUI);
