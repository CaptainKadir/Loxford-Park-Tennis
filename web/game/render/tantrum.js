// What happens when a match is lost: the losing cat smashes its racket on the ground several times,
// then the owl umpire leaves the chair and chases it round the court. Pure maths, tested without 3D.
export const SMASHES = 4;
export const CYCLE = 0.62;   // s per smash
export const START = 0.8;    // s after the match ends before the first one
export const HIT_AT = 0.5;   // s into a cycle when the racket reaches the ground
export const CHASE_START = START + SMASHES * CYCLE + 0.3;

const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** Racket pitch in radians at time t after the match ended (0 = pointing at the net, + = tipped down)
 * and how many smashes have landed. */
export function smash(t) {
  const u = t - START;
  if (u < 0) return { theta: 0.2, landed: 0 };
  const k = Math.min(SMASHES, Math.floor((u - HIT_AT) / CYCLE) + 1);
  if (u >= SMASHES * CYCLE) return { theta: 0.2, landed: SMASHES };
  const c = (u % CYCLE) / CYCLE * CYCLE; // seconds into this cycle
  let theta;
  if (c < 0.36) theta = 0.2 + (-1.9 - 0.2) * ease(c / 0.36);          // wind up over the head
  else if (c < HIT_AT) theta = -1.9 + (1.65 + 1.9) * ease((c - 0.36) / (HIT_AT - 0.36)); // slam down
  else theta = 1.65 - 0.5 * ease(clamp01((c - HIT_AT) / (CYCLE - HIT_AT)));           // bounce back a little
  return { theta, landed: Math.max(0, k) };
}

/** Body lean and crouch while smashing, peaking at the impact. */
export const slamAmount = (t) => {
  const u = t - START;
  if (u < 0 || u >= SMASHES * CYCLE) return 0;
  const c = u % CYCLE;
  return clamp01(1 - Math.abs(c - HIT_AT) / 0.12);
};

/** The chase: the cat runs between random spots on its half, the owl flies after it. */
export function createChase({ catX, catZ, half, owlX, owlY, owlZ, seed = 1 }) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const lo = half > 0 ? 2.5 : -11, hi = half > 0 ? 11 : -2.5; // z range of the cat's half
  const cat = { x: catX, z: catZ, vx: 0, vz: 0, tx: catX, tz: catZ, timer: 0 };
  let tt = 0;
  const owl = { x: owlX, y: owlY, z: owlZ, vx: 0, vy: 0, vz: 0, heading: 0, caught: 0 };
  const pick = () => {
    for (let i = 0; i < 8; i++) {
      const tx = (rnd() - 0.5) * 8, tz = lo + rnd() * (hi - lo);
      if (Math.hypot(tx - owl.x, tz - owl.z) > 3 || i === 7) { cat.tx = tx; cat.tz = tz; return; }
    }
  };
  return {
    cat, owl,
    update(dt) {
      tt += dt;
      // the cat runs for its spot, and picks another when it gets there, or the owl is close
      const dOwl = Math.hypot(owl.x - cat.x, owl.z - cat.z);
      cat.timer -= dt;
      if (cat.timer <= 0 || Math.hypot(cat.tx - cat.x, cat.tz - cat.z) < 0.5 || dOwl < 1.6) { pick(); cat.timer = 1.4; }
      const speed = dOwl < 3 ? 6.4 : 5.2;
      const dx = cat.tx - cat.x, dz = cat.tz - cat.z, d = Math.hypot(dx, dz) || 1;
      cat.vx += (dx / d * speed - cat.vx) * Math.min(1, dt * 8);
      cat.vz += (dz / d * speed - cat.vz) * Math.min(1, dt * 8);
      cat.x += cat.vx * dt; cat.z += cat.vz * dt;
      cat.x = Math.max(-5, Math.min(5, cat.x)); cat.z = Math.max(lo, Math.min(hi, cat.z));
      // the owl swoops after it: aims a little above the cat, bobbing, and sweeps past when it gets close
      const ty = 1.7 + 0.6 * Math.sin(tt * 3);
      const ox = cat.x - owl.x, oy = ty - owl.y, oz = cat.z - owl.z, od = Math.hypot(ox, oy, oz) || 1;
      const top = 7.5;
      owl.vx += (ox / od * top - owl.vx) * Math.min(1, dt * 2.2);
      owl.vy += (oy / od * top - owl.vy) * Math.min(1, dt * 2.2);
      owl.vz += (oz / od * top - owl.vz) * Math.min(1, dt * 2.2);
      owl.x += owl.vx * dt; owl.y = Math.max(0.9, owl.y + owl.vy * dt); owl.z += owl.vz * dt;
      if (Math.hypot(owl.vx, owl.vz) > 0.5) owl.heading = Math.atan2(owl.vx, owl.vz);
      if (od < 1.0) owl.caught += dt;
    },
  };
}
