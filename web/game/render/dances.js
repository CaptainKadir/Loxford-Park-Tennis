// A dance for every cat, shown on the character-select stage when the cat is on the cursor.
// Pure maths (no three.js): danceFor(catIndex, t) gives one frame of body, head, tail and racket movement.
//   hop, sway, roll, spin  - the whole cat: up (m), sideways (m), tilt (rad), extra turn (rad)
//   crouch, lean, legPhase, legAmp, tail - the body pose (same meaning as the in-game poses)
//   twist - body turn (rad), headYaw/headPitch/headZ - the head turn, nod (rad) and push forward (m)
//   racket - quaternion [w, x, y, z] in the cat's own frame, mood - 1 happy, -1 grumpy, 0 neutral
// Racket convention: identity points the head forward (+z); a turn of -90 degrees about x points it up.

export const DANCE_NAMES = ['The Hobo Shuffle', 'The Grumpy Stomp', 'The Ninja Spin', 'The Pigeon Strut', 'The Cloud Twirl', 'The Chaos Windmill'];

const TAU = Math.PI * 2;
const sin = Math.sin;
const smooth = (x) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
const abs = Math.abs;

/** Quaternion [w, x, y, z] for a turn of `a` radians about the unit axis (x, y, z). */
export const axisQuat = (a, x, y, z) => [Math.cos(a / 2), Math.sin(a / 2) * x, Math.sin(a / 2) * y, Math.sin(a / 2) * z];
/** Hamilton product a * b, both [w, x, y, z]: b first, then a. */
export function quatMul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

const REST = { hop: 0, sway: 0, roll: 0, spin: 0, crouch: 0, lean: 0, legPhase: 0, legAmp: 0, tail: 0, twist: 0, headYaw: 0, headPitch: 0, headZ: 0, mood: 0 };
const UP = (a = 1.4) => axisQuat(-a, 1, 0, 0); // racket raised

const DANCES = [
  // Otis, The Hobo: a slouching, swaying shuffle with the racket dragging like a walking stick, and a look around for scraps
  (t) => ({
    ...REST,
    sway: 0.14 * sin(t * 2), roll: 0.09 * sin(t * 2), lean: 0.28, crouch: 0.1 + 0.03 * sin(t * 4),
    legPhase: t * 4, legAmp: 0.3, tail: 0.25 * sin(t * 2), headPitch: 0.3, headYaw: 0.5 * sin(t * 1.3),
    racket: quatMul(axisQuat(0.35 * sin(t * 2), 0, 0, 1), axisQuat(1.05, 1, 0, 0)),
  }),
  // Minu, The Grumpy: stamping feet, a furious head shake and the racket wagged like a finger
  (t) => {
    const stomp = abs(sin(t * 3.5));
    return {
      ...REST,
      crouch: 0.07 * (1 - stomp), lean: 0.18, legPhase: t * 7, legAmp: 0.9, tail: 1.0 * sin(t * 9),
      headYaw: 0.7 * sin(t * 6) * smooth(sin(t * 0.9) * 2 + 0.6), headPitch: 0.15, mood: -1,
      racket: quatMul(axisQuat(0.45 * sin(t * 7), 0, 0, 1), UP(0.7)),
    };
  },
  // Bombay, The Ninja: hold a low stance, spin a full turn with the racket out like a blade, freeze in a pose
  (t) => {
    const p = (t % 4) / 4;
    const spin = smooth((p - 0.4) / 0.3) * TAU;
    const inSpin = p > 0.4 && p < 0.7;
    return {
      ...REST,
      crouch: inSpin ? 0.05 : 0.2, lean: 0.12, hop: inSpin ? 0.28 * sin(smooth((p - 0.4) / 0.3) * Math.PI) : 0, spin,
      legAmp: 0, tail: 0.15 * sin(t * 3), headYaw: p < 0.4 ? 0.9 * sin(t * 2) : 0,
      racket: inSpin ? axisQuat(Math.PI / 2, 0, 1, 0) : p < 0.4 ? quatMul(axisQuat(0.5, 0, 1, 0), UP(0.3)) : UP(0.9),
    };
  },
  // Bella, The Pigeon Whisperer: a pigeon strut with the head jabbing forward on every step and the racket flapping like a wing
  (t) => ({
    ...REST,
    legPhase: t * 5, legAmp: 0.6, hop: 0.02 * abs(sin(t * 5)), roll: 0.1 * sin(t * 2.5),
    headZ: 0.08 * (0.5 + 0.5 * sin(t * 5)), headPitch: 0.1 * sin(t * 5), tail: 0.6 * abs(sin(t * 5)), lean: 0.1,
    racket: quatMul(axisQuat(0.55 * sin(t * 10), 0, 0, 1), axisQuat(Math.PI / 2, 0, 1, 0)),
  }),
  // Snowy, Fluffy as a Cloud: a floating pirouette on tiptoes with the racket held high like a ribbon
  (t) => ({
    ...REST,
    spin: t * 1.3, hop: 0.07 * (0.5 + 0.5 * sin(t * 2.6)), legPhase: t * 2.6, legAmp: 0.15, lean: -0.05,
    tail: 0.9 * sin(t * 2), headPitch: -0.12, mood: 0,
    racket: quatMul(axisQuat(0.45 * sin(t * 1.3), 0, 0, 1), UP(1.45)),
  }),
  // Biscuit, The Terrorist: pure chaos. Manic hops, a windmilling racket, a banging head and a lashing tail
  (t) => ({
    ...REST,
    hop: 0.18 * abs(sin(t * 6)), lean: 0.2 * sin(t * 6), legPhase: t * 12, legAmp: 1, tail: sin(t * 14),
    headPitch: 0.5 * sin(t * 12), roll: 0.12 * sin(t * 6), mood: 1,
    racket: axisQuat(-(t * 7), 1, 0, 0),
  }),
];

/** One frame of cat `catIndex`'s dance at time t seconds, with the racket quaternion always present. */
export function danceFor(catIndex, t) {
  const f = DANCES[((catIndex % DANCES.length) + DANCES.length) % DANCES.length];
  const d = f(t);
  d.racket = d.racket || UP(1.2);
  return d;
}

const NUMERIC = Object.keys(REST);
/** Ease a dance frame in or out: w 0 is the plain pose (racket `rest`), w 1 the full dance. */
export function blendDance(d, w, rest) {
  const out = {};
  NUMERIC.forEach((k) => { out[k] = (d[k] || 0) * w; });
  const dot = d.racket[0] * rest[0] + d.racket[1] * rest[1] + d.racket[2] * rest[2] + d.racket[3] * rest[3];
  const sgn = dot < 0 ? -1 : 1; // stay on the short way round
  const q = d.racket.map((v, i) => rest[i] + (v * sgn - rest[i]) * w);
  const n = Math.hypot(...q) || 1;
  out.racket = q.map((v) => v / n);
  return out;
}
