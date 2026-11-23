// Pause screen text, last-point replay recorder and the pre-match camera. All pure, so they are tested without a browser.

export const KEY_HELP = [
  ['Arrows / WASD', 'Move your cat'],
  ['Phone swing', 'Hit the ball. Right side = forehand, left side = backhand'],
  ['Phone swing (toss)', 'Serve: swing when the ball is high'],
  ['Esc or P', 'Pause / resume'],
  ['S', 'Settings page (while paused); Up/Down, Left/Right pick and change, Esc goes back'],
  ['R', 'Replay the last point (C changes the camera angle)'],
  ['T', 'Match stats: points, aces, winners, where your shots landed'],
  ['C', 'Review the last landing mark (3 a match). In a replay, C changes the angle'],
  ['E or the phone button', 'Emote: your cat shows off (only between points). Two players: E is player 1, / is player 2'],
  ['W A S D / arrows', 'Two players on one keyboard: WASD moves player 1, the arrows move player 2'],
  ['M', 'Main menu (from pause)'],
  ['Enter / Space', 'Skip the intro or replay, start a rematch'],
];

/** Pause overlay markup: the three actions, the settings, and the key legend folded behind a Controls button.
 * settings: [{ i, label, value, note?, sel, help }]. */
export function pauseHtml(help = KEY_HELP, settings = [], { keysOpen = false, restart = false, stats = false, settingsOpen = false } = {}) {
  const keyRows = help.map(([k, v]) => `<div class="krow"><kbd>${k}</kbd><span>${v}</span></div>`).join('');
  const sel = settings.find((s) => s.sel);
  const set = settings.map((s) => `<div class="srow${s.sel ? ' sel' : ''}" data-i="${s.i}"><span>${s.label}${s.note ? ` <small>${s.note}</small>` : ''}</span><span class="val"><button data-act="left" data-i="${s.i}" aria-label="Previous">&#9664;</button><b>${s.value}</b><button data-act="right" data-i="${s.i}" aria-label="Next">&#9654;</button></span></div>`).join('');
  const act = (id, label, key, primary) => `<button class="pact${primary ? ' primary' : ''}" data-pact="${id}"><span>${label}</span><kbd>${key}</kbd></button>`;
  const setPanel = set ? `<div class="pset"><div class="phead">Settings</div>${set}<p class="sethelp">${sel?.help ?? ''}</p></div>` : '';
  if (settingsOpen) {
    return `<div class="ptitle">PAUSED</div>${setPanel}<div class="pacts">${act('back', 'Back', 'Esc', true)}</div>`
      + `<div class="phint">&uarr;&darr; &larr;&rarr; settings &middot; Esc back</div>`;
  }
  return `<div class="ptitle">PAUSED</div>`
    + `<div class="pacts">${act('resume', 'Resume', 'Esc', true)}${act('replay', 'Replay last point', 'R')}${stats ? act('stats', 'Match stats', 'T') : ''}${set ? act('settings', 'Settings', 'S') : ''}${restart ? act('restart', 'Restart match', '') : ''}${act('menu', 'Main menu', 'M')}</div>`
    + `<div class="pkeys"><button class="pkeybtn" data-pkeys aria-expanded="${keysOpen}">Controls ${keysOpen ? '&#9652;' : '&#9662;'}</button>${keysOpen ? `<div class="khelp">${keyRows}</div>` : ''}</div>`
    + `<div class="phint">S settings &middot; Esc resume</div>`;
}

/**
 * Keeps every frame of the rally in progress and of the one before it.
 * A rally starts when the lab enters its serve state; `current` is cleared into `last` then.
 * Each frame: { at (s since the point began), st, st2, status, status2 }.
 */
export function createRecorder({ maxFrames = 4000 } = {}) {
  let current = [], last = [], clock = 0, prevLab = -1;
  const LAB_WAIT = 0, LAB_RESULT = 3, LAB_SERVE = 5;
  return {
    push(dt, st, st2, status, status2) {
      if (st.labState === LAB_SERVE && prevLab !== LAB_SERVE) {
        if (current.some((f) => f.st.labState !== LAB_WAIT)) last = current; // keep a point that really was played
        current = []; clock = 0;
      }
      prevLab = st.labState;
      clock += dt;
      current.push({ at: clock, st, st2, status, status2 });
      if (current.length > maxFrames) current.splice(0, current.length - maxFrames);
    },
    /** The point to replay: the one just finished (result or wait), else the previous one. */
    clip() {
      const finished = prevLab === LAB_RESULT || prevLab === LAB_WAIT || (current.length && current[current.length - 1].st.matchOver);
      const c = finished && current.some((f) => f.st.labState !== LAB_WAIT) ? current : last;
      return c.length > 30 ? c : [];
    },
  };
}

/** Frame index to show `t` seconds into a clip (clamped); -1 for an empty clip. */
export function frameAt(clip, t) {
  if (!clip.length) return -1;
  const t0 = clip[0].at;
  let lo = 0, hi = clip.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (clip[mid].at - t0 < t) lo = mid + 1; else hi = mid; }
  return lo;
}
export const clipLength = (clip) => (clip.length ? clip[clip.length - 1].at - clip[0].at : 0);

/** Replay camera angles: the recorded match view is last so you can compare. Each takes a recorded state and returns a camera
 * (core coordinates: x across, y up, z along the court, the player at -z). They follow the ball a little so the rally stays framed. */
export const REPLAY_ANGLES = [
  { name: 'Side-on', cam: (st) => { const z = clamp(st.ballZ * 0.7, -7, 7); return { ex: -10.5, ey: 2.6, ez: z * 0.5, tx: 0, ty: 1.0, tz: z, fov: 44 }; } },
  { name: 'Behind the CPU', cam: (st) => ({ ex: clamp(st.ballX * 0.25, -1.5, 1.5), ey: 3.6, ez: 14.5, tx: clamp(st.ballX * 0.4, -2, 2), ty: 0.9, tz: -5, fov: 48 }) },
  { name: 'Overhead', cam: (st) => ({ ex: 0, ey: 17, ez: clamp(st.ballZ * 0.3, -3, 3) - 0.01, // offset along z only: lookAt's up vector then keeps the baselines horizontal
    tx: 0, ty: 0, tz: clamp(st.ballZ * 0.3, -3, 3), fov: 52 }) },
  { name: 'Match view', cam: null },
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** A recorded state with its camera swapped for the chosen replay angle (the original state when the angle has none). */
export function withReplayAngle(st, angle) {
  const a = REPLAY_ANGLES[angle % REPLAY_ANGLES.length];
  if (!st || !a.cam) return st;
  const c = a.cam(st);
  return { ...st, camEX: c.ex, camEY: c.ey, camEZ: c.ez, camTX: c.tx, camTY: c.ty, camTZ: c.tz, camFov: c.fov };
}

const smooth = (p) => p * p * (3 - 2 * p);
const lerp = (a, b, u) => a + (b - a) * u;
export const INTRO_TIME = 4.6;

// ---- the ball catches fire as a rally goes on ----
export const FIRE_START = 9, FIRE_FULL = 28; // hits in the point: first embers, then a blazing ball
/** How on fire the ball is, 0..1, after `hits` hits in the current point (eased, so it builds gradually). */
export function fireLevel(hits) {
  const u = Math.max(0, Math.min(1, (hits - (FIRE_START - 1)) / (FIRE_FULL - FIRE_START + 1)));
  return u * u * (3 - 2 * u);
}

// ---- the emote: a short cut scene of your cat showing off, only between points ----
export const EMOTE_TIME = 3.6;
const LAB_WAIT = 0, LAB_RESULT = 3; // the lab's states between points (see core/lab.h)
/** An emote may start while no point is being played and the match is still on. st: the core state.
 * A core waiting with no timer is waiting for the other player's serve (two-player, online): that is the start of a point, not a break. */
export const canEmote = (st) => !st.matchOver && (st.labState === LAB_RESULT || (st.labState === LAB_WAIT && !st.waitingForServe));
/** How much of the dance to show at t seconds: eased in and out so the cat does not snap into pose. */
export const emoteWeight = (t, dur = EMOTE_TIME) => Math.max(0, Math.min(1, t / 0.4, (dur - t) / 0.4));
/** The emote camera: in front of the cat (which faces +z), swinging slowly round it and moving in. */
export function emoteCam(t, cat, dur = EMOTE_TIME) {
  const e = smooth(Math.min(1, Math.max(0, t / dur)));
  const ang = lerp(-0.75, 0.55, e), r = lerp(4.6, 3.1, e);
  return { ex: cat.x + Math.sin(ang) * r, ey: lerp(1.9, 1.25, e), ez: cat.z + Math.cos(ang) * r, tx: cat.x, ty: 0.95, tz: cat.z, fov: lerp(44, 38, e) };
}

/** The cut scene camera at t seconds: a high circling shot that swoops down and lands exactly on the match camera `base`
 * ({ex,ey,ez,tx,ty,tz,fov}) at the end. */
export function introCam(t, base, dur = INTRO_TIME) {
  const u = Math.min(1, Math.max(0, t / dur));
  const e = smooth(u);
  const r0 = Math.hypot(base.ex, base.ez);
  const baseAng = Math.atan2(base.ex, base.ez);
  const ang = baseAng + (1 - e) * 2.3; // swing round from the far side
  const r = lerp(Math.max(r0 + 3, 14), r0, e);
  const ey = lerp(6, base.ey, e);
  const look = smooth(Math.min(1, u * 1.6)); // eyes settle on the match target a little before the end
  return {
    ex: Math.sin(ang) * r * lerp(0.5, 1, e), ey, ez: Math.cos(ang) * r, // squeezed sideways early on so the shot stays inside the stands
    tx: lerp(0, base.tx, look), ty: lerp(1.0, base.ty, look), tz: lerp(0, base.tz, look),
    fov: lerp(base.fov + 14, base.fov, e),
  };
}

/** What the intro overlay shows at t seconds. */
export function introCaption(t, names, dur = INTRO_TIME) {
  if (t >= dur - 0.7) return { phase: 'go', big: 'PLAY!', small: '' };
  if (t >= 0.2) return { phase: 'vs', big: `${names[0]}  vs  ${names[1]}`, small: 'Loxford Park Tennis' };
  return { phase: 'in', big: '', small: '' };
}
