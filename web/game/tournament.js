// A knock-out tournament: eight places, seven cats (the owl is the top seed and gets a bye in the first round).
// You play your matches; the others are decided from the seed, so the bracket is the same if the page reloads.
import { CATS, BOSS_INDEX } from './cats.js';
import { rng } from './challenge.js';

export const ROUNDS = ['Quarter-final', 'Semi-final', 'Final'];
const STRENGTH = (cat) => (cat === BOSS_INDEX ? 3 : 1);

/** A new bracket. The hero is slot 0; the others are shuffled from the seed; the owl takes the last slot and the bye. */
export function newTournament(hero, seed) {
  const r = rng(seed);
  const others = CATS.map((_, i) => i).filter((i) => i !== hero);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  // quarter-finals: [hero, a] [b, c] [d, e] [owl, bye]
  const qf = [[hero, others[0]], [others[1], others[2]], [others[3], others[4]], [BOSS_INDEX, -1]];
  const t = { hero, seed, round: 0, alive: true, champion: -1, rounds: [qf.map((m) => ({ a: m[0], b: m[1], winner: m[1] === -1 ? m[0] : -1 }))] };
  settleOthers(t);
  return t;
}

const courtsFor = (t, round) => ({ court: (t.seed + round) % 3, time: (t.seed + round * 2) % 3 });

/** Decide every match of the current round that does not involve the hero, then lay out the next round when all are done. */
function settleOthers(t) {
  const r = rng(t.seed + 1000 * (t.round + 1));
  const cur = t.rounds[t.round];
  for (const m of cur) {
    if (m.winner !== -1 || m.a === t.hero || m.b === t.hero) continue;
    const sa = STRENGTH(m.a) + r() * 1.2, sb = STRENGTH(m.b) + r() * 1.2;
    m.winner = sa >= sb ? m.a : m.b;
  }
  advance(t);
}
function advance(t) {
  const cur = t.rounds[t.round];
  if (cur.some((m) => m.winner === -1)) return;
  if (t.round === ROUNDS.length - 1) { t.champion = cur[0].winner; t.alive = t.champion === t.hero; return; }
  const next = [];
  for (let i = 0; i < cur.length; i += 2) next.push({ a: cur[i].winner, b: cur[i + 1].winner, winner: -1 });
  t.rounds.push(next); t.round++;
  settleOthers(t);
}

/** The hero's next match: { round, name, rival, level, games, court, time }, or null if the hero is out or has won. */
export function nextMatch(t) {
  if (!t.alive || t.champion !== -1) return null;
  const m = t.rounds[t.round].find((x) => x.a === t.hero || x.b === t.hero);
  if (!m || m.winner !== -1) return null;
  const rival = m.a === t.hero ? m.b : m.a;
  const level = rival === BOSS_INDEX ? 3 : Math.min(2, t.round + (t.seed % 2));
  return { round: t.round, name: ROUNDS[t.round], rival, level, games: t.round === 2 ? 3 : 2, ...courtsFor(t, t.round) };
}

/** The hero's match is over. Returns the updated tournament (the same object). */
export function report(t, heroWon) {
  const m = t.rounds[t.round].find((x) => x.a === t.hero || x.b === t.hero);
  if (!m || m.winner !== -1) return t;
  m.winner = heroWon ? t.hero : (m.a === t.hero ? m.b : m.a);
  if (!heroWon) { t.alive = false; settleRest(t); } else advance(t);
  return t;
}
/** The hero is out: play the rest of the bracket through without them. */
function settleRest(t) {
  for (let guard = 0; guard < 6 && t.champion === -1; guard++) {
    const r = rng(t.seed + 7000 + guard);
    for (const m of t.rounds[t.round]) if (m.winner === -1) { const sa = STRENGTH(m.a) + r() * 1.2, sb = STRENGTH(m.b) + r() * 1.2; m.winner = sa >= sb ? m.a : m.b; }
    const cur = t.rounds[t.round];
    if (t.round === ROUNDS.length - 1) { t.champion = cur[0].winner; break; }
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push({ a: cur[i].winner, b: cur[i + 1].winner, winner: -1 });
    t.rounds.push(next); t.round++;
  }
}

const KEY = 'loxford.tourney';
export function loadTournament(storage) { try { const t = JSON.parse(storage.getItem(KEY) || 'null'); return t && Array.isArray(t.rounds) && Number.isInteger(t.hero) ? t : null; } catch { return null; } }
export function saveTournament(storage, t) { try { if (t) storage.setItem(KEY, JSON.stringify(t)); else storage.removeItem(KEY); } catch { /* private mode */ } }

/** Standings kept for good: how often each cat has lifted the trophy. */
const WINS_KEY = 'loxford.tourneyWins';
export function loadTitles(storage) { try { const v = JSON.parse(storage.getItem(WINS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export function addTitle(storage, cat) { const v = loadTitles(storage); v[cat] = (v[cat] ?? 0) + 1; try { storage.setItem(WINS_KEY, JSON.stringify(v)); } catch { /* private mode */ } return v; }
