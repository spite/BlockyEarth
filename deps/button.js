import { LitElement, html } from "lit";

class Button extends LitElement {
  static properties = {
    pill: { type: Boolean },
    left: { type: Boolean },
    middle: { type: Boolean },
    right: { type: Boolean },
    active: { type: Boolean },
    negative: { type: Boolean },
    big: { type: Boolean },
    icon: { type: Boolean },
  };

  render() {
    const modifiers = [
      "pill",
      "left",
      "right",
      "middle",
      "active",
      "negative",
      "big",
      "icon",
    ];
    const classes = ["button", ...modifiers.filter((m) => this[m])];
    return html`
      <style>
        .button {
          display: inline-block;
          padding: 8px 16px;
          font-size: inherit;
          color: #3c3c3d;
          text-shadow: 1px 1px 0 #ffffff;
          background: #ececec;
          white-space: nowrap;
          overflow: visible;
          cursor: pointer;
          text-decoration: none;
          border: 1px solid #cacaca;
          border-radius: 3px;
          outline: none;
          position: relative;
          zoom: 1;
          font-weight: bold;
        }
        .button.primary {
          font-weight: bold;
        }
        .button:hover {
          color: #ffffff;
          border-color: #388ad4;
          text-decoration: none;
          text-shadow: -1px -1px 0 rgba(0, 0, 0, 0.3);
          background-position: 0 -40px;
          background-color: #2d7dc5;
        }
        .button:active,
        .button.active {
          background-position: 0 -81px;
          border-color: #347bba;
          background-color: #0f5ea2;
          color: #ffffff;
          text-shadow: none;
        }
        .button:active {
          top: 1px;
        }
        .button.negative:hover {
          color: #ffffff;
          background-position: 0 -121px;
          background-color: #d84743;
          border-color: #911d1b;
        }
        .button.negative:active,
        .button.negative.active {
          background-position: 0 -161px;
          background-color: #a5211e;
          border-color: #911d1b;
        }
        .button.pill {
          border-radius: 2em;
        }
        .button.left {
          border-bottom-right-radius: 0px;
          border-top-right-radius: 0px;
          margin-right: 0px;
        }
        .button.middle {
          margin-right: 0px;
          margin-left: 0px;
          border-radius: 0px;
          border-left: none;
        }
        .button.right {
          border-top-left-radius: 0px;
          border-bottom-left-radius: 0px;
          margin-left: 0px;
          border-left: none;
        }
        .button.left:active,
        .button.middle:active,
        .button.right:active {
          top: 0px;
        }
        .button.big {
          font-size: 16px;
          padding: 7px 16px;
        }
        .button.icon {
          padding: 0 1em;
          height: 2.5em;
          display: flex;
          align-items: center;
          fill: #3c3c3d;
        }
        .button.icon:hover {
          fill: white;
        }
      </style>
      <button class="${classes.join(" ")}"><slot></slot></button>
    `;
  }
}
customElements.define("x-button", Button);
