// The story cut scene: both cats on the stop's court, in the same pixel look as the match. They walk to the net,
// face each other and talk (head, tail and racket move while someone speaks), and the camera cuts between an
// establishing shot and over-the-shoulder shots on whoever has the line.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { buildCourt } from './court.js';
import { createPixelRenderer } from './pixel.js';
import { buildCat } from './cat.js';
import { buildStadium } from './stadium.js';
import { themeFor } from './courts.js';
import { lookFor } from '../cats.js';
import { POS, YAW, shotFor, shotKind, talkPose } from './talkshots.js';

const WALK_IN = 1.8; // s for the cats to walk to the net

export function createTalkStage(canvas, { court = 0, time = 0, aspect = 16 / 9, res = 800, levels = 0, hero, rival }) {
  const theme = themeFor(court, time);
  const pr = createPixelRenderer(canvas, { width: res, height: Math.round(res / aspect), fit: false, levels, edge: 1 });
  const grad = toonGradient();
  const { scene, camera } = pr;
  scene.background = new THREE.Color(theme.sky);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7fa8, theme.hemi));
  const sun = new THREE.DirectionalLight(theme.sunColor, theme.sun);
  sun.position.set(-6, 10, -2);
  scene.add(sun);
  scene.add(buildCourt(grad, theme));
  const stadium = buildStadium(grad, 1);
  scene.add(stadium.group);

  const actors = [hero, rival].map((catIndex, i) => {
    const cat = buildCat(lookFor(catIndex, i), grad, i === 0);
    scene.add(cat.group);
    return { cat, talk: 0, want: 0, mood: 0, t: i * 1.3 };
  });

  // the camera eases from shot to shot
  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };
  const want = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 40 };
  let clock = 0, shotT = 0;
  const setShot = (shot, snap = false) => {
    want.pos.set(...shot.pos); want.target.set(...shot.target); want.fov = shot.fov;
    shotT = 0;
    if (snap) { cam.pos.copy(want.pos); cam.target.copy(want.target); cam.fov = want.fov; }
  };
  setShot(shotFor('wide'), true);
  // the establishing shot starts further back and pushes in
  cam.pos.z -= 2.5; cam.pos.y += 0.6;

  const back = Math.max(1, Math.min(2.2, 1.7 / aspect)); // tall windows: pull back so both cats fit
  const apply = () => {
    camera.position.copy(cam.pos);
    if (back > 1 && cam.fov >= 39) camera.position.z -= (back - 1) * 2;
    camera.fov = cam.fov * (aspect < 1.2 ? 1.25 : 1);
    camera.updateProjectionMatrix();
    camera.lookAt(cam.target);
  };
  apply();

  return {
    pr, stadium,
    /** Line i of n is being said by side 0 (the hero) or 1 (the rival); mood: 1 happy, -1 grumpy. */
    setLine(i, n, speaker, mood = 0) {
      setShot(shotFor(shotKind(i, n), speaker));
      actors.forEach((a, k) => { a.mood = k === speaker ? mood : 0; });
    },
    /** Whether the speaker is mid-sentence (it moves while it talks and settles when the line is done). */
    setTalking(speaker, on) { actors.forEach((a, k) => { a.want = k === speaker && on ? 1 : 0; }); },
    update(dt) {
      clock += dt; shotT += dt;
      const walk = Math.max(0, 1 - clock / WALK_IN);
      actors.forEach((a, i) => {
        a.t += dt;
        a.talk += (a.want - a.talk) * Math.min(1, dt * 8);
        const w = walk > 0 ? walk : 0;
        const e = 1 - w * w; // eased arrival
        const startX = POS[i][0] > 0 ? 6.5 : -6.5;
        const x = startX + (POS[i][0] - startX) * e;
        const pose = talkPose(a.t, walk > 0 ? 0 : a.talk, a.mood, walk > 0 ? 1 : 0, i);
        a.cat.group.position.set(x, 0, POS[i][1]);
        a.cat.group.rotation.y = walk > 0 ? (POS[i][0] > 0 ? -Math.PI / 2 : Math.PI / 2) : YAW[i];
        a.cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: pose.racket, inRally: false, mood: pose.mood, dance: pose }, dt);
      });
      const k = 1 - Math.exp(-dt * 4.5);
      cam.pos.lerp(want.pos, k); cam.target.lerp(want.target, k); cam.fov += (want.fov - cam.fov) * k;
      // a slow push-in on every shot
      const drift = Math.min(1, shotT / 5) * 0.06;
      apply();
      camera.position.lerp(cam.target, drift);
      camera.lookAt(cam.target);
      stadium.update(dt, clock);
    },
    render() { pr.render(); },
    dispose() { pr.renderer.dispose(); },
  };
}
