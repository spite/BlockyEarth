import { Color } from "three";
import { delta } from "./color.js";

// from http://www.jennyscrayoncollection.com/2021/06/all-current-lego-colors.html

const colors = [
  // black
  0x1b1b1b, 0x42433e,
  // white
  0xefefef, 0xf7f7f7, 0xe7eecf,
  // grey
  0x7c7c7c, 0xa2acae,
  // silver
  0x777779, 0xa3a3a3, 0xceced0,
  // lilac
  0x9575b4, 0xbca5cf, 0x4b2f93, 0x7671b4,
  // blue
  0x01395e, 0x006bb9, 0x7abfe9, 0x009bd4, 0x489ecf, 0x85c8e2, 0x678398,
  0x00a3da, 0x00bfd2, 0x189e9f, 0x5ac1be, 0xc1e5db,
  // dark green
  0x70947a, 0x0e4420, 0x009247, 0x01af4e, 0x9bca3c, 0xd5e491, 0x77784e,
  // green
  0x00a850, 0x96c751, 0xe1e43d,
  // yellow
  0xfbab18, 0xfecd04, 0xf8d112, 0xfff677,
  // gold
  0xc39738, 0xd0a12c, 0xe0c077,
  // bright orange
  0xf96c62, 0xf05828, 0xf57c21, 0xf48834,
  // reddish brown
  0x3a180e, 0x6a2e14, 0xa55420, 0xae7548, 0xde8b5f, 0xfdc39e, 0x957d60,
  0x97896c, 0xdec58f,
  // red
  0x7e131b, 0xdd1a22, 0xe61f26,
  // purple
  0xe61f26, 0xe8509b, 0xe95ea2, 0xf7adce,
];

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

const table = colors.map((c) => {
  const color = new Color();
  color.setHex(c);
  return { rgb: hexToRgb(c), color };
});

const cache = new Map();

function getClosestColor(c) {
  const hex = c.getHex();
  const cached = cache.get(hex);
  if (cached) {
    return cached;
  }

  const rgb = hexToRgb(hex);
  let min = Infinity;
  let sel = table[0];
  for (const item of table) {
    const co = item.rgb;
    const d = delta([rgb.r, rgb.g, rgb.b], [co.r, co.g, co.b]);
    if (d < min) {
      min = d;
      sel = item;
    }
  }

  cache.set(hex, sel.color);
  return sel.color;
}

export { getClosestColor };
