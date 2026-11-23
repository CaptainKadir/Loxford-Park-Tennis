// Phone orientation -> sword. The phone is the hilt: its top edge is the blade.
// q is the court-frame quaternion [w,x,y,z] the controller already sends
// (x right, y forward at the screen, z up), so calibrating = "point the top at the screen".
import { rotate } from '../shared/frame.js';

/** Live-tunable feel settings (the game's panel edits these; defaults are the first guess). */
export const tuning = { span: 0.6, start: 4, stop: 2, hitSpeed: 4.5, parryR: 0.5, bodyR: 0.5, smooth: 0.6 };
const LIM = 1.3;
const clamp = (v) => Math.max(-LIM, Math.min(LIM, v));

export const bladeDir = (q) => rotate(q, [0, 1, 0]);

/** Where the blade tip points, in a flat cursor space: x right, y up, 0,0 = straight ahead. No singularities. */
export function cursorOf(q) {
  const d = bladeDir(q);
  return { x: clamp(d[0] / tuning.span), y: clamp(d[2] / tuning.span) };
}

/** Inverse of cursorOf for mouse/keyboard play: a quaternion whose blade points at cursor (x,y). */
export function quatForCursor(x, y) {
  const dx = x * tuning.span, dz = y * tuning.span;
  const dy = Math.sqrt(Math.max(0.0001, 1 - dx * dx - dz * dz));
  // rotate [0,1,0] onto d: axis = [0,1,0] x d = [dz, 0, -dx], cos = dy
  const w = 1 + dy;
  const q = [w, dz, 0, -dx];
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/**
 * Follows the blade and reports swings. A swing starts when the blade sweeps faster than `start` rad/s
 * and ends when it drops under `stop` (or after `maxS`). Each swing gets an id so a hit counts once.
 */
export function createSwingTracker({ maxS = 0.7 } = {}) {
  let prevDir = null, prevCur = null, prevT = null;
  let speed = 0, swinging = false, id = 0, swingT0 = 0, peak = 0, path = [], slowCount = 0;
  const st = { cursor: { x: 0, y: 0 }, prev: { x: 0, y: 0 }, speed: 0, swinging: false, id: 0 };

  return {
    state: st,
    /** Feed one sample; returns a finished-swing summary or null. */
    update(t, q) {
      const dir = bladeDir(q);
      const cur = cursorOf(q);
      let ended = null;
      if (prevDir && t > prevT) {
        const dt = t - prevT;
        const inst = angleBetween(prevDir, dir) / dt;
        speed = speed * (1 - tuning.smooth) + inst * tuning.smooth;
        if (!swinging && speed >= tuning.start) {
          swinging = true; id++; swingT0 = t; peak = speed; path = [{ ...prevCur }]; slowCount = 0;
        }
        if (swinging) {
          peak = Math.max(peak, speed);
          path.push({ ...cur });
          slowCount = speed < tuning.stop ? slowCount + 1 : 0;
          if (slowCount >= 2 || t - swingT0 > maxS) {
            const a = path[0], b = path[path.length - 1];
            ended = { id, peak, path, angle: Math.atan2(b.y - a.y, b.x - a.x), len: Math.hypot(b.x - a.x, b.y - a.y), dur: t - swingT0 };
            swinging = false;
          }
        }
      }
      st.prev = prevCur || cur; st.cursor = cur; st.speed = speed; st.swinging = swinging; st.id = id;
      prevDir = dir; prevCur = cur; prevT = t;
      return ended;
    },
  };
}

/** Does segment a->b pass through the circle at c with radius r? */
export function segmentHitsCircle(a, b, c, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2));
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y) <= r;
}
