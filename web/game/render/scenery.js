// Outside the stadium: a gradient sky with a sun (or stars at night), puffy clouds, distant hills and a ring of trees.
import * as THREE from 'three';
import * as tex from './textures.js';

const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
let seedV = 1;
const rnd = () => { seedV = (seedV * 1664525 + 1013904223) >>> 0; return seedV / 4294967296; };

function skyDome(theme) {
  const night = theme.time === 'night', dusk = theme.time === 'sunset' || theme.time === 'dusk';
  const top = night ? new THREE.Color(0x070b24) : dusk ? new THREE.Color(0x3b3f9a) : mix(theme.sky, 0x2f6fd8, 0.65);
  const horizon = night ? new THREE.Color(0x3a3f78) : dusk ? new THREE.Color(0xffa24a) : mix(theme.sky, 0xfff2d8, 0.6);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: top }, horizon: { value: horizon }, night: { value: night ? 1 : 0 },
      sunDir: { value: (dusk ? new THREE.Vector3(-0.3, 0.09, 0.95) : new THREE.Vector3(-0.45, 0.45, 0.77)).normalize() }, sunCol: { value: new THREE.Color(night ? 0xdfe6ff : dusk ? 0xff7a2a : 0xfff2b0) }, dusk: { value: dusk ? 1 : 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunCol; uniform vec3 sunDir; uniform float night; uniform float dusk; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vP);
        float t = clamp(d.y * 1.6, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(t, 0.7));
        if (dusk > 0.5) { c = mix(c, vec3(0.95,0.3,0.45), smoothstep(0.05, 0.35, d.y) * 0.55); c = mix(c, vec3(0.35,0.25,0.6), smoothstep(0.3, 0.9, d.y)); }
        float s = max(dot(d, sunDir), 0.0);
        c += sunCol * (pow(s, 600.0) * 1.6 + pow(s, 24.0) * 0.28 + dusk * pow(s, 6.0) * 0.35);       // disc and glow (the moon at night)
        if (night > 0.5) { vec2 g = floor(vec2(atan(d.x, d.z) * 90.0, d.y * 90.0)); float st = step(0.992, h(g)) * smoothstep(0.1, 0.4, d.y); c += vec3(st); }
        gl_FragColor = vec4(pow(c, vec3(1.0/2.2)), 1.0);  // rendered into a linear target like everything else
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(105, 24, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.userData.mat = mat; m.userData.from = { top: top.clone(), horizon: horizon.clone(), sun: mat.uniforms.sunCol.value.clone() };
  return m;
}

function puff(mat) { // a cloud: a few overlapping flattened spheres
  const g = new THREE.Group();
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const r = 2.4 + rnd() * 2.2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    s.position.set((i - n / 2) * 3.2 + rnd() * 1.5, rnd() * 1.2, rnd() * 2);
    s.scale.set(1.3, 0.62, 1);
    g.add(s);
  }
  return g;
}

function tree(trunkMat, leafMats, kind) {
  const g = new THREE.Group();
  const h = 5 + rnd() * 5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h * 0.45, 5), trunkMat);
  trunk.position.y = h * 0.22;
  g.add(trunk);
  const leaf = leafMats[Math.floor(rnd() * leafMats.length)];
  if (kind === 0) { // round tree
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1 - i * 0.35, 0), leaf);
      s.position.set((rnd() - 0.5) * 0.8, h * 0.55 + i * 1.5, (rnd() - 0.5) * 0.8);
      g.add(s);
    }
  } else { // pine: stacked cones
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(2.3 - i * 0.45, 2.6, 6), leaf);
      c.position.y = h * 0.35 + i * 1.7;
      g.add(c);
    }
  }
  g.rotation.y = rnd() * 6.28;
  g.scale.setScalar(0.7 + rnd() * 0.45);
  return g;
}

/** theme: a court theme (sky colour decides day or night). Returns { group, update(dt) }. */
export function buildScenery(grad, theme) {
  seedV = 7;
  const night = theme.time === 'night', dusk = theme.time === 'sunset' || theme.time === 'dusk';
  const group = new THREE.Group();
  const dome = skyDome(theme);
  group.add(dome);
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });

  // clouds drift slowly; a night sky gets few and dim
  const cloudMat = new THREE.MeshBasicMaterial({ color: night ? 0x5a6290 : dusk ? 0xffb89a : 0xffffff, transparent: true, opacity: night ? 0.5 : 0.92, depthWrite: false });
  const clouds = [];
  for (let i = 0; i < (night ? 4 : 9); i++) {
    const c = puff(cloudMat);
    c.position.set(-80 + i * 20 + rnd() * 10, 26 + rnd() * 18, -70 + rnd() * 140);
    group.add(c); clouds.push(c);
  }

  // layered hills on the horizon
  const hills = [[0x3d7a52, 62, 11], [0x2f6646, 74, 15]].map(([c, d, h]) => [night ? mix(c, 0x0a1428, 0.7).getHex() : dusk ? mix(c, 0x5a2a50, 0.5).getHex() : c, d, h]);
  const parkLook = theme.id === 'loxford';
  if (parkLook) {
    // open field out to the horizon instead of hills: a big flat meadow, with a darker band of rough grass at the far edge
    const meadow = night ? 0x16381f : dusk ? 0x5a7a3a : 0x6fae52, rough = night ? 0x102c18 : dusk ? 0x46662f : 0x569a45;
    const field = new THREE.Mesh(new THREE.CircleGeometry(100, 48), new THREE.MeshToonMaterial({ color: meadow, gradientMap: grad, map: tex.grass([60, 60], 17) }));
    field.rotation.x = -Math.PI / 2; field.position.y = -0.14;
    group.add(field);
    const edge = new THREE.Mesh(new THREE.RingGeometry(78, 100, 48), new THREE.MeshToonMaterial({ color: rough, gradientMap: grad, map: tex.grass([40, 8], 23) }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = -0.12;
    group.add(edge);
  } else
  hills.forEach(([c, d, h], layer) => {
    const m = toon(c);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + layer * 0.2;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), m);
      hill.scale.set(16 + rnd() * 10, h * (0.6 + rnd() * 0.6), 14);
      hill.position.set(Math.sin(a) * d, -2, Math.cos(a) * d);
      group.add(hill);
    }
  });

  // a ring of trees outside the stands
  const trunk = toon(night ? 0x2a1d14 : 0x6b4a2b);
  const leaves = (dusk ? [0x4a7a3a, 0x6a8a3a, 0x3a6a3a, 0x8a8a3a] : night ? [0x14391f, 0x1a4a2a, 0x0f2f1d] : [0x2f8f3f, 0x3fa94c, 0x1f7a3a, 0x5bb54f]).map(toon);
  const park = theme.id === 'loxford'; // a park: the trees crowd right up to the fence, bigger and many more
  const treeN = park ? 150 : 90;
  for (let i = 0; i < treeN; i++) {
    const a = (i / treeN) * Math.PI * 2 + (rnd() - 0.5) * 0.06;
    const d = park ? 36 + rnd() * 12 : 34 + rnd() * 16;
    const t = tree(trunk, leaves, rnd() < 0.55 ? 0 : 1);
    t.position.set(Math.sin(a) * d * 0.82, -0.2, Math.cos(a) * d * 1.15); // a little longer along the court
    group.add(t);
  }
  return {
    group,
    update(dt) { clouds.forEach((c) => { c.position.x += dt * 0.8; if (c.position.x > 90) c.position.x = -90; }); },
    /** Dusk to Night: u 0 (sunset) .. 1 (night). Moves the sky colours, brings up the stars and the moon. */
    setDusk(u) {
      const mat = dome.userData.mat, f = dome.userData.from;
      mat.uniforms.top.value.copy(f.top).lerp(new THREE.Color(0x070b24), u);
      mat.uniforms.horizon.value.copy(f.horizon).lerp(new THREE.Color(0x3a3f78), u);
      mat.uniforms.sunCol.value.copy(f.sun).lerp(new THREE.Color(0xdfe6ff), u);
      mat.uniforms.night.value = u > 0.5 ? 1 : 0;
      mat.uniforms.dusk.value = 1 - u;
      cloudMat.color.copy(new THREE.Color(0xffb89a)).lerp(new THREE.Color(0x5a6290), u);
    },
  };
}
