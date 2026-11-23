// The Daily Challenge: one small goal a day, the same for everybody (the day picks the challenge, its seed and its targets).
// Pure rules, so they are tested without a browser. The page feeds the run the core's state and where the ball lands.
import { COURT } from './feel.js';

const WHY_MISS = 3, WHY_BOUNCE = 4, WHY_FAULT = 5;
export const TARGET_R = 1.0; // metres: a landing this close to a target's centre counts

/** The date as YYYY-MM-DD in the player's own day. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A stable 32-bit number from a string (FNV-1a). */
export function hashOf(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** A small seeded random generator, so a day's targets are the same on every machine. */
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The challenges. feed: the core's tutorial feed (3 = the CPU feeds random balls and nobody serves; 0 = a normal match). */
export const CHALLENGES = [
  { id: 'targets', name: 'Bullseye', text: 'Hit all 3 targets on the CPU side. You get 6 balls.', feed: 3, level: 1, court: 1, time: 0, shots: 'all' },
  { id: 'marathon', name: 'Marathon', text: 'Win a point with a 14-hit rally. You can lose 5 points trying.', feed: 0, level: 2, court: 0, time: 1, shots: 'basic' },
  { id: 'dropshot', name: 'Drop Shot Dancer', text: 'Win a point with a drop shot. You have 10 points.', feed: 0, level: 1, court: 2, time: 0, shots: 'all' },
  { id: 'fireball', name: 'Fireball', text: 'Set the ball on fire: play a 16-hit rally. You have 8 points.', feed: 0, level: 2, court: 1, time: 2, shots: 'basic' },
];

/** Practice: the same machinery, but any time, with a score to beat (nothing here touches the daily streak). */
export const PRACTICE = [
  { id: 'practice-targets', practice: true, name: 'Target Practice', text: 'Ten balls, four targets. Land a shot on a ring to score; it moves on after each hit.', feed: 3, level: 1, court: 1, time: 0, shots: 'all', unit: 'of 10' },
  { id: 'practice-rally', practice: true, name: 'Rally Challenge', text: 'Keep the rally going against the CPU. Three lost points and it is over: how long can you last?', feed: 0, level: 1, court: 2, time: 0, shots: 'basic', unit: 'hit rally' },
];
export const isPractice = (def) => !!def?.practice;

/** Today's challenge: { def, seed, date }. */
export function challengeFor(date = dayKey()) {
  const seed = hashOf(`oc-${date}`);
  return { def: CHALLENGES[seed % CHALLENGES.length], seed, date };
}
/** Any challenge by id (for replaying one) with a given seed. */
export const challengeById = (id, date = dayKey(), seed = hashOf(`oc-${date}`)) => ({ def: [...CHALLENGES, ...PRACTICE].find((c) => c.id === id) ?? CHALLENGES[0], seed, date });

/** Three target centres on the CPU's half (z > 0), kept apart, from the seed. */
export function targetsFor(seed, n = 3) {
  const r = rng(seed ^ 0x9e3779b9), out = [];
  for (let guard = 0; out.length < n && guard < 200; guard++) {
    const x = (r() * 2 - 1) * (COURT.halfW - 1.2), z = 3.5 + r() * (COURT.halfL - 1.4 - 3.5);
    if (out.every((t) => Math.hypot(t.x - x, t.z - z) > 2.6)) out.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, hit: false });
  }
  return out;
}

/** One attempt. Call push(state) every frame and landed(mark) when one of your shots lands on the CPU's side. */
export function createRun({ def, seed }) {
  const run = { def, over: false, won: false, points: 0, lost: 0, balls: 0, score: 0, targets: def.id === 'targets' ? targetsFor(seed) : def.id === 'practice-targets' ? targetsFor(seed, 4) : [], best: 0, note: '' };
  const again = rng(seed ^ 0x51ed270b); // where a target goes after it is hit (practice)
  let prev = null, rally = 0, lastShot = 0, cpuTouched = false;
  const BALLS = 6;
  const finish = (won, note) => { if (run.over) return; run.over = true; run.won = won; run.note = note; };
  return {
    run,
    /** A shot of yours landed on the CPU side. */
    landed(mark) {
      if (def.id === 'practice-targets') {
        if (run.over || !mark || mark.z <= 0) return;
        run.balls++;
        const t = run.targets.find((x) => Math.hypot(x.x - mark.x, x.z - mark.z) <= TARGET_R);
        if (t) { run.score++; const [n] = targetsFor(Math.floor(again() * 4294967296), 1); if (n) { t.x = n.x; t.z = n.z; } }
        if (run.balls >= 10) finish(true, `${run.score} of 10 balls on a target`);
        return;
      }
      if (run.over || def.id !== 'targets' || !mark || mark.z <= 0) return;
      run.balls++;
      for (const t of run.targets) if (!t.hit && Math.hypot(t.x - mark.x, t.z - mark.z) <= TARGET_R) { t.hit = true; break; }
      const hit = run.targets.filter((t) => t.hit).length;
      if (hit === run.targets.length) finish(true, 'All three targets!');
      else if (run.balls >= BALLS) finish(false, `${hit} of ${run.targets.length} targets`);
    },
    push(cur) {
      if (!prev) { prev = cur; return; }
      if (cur.hits > prev.hits) { rally++; lastShot = cur.hitShot; }
      if (cur.cpuHits > prev.cpuHits) { rally++; cpuTouched = true; }
      run.best = Math.max(run.best, rally);
      const pts = cur.pointsHuman + cur.pointsCpu, was = prev.pointsHuman + prev.pointsCpu;
      if (pts > was && !run.over) {
        const won = cur.pointsHuman > prev.pointsHuman;
        run.points++; if (!won) run.lost++;
        if (def.id === 'practice-rally') { if (run.lost >= 3) { run.score = run.best; finish(true, `Best rally ${run.best} hits`); } }
        else if (def.id === 'marathon') { if (won && rally >= 14) finish(true, `A ${rally}-hit rally`); else if (run.lost >= 5) finish(false, `Best rally ${run.best}`); }
        else if (def.id === 'dropshot') { if (won && lastShot === 4 && (cur.why === WHY_MISS || cur.why === WHY_BOUNCE)) finish(true, 'A winning drop shot'); else if (run.points >= 10) finish(false, 'No drop-shot winner'); }
        else if (def.id === 'fireball') { if (run.best >= 16) finish(true, `A ${run.best}-hit rally`); else if (run.points >= 8) finish(false, `Best rally ${run.best}`); }
        rally = 0; lastShot = 0; cpuTouched = false;
      }
      if (def.id === 'fireball' && run.best >= 16) finish(true, `A ${run.best}-hit rally`); // the rally itself can end it, before the point does
      prev = cur;
    },
    /** One line for the screen while the challenge is on. */
    hud() {
      if (def.id === 'practice-targets') return `Score ${run.score} · balls left ${Math.max(0, 10 - run.balls)}`;
      if (def.id === 'practice-rally') return `Best rally ${run.best} · lives ${Math.max(0, 3 - run.lost)}`;
      if (def.id === 'targets') return `Targets ${run.targets.filter((t) => t.hit).length}/${run.targets.length} · balls ${Math.max(0, 6 - run.balls)} left`;
      if (def.id === 'marathon') return `Best rally ${run.best}/14 · lives ${Math.max(0, 5 - run.lost)}`;
      if (def.id === 'dropshot') return `Points left ${Math.max(0, 10 - run.points)}`;
      return `Best rally ${run.best}/16 · points left ${Math.max(0, 8 - run.points)}`;
    },
  };
}

/** 0..3 stars for a finished run (0 = not beaten): fewer points or balls used is better. */
export function starsFor(run) {
  if (!run.won) return 0;
  if (run.def.id === 'targets') return run.balls <= 3 ? 3 : run.balls <= 5 ? 2 : 1;
  const used = run.points;
  return used <= 2 ? 3 : used <= 5 ? 2 : 1;
}
export const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
export const shareText = (def, date, stars) => `Loxford Park Tennis · Daily ${date} · ${def.name} ${starText(stars)}`;

// ---- best results, kept in the browser ----
const KEY = 'loxford.daily';
export function loadDaily(storage) { try { const v = JSON.parse(storage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export function saveDaily(storage, date, stars) {
  const all = loadDaily(storage);
  all[date] = Math.max(all[date] ?? 0, Math.max(0, Math.min(3, stars | 0)));
  const keep = Object.keys(all).sort().slice(-60); // two months is plenty
  const out = Object.fromEntries(keep.map((k) => [k, all[k]]));
  try { storage.setItem(KEY, JSON.stringify(out)); } catch { /* private mode */ }
  return out;
}

// ---- practice best scores, kept in the browser ----
const PKEY = 'loxford.practice';
export function loadPractice(storage) { try { const v = JSON.parse(storage.getItem(PKEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
/** Keep the best score for a practice game; returns { best, isNew }. */
export function savePractice(storage, id, score) {
  const all = loadPractice(storage), prev = Math.max(0, Math.floor(Number(all[id])) || 0), s = Math.max(0, Math.floor(Number(score)) || 0);
  const isNew = s > prev; if (isNew) { all[id] = s; try { storage.setItem(PKEY, JSON.stringify(all)); } catch { /* private mode */ } }
  return { best: Math.max(prev, s), isNew };
}
