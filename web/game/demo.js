// Scripted racket orientations for the trainer's in-game example swings.
// The phone is shown the way the game draws it: device top = racket head, device screen = racket face.
// Frame R: x right, y toward the net, z up. Quaternions are [w, x, y, z].
//
// A pose is (psi, phi, gamma) in degrees:
//   psi   direction the face looks along, 0 = at the net, + = to the player's left
//   phi   face tilt, + = open (face looks up), - = closed
//   gamma racket head angle within the face plane, 0 = pointing up, + = toward the player's right, 90 = level right

const D = Math.PI / 180;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotation matrix columns (device x, y, z in R) -> unit quaternion. */
function matToQuat(c0, c1, c2) {
  const [m00, m10, m20] = c0, [m01, m11, m21] = c1, [m02, m12, m22] = c2;
  const tr = m00 + m11 + m22;
  let w, x, y, z;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4;
  }
  const n = Math.hypot(w, x, y, z);
  return [w / n, x / n, y / n, z / n];
}

/** Head and face-normal vectors in R for a pose. */
export function poseVectors(psi, phi, gamma) {
  const p = psi * D, f = phi * D, g = gamma * D;
  const n = [-Math.sin(p) * Math.cos(f), Math.cos(p) * Math.cos(f), Math.sin(f)];
  const s = [Math.cos(p), Math.sin(p), 0]; // horizontal, to the player's right of the facing direction
  const u2 = cross(n, s); // up within the face plane
  const head = [0, 1, 2].map((i) => Math.cos(g) * u2[i] + Math.sin(g) * s[i]);
  return { head, n };
}

/** Device quaternion (frame R) for a pose; device y = head, device z = face normal. */
export function poseQuat(psi, phi, gamma) {
  const { head, n } = poseVectors(psi, phi, gamma);
  const xd = cross(head, n);
  return matToQuat(xd, head, n);
}

// params: the stroke the core is given for the example return (speed m/s, face rad, path). keys: [u in 0..1, psi, phi, gamma];
// the contact is at `hit` (fraction of secs).
export const DEMOS = {
  'fh-drive': { params: { speed: 14, face: 0.03, path: 0.05 }, secs: 0.7, hit: 0.55, speed: 'medium-fast', face: 'upright',
    keys: [[0, -55, 0, 55], [0.55, 5, 0, 10], [1, 60, 0, -25]] },
  'bh-drive': { params: { speed: 14, face: 0.03, path: 0.05 }, secs: 0.7, hit: 0.55, speed: 'medium-fast', face: 'upright', left: true,
    keys: [[0, 60, 0, -55], [0.55, -5, 0, -10], [1, -60, 0, 25]] },
  'fh-topspin': { params: { speed: 14, face: -0.3, path: 0.4 }, secs: 0.45, hit: 0.55, speed: 'fast', face: 'slightly closed',
    keys: [[0, -55, -12, 100], [0.55, 5, -15, 25], [1, 70, -10, -50]] },
  'bh-topspin': { params: { speed: 14, face: -0.3, path: 0.4 }, secs: 0.45, hit: 0.55, speed: 'fast', face: 'slightly closed', left: true,
    keys: [[0, 60, -12, -100], [0.55, -5, -15, -25], [1, -70, -10, 50]] },
  'fh-slice': { params: { speed: 9, face: 0.35, path: -0.4 }, secs: 0.8, hit: 0.5, speed: 'medium', face: 'open (tilted up)',
    keys: [[0, -40, 30, -25], [0.5, 8, 30, 35], [1, 40, 25, 95]] },
  'bh-slice': { params: { speed: 9, face: 0.35, path: -0.4 }, secs: 0.8, hit: 0.5, speed: 'medium', face: 'open (tilted up)', left: true,
    keys: [[0, 40, 30, 25], [0.5, -8, 30, -35], [1, -40, 25, -95]] },
  drop: { params: { speed: 5.5, face: 0.3, path: -0.4 }, secs: 1.25, hit: 0.6, speed: 'slow and soft', face: 'open (tilted up)',
    keys: [[0, -25, 40, -10], [0.6, 5, 42, 40], [1, 12, 40, 55]] },
  lob: { params: { speed: 5.5, face: 0.3, path: 0.5 }, secs: 1.15, hit: 0.5, speed: 'slow, scooping up', face: 'open (tilted up)',
    keys: [[0, -30, 25, 105], [0.5, 4, 42, 30], [1, 25, 45, -35]] },
};

const ease = (u) => u * u * (3 - 2 * u);

/** Pose [psi, phi, gamma] at time u (0..1) of a demo. */
export function demoAngles(id, u) {
  const keys = DEMOS[id].keys;
  const uu = Math.min(1, Math.max(0, u));
  for (let i = 1; i < keys.length; i++) {
    if (uu <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      const k = ease((uu - a[0]) / (b[0] - a[0] || 1));
      return [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * k);
    }
  }
  return keys[keys.length - 1].slice(1);
}

export const demoQuat = (id, u) => poseQuat(...demoAngles(id, u));
