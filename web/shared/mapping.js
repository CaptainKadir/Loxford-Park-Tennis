// Fixing how the phone's orientation lines up with the racket, for when the on-screen bat does not
// move the way the hand does. Applied to the court-frame quaternion [w, x, y, z] before it reaches the game.
//   twist:  turn the phone's grip about its long axis (0, 90, 180, 270 degrees)
//   flipLR: mirror left and right
//   flipUD: mirror up and down
import { qmul, qnorm, rotate } from './frame.js';

export const DEFAULT_MAPPING = { flipLR: false, flipUD: false, twist: 0 };
const DEG = Math.PI / 180;

export function cleanMapping(m) {
  const twist = [0, 90, 180, 270].includes(Number(m?.twist)) ? Number(m.twist) : 0;
  return { flipLR: !!m?.flipLR, flipUD: !!m?.flipUD, twist };
}

export function applyMapping(q, m = DEFAULT_MAPPING) {
  let r = q;
  if (m.twist) {
    const a = m.twist * DEG;
    r = qnorm(qmul(r, [Math.cos(a / 2), 0, Math.sin(a / 2), 0])); // about the device y axis (head)
  }
  if (m.flipLR) r = [r[0], r[1], -r[2], -r[3]]; // reflect x
  if (m.flipUD) r = [r[0], -r[1], -r[2], r[3]]; // reflect z
  return r;
}

/** Where the phone's top points, in degrees: yaw + = left of the net, pitch + = up. */
export function headAngles(q) {
  const h = rotate(q, [0, 1, 0]);
  return { yaw: Math.atan2(-h[0], h[1]) / DEG, pitch: Math.asin(Math.max(-1, Math.min(1, h[2]))) / DEG };
}
