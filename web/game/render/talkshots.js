// Camera shots and body language for the story cut scenes. Pure maths (no three.js), so it can be tested.
// Two cats stand at the net facing each other. The camera looks along +z, where +x is to the screen's left,
// so the hero (side 0) at +x appears on the left and the rival (side 1) at -x on the right.

export const TALK_Z = -2.0;       // how far in front of the net they stand (m)
export const TALK_X = 1.5;        // each stands this far from the centre line
export const HEAD_Y = 1.25;       // about where a cat's face is
export const POS = [[TALK_X, TALK_Z], [-TALK_X, TALK_Z]];
// body turn (rad): facing each other, a little towards the camera (which is behind them, on the baseline side)
export const YAW = [-Math.PI / 2 - 0.28, Math.PI / 2 + 0.28];

/**
 * A shot: where the camera is, what it looks at, and its field of view.
 * kind: 'wide' (both cats, establishing), 'two' (a closer two-shot), 'ots' (over the listener's shoulder at `speaker`, 0 or 1).
 */
export function shotFor(kind, speaker = 0) {
  if (kind === 'wide') return { pos: [0.4, 1.7, TALK_Z - 6.6], target: [0, 1.05, TALK_Z], fov: 40 };
  if (kind === 'two') return { pos: [0, 1.5, TALK_Z - 5.8], target: [0, 1.0, TALK_Z], fov: 40 };
  const s = POS[speaker], l = POS[1 - speaker];
  let dx = s[0] - l[0], dz = s[1] - l[1];
  const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  let px = -dz, pz = dx; // sideways, chosen to put the camera on the baseline side
  if (pz > 0) { px = -px; pz = -pz; }
  // a three-quarter view of the speaker from the baseline side, the listener just in or out of the frame
  const c = Math.cos(0.62), n = Math.sin(0.62), d = 3.6; // 35 degrees round from the line to the listener
  return {
    pos: [s[0] - dx * c * d + px * n * d, 1.38, s[1] - dz * c * d + pz * n * d],
    target: [s[0], 1.02, s[1]],
    fov: 36,
  };
}

/** Which shot for line `i` of `n`: an establishing shot first, over-the-shoulder on whoever speaks, a two-shot to finish. */
export function shotKind(i, n) { return i === 0 ? 'wide' : i === n - 1 && n > 2 ? 'two' : 'ots'; }

const sin = Math.sin, abs = Math.abs;
const REST_RACKET = [0.866, -0.5, 0, 0]; // [w x y z]: racket held up in front

/** Body language: one frame for a cat. talk: 0..1 how much it is talking, mood: 1 happy, -1 grumpy, 0 neutral, walk: 0..1 walking in. */
export function talkPose(t, talk, mood, walk = 0, seed = 0) {
  const ph = seed * 1.7;
  const beat = abs(sin(t * 8.5 + ph)); // syllables
  const happy = mood > 0 ? 1 : 0, grump = mood < 0 ? 1 : 0;
  const gest = [Math.cos(0.18 * sin(t * 3.1 + ph) / 2), 0, 0, Math.sin(0.18 * sin(t * 3.1 + ph) / 2)]; // a small wave of the racket
  const r = REST_RACKET, g = gest;
  const racket = talk > 0.05 ? [
    g[0] * r[0] - g[1] * r[1] - g[2] * r[2] - g[3] * r[3],
    g[0] * r[1] + g[1] * r[0] + g[2] * r[3] - g[3] * r[2],
    g[0] * r[2] - g[1] * r[3] + g[2] * r[0] + g[3] * r[1],
    g[0] * r[3] + g[1] * r[2] - g[2] * r[1] + g[3] * r[0],
  ] : r;
  return {
    hop: talk * (0.025 * beat + happy * 0.05 * abs(sin(t * 5.5 + ph))) + walk * 0.03 * abs(sin(t * 11)),
    sway: 0, roll: grump * talk * 0.05 * sin(t * 2.3 + ph), spin: 0,
    crouch: grump * 0.03,
    lean: talk * (0.05 + 0.04 * sin(t * 2 + ph)) - grump * 0.05,
    legPhase: walk * t * 12, legAmp: walk,
    tail: (0.35 + 0.35 * talk) * sin(t * (happy ? 6 : 1.8) + ph),
    twist: 0,
    headYaw: talk * 0.22 * sin(t * 1.7 + ph) + (1 - talk) * 0.06 * sin(t * 0.8 + ph),
    headPitch: talk * (0.1 * sin(t * 8.5 + ph) + 0.06) + (1 - talk) * 0.04 * sin(t * 1.1 + ph) + grump * 0.1,
    headZ: talk * 0.012,
    racket,
    mood,
  };
}

/** How the line's tone reads: '!' is happy, a grumble is grumpy. */
export function moodOf(text) {
  if (/hmph|ugh|eleven|brass band|sleepier|grumpy/i.test(text)) return -1;
  return /!/.test(text) ? 1 : 0;
}
