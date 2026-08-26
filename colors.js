import { Color } from "three";
import { deltaE, rgb2lab } from "./color.js";

const bricks = {
  "Aqua": 0xb3d7d1,
  "Black": 0x05131d,
  "Blue": 0x0055bf,
  "Blue Violet": 0xa3a9ff,
  "Bright Green": 0x4b9f4a,
  "Bright Light Blue": 0x9fc3e9,
  "Bright Light Orange": 0xf8bb3d,
  "Bright Light Yellow": 0xfff03a,
  "Bright Pink": 0xe4adc8,
  "Brown": 0x583927,
  "Coral": 0xff698f,
  "Dark Azure": 0x078bc9,
  "Dark Blue": 0x0a3463,
  "Dark Bluish Gray": 0x6c6e68,
  "Dark Brown": 0x352100,
  "Dark Gray": 0x6d6e5c,
  "Dark Green": 0x184632,
  "Dark Orange": 0xa95500,
  "Dark Pink": 0xc870a0,
  "Dark Purple": 0x3f3691,
  "Dark Red": 0x720e0f,
  "Dark Tan": 0x958a73,
  "Dark Turquoise": 0x008f9b,
  "Flat Silver": 0x898788,
  "Green": 0x237841,
  "Lavender": 0xe1d5ed,
  "Light Aqua": 0xadc3c0,
  "Light Bluish Gray": 0xa0a5a9,
  "Light Gray": 0x9ba19d,
  "Light Nougat": 0xf6d7b3,
  "Light Yellow": 0xfbe696,
  "Lime": 0xbbe90b,
  "Maersk Blue": 0x3592c3,
  "Magenta": 0x923978,
  "Medium Azure": 0x36aebf,
  "Medium Blue": 0x5a93db,
  "Medium Brown": 0x755945,
  "Medium Dark Pink": 0xf785b1,
  "Medium Green": 0x73dca1,
  "Medium Lavender": 0xac78ba,
  "Medium Nougat": 0xaa7d55,
  "Medium Orange": 0xffa70b,
  "Nougat": 0xd09168,
  "Olive Green": 0x9b9a5a,
  "Orange": 0xfe8a18,
  "Pastel Blue": 0x5ac4da,
  "Pink": 0xfc97ac,
  "Purple": 0x81007b,
  "Red": 0xc91a09,
  "Reddish Brown": 0x582a12,
  "Reddish Orange": 0xca4c0b,
  "Sand Blue": 0x6074a1,
  "Sand Green": 0xa0bcac,
  "Sand Red": 0xd67572,
  "Tan": 0xe4cd9e,
  "Very Light Bluish Gray": 0xe6e3e0,
  "Very Light Gray": 0xe6e3da,
  "Vibrant Yellow": 0xebd800,
  "Warm Pink": 0xf6b7bf,
  "Warm Tan": 0xcca373,
  "White": 0xffffff,
  "Yellow": 0xf2cd37,
  "Yellowish Green": 0xdfeea5,
};

const table = Object.values(bricks).map((hex) => {
  const color = new Color();
  color.setHex(hex);
  const rgb = [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
  return { lab: rgb2lab(rgb), color };
});

const cache = new Map();

function getClosestColor(c) {
  const hex = c.getHex();
  const cached = cache.get(hex);
  if (cached) {
    return cached;
  }

  const lab = rgb2lab([(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff]);
  let min = Infinity;
  let sel = table[0];
  for (const item of table) {
    const d = deltaE(lab, item.lab);
    if (d < min) {
      min = d;
      sel = item;
    }
  }

  cache.set(hex, sel.color);
  return sel.color;
}

export { getClosestColor, bricks };
