import * as THREE from 'three';
import * as tex from './textures.js';
import { solveRacketArm, idlePose, runPose, readyPose, swingPose, swingTime, amplify, bodyYawFromRacket } from './rig.js';

export const FURS = {
  human: { fur: 0xf29a3a, stripe: 0xb8641c, belly: 0xfff0d9, shirt: 0xf29a3a },
  cpu: { fur: 0x9aa3b5, stripe: 0x5d667a, belly: 0xf1f3f8, shirt: 0x9aa3b5 },
};

// Cat-local coordinates are core coordinates for a cat facing +z: right = -x.
const SHOULDER = (xSide) => [xSide * 0.2, 1.02, 0.04];
const V = (a) => new THREE.Vector3(...a);

/** Place a unit-height cylinder (y axis) between two points. */
function stretch(mesh, a, b) {
  const va = V(a), vb = V(b);
  const d = vb.clone().sub(va);
  mesh.position.copy(va).add(vb).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(d.length(), 1e-4), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

/** The racket: head along +y, face normal +z, grip at the origin. m(color) makes a material. */
export function makeRacket(m) {
  // Racket model: head along +y, face normal +z. It sits in a group that rotates the
  // phone's device axes (top = y, screen = z) onto core axes (top -> forward z,
  // screen -> up y), so identity orientation = phone flat pointing at the net.
  const racket = new THREE.Group();
  const model = new THREE.Group();
  model.quaternion.set(0, Math.SQRT1_2, Math.SQRT1_2, 0);
  racket.add(model);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 6), m(0x2a2540));
  handle.position.y = -0.04;
  model.add(handle);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 4, 14), m(0xf4f4ff));
  frame.scale.set(0.82, 1.15, 1);
  frame.position.y = 0.3;
  model.add(frame);
  const stringMap = tex.strings();
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12),
    new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide, map: stringMap, alphaTest: stringMap ? 0.3 : 0 }));
  if (stringMap) stringMap.repeat.set(2, 2.5);
  strings.scale.set(0.82, 1.15, 1);
  strings.position.y = 0.3;
  model.add(strings);
  racket.scale.setScalar(1.4); // a bit bigger so the racket reads at the pixel resolution
  racket.userData.frame = frame;
  return racket;
}

export function buildCat(look, grad, rightHanded = true) {
  const m = (color) => new THREE.MeshToonMaterial({ color, gradientMap: grad });
  const fur = m(look.fur), stripe = m(look.stripe), belly = m(look.belly), shirt = m(look.shirt);
  const dark = m(0x1c1426), pink = m(0xffa6b8);
  fur.map = tex.fur(); stripe.map = tex.fur(17); belly.map = tex.fur(19);

  const root = new THREE.Group();
  const body = new THREE.Group(); // pivots at the hips
  body.position.y = 0.62;
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 8), shirt);
  torso.position.y = 0.28;
  body.add(torso);
  const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), belly);
  bellyPatch.scale.set(0.9, 1.2, 0.5);
  bellyPatch.position.set(0, 0.26, 0.15);
  body.add(bellyPatch);

  const eyes = [], ears = [];
  const head = new THREE.Group();
  head.position.y = 0.66;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur);
  skull.scale.set(1.1, 0.95, 1);
  head.add(skull);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 4), fur);
    ear.position.set(s * 0.13, 0.2, -0.02);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), pink);
    inner.position.set(s * 0.13, 0.19, 0.01);
    inner.rotation.z = -s * 0.25;
    head.add(inner);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.02), dark);
    eye.position.set(s * 0.08, 0.03, 0.19);
    head.add(eye);
    eyes.push(eye);
    ears.push(ear, inner);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), belly);
  muzzle.position.set(0, -0.05, 0.17);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), pink);
  nose.position.set(0, -0.02, 0.245);
  head.add(nose);
  if (look.kind === 'owl') { // the story boss: tufts, a pale face disc, big round eyes and a beak instead of cat ears and muzzle
    muzzle.visible = nose.visible = false;
    ears.forEach((e) => { e.scale.set(1, 1.5, 1); });
    const gold = m(0xffd23a), beak = m(0xf0a020);
    for (const e of eyes) { // each eye: a gold disc with the dark pupil in front
      e.scale.set(0.8, 0.8, 1);
      e.position.z += 0.012;
      const disc = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), gold);
      disc.scale.set(1, 1, 0.5);
      disc.position.set(e.position.x, e.position.y, 0.175);
      head.add(disc);
    }
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), belly);
    face.scale.set(1.15, 0.9, 0.5);
    face.position.set(0, 0.02, 0.15);
    head.add(face);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 4), beak);
    bk.rotation.x = Math.PI / 2 + 0.25;
    bk.position.set(0, -0.03, 0.24);
    head.add(bk);
  }
  for (const y of [0.13, 0.09]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), stripe);
    st.position.set(0, y + 0.07, 0.17);
    head.add(st);
  }

  // tail: three segments
  const tail = [];
  let parent = body;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group();
    seg.position.set(0, i === 0 ? 0.05 : 0.14, i === 0 ? -0.2 : 0);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.045 - i * 0.006, 0.12, 3, 6), i === 1 ? stripe : fur);
    mesh.position.y = 0.08;
    seg.add(mesh);
    parent.add(seg);
    tail.push(seg);
    parent = seg;
  }

  // legs pivot at the hips
  const legs = [], feet = [], footBox = new THREE.Box3(), racketBox = new THREE.Box3();
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.11, 0.02, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.36, 3, 6), fur);
    thigh.position.y = -0.3;
    leg.add(thigh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.2), belly);
    foot.position.set(0, -0.58, 0.04);
    leg.add(foot);
    body.add(leg);
    legs.push(leg); feet.push(foot);
  }

  // racket arm
  const side = rightHanded ? -1 : 1; // x of the racket-arm side
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 1, 6), fur);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 1, 6), fur);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), belly);
  root.add(upper, fore, paw);
  // the other arm hangs from the shoulder and moves with the body (hops, rolls, leans, swings as the cat runs)
  const idleArm = new THREE.Group();
  idleArm.position.set(-side * 0.24, 0.43, 0.05); // body-local shoulder
  const idleArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.5, 6), fur);
  idleArmMesh.position.y = -0.25;
  idleArm.add(idleArmMesh);
  body.add(idleArm);
  const shoulderLocal = new THREE.Vector3();

  const racket = makeRacket(m);
  root.add(racket);

  let phase = 0, swingT = null, t = 0, bodyYaw = 0, kind = null;
  const blank = { bob: 0, legPhase: 0, legAmp: 0, tail: 0, lean: 0, crouch: 0, twist: 0 };

  // cosmetics earned in the game (see progress.js): a collar, a hat and a headband on the head, and a colour for the racket frame
  let collarMesh = null, hatMesh = null, bandMesh = null;
  const drop = (o) => { if (!o) return null; o.parent?.remove(o); o.traverse((c) => { c.geometry?.dispose?.(); c.material?.dispose?.(); }); return null; };
  const tm = (color, glow = false) => new THREE.MeshToonMaterial({ color, gradientMap: grad, emissive: glow ? color : 0x000000, emissiveIntensity: glow ? 0.35 : 0 });
  const part = (geo, mat, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); return mesh; };
  const makeHat = (item) => {
    const g = new THREE.Group(), c = item.color, mat = tm(c, item.glow);
    if (item.id === 'cap') {
      const dome = part(new THREE.SphereGeometry(0.215, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.04, 0); dome.scale.set(1.1, 0.8, 1); g.add(dome);
      g.add(part(new THREE.BoxGeometry(0.2, 0.02, 0.15), tm(0xa8302b), 0, 0.045, 0.24), part(new THREE.SphereGeometry(0.025, 6, 5), tm(0xffffff), 0, 0.2, 0));
    } else if (item.id === 'party') {
      const cone = part(new THREE.ConeGeometry(0.11, 0.3, 8), mat, 0, 0.3, 0); cone.rotation.z = 0.12; g.add(cone, part(new THREE.SphereGeometry(0.04, 6, 5), tm(0xffffff), 0.035, 0.46, 0));
      for (const [x, y, z, col] of [[0.04, 0.26, 0.07, 0xffffff], [-0.04, 0.33, 0.05, 0xffd23a], [0.03, 0.2, -0.08, 0x6bd0ff]]) g.add(part(new THREE.SphereGeometry(0.02, 5, 4), tm(col), x, y, z));
    } else if (item.id === 'wizard') {
      g.add(part(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 14), mat, 0, 0.1, 0));
      const cone = part(new THREE.ConeGeometry(0.15, 0.4, 8), mat, 0.02, 0.32, 0); cone.rotation.z = -0.15; g.add(cone, part(new THREE.CylinderGeometry(0.152, 0.17, 0.04, 8), tm(0xffd23a), 0.0, 0.15, 0));
      g.add(part(new THREE.OctahedronGeometry(0.025, 0), tm(0xffd23a, true), 0.02, 0.32, 0.13));
    } else if (item.id === 'beanie') {
      const dome = part(new THREE.SphereGeometry(0.215, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.03, 0); dome.scale.set(1.1, 1, 1); g.add(dome);
      const cuff = part(new THREE.TorusGeometry(0.205, 0.04, 5, 14), tm(0xffffff), 0, 0.04, 0); cuff.rotation.x = Math.PI / 2; cuff.scale.set(1.1, 1, 1); g.add(cuff, part(new THREE.SphereGeometry(0.05, 7, 6), tm(0xffffff), 0, 0.26, 0));
    } else if (item.id === 'tophat') {
      g.add(part(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 14), mat, 0, 0.1, 0), part(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 12), mat, 0, 0.22, 0), part(new THREE.CylinderGeometry(0.143, 0.143, 0.05, 12), tm(0xe0524d), 0, 0.14, 0));
    } else if (item.id === 'crown') {
      g.add(part(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 10, 1, true), Object.assign(tm(c, true), { side: THREE.DoubleSide }), 0, 0.17, 0));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.add(part(new THREE.ConeGeometry(0.035, 0.1, 4), tm(c, true), Math.cos(a) * 0.145, 0.27, Math.sin(a) * 0.145)); }
      g.add(part(new THREE.SphereGeometry(0.03, 6, 5), tm(0xe0524d), 0, 0.2, 0.15));
    }
    g.position.y = 0.05;
    return g;
  };
  const makeBand = (item) => { // a ring round the head over the brow; the rainbow one is six coloured arcs
    const g = new THREE.Group();
    if (item.rainbow) { const cols = [0xff4d4d, 0xff9a2e, 0xffd23a, 0x6dff9a, 0x4dd2ff, 0xc04dff]; cols.forEach((col, i) => { const arc = part(new THREE.TorusGeometry(0.2, 0.03, 5, 6, Math.PI / 3 + 0.02), tm(col), 0, 0, 0); arc.rotation.z = (i * Math.PI) / 3; g.add(arc); }); }
    else g.add(part(new THREE.TorusGeometry(0.2, 0.03, 5, 16), tm(item.color, item.glow)));
    g.rotation.x = Math.PI / 2; g.scale.set(1.1, 1, 0.95); g.position.set(0, 0.08, 0);
    return g;
  };
  const dress = ({ collar = null, racketColor = null, hat = null, band = null } = {}) => {
    collarMesh = drop(collarMesh); hatMesh = drop(hatMesh); bandMesh = drop(bandMesh);
    if (collar && collar.color != null) {
      collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 5, 14), new THREE.MeshToonMaterial({ color: collar.color, gradientMap: grad, emissive: collar.glow ? collar.color : 0x000000, emissiveIntensity: collar.glow ? 0.35 : 0 }));
      collarMesh.rotation.x = Math.PI / 2;
      collarMesh.position.set(0, -0.12, 0.01);
      head.add(collarMesh);
    }
    if (hat && hat.color != null) { hatMesh = makeHat(hat); head.add(hatMesh); }
    if (band && band.color != null) { bandMesh = makeBand(band); head.add(bandMesh); }
    const fm = racket.userData.frame.material;
    fm.color.setHex(racketColor ?? 0xf4f4ff);
    if (fm.emissive) { fm.emissive.setHex(racketColor != null ? racketColor : 0x000000); fm.emissiveIntensity = racketColor != null ? 0.18 : 0; }
  };

  return {
    group: root,
    racket,
    dress,
    swinging: () => swingT !== null,
    /** World position of the middle of the racket head. */
    headPos(out) { return racket.userData.frame.getWorldPosition(out); },
    /** st: {x, z, vx, vz, racketQuat (cat-local core frame), inRally, swinging (bool) } */
    update(st, dt) {
      t += dt;
      const speed = Math.hypot(st.vx, st.vz);
      phase += speed * dt * 2.4;
      if (st.swingStart) { swingT = 0; kind = st.swingKind || null; }
      if (swingT !== null) {
        swingT += dt / swingTime(kind);
        if (swingT >= 1) swingT = null;
      }
      let pose = blank;
      if (swingT !== null) { pose = swingPose(swingT, rightHanded, kind); if (kind) pose = amplify(pose); }
      else if (speed > 0.5) pose = runPose(phase, speed);
      else pose = st.inRally ? readyPose(t) : idlePose(t);
      const dn = st.dance; // a dance (character select): { hop, roll, crouch, lean, legPhase, legAmp, tail, twist, headYaw, headPitch, headZ, racket, mood }
      if (dn) pose = { lunge: 0, rise: 0, roll: 0, bob: 0, legPhase: dn.legPhase, legAmp: dn.legAmp, tail: dn.tail, lean: dn.lean, crouch: dn.crouch, twist: 0 };

      // blink every few seconds, twitch an ear now and then
      const blink = (t % 3.4) < 0.12;
      eyes.forEach((e) => { e.scale.y = blink ? 0.15 : 1; });
      const twitch = (t % 5.3) < 0.25 ? Math.sin(t * 50) * 0.2 : 0;
      ears[0].rotation.z = 0.25 + twitch; ears[1].rotation.z = 0.25 + twitch; // the left ear and its pink inside
      const mood = st.mood || 0;
      const joy = mood > 0 ? Math.abs(Math.sin(t * 9)) * 0.22 : 0;
      const droop = mood < 0 ? 0.08 : 0;
      // a hop at the moment of a big shot or serve
      const hop = swingT !== null && st.big ? Math.sin(Math.min(1, swingT * 1.6) * Math.PI) * 0.22 : 0;
      body.position.y = 0.62 - pose.crouch + pose.bob + joy - droop + hop - (st.slam || 0) * 0.08 + (pose.rise || 0) + (dn ? dn.hop : 0);
      body.rotation.x = pose.lean + (st.slam || 0) * 0.4; // lean into a racket smash
      // Body follows the phone's sideways aim (smoothed); the canned swing twist is only a small extra.
      const wantYaw = dn ? dn.twist : bodyYawFromRacket(st.racketQuat);
      bodyYaw += (wantYaw - bodyYaw) * Math.min(1, dt * 20);
      body.rotation.y = bodyYaw - pose.twist * (kind && swingT !== null ? 0.35 : 0.15);
      head.rotation.y = pose.twist * 0.4 - bodyYaw * 0.4 + (dn ? dn.headYaw : 0);
      head.rotation.x = dn ? dn.headPitch : 0;
      head.position.z = dn ? dn.headZ : 0;
      body.rotation.z = dn ? dn.roll : (pose.roll || 0);
      legs[0].rotation.x = Math.sin(pose.legPhase) * 0.7 * pose.legAmp;
      legs[1].rotation.x = -Math.sin(pose.legPhase) * 0.7 * pose.legAmp;
      if (pose.lunge) { // split stance: the front foot steps forward (-x rotation), the back foot trails
        const frontLeg = (pose.lunge > 0) === (side < 0) ? 1 : 0; // + lunge: the foot opposite the racket arm
        const k = Math.abs(pose.lunge);
        legs[frontLeg].rotation.x -= 0.7 * k; legs[1 - frontLeg].rotation.x += 0.4 * k;
      }
      // however the body crouches, hops, rolls or leans, the lowest foot rests on the floor and never sinks through it
      root.updateMatrixWorld(true);
      let low = 0;
      for (const f of feet) { footBox.setFromObject(f); low = Math.min(low, footBox.min.y - root.matrixWorld.elements[13]); }
      if (low < 0) { body.position.y -= low; root.updateMatrixWorld(true); }
      const wag = mood > 0 ? Math.sin(t * 20) * 0.6 : 0;
      tail.forEach((seg, i) => { seg.rotation.z = pose.tail * (0.4 + i * 0.3) + wag; seg.rotation.x = mood < 0 ? -0.2 : 0.35; });

      // the free arm swings against the legs and out a little with a roll or a happy hop
      idleArm.rotation.x = -Math.sin(pose.legPhase) * 0.6 * pose.legAmp;
      idleArm.rotation.z = -side * (0.06 + (dn ? Math.abs(dn.roll) * 0.8 + dn.hop * 1.5 : 0));
      let sh = SHOULDER(side);
      if (dn) { // in a dance the racket shoulder rides the body too (hop, crouch, lean, roll, twist)
        body.updateMatrix();
        shoulderLocal.set(sh[0], sh[1] - 0.62, sh[2]).applyMatrix4(body.matrix);
        sh = [shoulderLocal.x, shoulderLocal.y, shoulderLocal.z];
      }
      const arm = solveRacketArm(sh, st.racketQuat, rightHanded);
      const q = arm.racketQuat; // core coordinates
      racket.quaternion.set(q[1], q[2], q[3], q[0]);
      racket.position.copy(V(arm.racketPos));
      // a low swing must not push the racket through the floor: lift the paw and racket (and half the elbow) clear of it
      root.updateMatrixWorld(true);
      racketBox.setFromObject(racket);
      const lift = root.matrixWorld.elements[13] + 0.01 - racketBox.min.y;
      if (lift > 0) { arm.paw[1] += lift; arm.racketPos[1] += lift; arm.elbow[1] += lift * 0.5; racket.position.y += lift; }
      stretch(upper, sh, arm.elbow);
      stretch(fore, arm.elbow, arm.paw);
      paw.position.copy(V(arm.paw));
    },
  };
}
