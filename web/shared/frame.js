// Phone orientation -> game reference frame R (x right, y toward the net, z up).
// Quaternions are [w, x, y, z]. Device frame: x right of screen, y top of
// screen, z out of the screen; DeviceOrientation world: x east, y north, z up.
const DEG = Math.PI / 180;
const MIN_HORIZ = 0.5; // device y-axis must be at least this horizontal to give a heading
const DRIFT_RANGE = 35 * DEG; // only drift this small is auto-corrected
const DRIFT_RATE = 0.25; // fraction of the error removed per second of stillness
const DRIFT_STILL_S = 2;

export const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
export const qconj = (q) => [q[0], -q[1], -q[2], -q[3]];
export const qnorm = (q) => {
  const n = Math.hypot(...q) || 1;
  return q.map((v) => v / n);
};
export function rotate(q, v) {
  const r = qmul(qmul(q, [0, v[0], v[1], v[2]]), qconj(q));
  return [r[1], r[2], r[3]];
}
const qz = (a) => [Math.cos(a / 2), 0, 0, Math.sin(a / 2)];
const qx = (a) => [Math.cos(a / 2), Math.sin(a / 2), 0, 0];
const qy = (a) => [Math.cos(a / 2), 0, Math.sin(a / 2), 0];

/** W3C DeviceOrientation angles (degrees) -> device-to-world quaternion (Z-X'-Y''). */
export function deviceQuat(alphaDeg, betaDeg, gammaDeg) {
  return qnorm(qmul(qmul(qz(alphaDeg * DEG), qx(betaDeg * DEG)), qy(gammaDeg * DEG)));
}

const heading = (q) => {
  const v = rotate(q, [0, 1, 0]);
  return Math.hypot(v[0], v[1]) < MIN_HORIZ ? null : Math.atan2(-v[0], v[1]);
};

/** Hold the phone with its top pointing at the net. Null if it is too vertical. */
export function calibrate(q) {
  const h = heading(q);
  return h === null ? null : { yaw0: h };
}

export const phoneToCourt = (q, calib) => qnorm(qmul(qz(-calib.yaw0), q));

/** Nudge yaw0 toward the current heading when still and only slightly off. */
export function driftCorrect(calib, q, stillSeconds, dt = 1) {
  if (stillSeconds < DRIFT_STILL_S) return calib;
  const h = heading(phoneToCourt(q, calib));
  if (h === null || Math.abs(h) > DRIFT_RANGE) return calib;
  return { yaw0: calib.yaw0 + h * Math.min(1, DRIFT_RATE * dt) };
}

/** Browsers disagree on the sign of accelerationIncludingGravity. Return the
 * acceleration in g with gravity pointing the way the orientation says it should. */
export function fixAccelSign(q, a, sign) {
  if (sign === undefined) {
    const g = rotate(qconj(q), [0, 0, 1]);
    sign = a[0] * g[0] + a[1] * g[1] + a[2] * g[2] < 0 ? -1 : 1;
  }
  return { a: a.map((x) => x * sign + 0), sign };
}
