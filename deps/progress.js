import { LitElement, html } from "lit";

class ProgressBar extends LitElement {
  static get properties() {
    return {
      progress: { type: Number },
      loaded: { type: Number },
      total: { type: Number },
    };
  }

  constructor() {
    super();
    this.progress = 0;
    this.loaded = 0;
    this.total = 0;
  }

  get pending() {
    return Math.max(0, this.total - this.loaded);
  }

  render() {
    const busy = this.pending > 0;
    const label = busy
      ? `${this.pending} tile${this.pending === 1 ? "" : "s"} pending`
      : "";
    const starting = busy && this.loaded === 0;
    const width = busy ? this.progress : 100;
    return html`
      <style>
        :host {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          z-index: 10000;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.25s ease 0.15s;
        }
        :host([busy]) {
          opacity: 1;
          transition-delay: 0s;
        }
        #fill {
          height: 100%;
          width: 0;
          background-color: #0f5ea2;
          transition: width 0.2s ease;
        }
        #text {
          position: absolute;
          top: 8px;
          left: 12px;
          color: #0f5ea2;
          font: 600 12px/1 "Open Sans", sans-serif;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9);
          white-space: nowrap;
        }
      </style>
      <div
        id="fill"
        style="width: ${width}%; transition: ${starting ? "none" : "width 0.2s ease"}"
      ></div>
      <span id="text">${label}</span>
    `;
  }

  updated() {
    this.toggleAttribute("busy", this.pending > 0);
  }
}
customElements.define("progress-bar", ProgressBar);
