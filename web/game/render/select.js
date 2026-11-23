// The character-select stage: the in-game cats, on the chosen court in the same pixel look, posing for the camera.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { buildCourt } from './court.js';
import { createPixelRenderer } from './pixel.js';
import { buildCat } from './cat.js';
import { buildStadium } from './stadium.js';
import { themeFor } from './courts.js';
import { lookFor } from '../cats.js';
import { danceFor, blendDance } from './dances.js';

const BASE_Z = -9.2; // near the baseline, camera looks back along the court at the stands behind the cats
let IDLE_Q = [0.866, -0.5, 0, 0]; // racket held up in front, head tilted up
export const setIdleQ = (q) => { IDLE_Q = q; };

export function createSelectStage(canvas, { court = 0, time = 0, aspect = 16 / 9, res = 640, levels = 0 } = {}) {
  const theme = themeFor(court, time);
  const pr = createPixelRenderer(canvas, { width: res, height: Math.round(res / aspect), fit: false, levels, edge: 1 });
  const grad = toonGradient();
  const { scene } = pr;
  scene.background = new THREE.Color(theme.sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7fa8, theme.hemi));
  const sun = new THREE.DirectionalLight(theme.sunColor, theme.sun);
  sun.position.set(-6, 10, -2);
  scene.add(sun);
  scene.add(buildCourt(grad, theme));
  const stadium = buildStadium(grad, 1);
  scene.add(stadium.group);
  pr.camera.fov = 38; pr.camera.updateProjectionMatrix();
  const back = Math.max(1, Math.min(2.6, 1.6 / aspect)); // portrait windows: stand further back so both cats fit
  pr.camera.position.set(0, 1.2 + (back - 1) * 0.5, BASE_Z + 5.0 * back);
  pr.camera.lookAt(0, 0.9, BASE_Z);

  const slots = [null, null]; // { catIndex, shirt, cat, t, swing }
  const X = [-1.0, 1.0], YAW = [0.5, -0.5];
  let clock = 0;

  function place(i, catIndex, shirt, entrance) {
    const cur = slots[i];
    if (cur && cur.catIndex === catIndex && cur.shirt === shirt) return;
    if (cur) scene.remove(cur.cat.group);
    const cat = buildCat(lookFor(catIndex, shirt), grad, i === 0);
    cat.group.position.set(X[i], 0, BASE_Z);
    cat.group.rotation.y = YAW[i];
    scene.add(cat.group);
    slots[i] = { catIndex, shirt, cat, t: 0, swing: entrance ? 1 : 0, enter: entrance ? 0 : 1, joy: 0, yaw: YAW[i], dw: 0 };
  }

  return {
    pr, stadium,
    /** left / right: { cat, shirt, live } */
    setSides(left, right, entrance = true) {
      place(0, left.cat, left.shirt, entrance);
      place(1, right.cat, right.shirt, entrance);
      slots[0].live = left.live; slots[1].live = right.live;
    },
    /** A cat flexes: the picked one swings its racket and hops. */
    flex(i) { if (slots[i]) { slots[i].swing = 1; slots[i].joy = 1; } },
    update(dt) {
      clock += dt;
      slots.forEach((s, i) => {
        if (!s) return;
        s.enter = Math.min(1, s.enter + dt * 3.2); // slides in from the side
        const e = 1 - (1 - s.enter) ** 3;
        s.t += dt;
        // the cat on the cursor dances its own dance (eased in and out); the other one stands and breathes
        s.dw = Math.max(0, Math.min(1, s.dw + (s.live ? dt * 4 : -dt * 4)));
        const dance = s.dw > 0 ? blendDance(danceFor(s.catIndex, s.t), s.dw, IDLE_Q) : null;
        s.cat.group.position.x = X[i] * (1 + (1 - e) * 2.2) + (dance ? dance.sway : 0);
        s.joy = Math.max(0, s.joy - dt * 1.2);
        const swingStart = s.swing > 0; s.swing = 0;
        s.cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: dance ? dance.racket : IDLE_Q, inRally: !!s.live, swingStart, big: swingStart, mood: dance ? (dance.mood || (s.joy > 0.2 ? 1 : 0)) : (s.joy > 0.2 ? 1 : 0), dance }, dt);
        // the cat on the cursor turns to face the camera
        const face = s.live ? 0.15 : YAW[i];
        s.yaw += (face - s.yaw) * Math.min(1, dt * 6);
        s.cat.group.rotation.y = s.yaw + (dance ? dance.spin : 0);
      });
      stadium.update(dt, clock);
    },
    render() { pr.render(); },
    dispose() { pr.renderer.dispose(); },
  };
}

/** Head-and-shoulders pictures of every cat in the same pixel look, as data URLs (shirt colour of the given slot). */
export function renderCatThumbs(cats, shirt = 0, size = 72) {
  const canvas = document.createElement('canvas');
  const pr = createPixelRenderer(canvas, { width: size, height: size, fit: false, levels: 0, edge: 1 });
  const grad = toonGradient();
  pr.scene.background = new THREE.Color(0x2a2748);
  pr.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7fa8, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(2, 3, 4); pr.scene.add(sun);
  pr.camera.fov = 30; pr.camera.aspect = 1; pr.camera.updateProjectionMatrix();
  pr.camera.position.set(0, 1.35, 1.45); pr.camera.lookAt(0, 1.27, 0);
  const out = [];
  cats.forEach((_, i) => {
    const cat = buildCat(lookFor(i, shirt), grad, true);
    cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: IDLE_Q, inRally: false }, 0.5);
    pr.scene.add(cat.group);
    pr.render();
    out.push(canvas.toDataURL());
    pr.scene.remove(cat.group);
  });
  pr.renderer.dispose();
  return out;
}
