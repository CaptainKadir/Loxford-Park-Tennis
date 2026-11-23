// The lesson stage: your cat on the court acting out an example swing, with a big virtual phone floating beside it
// that turns exactly the way the real phone should. A trail follows the racket head so the path of the swing shows.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { buildCourt } from './court.js';
import { createPixelRenderer } from './pixel.js';
import { buildCat } from './cat.js';
import { buildStadium } from './stadium.js';
import { themeFor } from './courts.js';
import { lookFor } from '../cats.js';
import { quatRToCore } from './rig.js';
import { blendDance, danceFor } from './dances.js';
import { launchShot, stepShot, SHOT_SLOW } from '../lessonshots.js';

const CAT_Z = -6.4;                                  // on the baseline, like in a match
const PHONE_AT = [1.35, 1.25, CAT_Z + 0.9];           // beside the cat (its left), where the camera sees both
const PHONE_SCALE = 5.4;                              // a real phone is about 15 cm: drawn big enough to read
const TRAIL = 26;
const REST_Q = [0.866, -0.5, 0, 0];

/** The face of the virtual phone: a screen with "TOP" and an arrow, so the way it points is clear. */
function screenTexture() {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 192;
  const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 192);
  grd.addColorStop(0, '#5b8dff'); grd.addColorStop(1, '#1d2f6a');
  g.fillStyle = grd; g.fillRect(0, 0, 96, 192);
  g.fillStyle = '#ffd166'; g.fillRect(0, 0, 96, 40);
  g.fillStyle = '#1b1530'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('▲ TOP', 48, 21);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
  g.beginPath(); g.ellipse(48, 118, 28, 38, 0, 0, Math.PI * 2); g.stroke(); // the racket face
  g.beginPath(); g.moveTo(48, 80); g.lineTo(48, 156); g.moveTo(24, 118); g.lineTo(72, 118); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.font = 'bold 15px sans-serif'; g.fillText('SCREEN', 48, 178);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createLessonStage(canvas, { court = 0, time = 0, aspect = 16 / 9, res = 800, levels = 0, cat: catIndex = 0 } = {}) {
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

  const cat = buildCat(lookFor(catIndex, 0), grad, true);
  cat.group.position.set(0, 0, CAT_Z);
  scene.add(cat.group);

  // the virtual phone: device axes x right, y top, z screen, put into the racket's frame the same way the racket is
  const phone = new THREE.Group();
  const model = new THREE.Group();
  model.quaternion.set(0, Math.SQRT1_2, Math.SQRT1_2, 0);
  phone.add(model);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.2, 0.012), new THREE.MeshToonMaterial({ color: 0x15172b, gradientMap: grad }));
  model.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.18), new THREE.MeshBasicMaterial({ map: screenTexture() }));
  screen.position.z = 0.0066;
  model.add(screen);
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.016), new THREE.MeshBasicMaterial({ color: 0xffd166 })); // the racket-head end
  topCap.position.y = 0.1;
  model.add(topCap);
  phone.scale.setScalar(PHONE_SCALE);
  phone.position.set(...PHONE_AT);
  scene.add(phone);

  // a fading trail of where the racket head goes
  const dots = [];
  const dotGeo = new THREE.SphereGeometry(0.035, 6, 5);
  for (let i = 0; i < TRAIL; i++) {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true }));
    m.visible = false; scene.add(m); dots.push(m);
  }
  let dotN = 0, dotT = 0;

  const aspectFix = aspect < 1.3 ? 1.3 : 1;
  camera.fov = 38 * aspectFix; camera.updateProjectionMatrix();
  // two shots: a close-up of the cat and phone, and a follow-cam behind the ball once it has been struck
  const CAT_CAM = { pos: new THREE.Vector3(-0.6, 1.7, CAT_Z + 6.6), look: new THREE.Vector3(0.5, 0.25, CAT_Z) };
  const cam = { pos: CAT_CAM.pos.clone(), look: CAT_CAM.look.clone() }, wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  camera.position.copy(cam.pos); camera.lookAt(cam.look);

  // the serve lesson's ball: tossed up, struck at the top, then away over the net
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshToonMaterial({ color: 0xd8ff3a, gradientMap: grad }));
  ball.visible = false; scene.add(ball);
  let serveT = -1, hit = false;
  // the example shot after a swing: the ball, a trail of where it went, and a ring where it lands
  let shot = null;
  const shotBall = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshToonMaterial({ color: 0xd8ff3a, gradientMap: grad }));
  shotBall.visible = false; scene.add(shotBall);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 20), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  let ringT = 0;
  const flight = [];
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); m.visible = false; m.scale.setScalar(0.6); scene.add(m); flight.push(m); }
  let flightN = 0, flightT = 0;

  const headV = new THREE.Vector3();
  let clock = 0, state = { qR: null, dance: null, serve: false, phone: true };

  return {
    pr, stadium,
    /** What to show: qR, the phone's orientation in frame R (or null); dance, a dance object; showPhone. */
    setPose(p) { state = { ...state, ...p }; },
    /** The example shot for demo `id`: the ball leaves the racket now. */
    launch(id) { shot = launchShot(id); flight.forEach((m) => { m.visible = false; }); ring.visible = false; },
    update(dt) {
      clock += dt;
      const dance = state.dance ? blendDance(state.dance, 1, REST_Q) : null;
      const rq = state.qR ? quatRToCore(state.qR) : dance ? dance.racket : REST_Q;
      let swingStart = false;
      if (state.serve) { // toss, swing at the top, ball away; every 3.6 s
        serveT = (serveT + dt) % 3.6;
        if (serveT < dt) hit = false;
        if (!hit && serveT >= 0.62) { hit = true; swingStart = true; }
        const tt = serveT;
        ball.visible = true;
        if (!hit) ball.position.set(-0.12, 1.05 + 5.2 * tt - 4.9 * tt * tt, CAT_Z + 0.3);
        else ball.position.set(-0.12 + (tt - 0.62) * 1.5, 2.3 - (tt - 0.62) * 1.2, CAT_Z + 0.4 + (tt - 0.62) * 22);
        if (ball.position.z > CAT_Z + 14 || tt > 1.6) ball.visible = false;
      } else { ball.visible = false; serveT = -1; }
      cat.update({ x: 0, z: 0, vx: 0, vz: 0, racketQuat: rq, inRally: !state.dance, mood: dance ? 1 : 0, dance, swingStart, swingKind: state.serve ? { name: 'serve', back: false } : null, big: swingStart }, dt);
      if (dance) { cat.group.position.x = dance.sway; cat.group.rotation.y = dance.spin; } else { cat.group.position.x = 0; cat.group.rotation.y = 0; }
      phone.visible = state.phone && !!state.qR;
      if (state.qR) phone.quaternion.set(rq[1], rq[2], rq[3], rq[0]);
      phone.position.y = PHONE_AT[1] + Math.sin(clock * 1.6) * 0.03;
      // the trail
      dotT += dt;
      if (state.qR && dotT > 0.03) {
        dotT = 0;
        cat.headPos(headV);
        const m = dots[dotN++ % TRAIL];
        m.position.copy(headV); m.visible = true; m.userData.life = 0.7;
      }
      for (const m of dots) {
        if (!m.visible) continue;
        m.userData.life -= dt;
        if (m.userData.life <= 0) { m.visible = false; continue; }
        m.material.opacity = Math.min(1, m.userData.life / 0.45);
        m.scale.setScalar(0.5 + m.userData.life);
      }
      if (shot) { // the example shot in flight
        const was = shot.bounces;
        stepShot(shot, dt * SHOT_SLOW);
        shotBall.visible = !shot.done || shot.t < 5;
        shotBall.position.set(shot.x, shot.y, shot.z);
        if (shot.bounces > was && was === 0) { ring.position.set(shot.landed.x, 0.05, shot.landed.z); ring.visible = true; ringT = 1.0; }
        flightT += dt;
        if (flightT > 0.04 && !shot.done) { flightT = 0; const m = flight[flightN++ % flight.length]; m.position.set(shot.x, shot.y, shot.z); m.visible = true; m.userData.life = 0.9; }
        if (shot.done) shotBall.visible = false;
      } else shotBall.visible = false;
      for (const m of flight) { if (!m.visible) continue; m.userData.life -= dt; if (m.userData.life <= 0) m.visible = false; else m.material.opacity = Math.min(0.6, m.userData.life); }
      if (ring.visible) { ringT -= dt; ring.material.opacity = Math.max(0, Math.min(1, ringT)); ring.scale.setScalar(1 + (1 - ringT) * 0.6); if (ringT <= 0) ring.visible = false; }
      // the camera: on the cat, then behind the ball from the strike until it has landed
      const follow = shot && (shot.bounces === 0 || ring.visible) && !shot.done;
      if (follow) { wantPos.set(shot.x - 3.0, Math.max(1.6, shot.y * 0.5 + 1.5), shot.z - 4.6); wantLook.set(shot.x + 0.4, shot.y * 0.4 + 0.3, shot.z + 3); }
      else { wantPos.copy(CAT_CAM.pos); wantLook.copy(CAT_CAM.look); }
      const k = 1 - Math.exp(-dt * (follow ? 3 : 2.2));
      cam.pos.lerp(wantPos, k); cam.look.lerp(wantLook, k);
      camera.position.copy(cam.pos); camera.lookAt(cam.look);
      stadium.update(dt, clock);
    },
    clearTrail() { dots.forEach((m) => { m.visible = false; }); shot = null; flight.forEach((m) => { m.visible = false; }); ring.visible = false; },
    render() { pr.render(); },
    dispose() { pr.renderer.dispose(); },
  };
}
