// The story map as a 3D diorama: a slab of park with a road through it, a pond, the sea, the city and the hill, and a
// small toy-style building standing at each stop (gate, duck pond, market, rooftop court, harbour, clock tower).
// The camera looks down at it from the south and leans a little with the pointer. The page's stop pins and the walking
// cat token are DOM elements; each frame this scene moves them onto the projected ground positions.
// Pure helpers at the top are tested without WebGL.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { STOPS } from '../story.js';

export const MAP_W = 200, MAP_H = 100; // the painted map's units (the SVG viewBox); the diorama keeps them
/** A stop's place on the ground: x east, z south, in map units from the middle of the slab. */
export function stopGround(stop) { return { x: stop.x * 2 - MAP_W / 2, z: stop.y - MAP_H / 2 }; }
/** done / now / lock for stop i when the story has reached `stage`. */
export const stopState = (i, stage) => (i < stage ? 'done' : i === stage ? 'now' : 'lock');
const smooth = (u) => u * u * (3 - 2 * u);
/** The token's place between two stops along the road: f 0..1 eased. Returns a fractional stop index. */
export function walkIndex(from, to, f) { return from + (to - from) * smooth(Math.max(0, Math.min(1, f))); }
const KEYS = ['gate', 'pond', 'market', 'rooftop', 'harbour', 'roost'];
const SCALE = { gate: 1.3, pond: 1.35, market: 1.2, rooftop: 1.35, harbour: 1.3, roost: 0.95 };
const HEIGHT = { gate: 19, pond: 8, market: 11, rooftop: 20, harbour: 29, roost: 49 }; // a model's height at scale 1, for the star and arrow above it
const ZONE = { gate: 34, pond: 26, market: 26, rooftop: 28, harbour: 32, roost: 20 }; // radius kept clear of trees and flowers
const SPOT = { gate: [12, -9], pond: [0, -14], market: [0, -8], rooftop: [0, -9], harbour: [-2, -4], roost: [-9, -8] }; // where each building stands, from its stop (behind the pin)

export function createMapScene(canvas, { stage = 0, calm = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, MAP_W / MAP_H, 20, 600);
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6a8a5a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0cc, 2.1);
  sun.position.set(-70, 110, 60);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006;
  Object.assign(sun.shadow.camera, { left: -115, right: 115, top: 75, bottom: -75, near: 10, far: 320 });
  scene.add(sun);
  const grad = toonGradient();
  const mats = new Map();
  const mat = (color, opts = {}) => {
    const k = `${color}|${JSON.stringify(opts)}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshToonMaterial({ color, gradientMap: grad, ...opts }));
    return mats.get(k);
  };
  const shade = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const mesh = (geo, color, x = 0, y = 0, z = 0, opts) => { const m = shade(new THREE.Mesh(geo, mat(color, opts))); m.position.set(x, y, z); return m; };
  const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z);
  const ball = (r, c, x, y, z) => mesh(new THREE.SphereGeometry(r, 12, 9), c, x, y, z);
  const cyl = (rt, rb, h, c, x, y, z, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z);
  const flat = (shape, color, y, opts = {}) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(color, opts)); m.rotation.x = Math.PI / 2; m.position.y = y; m.receiveShadow = true; m.material.side = THREE.DoubleSide; return m; };
  const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x - 100, z - 50) : s.moveTo(x - 100, z - 50))); s.closePath(); return s; };
  const root = new THREE.Group();
  scene.add(root);

  // ---- the slab: grass on top, earth sides ----
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  { const g = gc.getContext('2d'); g.fillStyle = '#4c9a58'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#44904f'; for (let i = -128; i < 256; i += 32) { g.save(); g.translate(i, 0); g.rotate(0.45); g.fillRect(0, -40, 16, 260); g.restore(); } }
  const gtex = new THREE.CanvasTexture(gc); gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(8, 4); gtex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), new THREE.MeshToonMaterial({ map: gtex, gradientMap: grad }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const earth = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 0.2, 7, MAP_H + 0.2), [mat(0x7a5430), mat(0x7a5430), mat(0x2f7345), mat(0x4e3620), mat(0x6b4a2b), mat(0x6b4a2b)]);
  earth.position.y = -3.55; earth.receiveShadow = true; root.add(earth);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 1.6, 0.9, MAP_H + 1.6), mat(0x2f7345)); rim.position.y = -0.4; root.add(rim);

  // ---- the sea and its sand, bottom right ----
  root.add(flat(poly([[134, 100], [134, 79], [146, 69], [157, 75], [169, 81], [178, 73], [190, 67], [200, 71], [200, 100]]), 0xe8d29a, 0.06));
  const sea = flat(poly([[138, 100], [138, 80], [146, 72], [156, 78], [168, 84], [178, 76], [190, 70], [200, 74], [200, 100]]), 0x2f87cf, 0.14);
  root.add(sea);
  const waves = [];
  for (const [x, z] of [[150, 90], [166, 94], [182, 86], [156, 97], [190, 96]]) { const w = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 4, 14, Math.PI), mat(0xd7f1ff)); w.rotation.x = Math.PI / 2; w.position.set(x - 100, 0.3, z - 50); root.add(w); waves.push(w); }
  // a stream from the pond down to the sea edge
  const stream = new THREE.CatmullRomCurve3([[30, 100], [34, 84], [46, 78], [60, 72], [58, 58]].map(([x, z]) => new THREE.Vector3(x - 100, 0.1, z - 50)));
  const ribbon = (curve, width, color, y, n = 120) => {
    const pos = [], idx = [], p = new THREE.Vector3(), t = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      curve.getPoint(i / n, p); curve.getTangent(i / n, t);
      const nx = -t.z, nz = t.x, l = Math.hypot(nx, nz) || 1;
      pos.push(p.x + nx / l * width / 2, y, p.z + nz / l * width / 2, p.x - nx / l * width / 2, y, p.z - nz / l * width / 2);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(color)); m.receiveShadow = true; return m;
  };
  root.add(ribbon(stream, 2.2, 0x4fb3e8, 0.2));

  // ---- the road through the six stops ----
  const stopPos = STOPS.map(stopGround);
  const roadPts = [new THREE.Vector3(-104, 0.2, stopPos[0].z + 8), ...stopPos.map((p) => new THREE.Vector3(p.x, 0.2, p.z))];
  const road = new THREE.CatmullRomCurve3(roadPts, false, 'catmullrom', 0.5);
  root.add(ribbon(road, 5.2, 0x5a3d22, 0.3), ribbon(road, 4.0, 0xd9b87c, 0.4), ribbon(road, 0.6, 0xf1d9a2, 0.5));
  // where each stop falls along the road (0..1), to walk the token between them
  const roadT = stopPos.map((p) => { let best = 0, bd = 1e9; const q = new THREE.Vector3(); for (let i = 0; i <= 600; i++) { road.getPoint(i / 600, q); const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = i / 600; } } return best; });

  // ---- the city and the hill (top right), trees and bushes ----
  for (const [x, z, w, d, h, c] of [[110, 8, 10, 8, 10, 0x4d5d82], [122, 5, 9, 8, 15, 0x56688a], [135, 8, 9, 8, 9, 0x4d5d82], [147, 12, 8, 7, 12, 0x56688a], [99, 12, 8, 7, 7, 0x5a6a90]]) {
    root.add(box(w, h, d, c, x - 100, h / 2, z - 50));
    for (let k = 0; k < 3; k++) root.add(box(w * 0.18, h * 0.12, 0.2, 0xffd978, x - 100 - w * 0.25 + k * w * 0.25, h * (0.35 + 0.2 * (k % 2)), z - 50 + d / 2 + 0.1));
  }
  for (const [x, z, r, h, c] of [[160, 6, 13, 16, 0x434a6e], [176, 12, 14, 20, 0x59608a], [192, 6, 12, 14, 0x434a6e], [168, 28, 9, 9, 0x59608a], [196, 26, 8, 8, 0x434a6e]]) { const m = mesh(new THREE.ConeGeometry(r, h, 6), c, x - 100, h / 2, z - 50); root.add(m); }
  // ---- scenery: road edging, trees, bushes, flowers, grass, rocks and the shoreline ----
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const zones = KEYS.map((k, i) => ({ x: stopPos[i].x + SPOT[k][0], z: stopPos[i].z + SPOT[k][1], r: ZONE[k] })); // where each stop's building stands
  const roadSamples = road.getSpacedPoints(160), streamSamples = stream.getSpacedPoints(60);
  const nearPts = (pts, x, z, r) => pts.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < r * r);
  const free = (x, z, { road: rr = 6, bld = 0, margin = 4 } = {}) => {
    if (Math.abs(x) > MAP_W / 2 - margin || Math.abs(z) > MAP_H / 2 - margin) return false;
    if (x > 32 && z > 14) return false; // sea and sand
    if (nearPts(roadSamples, x, z, rr) || nearPts(streamSamples, x, z, 3.5)) return false;
    return !zones.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + bld) ** 2);
  };
  // little stones edging the road
  { const pts = road.getSpacedPoints(130), t = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.55, 0.7), mat(0xa9a59a), pts.length * 2); stones.receiveShadow = true;
    let n = 0;
    pts.forEach((p, i) => { const nx = pts[Math.min(pts.length - 1, i + 1)], pv = pts[Math.max(0, i - 1)]; t.subVectors(nx, pv).normalize(); const ang = Math.atan2(t.x, t.z);
      for (const s of [-1, 1]) { const off = 2.9 + rnd() * 0.25; q.setFromAxisAngle(up, ang + (rnd() - 0.5) * 0.4); sc.set(0.7 + rnd() * 0.7, 1, 0.8 + rnd() * 0.5); m.compose(new THREE.Vector3(p.x + Math.cos(ang) * s * off, 0.5, p.z - Math.sin(ang) * s * off), q, sc); stones.setMatrixAt(n++, m); } });
    stones.count = n; root.add(stones); }
  const makeTree = (x, z, s, kind) => {
    const g = new THREE.Group();
    g.add(cyl(0.45, 0.65, 2.4, 0x6b4a2b, 0, 1.2, 0, 6));
    if (kind === 0) { for (let k = 0; k < 4; k++) g.add(mesh(new THREE.ConeGeometry(3.4 - k * 0.7, 3.4, 8), k % 2 ? 0x2a7d52 : 0x1f6b46, 0, 3.6 + k * 1.9, 0)); }
    else if (kind === 1) { g.add(ball(3, 0x3a9a55, 0, 4.6, 0), ball(2.2, 0x4aa65f, 1.5, 5.9, 0.6), ball(2, 0x256f3d, -1.6, 4, 0.5), ball(1.7, 0x56b86c, -0.4, 6.6, -0.4)); }
    else { g.add(ball(2.7, 0xe58aa8, 0, 4.6, 0), ball(1.9, 0xf2a6bf, 1.4, 5.6, 0.5), ball(1.8, 0xd4708f, -1.4, 4, 0.4)); } // a blossom tree
    g.position.set(x, 0, z); g.scale.setScalar(s); root.add(g);
  };
  const TREES = [[6, 52], [3, 60], [22, 56], [34, 66], [40, 84], [26, 90], [60, 90], [72, 82], [70, 60], [84, 44], [96, 50], [110, 56], [112, 82], [124, 70], [10, 30], [38, 20], [20, 16], [70, 22], [82, 12], [100, 30], [150, 46], [142, 52], [160, 46], [190, 52], [180, 46], [4, 92]];
  TREES.forEach(([x, z], i) => { const wx = x - 100, wz = z - 50; if (free(wx, wz, { road: 6, bld: 3 })) makeTree(wx, wz, 0.95 + rnd() * 0.45, i % 3 === 0 ? 0 : i % 7 === 0 ? 2 : 1); });
  for (let i = 0, placed = 0; i < 400 && placed < 46; i++) { const x = (rnd() - 0.5) * 196, z = (rnd() - 0.5) * 96; if (free(x, z, { road: 7, bld: 5 })) { makeTree(x, z, 0.8 + rnd() * 0.6, rnd() < 0.14 ? 2 : rnd() < 0.5 ? 0 : 1); placed++; } }
  for (let i = 0, placed = 0; i < 300 && placed < 26; i++) { const x = (rnd() - 0.5) * 196, z = (rnd() - 0.5) * 96; if (free(x, z, { road: 4.5, bld: 2 })) { const b = new THREE.Group(); b.add(ball(1.8, 0x3f9b57, 0, 0.8, 0), ball(1.2, 0x57b46c, -1, 0.7, 0.3), ball(1.1, 0x2f8a4c, 1, 0.6, -0.3)); b.position.set(x, 0, z); b.scale.setScalar(0.8 + rnd() * 0.6); root.add(b); placed++; } }
  for (let i = 0, placed = 0; i < 300 && placed < 22; i++) { const x = (rnd() - 0.5) * 196, z = (rnd() - 0.5) * 96; if (free(x, z, { road: 5, bld: 3 })) { const r = mesh(new THREE.DodecahedronGeometry(1, 0), i % 2 ? 0x8a8f9c : 0x767c8c, x, 0.4, z); r.scale.set(1 + rnd() * 1.4, 0.7 + rnd() * 0.8, 1 + rnd() * 1.2); r.rotation.y = rnd() * 3; root.add(r); placed++; } }
  { // flowers and grass tufts (instanced)
    const FL = [0xff7a9c, 0xffd166, 0xffffff, 0xc58bff, 0xff9a4a], flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 6, 5), new THREE.MeshToonMaterial({ gradientMap: grad }), 320);
    const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.36, 1.3, 4), new THREE.MeshToonMaterial({ color: 0x2f7d45, gradientMap: grad }), 520);
    const m = new THREE.Matrix4(), c = new THREE.Color(); let nf = 0, nt = 0;
    for (let i = 0; i < 4000 && (nf < 320 || nt < 520); i++) {
      const x = (rnd() - 0.5) * 196, z = (rnd() - 0.5) * 96;
      if (!free(x, z, { road: 3.8, bld: 0, margin: 2 })) continue;
      if (rnd() < 0.38 && nf < 320) { m.makeTranslation(x, 0.45, z); flowers.setMatrixAt(nf, m); flowers.setColorAt(nf++, c.setHex(FL[Math.floor(rnd() * FL.length)])); }
      else if (nt < 520) { m.compose(new THREE.Vector3(x, 0.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 3), new THREE.Vector3(1, 0.7 + rnd() * 0.9, 1)); tufts.setMatrixAt(nt++, m); }
    }
    flowers.count = nf; tufts.count = nt; flowers.instanceColor.needsUpdate = true; root.add(flowers, tufts);
  }
  // foam along the shoreline and a shimmer on the water
  const shore = new THREE.CatmullRomCurve3([[138, 80], [146, 72], [156, 78], [168, 84], [178, 76], [190, 70], [200, 74]].map(([x, z]) => new THREE.Vector3(x - 100, 0.22, z - 50)));
  const foam = ribbon(shore, 1.5, 0xffffff, 0.22, 60); foam.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }); root.add(foam);
  const sheen = flat(poly([[146, 98], [146, 86], [158, 84], [170, 90], [182, 84], [194, 80], [198, 98]]), 0x7fd0ff, 0.17, { transparent: true, opacity: 0.2, depthWrite: false }); root.add(sheen);

  // ---- small parts used by several buildings ----
  const glow = (c, e = c) => ({ emissive: e });
  const lamp = (x, z, h = 6) => { const g = new THREE.Group(); g.add(cyl(0.18, 0.26, h, 0x1d2740, 0, h / 2, 0, 6), box(0.9, 0.18, 0.9, 0x1d2740, 0, h, 0), ball(0.62, 0xffe9a0, 0, h + 0.55, 0)); g.children[2].material = mat(0xffe9a0, { emissive: 0xffd36a }); g.position.set(x, 0, z); return g; };
  const picket = (x0, z0, x1, z1, color = 0xf2ede0, h = 1.8) => {
    const g = new THREE.Group(), n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.9));
    for (let i = 0; i <= n; i++) { const t = i / n; g.add(box(0.28, h, 0.28, color, x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t)); }
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0);
    for (const y of [h * 0.38, h * 0.78]) { const r = box(len, 0.16, 0.2, color, (x0 + x1) / 2, y, (z0 + z1) / 2); r.rotation.y = -ang; g.add(r); }
    return g;
  };
  const crate = (x, z, s = 1.6, c = 0xb8854a) => { const g = new THREE.Group(); g.add(box(s, s, s, c, 0, s / 2, 0), box(s * 1.02, 0.14, s * 1.02, 0x7a5230, 0, s * 0.3, 0), box(s * 1.02, 0.14, s * 1.02, 0x7a5230, 0, s * 0.75, 0)); g.position.set(x, 0, z); return g; };
  const barrel = (x, z, c = 0x8a5a2e) => { const g = new THREE.Group(); g.add(cyl(0.8, 0.8, 1.7, c, 0, 0.85, 0, 10), cyl(0.84, 0.84, 0.14, 0x3a2a1a, 0, 0.45, 0, 10), cyl(0.84, 0.84, 0.14, 0x3a2a1a, 0, 1.25, 0, 10)); g.position.set(x, 0, z); return g; };
  const windows = (g, w, h, cols, rows, y0, z, seedA = 0) => { // a grid of window panes on a front face at depth z
    const pw = w / cols, ph = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lit = (r * 7 + c * 3 + seedA) % 4 !== 0;
      g.add(mesh(new THREE.BoxGeometry(pw * 0.55, ph * 0.55, 0.25), lit ? 0xffe39a : 0x2d3b5c, -w / 2 + pw * (c + 0.5), y0 + ph * (r + 0.5), z, lit ? { emissive: 0x8a6a1a } : undefined));
      g.add(box(pw * 0.7, 0.14, 0.34, 0xcfd6e6, -w / 2 + pw * (c + 0.5), y0 + ph * (r + 0.5) - ph * 0.32, z));
    }
  };
  const awning = (c1, c2, w = 7.6, d = 3.6) => { const a = new THREE.Group(); const n = Math.round(w / 1.2); for (let i = 0; i < n; i++) a.add(box(w / n, 0.3, d, i % 2 ? c2 : c1, -w / 2 + w / n * (i + 0.5), 0, 0)); a.rotation.x = -0.42; return a; };
  const flagTri = (c) => { const s = new THREE.Shape(); s.moveTo(-0.55, 0); s.lineTo(0.55, 0); s.lineTo(0, -1.1); s.closePath(); const m = shade(new THREE.Mesh(new THREE.ShapeGeometry(s), mat(c, { side: THREE.DoubleSide }))); return m; };

  // ---- one building (with its surroundings) per stop; each stands on y = 0 and faces +z ----
  const MODELS = {
    gate() { // the park entrance: stone pillars, an iron arch and sign, lamps, fences, flower beds, steps
      const g = new THREE.Group();
      for (const x of [-6, 6]) {
        g.add(box(3, 1, 3, 0xcfc8b6, x, 0.5, 0), box(2.3, 10.5, 2.3, 0xb9b2a2, x, 6.25, 0), box(3.1, 1, 3.1, 0xd4cdbc, x, 11.8, 0), ball(1.05, 0xd4cdbc, x, 13.1, 0));
        for (const y of [3.5, 6.5, 9.5]) g.add(box(2.4, 0.14, 2.4, 0x8d8676, x, y, 0));
      }
      const arch = mesh(new THREE.TorusGeometry(6, 0.42, 8, 24, Math.PI), 0x1d2740, 0, 11.5, 0); g.add(arch);
      const arch2 = mesh(new THREE.TorusGeometry(5.1, 0.2, 6, 24, Math.PI), 0x1d2740, 0, 11.5, 0); g.add(arch2);
      for (let i = 1; i < 8; i++) { const a = (i / 8) * Math.PI, x = Math.cos(a) * 5.55, y = 11.5 + Math.sin(a) * 5.55; g.add(box(0.16, 0.9, 0.16, 0x1d2740, x, y, 0)); }
      g.add(box(8, 2.4, 0.7, 0x7a4a12, 0, 17.2, 0), box(7.4, 1.9, 0.8, 0xffd166, 0, 17.2, 0.05), box(6.2, 0.25, 0.9, 0x7a4a12, 0, 17.2, 0.1));
      g.add(box(0.2, 3.4, 0.2, 0x1d2740, -3.2, 15.2, 0), box(0.2, 3.4, 0.2, 0x1d2740, 3.2, 15.2, 0));
      g.add(box(9, 0.45, 3.4, 0xcfc8b6, 0, 0.22, 2.2), box(8, 0.45, 3, 0xd8d1bf, 0, 0.55, 2.2));
      g.add(picket(-7.5, 0, -17, 0, 0x2b3a52, 3.6), picket(7.5, 0, 17, 0, 0x2b3a52, 3.6));
      g.add(lamp(-9, 3.6, 7), lamp(9, 3.6, 7), lamp(-19, 1, 6), lamp(19, 1, 6));
      for (const sx of [-1, 1]) {
        g.add(box(8, 0.7, 2.4, 0x6b4a2b, sx * 13, 0.35, 4.4));
        [0xff7a9c, 0xffd166, 0xffffff, 0xc58bff, 0xff7a9c, 0xffd166, 0xffffff].forEach((c, i) => g.add(ball(0.55, c, sx * 13 - 3.2 + i * 1.07, 1.1 + (i % 2) * 0.2, 4.4 + ((i * 3) % 3 - 1) * 0.5)));
        g.add(ball(1.6, 0x3f9b57, sx * 18.5, 0.9, 4.2));
      }
      return g;
    },
    pond() { // a duck pond: stone rim, lily pads, two ducks, reeds, a willow, a bench and a little jetty
      const g = new THREE.Group();
      const bank = cyl(13, 13.4, 1.0, 0x7a6a3c, 0, 0.45, 0, 28); g.add(bank);
      const water = cyl(11.8, 11.8, 0.3, 0x3fa3e0, 0, 0.95, 0, 28); water.castShadow = false; g.add(water);
      const sheen = cyl(8.6, 8.6, 0.3, 0x6fcaf2, -1, 1.0, 0.5, 24); sheen.castShadow = false; sheen.material = mat(0x6fcaf2, { transparent: true, opacity: 0.55 }); g.add(sheen);
      for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, r = 12.4 + (i % 3) * 0.25; const s = ball(0.75 + (i % 4) * 0.13, i % 2 ? 0x8a8f9c : 0xa2a7b4, Math.cos(a) * r, 0.7, Math.sin(a) * r); s.scale.y = 0.65; g.add(s); }
      for (const [x, z, r] of [[-4, 2, 1.9], [4.4, -3.5, 1.5], [1.5, 5.5, 1.7], [-6, -3, 1.4]]) {
        g.add(cyl(r, r, 0.2, 0x3ea35a, x, 1.2, z, 12)); g.add(ball(0.42, 0xff8fb0, x + 0.3, 1.5, z - 0.2));
      }
      const makeDuck = (c, bill, x, z, ph) => {
        const d = new THREE.Group();
        d.add(ball(1.5, c, 0, 1.6, 0), ball(0.95, c, 1.0, 2.9, 0), ball(0.7, c, -1.4, 1.9, 0)); // body, head, tail
        const beak = mesh(new THREE.ConeGeometry(0.3, 0.8, 6), bill, 2.0, 2.8, 0); beak.rotation.z = -Math.PI / 2; d.add(beak);
        d.add(ball(0.13, 0x111111, 1.45, 3.05, 0.55), ball(0.13, 0x111111, 1.45, 3.05, -0.55));
        d.position.set(x, 0.85, z); d.userData = { anim: 'duck', ph, x, z }; return d;
      };
      g.add(makeDuck(0xffffff, 0xff9a2e, -1.5, -1, 0), makeDuck(0xffe27a, 0xff9a2e, 3, 2.5, 2));
      const ring = mesh(new THREE.TorusGeometry(3.4, 0.1, 4, 28), 0xd7f1ff, -1.5, 1.2, -1, { transparent: true, opacity: 0.8 }); ring.rotation.x = Math.PI / 2; ring.userData.anim = 'ripple'; g.add(ring);
      for (let i = 0; i < 9; i++) { const a = 2.4 + i * 0.16, x = Math.cos(a) * 12.4, z = Math.sin(a) * 12.4; g.add(cyl(0.07, 0.1, 3.4 + (i % 3), 0x5c8f3a, x, 2.3, z, 5), cyl(0.2, 0.2, 1.1, 0x6b4a2b, x, 4.3 + (i % 3) * 0.5, z, 6)); }
      const willow = new THREE.Group(); // a willow on the left bank
      willow.add(cyl(0.7, 1.1, 5, 0x6b4a2b, 0, 2.5, 0, 7), ball(4.2, 0x6bbf5a, 0, 6.2, 0));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; willow.add(cyl(0.08, 0.14, 4.2, 0x4a9a46, Math.cos(a) * 3.6, 3.7, Math.sin(a) * 3.6, 4)); }
      willow.position.set(-14, 0, -3); g.add(willow);
      g.add(box(3.4, 0.3, 1.2, 0x8a5a2e, 15.5, 1.1, 3), box(0.25, 1.1, 0.25, 0x5a3d22, 14, 0.55, 3), box(0.25, 1.1, 0.25, 0x5a3d22, 17, 0.55, 3), box(3.4, 1.4, 0.2, 0x8a5a2e, 15.5, 1.9, 2.5)); // bench
      return g;
    },
    market() { // a paved square: three striped stalls, bunting, crates, barrels, a fountain and a lamp
      const g = new THREE.Group();
      g.add(box(32, 0.5, 18, 0xd9c7a0, 0, 0.25, 0));
      for (let i = -3; i <= 3; i++) g.add(box(0.12, 0.1, 18, 0xb8a37c, i * 4.4, 0.55, 0));
      for (let i = -2; i <= 2; i++) g.add(box(32, 0.1, 0.12, 0xb8a37c, 0, 0.55, i * 3.6));
      const stall = (x, c1, c2, goods) => {
        const s = new THREE.Group();
        s.add(box(8.4, 3.2, 3.8, 0x7a5230, 0, 1.9, 0), box(8.8, 0.5, 4.2, 0x9a6d3f, 0, 3.7, 0.1));
        for (const px of [-4, 4]) s.add(cyl(0.22, 0.22, 8.2, 0x5a3d22, px, 4.5, 2, 6), cyl(0.22, 0.22, 7, 0x5a3d22, px, 3.9, -1.9, 6));
        const aw = awning(c1, c2); aw.position.set(0, 8.2, 0.1); s.add(aw);
        s.add(box(8.6, 0.5, 0.3, c1, 0, 7.4, 2.1)); // valance
        goods.forEach((c, i) => s.add(ball(0.72, c, -3 + i * 1.5, 4.5, 1.2)));
        s.add(box(2.4, 1.6, 0.3, 0xf4eed2, 0, 5.5, -1.7)); // a price board on the back
        s.position.set(x, 0.5, -3); return s;
      };
      g.add(stall(-10, 0xe0524d, 0xffffff, [0xe8483b, 0xffd166, 0x7ac74f, 0xe8483b, 0xffd166, 0x7ac74f]), stall(0, 0x2f7fd0, 0xffffff, [0xff8fb0, 0xffd166, 0xffffff, 0xff8fb0, 0xffd166]), stall(10, 0xf2a93b, 0xffffff, [0x7ac74f, 0xe8483b, 0x7ac74f, 0xe8483b, 0x7ac74f, 0xffd166]));
      g.add(crate(-15, 5), crate(-13.2, 5.6, 1.3, 0xa9763f), crate(-14.2, 5.2, 1.2, 0xb8854a), barrel(14.5, 5), barrel(16, 4.2, 0x6b4a2b), crate(15.2, 6.3, 1.4));
      const pole1 = cyl(0.2, 0.2, 10, 0x5a3d22, -15.5, 5.5, 3, 6), pole2 = cyl(0.2, 0.2, 10, 0x5a3d22, 15.5, 5.5, 3, 6); g.add(pole1, pole2);
      for (let i = 0; i <= 12; i++) { const t = i / 12, x = -15.5 + 31 * t, y = 10 - Math.sin(t * Math.PI) * 2.2; const f = flagTri([0xff7a9c, 0xffd166, 0x6bd0ff, 0x7ac74f][i % 4]); f.position.set(x, y, 3); g.add(f); }
      const fount = new THREE.Group(); fount.add(cyl(2.6, 2.8, 0.9, 0xb9b2a2, 0, 0.95, 0, 16), cyl(2.1, 2.1, 0.3, 0x4fb3e8, 0, 1.4, 0, 16), cyl(0.4, 0.5, 2.6, 0xb9b2a2, 0, 2.2, 0, 8), ball(0.55, 0x9fe8ff, 0, 3.7, 0)); fount.position.set(0, 0, 6); g.add(fount);
      g.add(lamp(-17, 6.5, 6), lamp(17, -7, 6));
      return g;
    },
    rooftop() { // an apartment block with a tennis court on its roof, a water tank, neighbours and a street lamp
      const g = new THREE.Group();
      g.add(box(20, 13, 9, 0x8aa0c4, 0, 6.5, 0), box(20.6, 0.8, 9.6, 0xa8bbd8, 0, 13.4, 0));
      windows(g, 17, 9, 5, 3, 3.2, 4.6);
      g.add(box(2.6, 3.2, 0.4, 0x3a2a1a, 0, 1.6, 4.7), box(3.6, 0.4, 1.4, 0xe0524d, 0, 3.5, 5.2), box(2, 2.6, 0.2, 0x7a5a3a, 0, 1.4, 4.9));
      g.add(box(18.6, 0.5, 8.2, 0x3b7fbf, 0, 14, 0));
      for (const [w, d, x, z] of [[18.4, 0.14, 0, 3.8], [18.4, 0.14, 0, -3.8], [0.14, 7.8, -9, 0], [0.14, 7.8, 9, 0], [0.14, 7.8, 0, 0], [9.2, 0.14, -4.6, 1.8], [9.2, 0.14, 4.6, 1.8]]) g.add(box(w, 0.08, d, 0xffffff, x, 14.3, z));
      g.add(box(0.3, 2.4, 0.3, 0xdddddd, -9.2, 15.4, 0), box(0.3, 2.4, 0.3, 0xdddddd, 9.2, 15.4, 0), mesh(new THREE.PlaneGeometry(18.4, 1.6), 0xffffff, 0, 15.9, 0, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), box(18.6, 0.14, 0.14, 0xffffff, 0, 16.7, 0));
      for (const x of [-9.8, 9.8]) for (const z of [-4.4, 4.4]) g.add(cyl(0.1, 0.1, 3, 0x2b3a52, x, 15.5, z, 5));
      g.add(mesh(new THREE.PlaneGeometry(20, 2.6), 0x2b3a52, 0, 15.6, 4.7, { transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
      g.add(ball(0.5, 0xd8ff3a, 3, 15.2, 1.4));
      const tank = new THREE.Group(); tank.add(cyl(1.9, 1.9, 3.2, 0x9a6d3f, 0, 3.8, 0, 12), mesh(new THREE.ConeGeometry(2.1, 1.3, 12), 0x6d4a2b, 0, 6.05, 0), ...[-1.3, 1.3].flatMap((x) => [-1.3, 1.3].map((z) => cyl(0.12, 0.12, 2.4, 0x5a3d22, x, 1.2, z, 4)))); tank.position.set(-6.5, 14.2, -2); g.add(tank);
      g.add(box(1.8, 1.3, 1.6, 0xb9b2a2, 7.5, 15, -3), box(1.4, 1, 1.2, 0xcfd6e6, 5.4, 14.8, -3));
      g.add(cyl(0.1, 0.1, 5, 0x2b3a52, 8.6, 16.5, -3.4, 5), box(2, 0.1, 0.1, 0x2b3a52, 8.6, 18, -3.4), box(1.4, 0.1, 0.1, 0x2b3a52, 8.6, 17.2, -3.4));
      for (const [x, h, c, s] of [[-17.5, 9, 0x6a7a99, 0], [-17.5 + 0.0, 0, 0, 0], [17, 7, 0x56688a, 1]]) if (h) { const sg = new THREE.Group(); sg.add(box(9, h, 7, c, 0, h / 2, 0), box(9.4, 0.5, 7.4, 0xa8bbd8, 0, h + 0.2, 0)); windows(sg, 7, h - 2, 3, Math.max(2, Math.round((h - 2) / 3)), 1.4, 3.6, s + 2); sg.position.set(x, 0, -1); g.add(sg); }
      g.add(lamp(-12.5, 6, 6));
      return g;
    },
    harbour() { // a wooden pier with a sailboat, a fishing boat, crates, a crane and a striped lighthouse
      const g = new THREE.Group();
      g.add(box(7, 0.9, 20, 0x8a5d34, 0, 1.1, 8));
      for (let i = 0; i < 16; i++) g.add(box(7, 0.06, 0.12, 0x6d4a2b, 0, 1.58, 0.5 + i * 1.2));
      for (let i = 0; i < 6; i++) for (const sx of [-3.4, 3.4]) g.add(cyl(0.3, 0.3, 3.2, 0x5a3d22, sx, 0.9, 0.6 + i * 3.6, 6));
      g.add(crate(-1.6, 3), crate(-2, 5, 1.2, 0xa9763f), barrel(2, 4), barrel(2.4, 5.6, 0x6b4a2b), crate(1.6, 8.4, 1.4));
      const crane = new THREE.Group(); crane.add(box(0.5, 7, 0.5, 0x2b3a52, 0, 3.5, 0), box(5.6, 0.4, 0.4, 0x2b3a52, 2.2, 7, 0), cyl(0.03, 0.03, 2.6, 0xdddddd, 4.6, 5.6, 0, 4), box(0.7, 0.5, 0.7, 0xffd166, 4.6, 4.2, 0)); crane.position.set(-2.6, 1.5, 12.5); g.add(crane);
      const sailboat = new THREE.Group();
      const hull = mesh(new THREE.CylinderGeometry(4.4, 2.8, 2, 4), 0xe0524d, 0, 1.2, 0); hull.rotation.y = Math.PI / 4; hull.scale.set(1.6, 1, 0.55); sailboat.add(hull);
      sailboat.add(box(11, 0.3, 0.12, 0xffffff, 0, 2.05, 1.7), box(3, 1.3, 1.8, 0xf2e4c0, -1.5, 2.7, 0), box(3.2, 0.2, 2, 0x7a4a12, -1.5, 3.4, 0), cyl(0.17, 0.17, 12, 0x6d4a2b, 1.5, 8, 0, 6));
      const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(5.6, 0); sail.lineTo(0, 10); sail.closePath();
      const sm = mesh(new THREE.ShapeGeometry(sail), 0xffffff, 1.7, 2.4, 0, { side: THREE.DoubleSide }); sm.userData.anim = 'sail'; sailboat.add(sm);
      const jib = new THREE.Shape(); jib.moveTo(0, 0); jib.lineTo(-4.4, 0); jib.lineTo(0, 7.6); jib.closePath();
      sailboat.add(mesh(new THREE.ShapeGeometry(jib), 0xf2e4c0, 1.3, 2.4, 0, { side: THREE.DoubleSide }), box(1.5, 0.9, 0.1, 0xffd166, 2.3, 14.2, 0));
      sailboat.position.set(10, 0.2, 10); sailboat.rotation.y = -0.35; sailboat.userData.anim = 'bob'; g.add(sailboat);
      const fish = new THREE.Group();
      const fh = mesh(new THREE.CylinderGeometry(2.6, 1.8, 1.4, 4), 0xf2a93b, 0, 0.8, 0); fh.rotation.y = Math.PI / 4; fh.scale.set(1.5, 1, 0.55); fish.add(fh, box(1.6, 1.4, 1.4, 0xf4eed2, 0.4, 1.8, 0), box(1.9, 0.14, 1.7, 0x6d4a2b, 0.4, 2.55, 0));
      fish.position.set(-9, 0.2, 14); fish.rotation.y = 0.5; fish.userData.anim = 'bob'; g.add(fish);
      for (const [x, z, c] of [[5, 18, 0xe0524d], [-4, 20, 0xffffff], [13, 17, 0xf2a93b]]) { const b = new THREE.Group(); b.add(ball(0.55, c, 0, 0.3, 0), cyl(0.07, 0.07, 1.4, 0x2b3a52, 0, 1.1, 0, 4)); b.position.set(x, 0.1, z); b.userData.anim = 'bob'; g.add(b); }
      const lh = new THREE.Group(); // the lighthouse stands on the headland behind the pier
      lh.add(cyl(4.6, 5.2, 1.4, 0x8a8f9c, 0, 0.7, 0, 12), cyl(2.6, 3.8, 20, 0xffffff, 0, 11.4, 0, 14));
      for (const y of [6, 14]) lh.add(cyl(3.28 - (y / 20) * 1.0, 3.5 - (y / 20) * 1.0, 3.4, 0xe0524d, 0, y + 1, 0, 14));
      lh.add(cyl(3.5, 3.5, 0.5, 0x2b3a52, 0, 21.7, 0, 14), mesh(new THREE.CylinderGeometry(2.1, 2.1, 3, 12), 0xffe9a0, 0, 23.4, 0, { emissive: 0xffd36a }), mesh(new THREE.ConeGeometry(2.8, 3, 12), 0xe0524d, 0, 26.4, 0), box(0.8, 1.4, 0.15, 0x2b3a52, 0, 2.4, 3.8), box(0.6, 0.9, 0.15, 0x2b3a52, 0, 8, 2.9), box(0.6, 0.9, 0.15, 0x2b3a52, 0, 15, 2.6));
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 13, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      const bpivot = new THREE.Group(); bpivot.position.set(0, 23.4, 0); beam.rotation.z = -Math.PI / 2; beam.position.set(7, 0, 0); bpivot.add(beam); bpivot.userData.anim = 'beam'; lh.add(bpivot);
      lh.position.set(15, 0, -3); g.add(lh);
      g.add(lamp(-4.6, 2, 5), lamp(4.6, 12, 5));
      return g;
    },
    roost() { // Hoot's clock tower on a rocky outcrop: banded stone shaft, lit windows, two clock faces, battlements and the owl
      const g = new THREE.Group();
      for (const [x, z, r, h, c] of [[0, 0, 9.5, 5, 0x6a6486], [-6, 2, 5, 4, 0x59608a], [6, 3, 5.5, 3.6, 0x59608a], [-2, 6, 4, 2.6, 0x6a6486]]) g.add(mesh(new THREE.ConeGeometry(r, h, 7), c, x, h / 2, z));
      g.add(box(8.4, 4, 8.4, 0x7d7896, 0, 6.5, 0));
      g.add(box(6.6, 22, 6.6, 0x8e8aa0, 0, 19.5, 0));
      for (const y of [11, 17, 23, 29]) g.add(box(7.1, 0.5, 7.1, 0xa6a2b8, 0, y, 0));
      g.add(box(8.8, 1.6, 8.8, 0xa6a2b8, 0, 31, 0));
      for (let i = 0; i < 12; i++) { const side = i % 4, k = Math.floor(i / 4) - 1; const x = side === 0 ? k * 2.6 : side === 1 ? k * 2.6 : side === 2 ? -4.2 : 4.2, z = side === 0 ? 4.2 : side === 1 ? -4.2 : k * 2.6; g.add(box(1.3, 1.3, 1.3, 0xb9b2c8, x, 32.3, z)); }
      g.add(box(5.4, 5.6, 5.4, 0x8e8aa0, 0, 34.2, 0), box(6.4, 0.7, 6.4, 0xa6a2b8, 0, 37.3, 0));
      const roof = mesh(new THREE.ConeGeometry(5.2, 8, 4), 0x4a3f72, 0, 41.5, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      g.add(cyl(0.12, 0.12, 3, 0xffd23a, 0, 46.5, 0, 5), ball(0.45, 0xffd23a, 0, 48.2, 0));
      for (const [px, pz, ry] of [[0, 3.4, 0], [3.4, 0, Math.PI / 2]]) {
        const face = new THREE.Group(); face.add(cyl(2.3, 2.3, 0.4, 0xf4eed2, 0, 0, 0, 24), cyl(2.45, 2.45, 0.3, 0x3a3160, 0, 0, -0.1, 24));
        face.children[0].rotation.x = face.children[1].rotation.x = Math.PI / 2;
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; face.add(box(0.14, k % 3 ? 0.3 : 0.55, 0.12, 0x2b2342, Math.sin(a) * 1.85, Math.cos(a) * 1.85, 0.3)); }
        const hand1 = box(0.2, 1.7, 0.12, 0x2b2342, 0, 0.8, 0.32), hand2 = box(1.2, 0.2, 0.12, 0x2b2342, 0.55, 0, 0.32); face.add(hand1, hand2);
        face.position.set(px, 25.5, pz); face.rotation.y = ry; g.add(face);
      }
      for (const y of [14, 19.5]) for (const x of [-1.6, 1.6]) { g.add(box(1.0, 2.2, 0.3, 0x2b2342, x, y, 3.36), mesh(new THREE.BoxGeometry(0.7, 1.8, 0.2), 0xffd36a, x, y, 3.42, { emissive: 0x8a6a1a })); }
      for (const x of [-1.3, 1.3]) g.add(mesh(new THREE.BoxGeometry(1.0, 2.6, 0.3), 0x2b2342, x, 34.4, 2.76), mesh(new THREE.BoxGeometry(0.7, 2.2, 0.2), 0xffd36a, x, 34.4, 2.8, { emissive: 0x8a6a1a }));
      g.add(box(2.2, 3.2, 0.4, 0x3a3160, 0, 6.2, 4.3), box(1.6, 0.5, 2, 0x8a8f9c, 0, 4.6, 5.2), box(3.4, 0.5, 2.6, 0x8a8f9c, 0, 4.2, 5.8));
      const owl = new THREE.Group();
      owl.add(ball(1.7, 0x5b4632, 0, 0, 0), ball(1.1, 0x8a6e50, 0, -0.3, 1.1), ball(0.42, 0xffd23a, -0.62, 0.35, 1.4), ball(0.42, 0xffd23a, 0.62, 0.35, 1.4), ball(0.18, 0x111111, -0.62, 0.35, 1.78), ball(0.18, 0x111111, 0.62, 0.35, 1.78));
      const beak = mesh(new THREE.ConeGeometry(0.28, 0.6, 4), 0xff9a2e, 0, -0.15, 1.7); beak.rotation.x = Math.PI / 2; owl.add(beak);
      for (const sx of [-1, 1]) { const ear = mesh(new THREE.ConeGeometry(0.4, 0.9, 4), 0x5b4632, sx * 1.0, 1.6, 0); owl.add(ear); owl.add(mesh(new THREE.SphereGeometry(0.8, 8, 6), 0x4a3828, sx * 1.6, -0.3, 0)); }
      owl.position.set(0, 44.6, 0); owl.scale.setScalar(1); g.add(owl);
      g.add(lamp(-7, 7, 5), lamp(9, 5, 5));
      return g;
    },
  };

  const anims = [];
  const emblems = KEYS.map((key, i) => {
    const model = MODELS[key]();
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.position.set(zones[i].x, 0, zones[i].z);
    wrap.scale.setScalar(SCALE[key]);
    root.add(wrap);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } if (o.userData.anim) anims.push({ o, kind: o.userData.anim, x: o.position.x, y: o.position.y, z: o.position.z, ph: o.userData.ph ?? 0, rz: o.rotation.z, ry: o.rotation.y }); });
    const R = ZONE[key] * 0.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(wrap.position.x, 0.7, wrap.position.z); ring.scale.set(R, R, 1); root.add(ring);
    const top = HEIGHT[key] * SCALE[key] + 7;
    const beam = mesh(new THREE.ConeGeometry(2.6, 5.5, 4), 0xffe27a, wrap.position.x, top, wrap.position.z, { emissive: 0x7a5a00 }); beam.rotation.x = Math.PI; beam.castShadow = false; root.add(beam);
    const star = mesh(new THREE.OctahedronGeometry(2.8, 0), 0xffd23a, wrap.position.x, top, wrap.position.z, { emissive: 0x6a4a00 }); star.scale.y = 1.4; star.castShadow = false; root.add(star);
    return { key, i, model, wrap, ring, beam, star, R, top };
  });

  const grey = new THREE.Color(0x7d8394);
  let curStage = stage;
  const applyStage = () => {
    for (const e of emblems) {
      const st = stopState(e.i, curStage);
      e.ring.visible = e.beam.visible = st === 'now'; e.star.visible = st === 'done';
      e.model.traverse((o) => {
        if (!o.isMesh || o.userData.noDim) return;
        if (!o.userData.orig) o.userData.orig = o.material;
        if (st === 'lock') { if (!o.userData.dim) { o.userData.dim = o.material.clone(); o.userData.dim.color.lerp(grey, 0.5); } o.material = o.userData.dim; } else o.material = o.userData.orig;
      });
    }
  };
  applyStage();

  // ---- the DOM pins and the token ride on the projected ground ----
  let els = null, walk = null, tokenIdx = stage, px = 0, py = 0, sx = 0, sy = 0, clock = 0, disposed = false;
  const v = new THREE.Vector3();
  const screenOf = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * 100, (-v.y * 0.5 + 0.5) * 100]; };
  const roadPoint = (idx) => { // a fractional stop index to a point on the road
    const lo = Math.max(0, Math.min(STOPS.length - 1, Math.floor(idx))), hi = Math.min(STOPS.length - 1, lo + 1), f = idx - lo;
    return road.getPoint(roadT[lo] + (roadT[hi] - roadT[lo]) * f);
  };
  const place = () => {
    if (!els) return;
    els.nodes.forEach((n, i) => { const [l, t] = screenOf(stopPos[i].x, 0.5, stopPos[i].z); n.style.left = `${l}%`; n.style.top = `${t}%`; });
    if (els.token) { const p = roadPoint(tokenIdx), [l, t] = screenOf(p.x, 0.5, p.z); els.token.style.left = `${l}%`; els.token.style.top = `${t}%`; }
  };
  const resize = () => {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 400;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
  };
  resize();

  return {
    canvas, road,
    /** Hand over the page's stop pins (in order) and the token; their left/top are then driven here. */
    bind(nodes, token) { els = { nodes: [...nodes], token }; if (token) token.style.transition = 'none'; },
    setPointer(x, y) { px = x; py = y; },
    setStage(s) { curStage = s; applyStage(); },
    /** Walk the token from one stop to another (about 1.3 s); the stage changes when it arrives. */
    walkTo(from, to, secs = 1.3) { walk = { from, to, t: 0, secs }; tokenIdx = from; },
    resize,
    update(dt) {
      clock += dt;
      sx += (px - sx) * Math.min(1, dt * 3); sy += (py - sy) * Math.min(1, dt * 3);
      const ix = calm ? 0 : Math.sin(clock * 0.2) * 3, iy = calm ? 0 : Math.cos(clock * 0.17) * 1.5;
      camera.position.set(sx * 16 + ix, 114 - sy * 6 + iy, 120);
      camera.lookAt(0, -2, 4);
      if (walk) { walk.t += dt; const f = walk.t / walk.secs; tokenIdx = walkIndex(walk.from, walk.to, f); if (f >= 1) { tokenIdx = walk.to; walk = null; } }
      if (!calm) {
        for (const e of emblems) {
          if (e.ring.visible) { const k = (clock * 0.8) % 1; e.ring.scale.set(e.R * (1 + k * 0.35), e.R * (1 + k * 0.35), 1); e.ring.material.opacity = 0.5 * (1 - k); e.beam.position.y = e.top + Math.abs(Math.sin(clock * 3)) * 3; e.beam.rotation.y = clock * 2; }
          if (e.star.visible) { e.star.rotation.y = clock * 2; e.star.position.y = e.top + Math.sin(clock * 2.4 + e.i) * 0.8; }
        }
        for (const a of anims) {
          const o = a.o;
          if (a.kind === 'duck') { const u = clock * 0.45 + a.ph; o.position.x = a.x + Math.cos(u) * 3.4; o.position.z = a.z + Math.sin(u) * 2.4; o.rotation.y = -Math.atan2(Math.cos(u) * 2.4, -Math.sin(u) * 3.4); o.position.y = 0.85 + Math.sin(clock * 2.2 + a.ph) * 0.1; }
          else if (a.kind === 'ripple') { const k = (clock * 0.6) % 1; o.scale.setScalar(1 + k * 0.4); o.material.opacity = 0.8 * (1 - k); }
          else if (a.kind === 'sail') o.rotation.y = Math.sin(clock * 1.3) * 0.2;
          else if (a.kind === 'bob') { o.position.y = a.y + Math.sin(clock * 1.4 + a.x) * 0.3; o.rotation.z = a.rz + Math.sin(clock * 1.1 + a.x) * 0.04; }
          else if (a.kind === 'beam') o.rotation.y = clock * 1.1;
        }
        waves.forEach((w, i) => { w.position.y = 0.3 + Math.sin(clock * 1.6 + i) * 0.15; });
        sheen.material.opacity = 0.16 + Math.sin(clock * 1.2) * 0.07; foam.material.opacity = 0.5 + Math.sin(clock * 1.7) * 0.2;
      }
      camera.updateMatrixWorld();
      place();
    },
    render() { if (!disposed) renderer.render(scene, camera); },
    dispose() { disposed = true; renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose?.(); }); },
  };
}
