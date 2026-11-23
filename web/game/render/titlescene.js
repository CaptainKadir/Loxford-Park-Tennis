// The title page's backdrop: the in-game cats (same models, same pixel look) chasing each other round the court.
// Two chases on two tracks, running opposite ways. Each chaser closes in, swipes, the chased cat leaps clear and the
// roles swap, with dust at their paws and a tennis ball bouncing along for company. Pure motion helpers are exported for tests.
import * as THREE from 'three';
import { toonGradient } from './config.js';
import { buildCourt } from './court.js';
import { createPixelRenderer } from './pixel.js';
import { buildCat } from './cat.js';
import { buildStadium } from './stadium.js';
import { createEffects } from './effects.js';
import { themeFor } from './courts.js';
import { lookFor } from '../cats.js';
import { swingKind } from './rig.js';

/** A point on an ellipse track at angle u (radians), and the direction of travel (dir = +1 or -1). */
export function trackPoint(tr, u) {
  const x = tr.cx + tr.rx * Math.cos(u), z = tr.cz + tr.rz * Math.sin(u);
  return { x, z };
}
/** The chase between two cats on one track: the lead's angle, the chaser's gap behind it, and whether a catch is happening. */
export function chaseAt(t, { speed = 1, gapMin = 0.35, gapMax = 1.5, period = 9 } = {}) {
  const phase = (t % period) / period;
  const close = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2); // 0 far apart .. 1 on the lead's heels
  const gap = gapMax - (gapMax - gapMin) * close;
  const catching = close > 0.97;
  return { lead: t * speed, gap, catching, close, swap: Math.floor(t / period) % 2 };
}

const TRACKS = [
  { cx: 0, cz: -8.2, rx: 4.6, rz: 1.9, dir: 1, speed: 0.95, period: 9, cats: [1, 0] },
  { cx: 0, cz: -7.0, rx: 3.0, rz: 1.1, dir: -1, speed: 1.3, period: 7, cats: [4, 5] },
];

export function createTitleScene(canvas, { court = 1, time = 1, aspect = 16 / 9, res = 640, levels = 0 } = {}) {
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
  const fx = createEffects(scene);
  pr.camera.fov = 46; pr.camera.updateProjectionMatrix();

  const runners = TRACKS.map((tr) => tr.cats.map((ci, k) => {
    const cat = buildCat(lookFor(ci, k), grad, true);
    scene.add(cat.group);
    return { cat, ci, u: 0, x: 0, z: 0, y: 0, vy: 0, jump: 0, swipe: 0, prev: null, dust: 0 };
  }));

  // a tennis ball bouncing in the middle of the chase
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshToonMaterial({ color: 0xd8ff3a, gradientMap: grad }));
  scene.add(ball);
  let clock = 0;

  const step = (tr, pair, t, dt) => {
    const c = chaseAt(t, tr);
    const [a, b] = pair; // a is chased first, b chases; they swap each period
    const lead = c.swap ? b : a, chaser = c.swap ? a : b;
    const uL = tr.dir * c.lead, uC = tr.dir * (c.lead - c.gap);
    for (const [r, u, isLead] of [[lead, uL, true], [chaser, uC, false]]) {
      const p = trackPoint(tr, u);
      const nx = trackPoint(tr, u + tr.dir * 0.02);
      const hx = nx.x - p.x, hz = nx.z - p.z;
      const sp = Math.hypot(hx, hz) / 0.02 * tr.speed * (isLead ? 1 : 1 + 0.35 * c.close);
      r.vx = hx; r.vz = hz;
      let yaw = Math.atan2(hx, hz);
      // the lead glances back over its shoulder while it runs; the chaser leans into the turn
      r.x = p.x; r.z = p.z;
      // a leap at the moment of the catch: the lead jumps clear, the chaser swipes
      if (c.catching && isLead && r.jump <= 0 && r.y <= 0.001) { r.vy = 5.2; r.jump = 1; fx.burst(r.x, 0.2, r.z, 0xfff2a0); }
      if (c.catching && !isLead && r.swipe <= 0) r.swipe = 1;
      if (!c.catching) { if (isLead) r.jump = 0; else r.swipe = Math.max(0, r.swipe - dt); }
      r.vy -= 14 * dt; r.y = Math.max(0, r.y + r.vy * dt); if (r.y === 0 && r.vy < 0) r.vy = 0;
      r.cat.group.position.set(r.x, r.y, r.z);
      r.cat.group.rotation.y = yaw + (isLead ? Math.sin(t * 3) * 0.12 : 0);
      const speed = Math.min(8, Math.max(2.5, sp));
      const swipeNow = r.swipe === 1 && !r.swiped;
      if (swipeNow) { r.swiped = true; fx.burst(r.x + hx * 6, 0.9, r.z + hz * 6, 0xcfe8ff); }
      if (!c.catching) r.swiped = false;
      r.cat.update({ x: 0, z: 0, vx: 0, vz: speed, racketQuat: [1, 0, 0, 0], inRally: false, big: swipeNow, swingStart: swipeNow, swingKind: swingKind(1, swipeNow ? 3 : 1), mood: isLead ? -1 : 1 }, dt);
      r.dust -= dt;
      if (r.dust <= 0 && r.y < 0.05) { fx.runDust(r.x, r.z); r.dust = 0.07; }
    }
  };

  return {
    pr,
    update(dt) {
      clock += dt;
      TRACKS.forEach((tr, i) => step(tr, runners[i], clock, dt));
      // the ball bounces along the lower track
      const bp = trackPoint(TRACKS[1], -TRACKS[1].dir * clock * 0.7 + 1);
      ball.position.set(bp.x * 0.8, 0.11 + Math.abs(Math.sin(clock * 5)) * 0.9, bp.z + 0.4);
      fx.update(dt);
      // the camera drifts slowly so the court slides behind the runners
      const sway = Math.sin(clock * 0.21);
      pr.camera.position.set(sway * 1.2, 2.6 + Math.sin(clock * 0.13) * 0.15, 0.5);
      pr.camera.lookAt(sway * 0.5, 2.5, -8.4); // a little above the cats, so they run in the lower half of the screen
      stadium.update(dt, clock);
    },
    render() { pr.render(); },
    dispose() { pr.renderer.dispose(); },
  };
}
