import * as THREE from 'three';
import { PALETTE } from './config.js';
import * as tex from './textures.js';

// Must stay equal to core/court.h (checked by test/pixel.test.mjs).
export const COURT = {
  halfLen: 11.885, singlesHalfW: 4.115, doublesHalfW: 5.485, serviceZ: 6.4,
  netCentre: 0.914, netPost: 1.07, postX: 6.399, lineW: 0.05,
};

/** Core world (x across, y up, z along) is right-handed like three.js: no conversion. */
export const toThree = (x, y, z) => [x, y, z];

const mat = (color, grad, map = null) => new THREE.MeshToonMaterial({ color, gradientMap: grad, map });

export function buildCourt(grad, theme = null) {
  const T = theme ?? { court: PALETTE.court, run: PALETTE.courtDark, ground: PALETTE.grass, stripe: PALETTE.grassDark, line: PALETTE.line, tex: 'hard' };
  const g = new THREE.Group();
  const add = (mesh, name) => { if (name) mesh.name = name; g.add(mesh); return mesh; };
  const box = (w, h, d, color, x, y, z, name, map = null) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, grad, map));
    m.position.set(...toThree(x, y, z));
    return add(m, name);
  };

  const TILE = 2; // metres per texture tile
  const grassTex = tex.grass([80 / TILE, 90 / TILE]);
  box(80, 0.2, 90, T.ground, 0, -0.11, 0, 'ground', grassTex);
  // mowing stripes
  for (let i = -4; i < 4; i += 2) box(80, 0.01, 11.25, T.stripe, 0, -0.005, i * 11.25 + 5.6, undefined, tex.grass([80 / TILE, 11.25 / TILE], 9));
  const surf = T.tex === 'grass' ? tex.grass : tex.hardCourt;
  const park = T.id === 'loxford';
  if (park) buildParkCourt(g, grad, T, surf, box);
  else box(2 * COURT.doublesHalfW + 6, 0.1, 2 * COURT.halfLen + 12, T.run, 0, -0.03, 0, 'run-off',
    surf([(2 * COURT.doublesHalfW + 6) / TILE, (2 * COURT.halfLen + 12) / TILE], 4));
  box(2 * COURT.doublesHalfW, 0.06, 2 * COURT.halfLen, T.court, 0, 0, 0, 'court-surface',
    surf([2 * COURT.doublesHalfW / TILE, 2 * COURT.halfLen / TILE]));

  const L = Math.max(COURT.lineW, 0.11), y = 0.035; // drawn wider so lines survive 480x270
  const hw = COURT.doublesHalfW, sw = COURT.singlesHalfW, hl = COURT.halfLen;
  for (const sx of [-1, 1]) {
    box(L, 0.01, 2 * hl, T.line, sx * hw, y, 0);
    box(L, 0.01, 2 * hl, T.line, sx * sw, y, 0);
    box(L, 0.01, 2 * COURT.serviceZ, T.line, 0, y, 0);
  }
  for (const sz of [-1, 1]) {
    box(2 * hw, 0.01, L, T.line, 0, y, sz * hl);
    box(2 * sw, 0.01, L, T.line, 0, y, sz * COURT.serviceZ);
  }
  box(L, 0.01, 2 * COURT.serviceZ, T.line, 0, y, 0);

  const net = new THREE.Group();
  net.name = 'net';
  const netMat = mat(PALETTE.net, grad, tex.netMesh([2 * COURT.postX / 1.6, COURT.netCentre / 1.6]));
  if (netMat.map) { netMat.transparent = true; netMat.alphaTest = 0.4; netMat.side = THREE.DoubleSide; }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2 * COURT.postX, COURT.netCentre, 0.03), netMat);
  mesh.position.set(0, COURT.netCentre / 2, 0);
  net.add(mesh);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(2 * COURT.postX, 0.07, 0.05), mat(0xffffff, grad));
  tape.position.set(0, COURT.netCentre, 0);
  net.add(tape);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, COURT.netPost, 0.1), mat(PALETTE.post, grad));
    post.position.set(sx * COURT.postX, COURT.netPost / 2, 0);
    net.add(post);
  }
  g.add(net);
  return g;
}

// ---- Loxford Park: two courts side by side in one blue slab, inside a wire fence ----
const PARK = { x0: -24, x1: 8.5, z: 22, fenceH: 2.4 }; // the slab: the played court at x = 0, a second (not played) court to its left
export const PARK_NEIGHBOUR_X = -(2 * COURT.doublesHalfW + 4.5);

function buildParkCourt(g, grad, T, surf, box) {
  const TILE = 2, w = PARK.x1 - PARK.x0, cx = (PARK.x0 + PARK.x1) / 2;
  box(w, 0.1, 2 * PARK.z, T.run, cx, -0.03, 0, 'run-off', surf([w / TILE, 2 * PARK.z / TILE], 4));
  // the neighbouring court: surface, lines and a net, only for looks
  const nx = PARK_NEIGHBOUR_X, hw = COURT.doublesHalfW, sw = COURT.singlesHalfW, hl = COURT.halfLen, L = 0.11, y = 0.035;
  box(2 * hw, 0.06, 2 * hl, T.court, nx, 0, 0, undefined, surf([2 * hw / TILE, 2 * hl / TILE]));
  for (const sx of [-1, 1]) { box(L, 0.01, 2 * hl, T.line, nx + sx * hw, y, 0); box(L, 0.01, 2 * hl, T.line, nx + sx * sw, y, 0); }
  for (const sz of [-1, 1]) { box(2 * hw, 0.01, L, T.line, nx, y, sz * hl); box(2 * sw, 0.01, L, T.line, nx, y, sz * COURT.serviceZ); }
  box(L, 0.01, 2 * COURT.serviceZ, T.line, nx, y, 0);
  const netMat = mat(PALETTE.net, grad, tex.netMesh([2 * COURT.postX / 1.6, COURT.netCentre / 1.6]));
  if (netMat.map) { netMat.transparent = true; netMat.alphaTest = 0.4; netMat.side = THREE.DoubleSide; }
  const net = new THREE.Mesh(new THREE.BoxGeometry(2 * COURT.postX, COURT.netCentre, 0.03), netMat);
  net.position.set(nx, COURT.netCentre / 2, 0);
  g.add(net);
  for (const sx of [-1, 1]) box(0.1, COURT.netPost, 0.1, PALETTE.post, nx + sx * COURT.postX, COURT.netPost / 2, 0);

  // a dark-green wire fence all round the slab: posts every 3 m and a see-through mesh between them
  const postMat = mat(0x1f3b2c, grad);
  const run = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3));
    const fenceMat = new THREE.MeshBasicMaterial({ color: 0x1d3a2a, map: tex.netMesh([len / 1.2, PARK.fenceH / 1.2]), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    const wire = new THREE.Mesh(new THREE.PlaneGeometry(len, PARK.fenceH), fenceMat);
    wire.position.set((x0 + x1) / 2, PARK.fenceH / 2, (z0 + z1) / 2);
    wire.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    g.add(wire);
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, PARK.fenceH, 0.12), postMat);
      p.position.set(x0 + ((x1 - x0) * i) / n, PARK.fenceH / 2, z0 + ((z1 - z0) * i) / n);
      g.add(p);
    }
  };
  run(PARK.x0, -PARK.z, PARK.x1, -PARK.z); run(PARK.x0, PARK.z, PARK.x1, PARK.z);
  run(PARK.x0, -PARK.z, PARK.x0, PARK.z); run(PARK.x1, -PARK.z, PARK.x1, PARK.z);
  // park furniture beyond the fence: a sand pitch with a small goal, a table-tennis table and a path
  box(26, 0.04, 14, 0xe8dcc0, 28, 0.02, -34, undefined, tex.grass([13, 7], 21));
  box(3.2, 0.1, 0.1, 0xf2d24a, 28, 2.0, -41); box(0.1, 2.0, 0.1, 0xf2d24a, 26.4, 1.0, -41); box(0.1, 2.0, 0.1, 0xf2d24a, 29.6, 1.0, -41);
  box(2.7, 0.08, 1.5, 0x9aa4ad, 22, 0.75, 27); for (const lx of [-1.1, 1.1]) box(0.08, 0.75, 1.2, 0x7d8790, 22 + lx, 0.37, 27);
  // the park path running past the fence on the left of the view (the fence at x = 8.5 is on the left on screen)
  box(6, 0.05, 120, 0xe6dcc4, 12, 0.015, 0);
  for (const lz of [-18, -6, 6, 18]) box(0.6, 0.5, 1.6, 0x8a5a33, 13.6, 0.25, lz); // a few benches along it
}
