// The example shots in the lessons: where the ball goes after each demo swing. A tiny physics sim (gravity, a little drag,
// spin as an extra push up or down, and a bounce that depends on the shot), tuned so each stroke looks like itself:
// the topspin dips and kicks up, the slice skids low, the drop shot dies, the lob floats. Pure maths, so it can be tested.
// Coordinates are core's: the cat stands at z = CAT_Z facing +z, the net is at z = 0, the far baseline at z = 11.885.

export const CAT_Z = -6.4;
const G = 9.8, DRAG = 0.05, FLOOR = 0.07;
// per shot kind: launch speed (m/s) and elevation (deg), spin push (m/s^2, + up), bounce keep (vertical, forward)
const KINDS = {
  drive: { sp: 20.6, el: 6, spin: 0, e: 0.78, f: 0.8 },
  top: { sp: 19.2, el: 17, spin: -6, e: 0.78, f: 0.92 },
  slice: { sp: 19.3, el: 3, spin: 3.5, e: 0.45, f: 0.55 },
  drop: { sp: 7.7, el: 24, spin: 2.5, e: 0.4, f: -0.15 },
  lob: { sp: 12.7, el: 52, spin: 0, e: 0.75, f: 0.8 },
};
export const SHOT_KIND = { 'fh-drive': 'drive', 'bh-drive': 'drive', 'fh-topspin': 'top', 'bh-topspin': 'top', 'fh-slice': 'slice', 'bh-slice': 'slice', drop: 'drop', lob: 'lob' };
const BACKHAND = new Set(['bh-drive', 'bh-topspin', 'bh-slice']);

/** A ball just struck by demo `id`: from beside the cat (forehands on its right, -x), heading cross-court. */
export function launchShot(id) {
  const k = KINDS[SHOT_KIND[id]], el = (k.el * Math.PI) / 180, back = BACKHAND.has(id);
  const straight = id === 'drop' || id === 'lob';
  const side = back ? 1 : -1; // the cat's right is -x
  return {
    id, kind: SHOT_KIND[id], t: 0, bounces: 0, landed: null, done: false,
    x: side * 0.45, y: 1.0, z: CAT_Z + 0.7,
    vx: -side * (straight ? 0.5 : 1.3), vy: k.sp * Math.sin(el), vz: k.sp * Math.cos(el),
  };
}

/** Move the ball dt seconds on (in small steps). Returns the same state; `landed` is set at the first bounce. */
export function stepShot(s, dt) {
  const k = KINDS[s.kind];
  let left = dt;
  while (left > 1e-9 && !s.done) {
    const h = Math.min(left, 1 / 240);
    left -= h;
    s.vy += (-G + (s.bounces ? 0 : k.spin)) * h;
    s.vz *= 1 - DRAG * h;
    s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h;
    s.t += h;
    if (s.y <= FLOOR && s.vy < 0) {
      if (!s.bounces) s.landed = { x: s.x, z: s.z };
      s.bounces++;
      s.vy = -s.vy * k.e; s.vz *= k.f; s.vx *= k.f; s.y = FLOOR;
    }
    if (s.t > 5 || s.z > 16 || s.z < CAT_Z - 3 || (s.bounces >= 3)) s.done = true;
  }
  return s;
}

export const SHOT_SLOW = 0.5; // the ball is shown at half speed so the arc and the bounce can be followed
const HOLD_AFTER_LAND = 1.1;   // real seconds the ring is shown after it lands
/** Real seconds from the moment of contact until the example shot has landed and been looked at. */
export function shotDuration(id) {
  const s = launchShot(id);
  while (!s.landed && s.t < 6) stepShot(s, 1 / 120);
  return s.t / SHOT_SLOW + HOLD_AFTER_LAND;
}

/** Run a whole shot and report what happened (used by the tests): net height, landing depth, bounce height. */
export function flyShot(id) {
  const s = launchShot(id);
  let netY = null, apex = s.y, bounceApex = 0, prevZ = s.z;
  while (!s.done && s.t < 6) {
    stepShot(s, 1 / 120);
    if (prevZ < 0 && s.z >= 0 && netY === null) netY = s.y;
    prevZ = s.z;
    apex = Math.max(apex, s.y);
    if (s.bounces >= 1) bounceApex = Math.max(bounceApex, s.y);
  }
  return { netY, landZ: s.landed?.z ?? null, landX: s.landed?.x ?? null, apex, bounceApex };
}
