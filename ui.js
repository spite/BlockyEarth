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

class BlockyEarthUI extends LitElement {
  static get properties() {
    return {
      mode: Symbol,
    };
  }

  constructor() {
    super();
    this._generator = null;
  }

  set generator(g) {
    this._generator = g;
    this.mode = this._generator.mode;
  }

  setMode(mode) {
    this._generator.mode = mode;
    this.mode = mode;
  }

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
      </style>
      <div id="tools">
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
          <x-button id="cropNoneBtn" left active>None</x-button>
          <x-button id="cropCircleBtn" middle>Circle</x-button>
          <x-button id="cropHexagonBtn" right>Hexagon</x-button>
        </div>
        <div>
          <span>Height</span>
          <x-button id="noQuantBtn" left>Natural</x-button>
          <x-button id="blockBtn" middle>Block</x-button>
          <x-button id="halfBlockBtn" middle>Half-block</x-button>
          <x-button id="quarterBlockBtn" right>Quarter-block</x-button>
        </div>
        <div>
          <input type="checkbox" id="perfectAlignment" />
          <label for="perfectAlignment">Align</label>
          <input type="checkbox" id="brickPalette" />
          <label for="brickPalette">Palette</label>
          <input type="range" id="heightScale" min="0" max="10" step=".1" />
          <select id="colorTiles"></select>
        </div>
        <div>
          <x-button id="downloadBtn" icon left
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
          <x-button id="snapBtn" icon right
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
    `;
  }
}
customElements.define("blockyearth-ui", BlockyEarthUI);
