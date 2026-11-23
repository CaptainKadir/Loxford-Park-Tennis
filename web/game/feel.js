// Game-feel rules that need no browser: how hard an impact is, what the crowd and the cats say, what each court surface does to a
// bounce, and the close-call (Hawk-Eye style) review. Pure, so it is tested without a window.
// Everything here is cosmetic: none of it feeds back into the core's physics.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- court geometry (core units: x across with +x the player's left, z along the court with the player at -z; metres) ----
export const COURT = { halfW: 4.115, halfL: 11.885, service: 6.4 };

// ---- impacts: a hard hit holds the cat's pose for a few frames and punches the camera in; a serve or smash does more ----
/** How strong the impact of the hit that just happened is, 0 (none) to 1 (a full-power smash or a hit on a burning ball). */
export function impactOf(prev, cur, { rally = 0 } = {}) {
  if (!prev || cur.hits <= prev.hits) return 0;
  const sp = cur.hitSpeed ?? 0;
  const base = clamp((sp - 8) / 14, 0, 1); // 8 m/s is a rally ball, 22 m/s a big serve or smash
  const fire = clamp((rally - 8) / 12, 0, 0.5);
  return clamp(base + fire, 0, 1);
}
/** Seconds the cat's pose is held at contact. Short enough that the ball is still on its way when the cat moves again. */
export const holdFor = (impact) => (impact < 0.15 ? 0 : 0.03 + impact * 0.06);
/** The camera punch: the field of view narrows by this many degrees at the moment of impact, then eases back. */
export const punchFor = (impact) => impact * 3.2;

// ---- the rally builds up the crowd and the camera ----
/** 0..1: how worked up the crowd is after `hits` hits in the point. */
export const rallyIntensity = (hits) => clamp((hits - 3) / 14, 0, 1);
/** Crowd murmur level during a rally (0 between points). */
export const crowdBed = (hits, inPlay) => (inPlay && hits >= 4 ? 0.1 + rallyIntensity(hits) * 0.5 : 0); // silent until a rally is really going: a constant hiss under every point is just noise
/** The camera pulls in a little as a long rally goes on (degrees of field of view). */
export const rallyZoom = (hits) => rallyIntensity(hits) * 2.5;

// ---- surfaces: what a bounce and a footstep do on each court (the physics stays the same on all of them) ----
export const SURFACES = {
  clay: { dust: 0xd9784a, dustN: 12, flecks: 3, bounceHz: 1800, stepHz: 2400, bounceGain: 0.9, stepGain: 0.8, skid: true },
  hard: { dust: 0xe8e2d0, dustN: 5, flecks: 0, bounceHz: 9000, stepHz: 9000, bounceGain: 1.1, stepGain: 1.1, skid: false },
  grass: { dust: 0x9fd488, dustN: 8, flecks: 6, bounceHz: 1200, stepHz: 3200, bounceGain: 0.75, stepGain: 0.9, skid: false },
};
export const surfaceFor = (courtId) => SURFACES[courtId] ?? SURFACES.hard;

// ---- each cat has its own voice: a pitch multiplier for grunts, groans and cheers ----
export const CAT_PITCH = [0.85, 0.7, 0.62, 1.25, 1.4, 1.1, 0.5]; // Otis, Minu, Bombay, Bella, Snowy, Biscuit, Professor Hoot
export const catPitch = (cat) => CAT_PITCH[((cat | 0) % CAT_PITCH.length + CAT_PITCH.length) % CAT_PITCH.length];

// ---- the layered racket sound: a low thump (the strings), a bright crack (the frame) and a wood knock for a mis-hit ----
/** The three synth layers to add on top of the recorded hit. speed: ball speed after contact, m/s. */
export function racketLayers(speed, { serve = false } = {}) {
  const s = clamp((speed - 5) / 20, 0, 1);
  return {
    thump: { gain: 0.25 + s * 0.45, hz: serve ? 110 : 150 - s * 40, len: 0.09 + s * 0.05 },
    crack: { gain: 0.1 + s * 0.4, hz: 2600 + s * 2200, len: 0.035 + s * 0.02 },
    knock: { gain: s < 0.12 ? 0.18 : 0, hz: 520, len: 0.05 }, // a very soft ball is a frame shot
  };
}

// ---- crowd and cat reactions, from what just happened ----
/**
 * What the crowd and the cats call out for a change of state. Each: { sound: 'gasp'|'groan'|'cheer'|'effort'|'ooh'|'stinger', gain, who? }.
 * ctx: { rally (hits in the point that just ended), closeCall }.
 */
export function reactionsFor(prev, cur, ctx = {}) {
  if (!prev) return [];
  const out = [];
  const pts = cur.pointsHuman + cur.pointsCpu, was = prev.pointsHuman + prev.pointsCpu;
  const rally = ctx.rally ?? 0;
  if (pts > was) {
    const humanWon = cur.pointsHuman > prev.pointsHuman;
    if (rally >= 8) out.push({ sound: humanWon ? 'cheer' : 'groan', gain: clamp(0.4 + rally / 24, 0.4, 1) });
    else if (humanWon) out.push({ sound: 'cheer', gain: 0.35 });
    if (ctx.closeCall) out.push({ sound: 'gasp', gain: 0.7 });
  }
  // a grunt on a hard shot, or on a backhand with some weight behind it (never the serve)
  if (cur.hits > prev.hits && cur.hitSide !== 0 && ((cur.hitSpeed ?? 0) >= 15 || (cur.hitSide === 2 && (cur.hitSpeed ?? 0) >= 10)))
    out.push({ sound: 'effort', gain: clamp(0.4 + ((cur.hitSpeed ?? 0) - 10) * 0.02, 0.4, 0.75), who: 0, side: cur.hitSide, speed: cur.hitSpeed ?? 0 });
  if (cur.cpuHits > prev.cpuHits && rally >= 10) out.push({ sound: 'ooh', gain: 0.35 });
  const g = ctx.gamesToWin || 4;
  const mpNow = matchPoint(cur, g), mpWas = matchPoint(prev, g);
  if (mpNow && !mpWas) out.push({ sound: 'stinger', gain: 1 });
  return out;
}

/** Whether the next point could end the match (a player holds game point in the last game needed). */
export function matchPoint(st, gamesToWin = 4) {
  if (!st || st.matchOver) return false;
  const gamePoint = (a, b) => a >= 3 && a > b; // 40 (or advantage) against less: the next point wins the game
  const takesMatch = (g, o) => { const n = g + 1; return (n >= gamesToWin && n - o >= 2) || (n > gamesToWin - 1 && n > o && o >= gamesToWin - 1); }; // the core's own rule (core/score.c)
  return (gamePoint(st.ptsH, st.ptsC) && takesMatch(st.gamesH, st.gamesC)) || (gamePoint(st.ptsC, st.ptsH) && takesMatch(st.gamesC, st.gamesH));
}

// ---- landing marks and close calls ----
/** Track where the ball lands. Feed it every state; it returns { x, z } the moment a bounce happens (interpolated between the two frames), else null. */
export function createBounceTracker() {
  let prev = null;
  return {
    reset() { prev = null; },
    push(st) {
      let out = null;
      if (prev && prev.ballVY < -0.5 && st.ballVY > 0 && st.ballY < 0.35 && prev.ballY >= 0) {
        const total = prev.ballY + Math.max(0, st.ballY);
        const f = total > 1e-6 ? clamp(prev.ballY / total, 0, 1) : 1;
        out = { x: prev.ballX + (st.ballX - prev.ballX) * f, z: prev.ballZ + (st.ballZ - prev.ballZ) * f, t: st.labT };
      }
      prev = st;
      return out;
    },
  };
}

/** The line a landing mark is nearest to, and how far (m): { dist, line, inside }. A serve is judged against its service box. */
export function nearestLine(x, z, { serve = false } = {}) {
  const ax = Math.abs(x), az = Math.abs(z);
  const lines = [{ name: 'sideline', d: Math.abs(ax - COURT.halfW) }, { name: 'baseline', d: Math.abs(az - COURT.halfL) }];
  if (serve) lines.push({ name: 'service line', d: Math.abs(az - COURT.service) }, { name: 'centre line', d: ax });
  lines.sort((a, b) => a.d - b.d);
  const inside = serve ? ax <= COURT.halfW && az <= COURT.service : ax <= COURT.halfW && az <= COURT.halfL;
  return { dist: lines[0].d, line: lines[0].name, inside };
}

export const CLOSE_CALL_M = 0.12; // a mark this near a line (or nearer) is a close call worth a second look
/** A close call? mark: { x, z }. Returns null, or { line, dist, verdict: 'IN'|'OUT' }.
 * `verdict` is the core's own ruling when the caller has it (true = in): the picture then never disagrees with the score. */
export function closeCall(mark, { serve = false, ruledIn } = {}) {
  if (!mark) return null;
  const n = nearestLine(mark.x, mark.z, { serve });
  if (n.dist > CLOSE_CALL_M) return null;
  return { line: n.line, dist: n.dist, verdict: (ruledIn ?? n.inside) ? 'IN' : 'OUT' };
}

/** Where to draw the mark on the review picture: the real mark, nudged (never more than the ball's own width) so it sits on the side the ruling says. */
export function reviewMark(mark, verdict, { serve = false } = {}) {
  const n = nearestLine(mark.x, mark.z, { serve });
  const wantIn = verdict === 'IN';
  if (n.inside === wantIn) return { ...mark, nudged: false };
  const towards = (v, edge) => Math.sign(v || 1) * (edge + (wantIn ? -0.02 : 0.02));
  if (n.line === 'sideline') return { x: towards(mark.x, COURT.halfW), z: mark.z, nudged: true };
  if (n.line === 'baseline') return { x: mark.x, z: towards(mark.z, COURT.halfL), nudged: true };
  if (n.line === 'service line') return { x: mark.x, z: towards(mark.z, COURT.service), nudged: true };
  return { ...mark, nudged: false };
}

/** The challenge allowance: three reviews a match, and a review is only allowed on the last point's call. */
export function createChallenges(per = 3) {
  let left = per;
  return {
    get left() { return left; },
    reset() { left = per; },
    /** Try to spend one. Returns the call if it was allowed, else null. */
    use(call) { if (!call || left <= 0) return null; left--; return call; },
  };
}
