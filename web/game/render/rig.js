// Pure rig maths for the cats: where the racket arm goes, and body clips.
// Core coordinates (right-handed): y up, z forward for a cat facing +z, so the
// cat's right is -x.
import { rotate } from '../../shared/frame.js';

export const ARM_REACH = 0.62; // m, shoulder to paw
const RACKET_FORWARD_BIAS = [0.4, -0.2, 0.6]; // x is scaled by the handedness side
const HEAD_FOLLOW = 0.9;

const norm = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

/** Rotate a quaternion from the phone/court reference frame R (x right, y toward
 * the net, z up) into core coordinates for a cat facing +z (right = -x, up = y,
 * forward = z): R.x -> -x, R.y -> z, R.z -> y, a proper rotation. */
export const quatRToCore = (q) => [q[0], -q[1], q[3], q[2]];

/** Racket pose from the phone quaternion q (core coordinates, see quatRToCore). The orientation is
 * exactly the phone's; only the paw position is synthesised, following where
 * the racket head points. */
export function solveRacketArm(shoulder, q, rightHanded) {
  const side = rightHanded ? -1 : 1; // x offset toward the racket-arm side
  const head = rotate(q, [0, 0, 1]); // racket head points along core +z at identity
  const dir = norm([
    RACKET_FORWARD_BIAS[0] * side + HEAD_FOLLOW * head[0],
    RACKET_FORWARD_BIAS[1] + HEAD_FOLLOW * head[1],
    RACKET_FORWARD_BIAS[2] + HEAD_FOLLOW * head[2],
  ]);
  const paw = shoulder.map((s, i) => s + dir[i] * ARM_REACH);
  const mid = shoulder.map((s, i) => s + (paw[i] - s) / 2);
  const elbow = [mid[0] + side * 0.12, mid[1] - 0.12, mid[2]];
  // keep the elbow inside reach too
  const d = Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]);
  const k = d > ARM_REACH ? ARM_REACH / d : 1;
  return {
    elbow: shoulder.map((s, i) => s + (elbow[i] - s) * k),
    paw,
    racketPos: paw,
    racketQuat: q,
  };
}

const BODY_YAW_GAIN = 1.0;
const BODY_YAW_MAX = 1.7; // rad (about 97 degrees)

/** Body turn (rad about core y, + = toward the cat's left, +x) that follows where the
 * racket head points sideways, so turning the phone left turns the cat for a backhand. */
export function bodyYawFromRacket(q) {
  const head = rotate(q, [0, 0, 1]);
  const yaw = Math.atan2(head[0], head[2]);
  return Math.max(-BODY_YAW_MAX, Math.min(BODY_YAW_MAX, yaw * BODY_YAW_GAIN));
}

export const idlePose = (t) => ({
  bob: 0.012 * Math.sin(t * 2 * Math.PI * 0.8),
  legPhase: 0, legAmp: 0, tail: 0.35 * Math.sin(t * 2.2), lean: 0, crouch: 0, twist: 0,
});

export const runPose = (phase, speed) => {
  const legAmp = Math.min(1, speed / 6);
  return {
    bob: 0.04 * Math.abs(Math.sin(phase)) * legAmp,
    legPhase: phase, legAmp, tail: 0.5 * Math.sin(phase * 0.5), lean: 0.2 * legAmp, crouch: 0, twist: 0,
  };
};

export const readyPose = (t) => ({ ...idlePose(t), crouch: 0.1, lean: 0.12 });

const smooth = (p) => p * p * (3 - 2 * p);
const bump = (p, a, b) => Math.sin(Math.PI * Math.min(1, Math.max(0, (p - a) / (b - a)))); // 0 outside [a,b], 1 in the middle

/** Which swing animation a stroke gets. side: 0 serve, 1 forehand, 2 backhand (as the core reports it);
 * shot: 1 drive, 2 topspin, 3 slice, 4 drop, 5 lob. */
export function swingKind(side, shot = 1) {
  const back = side === 2;
  if (side === 0) return { name: 'serve', back: false };
  const name = ['', 'drive', 'topspin', 'slice', 'drop', 'lob'][shot] || 'drive';
  return { name: name === 'drive' ? (back ? 'backhand' : 'forehand') : name, back };
}

/** Seconds each swing animation takes. */
export const SWING_TIME = { forehand: 0.5, backhand: 0.5, serve: 0.85, topspin: 0.6, slice: 0.48, drop: 0.7, lob: 0.7 };
/** How much the body clips are exaggerated so each stroke reads at a glance. */
export const SWING_AMP = { lean: 2, crouch: 1.8, rise: 2, roll: 2.2, lunge: 1.8, twist: 1.6, tail: 1.5 };
export const amplify = (pose) => { const o = { ...pose }; for (const [k, g] of Object.entries(SWING_AMP)) if (typeof o[k] === 'number') o[k] *= g; return o; };
export const swingTime = (kind) => SWING_TIME[kind?.name] ?? 0.35;

/** progress p in [0,1]: backswing to follow-through. twist in radians, + toward the player's right for right-handers.
 * kind (from swingKind) picks the animation; without it the plain forehand-ish swing is used.
 * Extra fields: lunge (legs split, front foot forward, + = the foot opposite the racket arm), rise (body lifts, m), roll (body tilt, rad). */
export function swingPose(p, rightHanded, kind) {
  const side = rightHanded ? 1 : -1;
  const e = smooth(p);
  const base = { bob: 0, legPhase: 0, legAmp: 0, tail: 0.8 * e, lean: 0.1, crouch: 0.08, twist: side * (-0.6 + 1.4 * e), lunge: 0, rise: 0, roll: 0 };
  if (!kind) return base;
  const front = kind.back ? -1 : 1; // a backhand steps in with the racket-side foot
  switch (kind.name) {
    case 'forehand': // open stance: coil, then rotate through the ball, weight onto the front foot
      return { ...base, lean: 0.06 + 0.2 * e, crouch: 0.1 * bump(p, 0, 0.7) + 0.04, lunge: 0.45 * bump(p, 0, 1) * front, roll: side * 0.1 * (1 - e) };
    case 'backhand': // turn the shoulders away early, step across, tilt the other way
      return { ...base, twist: -side * (-0.5 + 1.2 * e), lean: 0.1 + 0.22 * e, crouch: 0.12 * bump(p, 0, 0.7) + 0.04, lunge: 0.5 * bump(p, 0, 1) * front, roll: -side * 0.14 * (1 - e), tail: -0.7 * e };
    case 'serve': { // coil down, toss and stretch up, then snap forward
      const load = bump(p, 0, 0.35), up = bump(p, 0.3, 0.62), snap = smooth(Math.min(1, Math.max(0, (p - 0.5) / 0.4)));
      return { ...base, crouch: 0.2 * load - 0.04 * up, rise: 0.2 * up, lean: -0.3 * load - 0.12 * up + 0.5 * snap, twist: side * (-0.8 + 1.7 * snap), tail: 1.0 * up, lunge: 0.25 * up * front };
    }
    case 'topspin': { // sink low, drive up and through the ball, a little jump
      const sink = bump(p, 0, 0.4), jump = bump(p, 0.35, 0.9);
      return { ...base, crouch: 0.26 * sink, rise: 0.14 * jump, lean: 0.32 * e, twist: side * (-0.9 + 1.9 * e), lunge: 0.4 * sink * front, tail: 1.1 * e };
    }
    case 'slice': // low and short, shoulders stay quiet, chop down and across
      return { ...base, crouch: 0.16, lean: 0.34 * bump(p, 0.1, 1), twist: side * (-0.3 + 0.7 * e), lunge: 0.5 * bump(p, 0, 1) * front, roll: side * 0.05, tail: 0.3 * e };
    case 'drop': // a soft touch: sink and tip forward, tiny motion
      return { ...base, crouch: 0.14 * bump(p, 0, 1), lean: 0.3 * bump(p, 0, 1), twist: side * (-0.2 + 0.4 * e), lunge: 0.2 * bump(p, 0, 1) * front, tail: 0.2 * e };
    case 'lob': { // scoop from low, rise tall and lean back as the ball goes up
      const low = bump(p, 0, 0.45), tall = bump(p, 0.3, 1);
      return { ...base, crouch: 0.22 * low, rise: 0.1 * tall, lean: -0.18 * tall, twist: side * (-0.4 + 0.9 * e), lunge: 0.2 * low * front, tail: 0.6 * tall };
    }
    default: return base;
  }
}
