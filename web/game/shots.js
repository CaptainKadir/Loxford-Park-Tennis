// Shot types, the trainer's prompts, and fitting the classifier thresholds from
// the player's own labelled swings. classify() must match shot_classify_values()
// in core/shot.c (a test compares them through the WASM build).

export const DRIVE = 1, TOPSPIN = 2, SLICE = 3, DROP = 4, LOB = 5;

export const DEFAULT_TUNING = {
  slowSpeed: 7, fastSpeed: 10.5, openFace: 0.2, closedFace: -0.2, lobPath: 0,
};

/** speed m/s, face rad (+ = open), path (+ = low to high). */
export function classify(speed, face, path, t = DEFAULT_TUNING) {
  const open = face >= t.openFace;
  if (speed < t.slowSpeed && open) return path >= t.lobPath ? LOB : DROP;
  if (open) return SLICE;
  if (speed >= t.fastSpeed && face <= t.closedFace) return TOPSPIN;
  return DRIVE;
}

/** What the trainer asks for. `type` is the expected shot; `back` uses the backhand face angle. */
export const ALL_PROMPTS = [
  { id: 'fh-drive', type: DRIVE, back: false, title: 'FOREHAND',
    how: 'Swing from your right side, like hitting a forehand. Screen facing forward, a firm level swing.' },
  { id: 'bh-drive', type: DRIVE, back: true, title: 'BACKHAND',
    how: 'Turn the phone to your left and swing across your body, like a backhand.' },
  { id: 'fh-topspin', type: TOPSPIN, back: false, title: 'FOREHAND TOPSPIN',
    how: 'A fast swing from low to high, screen tipped down a little (closed face).' },
  { id: 'bh-topspin', type: TOPSPIN, back: true, title: 'BACKHAND TOPSPIN',
    how: 'Same fast low-to-high brush on your left side, face a little closed.' },
  { id: 'fh-slice', type: SLICE, back: false, title: 'FOREHAND SLICE',
    how: 'Medium swing from high to low with the screen tipped up (open face).' },
  { id: 'bh-slice', type: SLICE, back: true, title: 'BACKHAND SLICE',
    how: 'High to low across your body, face open (screen tipped up).' },
  { id: 'drop', type: DROP, back: false, title: 'DROP SHOT',
    how: 'A slow, soft chop from high to low with the face open. Barely any swing speed.' },
  { id: 'lob', type: LOB, back: false, title: 'LOB',
    how: 'A slow scoop upward with the face open.' },
];
/** Basic: forehand, backhand and lob. The trainer shows all eight with ?all. */
export const PROMPTS = ALL_PROMPTS.filter((p) => p.type === DRIVE || p.type === LOB);
export const REPS = 4;

export const SHOT_NAMES = ['', 'drive', 'topspin', 'slice', 'drop shot', 'lob'];

/** samples: [{type, speed, face, path}] (face already the side that matches the prompt). */
export function accuracy(samples, t) {
  if (!samples.length) return 0;
  return samples.filter((s) => classify(s.speed, s.face, s.path, t) === s.type).length / samples.length;
}

const quantiles = (xs, n) => {
  const a = [...xs].sort((x, y) => x - y);
  const out = new Set();
  for (let i = 0; i < a.length; i++) {
    out.add(a[i]);
    if (i) out.add((a[i] + a[i - 1]) / 2);
  }
  const arr = [...out].sort((x, y) => x - y);
  if (arr.length <= n) return arr;
  return Array.from({ length: n }, (_, i) => arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
};

/** Pick thresholds that name the most recorded swings correctly: coordinate descent
 * over candidate values taken from the data itself. Ties keep the value closest to
 * the starting one, so unconstrained parameters stay put. */
export function fitTuning(samples, start = DEFAULT_TUNING) {
  const t = { ...start };
  const cands = {
    slowSpeed: quantiles(samples.map((s) => s.speed), 40),
    fastSpeed: quantiles(samples.map((s) => s.speed), 40),
    openFace: quantiles(samples.map((s) => s.face), 40),
    closedFace: quantiles(samples.map((s) => s.face), 40),
    lobPath: quantiles(samples.map((s) => s.path), 40),
  };
  let best = accuracy(samples, t);
  for (let round = 0; round < 6; round++) {
    let improved = false;
    for (const key of Object.keys(cands)) {
      let bestV = t[key], bestA = best;
      for (const v of cands[key]) {
        const a = accuracy(samples, { ...t, [key]: v });
        if (a > bestA + 1e-9 || (Math.abs(a - bestA) < 1e-9 && Math.abs(v - start[key]) < Math.abs(bestV - start[key]))) {
          bestA = a; bestV = v;
        }
      }
      if (bestA > best + 1e-9) improved = true;
      t[key] = bestV; best = bestA;
    }
    if (!improved) break;
  }
  return t;
}

/** Row per prompt: how many of its swings each shot type was named as. */
export function confusion(samples, t) {
  const rows = {};
  for (const s of samples) {
    const got = classify(s.speed, s.face, s.path, t);
    (rows[s.promptId] ??= { want: s.type, counts: {} });
    rows[s.promptId].counts[got] = (rows[s.promptId].counts[got] || 0) + 1;
  }
  return rows;
}
