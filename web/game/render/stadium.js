import * as THREE from 'three';
import * as tex from './textures.js';
import { COURT, toThree } from './court.js';

const FUR = [0xf29a3a, 0x9aa3b5, 0xf4efe6, 0x4a4252, 0xd9a066, 0xc9d3e6];
const SHIRT = [0xe63946, 0x2d6bd6, 0xffd166, 0x3ddc97, 0xb38cff, 0xff8fb1];

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// Stands: three tiers behind each long side and the two ends.
const SIDE_X = COURT.doublesHalfW + 5;
const END_Z = COURT.halfLen + 7;
const ENDS = ['MEOW CUP', 'PURR-FECT'];
const SIDES = ['CATNIP COLA', 'WHISKER SPORTS'];

/** Deterministic crowd positions: [{x, y, z, fur, shirt, phase}] in core coordinates. */
export function crowdLayout(seed) {
  const r = rng(seed);
  const out = [];
  for (let tier = 0; tier < 4; tier++) {
    const off = tier * 1.1;
    const y = 0.9 + tier * 0.9;
    for (const sx of [-1, 1]) {
      for (let z = -END_Z + 2; z <= END_Z - 2; z += 1.2) {
        if (r() < 0.12) continue;
        out.push({ x: sx * (SIDE_X + off), y, z: z + (r() - 0.5) * 0.3, fur: FUR[(r() * FUR.length) | 0],
                   shirt: SHIRT[(r() * SHIRT.length) | 0], phase: r() * 6.28 });
      }
    }
    for (const sz of [-1, 1]) {
      for (let x = -SIDE_X; x <= SIDE_X; x += 1.2) {
        if (r() < 0.12) continue;
        out.push({ x: x + (r() - 0.5) * 0.3, y, z: sz * (END_Z + off), fur: FUR[(r() * FUR.length) | 0],
                   shirt: SHIRT[(r() * SHIRT.length) | 0], phase: r() * 6.28 });
      }
    }
  }
  return out;
}

/** park: a public park court, so no stands, banners or crowd (the umpire chair and owl stay). */
export function buildStadium(grad, seed = 1, { park = false } = {}) {
  const group = new THREE.Group();
  const toon = (c, map = null) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, map });
  const standTex = (rx, ry) => tex.stands([rx, ry]);
  const place = (mesh, x, y, z) => { mesh.position.set(...toThree(x, y, z)); group.add(mesh); return mesh; };

  // concrete tiers
  for (let tier = 0; tier < (park ? 0 : 4); tier++) {
    const off = tier * 1.1, h = 0.8 + tier * 0.9;
    for (const sx of [-1, 1])
      place(new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 2 * END_Z + 2 * off), toon(0x6b5f8a, standTex(END_Z / 2, h / 2))), sx * (SIDE_X + off + 0.3), h / 2 - 0.1, 0);
    for (const sz of [-1, 1])
      place(new THREE.Mesh(new THREE.BoxGeometry(2 * SIDE_X + 2 * off, h, 1.1), toon(0x6b5f8a, standTex(SIDE_X / 2, h / 2))), 0, h / 2 - 0.1, sz * (END_Z + off + 0.3));
  }
  // advertising banners at the court edge
  const banner = [0xe63946, 0x2d6bd6, 0xffd166];
  if (!park) [-1, 1].forEach((sz, i) => place(new THREE.Mesh(new THREE.BoxGeometry(2 * SIDE_X, 0.9, 0.2), toon(banner[i], tex.banner([2 * SIDE_X / 5.4, 1], ENDS[i]))), 0, 0.45, sz * (END_Z - 0.6)));
  if (!park) [-1, 1].forEach((sx, i) => place(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 2 * END_Z), toon(banner[i + 1], tex.banner([2 * END_Z / 5.4, 1], SIDES[i]))), sx * (SIDE_X - 0.6), 0.45, 0));
  // umpire chair: tall legs, a seat and a back, with an owl umpire on top
  const chair = new THREE.Group();
  const metal = toon(0x2a2540), wood = toon(0xb8864a);
  for (const lx of [-0.35, 0.35]) for (const lz of [-0.35, 0.35]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), metal);
    leg.position.set(lx, 1.1, lz);
    chair.add(leg);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 1.0), wood);
  seat.position.y = 2.26;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.1), wood);
  back.position.set(0, 2.75, -0.45);
  chair.add(back);
  const owl = buildOwl(toon);
  owl.group.position.y = 2.32;
  owl.group.scale.setScalar(1.6); // big enough to read from the baseline camera
  chair.add(owl.group);
  chair.position.set(...toThree(COURT.postX + 1.4, 0, 0));
  chair.rotation.y = -Math.PI / 2; // the chair stands at +x, facing the court at -x
  group.add(chair);

  // crowd: one instanced mesh for heads, one for bodies
  const people = park ? [] : crowdLayout(seed);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 6, 5), toon(0xffffff), people.length);
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.26, 0.3, 2, 5), toon(0xffffff), people.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  people.forEach((p, i) => {
    m4.setPosition(...toThree(p.x, p.y + 0.55, p.z));
    heads.setMatrixAt(i, m4);
    heads.setColorAt(i, c.setHex(p.fur));
    m4.setPosition(...toThree(p.x, p.y, p.z));
    bodies.setMatrixAt(i, m4);
    bodies.setColorAt(i, c.setHex(p.shirt));
  });
  heads.frustumCulled = bodies.frustumCulled = false;
  group.add(heads, bodies);

  let cheer = 0;
  const base = people.map((p) => toThree(p.x, p.y, p.z));
  return {
    group,
    cheer() { cheer = 1; owl.flap(); },
    /** The umpire follows the ball with its head (ball in scene coordinates). */
    watch(p) { if (!owl.flying) owl.look(p, chair); },
    /** The owl leaves its chair and flies; set its position and heading each frame; land() puts it back. */
    owl: { takeOff: (pos) => owl.takeOff(group, pos), fly: (x, y, z, heading, dt) => owl.fly(x, y, z, heading, dt), land: () => owl.land(chair), get flying() { return owl.flying; } },
    update(dt, t) {
      owl.update(dt, t);
      cheer = Math.max(0, cheer - dt * 0.6);
      const amp = 0.04 + 0.45 * cheer;
      people.forEach((p, i) => {
        // a slow wave rolls round the stands, on top of the bobbing
        const wv = Math.max(0, Math.sin((base[i][0] + base[i][2]) * 0.3 - t * 2.2));
        const hop = Math.abs(Math.sin(t * (4 + 6 * cheer) + p.phase)) * amp + wv * wv * wv * wv * 0.28;
        m4.setPosition(base[i][0], base[i][1] + 0.55 + hop, base[i][2]);
        heads.setMatrixAt(i, m4);
        m4.setPosition(base[i][0], base[i][1] + hop, base[i][2]);
        bodies.setMatrixAt(i, m4);
      });
      heads.instanceMatrix.needsUpdate = bodies.instanceMatrix.needsUpdate = true;
    },
  };
}


/** An owl: round brown body, cream belly, big yellow eyes, beak, ear tufts and wings. Faces +z.
 * The head turns to follow the ball, it blinks, and the wings flap when a point is scored. */
export function buildOwl(toon) {
  const group = new THREE.Group();
  const brown = toon(0x8a5a35), dark = toon(0x5e3a20), cream = toon(0xf1dfbf), yellow = toon(0xffd23f), black = toon(0x15101e), orange = toon(0xf08a24);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), brown);
  body.scale.set(1, 1.2, 0.95);
  body.position.y = 0.4;
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), cream);
  belly.scale.set(0.9, 1.15, 0.5);
  belly.position.set(0, 0.38, 0.22);
  group.add(belly);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.32, 0.55, 0);
    const wm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), dark);
    wm.scale.set(0.35, 1.2, 0.8);
    wm.position.set(s * 0.04, -0.2, 0);
    w.add(wm);
    group.add(w);
    wings.push(w);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), orange);
    foot.position.set(s * 0.14, 0.03, 0.12);
    group.add(foot);
  }
  const head = new THREE.Group();
  head.position.y = 0.88;
  group.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), brown);
  skull.scale.set(1.1, 0.95, 1);
  head.add(skull);
  const eyes = [];
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), cream);
    ring.scale.set(1, 1, 0.5);
    ring.position.set(s * 0.12, 0.02, 0.22);
    head.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), yellow);
    eye.scale.set(1, 1, 0.5);
    eye.position.set(s * 0.12, 0.02, 0.255);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), black);
    pupil.position.set(s * 0.12, 0.02, 0.285);
    head.add(pupil);
    eyes.push(eye, pupil);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), dark);
    tuft.position.set(s * 0.17, 0.3, 0);
    tuft.rotation.z = -s * 0.35;
    head.add(tuft);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.06, 0.3);
  head.add(beak);
  // a whistle on a cord
  const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.1), toon(0xcfd4dd));
  whistle.position.set(0, 0.6, 0.33);
  group.add(whistle);

  let yaw = 0, flap = 0, flying = false, flyT = 0;
  const wp = new THREE.Vector3();
  return {
    group,
    head,
    get flying() { return flying; },
    /** Leave the chair: move to the scene root at `pos` (world), wings out. */
    takeOff(sceneGroup, pos) {
      group.getWorldPosition(wp);
      sceneGroup.add(group);
      group.position.set(pos ? pos[0] : wp.x, pos ? pos[1] : wp.y, pos ? pos[2] : wp.z);
      group.scale.setScalar(1.6);
      head.rotation.y = 0; yaw = 0;
      flying = true;
    },
    fly(x, y, z, heading, dt) {
      flyT += dt;
      group.position.set(x, y + Math.sin(flyT * 14) * 0.05, z);
      group.rotation.y = heading;
      group.rotation.x = 0.45; // leaning forward into the dive
      const f = Math.sin(flyT * 26);
      wings[0].rotation.z = 0.9 + f * 0.9;
      wings[1].rotation.z = -0.9 - f * 0.9;
    },
    land(chair) {
      chair.add(group);
      group.position.set(0, 2.32, 0);
      group.rotation.set(0, 0, 0);
      group.scale.setScalar(1.6);
      flying = false;
    },
    flap() { flap = 1; },
    /** Turn the head toward a scene point; `parent` is the chair group (it carries the turn of the seat). */
    look(p, parent) {
      parent.updateMatrixWorld();
      group.getWorldPosition(wp);
      const world = Math.atan2(p[0] - wp.x, p[2] - wp.z);
      let want = world - parent.rotation.y;
      want = Math.atan2(Math.sin(want), Math.cos(want));
      yaw += (Math.max(-1.25, Math.min(1.25, want)) - yaw) * 0.25;
      head.rotation.y = yaw;
    },
    update(dt, t) {
      if (flying) return;
      flap = Math.max(0, flap - dt * 1.2);
      const f = Math.sin(t * 22) * flap;
      wings[0].rotation.z = 0.1 + f * 0.9;
      wings[1].rotation.z = -0.1 - f * 0.9;
      const blink = t % 4.1 < 0.12;
      for (const e of eyes) e.scale.y = blink ? 0.12 : 1;
      group.position.y += 0; // body stays put
    },
  };
}
