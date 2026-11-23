// Small procedural pixel textures that add detail to the flat colours: court grain and scuffs, grass blades,
// net mesh, banner stripes, concrete steps, fur and a tennis-ball seam. They are painted in near-white
// greys and multiply with each material's colour, drawn tiny and sampled without smoothing so they
// stay crisp. Without a DOM (the node tests) every function returns null and the material stays flat.
import * as THREE from 'three';

const hasDom = typeof document !== 'undefined';

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function make(w, h, draw, { repeat = [1, 1], seed = 1, transparent = false } = {}) {
  if (!hasDom) return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (!transparent) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
  draw(g, w, h, rng(seed));
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

const grey = (v) => `rgb(${v},${v},${v})`;
const px = (g, x, y, v, w = 1, h = 1) => { g.fillStyle = grey(v); g.fillRect(x, y, w, h); };

/** Hard-court grain with the odd scuff and pale fleck. */
export function hardCourt(repeat, seed = 3) {
  return make(64, 64, (g, w, h, r) => {
    for (let i = 0; i < 700; i++) px(g, (r() * w) | 0, (r() * h) | 0, 222 + ((r() * 33) | 0));
    for (let i = 0; i < 14; i++) px(g, (r() * w) | 0, (r() * h) | 0, 196 + ((r() * 14) | 0), 2 + ((r() * 3) | 0), 1 + ((r() * 2) | 0)); // scuffs
    for (let i = 0; i < 40; i++) px(g, (r() * w) | 0, (r() * h) | 0, 255);
  }, { repeat, seed });
}

/** Mown grass: short blades, a little lighter and darker. */
export function grass(repeat, seed = 5) {
  return make(64, 64, (g, w, h, r) => {
    for (let i = 0; i < 520; i++) {
      const v = r() < 0.5 ? 205 + ((r() * 25) | 0) : 240 + ((r() * 15) | 0);
      px(g, (r() * w) | 0, (r() * h) | 0, v, 1, 2 + ((r() * 2) | 0));
    }
  }, { repeat, seed });
}

/** Net mesh: a grid of cords on a clear background, for an alpha-tested material. */
export function netMesh(repeat) {
  return make(32, 32, (g, w, h) => {
    g.fillStyle = '#fff';
    for (let i = 0; i < w; i += 8) { g.fillRect(i, 0, 3, h); g.fillRect(0, i, w, 3); }
  }, { repeat, transparent: true });
}

// A 5x7 pixel font for the banners.
const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'], ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Pixel-font width of a word at a scale (letters 5 wide with a 1 pixel gap). */
export const textWidth = (word, scale) => word.length * 6 * scale - scale;

/** Draw a word in pixel letters with its top-left at (x, y). */
function drawWord(g, word, x, y, scale, v) {
  g.fillStyle = grey(v);
  for (const ch of word.toUpperCase()) {
    const glyph = GLYPHS[ch] || GLYPHS[' '];
    glyph.forEach((row, ry) => { for (let rx = 0; rx < 5; rx++) if (row[rx] === '1') g.fillRect(x + rx * scale, y + ry * scale, scale, scale); });
    x += 6 * scale;
  }
}

/** Advertising banner with a real word on it. The tile is 192x32 (six times as wide as tall), so
 * repeat it every 6 banner-heights. */
export function banner(repeat, word = 'MEOW CUP', seed = 7) {
  return make(192, 32, (g, w, h) => {
    for (let x = -h; x < w; x += 24) { // faint diagonal stripes at the ends
      g.fillStyle = grey(236);
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + 10, h); g.lineTo(x + 10 + h, 0); g.lineTo(x + h, 0); g.fill();
    }
    g.fillStyle = '#fff'; g.fillRect(6, 4, w - 12, h - 8);
    const scale = textWidth(word, 2) <= w - 24 ? 2 : 1;
    const tw = textWidth(word, scale);
    const x0 = Math.round((w - tw) / 2), y0 = Math.round((h - 7 * scale) / 2);
    drawWord(g, word, x0 + scale, y0 + scale, scale, 215); // a soft shadow
    drawWord(g, word, x0, y0, scale, 70); // dark letters on the banner colour
  }, { repeat, seed });
}

/** Concrete stand steps: rows with darker edges and seat dots. */
export function stands(repeat, seed = 11) {
  return make(64, 64, (g, w, h, r) => {
    for (let y = 0; y < h; y += 16) { px(g, 0, y, 190, w, 2); px(g, 0, y + 2, 225, w, 1); }
    for (let i = 0; i < 60; i++) px(g, (r() * w) | 0, (r() * h) | 0, 205 + ((r() * 40) | 0));
    for (let x = 4; x < w; x += 8) for (let y = 6; y < h; y += 16) px(g, x, y, 180, 3, 3);
  }, { repeat, seed });
}

/** Fur: fine speckle with a few darker tufts. */
export function fur(seed = 13) {
  return make(32, 32, (g, w, h, r) => {
    for (let i = 0; i < 160; i++) px(g, (r() * w) | 0, (r() * h) | 0, 205 + ((r() * 50) | 0));
    for (let i = 0; i < 18; i++) px(g, (r() * w) | 0, (r() * h) | 0, 175 + ((r() * 25) | 0), 1, 2 + ((r() * 3) | 0));
  }, { seed });
}

/** Tennis ball: a white seam curving around a slightly darker felt. */
export function ball() {
  return make(64, 32, (g, w, h, r) => {
    g.fillStyle = grey(236); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) px(g, (r() * w) | 0, (r() * h) | 0, 222 + ((r() * 30) | 0));
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    for (const o of [0, w / 2]) {
      g.beginPath();
      for (let y = 0; y <= h; y++) {
        const x = o + w / 4 + Math.sin((y / h) * Math.PI * 2) * 6;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

/** Racket strings: a crosshatch on a clear background. */
export function strings() {
  return make(16, 16, (g, w, h) => {
    g.fillStyle = '#fff';
    for (let i = 0; i < w; i += 4) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
  }, { transparent: true });
}

/** Ball skins (full colour; the ball's material is white so they show as painted): stripes, stars, gold, flame and disco tiles. */
export function ballSkin(pattern) {
  return make(64, 32, (g, w, h, r) => {
    const fill = (c) => { g.fillStyle = c; g.fillRect(0, 0, w, h); };
    if (pattern === 'stripes') { fill('#f4f4f4'); g.fillStyle = '#e0524d'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 6, h); }
    else if (pattern === 'stars') { fill('#25356b'); g.fillStyle = '#ffd23a'; for (let i = 0; i < 14; i++) { const x = ((i * 23) % w), y = ((i * 11) % h); g.fillRect(x, y, 3, 3); g.fillRect(x - 1, y + 1, 5, 1); g.fillRect(x + 1, y - 1, 1, 5); } }
    else if (pattern === 'gold') { fill('#e0a21f'); g.fillStyle = '#fff3b0'; for (let i = 0; i < 10; i++) g.fillRect((r() * w) | 0, (r() * h) | 0, 4, 1); g.fillStyle = '#b9770f'; g.fillRect(0, h - 6, w, 3); }
    else if (pattern === 'flame') { fill('#ff6a1a'); g.fillStyle = '#ffd23a'; for (let x = 0; x < w; x += 8) g.fillRect(x, h - 4 - ((x * 7) % 10), 5, 14); g.fillStyle = '#fff3b0'; for (let x = 4; x < w; x += 16) g.fillRect(x, h - 3, 3, 8); }
    else if (pattern === 'disco') { fill('#8e96aa'); const cols = ['#9fe8ff', '#ff9ad5', '#fff3b0', '#c9b6ff']; for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = cols[((x / 4) * 3 + (y / 4) * 5) % 4 | 0]; g.fillRect(x, y, 3, 3); } }
    else if (pattern === 'moon') { fill('#f1ecd2'); g.fillStyle = '#c9c3a4'; for (let i = 0; i < 9; i++) { const x = (r() * w) | 0, y = (r() * h) | 0, rr = 2 + ((r() * 3) | 0); g.fillRect(x, y, rr, rr - 1); } }
    else fill('#fff');
  }, { seed: 5 });
}
