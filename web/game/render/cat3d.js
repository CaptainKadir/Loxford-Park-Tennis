// A cat tennis player built on Kenney's CC0 "Animated Characters Retro" skeleton (idle and run
// animations), with a cat head, ears and tail added, fur-coloured skin, and the racket arm driven
// by the phone. Falls back to the procedural cat (cat.js) until the files have loaded.
import * as THREE from 'three';
import { solveRacketArm, bodyYawFromRacket } from './rig.js';
import { makeRacket } from './cat.js';

const SCALE = 0.0036; // the model is about 376 units tall; a cat player is a bit under 1.4 m
const BASE = '/assets/characters/';

let assets = null; // loaded once, shared by both cats

/** Load the model, the animations and the skin image. Browser only. */
export async function loadCatAssets() {
  if (assets) return assets;
  const { FBXLoader } = await import('/vendor/three/examples/jsm/loaders/FBXLoader.js');
  const { clone } = await import('/vendor/three/examples/jsm/utils/SkeletonUtils.js');
  const L = new FBXLoader();
  const [model, idle, run] = await Promise.all(['characterMedium', 'idle', 'run'].map((n) => L.loadAsync(`${BASE}${n}.fbx`)));
  const pick = (fbx, key) => fbx.animations.find((a) => a.name.endsWith(key)) || fbx.animations[0];
  const skin = await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = `${BASE}humanMaleA.png`;
  });
  assets = { model, clone, idleClip: pick(idle, 'Idle'), runClip: pick(run, 'Run'), skin };
  return assets;
}

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Recolour the skin image: skin tones become fur, the pale shirt becomes the team shirt. */
export function recolourSkin(img, look) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, cv.width, cv.height);
  const fur = hex(look.fur), shirt = hex(look.shirt);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = ((gg - b) / (mx - mn)) * 60;
      else if (mx === gg) hue = (2 + (b - r) / (mx - mn)) * 60;
      else hue = (4 + (r - gg) / (mx - mn)) * 60;
      if (hue < 0) hue += 360;
    }
    let target = null;
    if (hue >= 5 && hue <= 50 && sat >= 0.18 && l > 0.35) target = fur; // skin
    else if (sat < 0.25 && l > 0.5) target = shirt; // the pale top
    if (target) {
      const k = 0.55 + 0.9 * l;
      d[i] = Math.min(255, target[0] * k);
      d[i + 1] = Math.min(255, target[1] * k);
      d[i + 2] = Math.min(255, target[2] * k);
    }
  }
  g.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  return tex;
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();

/** Point `bone` (whose child sits `childLocal` away in its own frame) at a world-space target. */
function aimBone(bone, childLocal, targetWorld) {
  bone.parent.updateWorldMatrix(true, false);
  const t = bone.parent.worldToLocal(_v.copy(targetWorld)).sub(bone.position);
  if (t.lengthSq() < 1e-12) return;
  bone.quaternion.setFromUnitVectors(_w.copy(childLocal).normalize(), t.normalize());
  bone.updateMatrixWorld(true);
}

export function buildCharacterCat(look, grad, rightHanded = true) {
  const a = assets;
  const m = (color) => new THREE.MeshToonMaterial({ color, gradientMap: grad });
  const root = new THREE.Group();
  const model = a.clone(a.model);
  model.scale.setScalar(SCALE);
  const pivot = new THREE.Group(); // turns the body with the phone
  pivot.add(model);
  root.add(pivot);

  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const skin = recolourSkin(a.skin, look);
  model.traverse((o) => {
    if (o.isSkinnedMesh || o.isMesh) {
      o.material = new THREE.MeshToonMaterial({ map: skin, gradientMap: grad });
      o.frustumCulled = false;
    }
  });

  // which way does the model face? Make it face core +z (its right hand on -x).
  root.updateMatrixWorld(true);
  const right = _v.copy(bones.RightArm.getWorldPosition(new THREE.Vector3())).sub(bones.LeftArm.getWorldPosition(new THREE.Vector3()));
  right.y = 0; right.normalize();
  const facing = new THREE.Vector3(0, 1, 0).cross(right);
  model.rotation.y = facing.z < 0 ? Math.PI : 0;
  root.updateMatrixWorld(true);

  // Cat head, ears and face on the head bone, placed using the model's own up/forward directions.
  const head = bones.Head, headEnd = bones.Head_end;
  const hl = headEnd.position.length(); // head bone length in model units
  const inBone = (bone, dir) => { // a world direction as seen in a bone's own frame
    const o = bone.getWorldPosition(new THREE.Vector3());
    return bone.worldToLocal(o.add(dir)).normalize();
  };
  const worldFwd = new THREE.Vector3(0, 0, 1), worldUp = new THREE.Vector3(0, 1, 0);
  const fwd = inBone(head, worldFwd), up = inBone(head, worldUp), side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const place = (mesh, f, u, s) => { // f forward, u up, s sideways, all in units of head length
    mesh.position.copy(fwd).multiplyScalar(f * hl).addScaledVector(up, u * hl).addScaledVector(side, s * hl);
    head.add(mesh);
    return mesh;
  };
  const fur = m(look.fur), stripe = m(look.stripe), belly = m(look.belly), dark = m(0x1c1426), pink = m(0xffa6b8);
  const skull = place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.78, 10, 8), fur), 0.12, 0.55, 0);
  skull.scale.set(1.05, 0.92, 0.95);
  const owl = look.kind === 'owl'; // the story boss: tufts, a pale face disc, big round eyes and a beak instead of cat ears and muzzle
  const gold = m(0xffd23a), beak = m(0xf0a020);
  for (const s of [-1, 1]) {
    const ear = place(new THREE.Mesh(new THREE.ConeGeometry(hl * 0.26, hl * (owl ? 0.8 : 0.55), 4), fur), 0.05, owl ? 1.3 : 1.18, s * 0.5);
    ear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up.clone().addScaledVector(side, s * (owl ? 0.5 : 0.25)).normalize());
    if (!owl) {
      const inner = place(new THREE.Mesh(new THREE.ConeGeometry(hl * 0.15, hl * 0.35, 4), pink), 0.14, 1.12, s * 0.5);
      inner.quaternion.copy(ear.quaternion);
    }
    if (owl) {
      const disc = place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.2, 8, 6), gold), 0.74, 0.62, s * 0.3);
      disc.scale.set(1, 1, 0.5);
      place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.1, 6, 5), dark), 0.84, 0.62, s * 0.3); // pupils
    } else place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.09, 6, 5), dark), 0.78, 0.62, s * 0.3); // eyes
  }
  if (owl) {
    const face = place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.42, 10, 8), belly), 0.6, 0.55, 0);
    face.scale.set(1.2, 0.95, 0.5);
    const bk = place(new THREE.Mesh(new THREE.ConeGeometry(hl * 0.12, hl * 0.3, 4), beak), 0.9, 0.42, 0);
    bk.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fwd.clone().addScaledVector(up, -0.3).normalize());
  } else {
    place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.07, 6, 5), pink), 0.86, 0.45, 0); // nose
    const muzzle = place(new THREE.Mesh(new THREE.SphereGeometry(hl * 0.2, 8, 6), belly), 0.72, 0.4, 0);
    muzzle.scale.set(1.2, 0.8, 0.8);
  }

  // Tail on the hips: a few spheres curling up and back.
  const hips = bones.Hips;
  const hf = inBone(hips, worldFwd), hu = inBone(hips, worldUp);
  const tail = new THREE.Group();
  hips.add(tail);
  const hipUnit = headEnd.position.length() * 1.1;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(hipUnit * (0.16 - 0.08 * t), 6, 5), i % 2 ? stripe : fur);
    seg.position.copy(hf).multiplyScalar(-hipUnit * (0.5 + t * 1.1)).addScaledVector(hu, hipUnit * (0.2 + t * t * 1.6));
    tail.add(seg);
  }

  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(a.idleClip), run = mixer.clipAction(a.runClip);
  idle.play();
  let current = idle;

  const racket = makeRacket(m);
  root.add(racket);

  const handName = rightHanded ? 'Right' : 'Left';
  const upperArm = bones[`${handName}Arm`], foreArm = bones[`${handName}ForeArm`], hand = bones[`${handName}Hand`];
  const upperRest = foreArm.position.clone(), foreRest = hand.position.clone();
  let bodyYaw = 0, t = 0;
  const tmp = new THREE.Vector3(), elbowW = new THREE.Vector3(), pawW = new THREE.Vector3();

  return {
    group: root,
    racket,
    update(st, dt) {
      t += dt;
      const speed = Math.hypot(st.vx, st.vz);
      const want = speed > 0.5 ? run : idle;
      if (want !== current) {
        want.reset().play();
        want.crossFadeFrom(current, 0.15, false);
        current = want;
      }
      run.timeScale = Math.min(1.6, Math.max(0.6, speed / 4));
      mixer.update(dt);

      const wantYaw = bodyYawFromRacket(st.racketQuat);
      bodyYaw += (wantYaw - bodyYaw) * Math.min(1, dt * 20);
      pivot.rotation.y = bodyYaw * 0.8;
      tail.rotation.y = 0.35 * Math.sin(t * 2.2);
      root.updateMatrixWorld(true);

      // racket arm: aim the upper arm and forearm so the hand follows where the phone points the racket
      const shoulderLocal = root.worldToLocal(upperArm.getWorldPosition(tmp).clone());
      const arm = solveRacketArm([shoulderLocal.x, shoulderLocal.y, shoulderLocal.z], st.racketQuat, rightHanded);
      elbowW.set(...arm.elbow); root.localToWorld(elbowW);
      pawW.set(...arm.paw); root.localToWorld(pawW);
      aimBone(upperArm, upperRest, elbowW);
      aimBone(foreArm, foreRest, pawW);
      const handLocal = root.worldToLocal(hand.getWorldPosition(tmp).clone());
      racket.position.copy(handLocal);
      const q = arm.racketQuat;
      racket.quaternion.set(q[1], q[2], q[3], q[0]);
    },
  };
}

export const catAssetsReady = () => !!assets;
