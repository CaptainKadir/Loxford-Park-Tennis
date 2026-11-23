import { STOPS } from './story.js';
// What the player has done so far (matches, aces, daily challenges ...), the cosmetics that unlocks, and what is equipped.
// Kept in the browser's storage. Pure apart from the storage object you pass in, so it is tested without a browser.

const KEY = 'loxford.progress';

export const NEW_CAREER = () => ({ matches: 0, wins: 0, aces: 0, rally: 0, winners: 0, points: 0, story: 0, daily: 0, streak: 0, lastDaily: '', tourney: 0, party: 0, fire: 0, stop0: 0, stop1: 0, stop2: 0, stop3: 0, stop4: 0, stop5: 0 });

/** The cosmetics. need: every listed career number must reach its value. A cosmetic with no need is free from the start. */
export const SLOTS = {
  collar: [
    { id: 'none', name: 'No collar' },
    { id: 'red', name: 'Red collar', color: 0xe63946 },
    { id: 'blue', name: 'Blue collar', color: 0x2d6bd6, need: { wins: 1 } },
    { id: 'gold', name: 'Gold collar', color: 0xffd23a, glow: true, need: { story: 1 } },
    { id: 'rainbow', name: 'Rainbow collar', color: 0xff5ca8, glow: true, need: { daily: 3 } },
    { id: 'leaf', name: 'Leaf collar', color: 0x57b46c, need: { stop0: 1 } }, // story reward: Park Gate
  ],
  hat: [
    { id: 'none', name: 'No hat' },
    { id: 'cap', name: 'Sun cap', color: 0xe0524d, need: { wins: 2 } },
    { id: 'party', name: 'Party hat', color: 0xff5ca8, need: { party: 2 } },
    { id: 'wizard', name: 'Wizard hat', color: 0x4a3f9a, need: { story: 1 } },
    { id: 'tophat', name: 'Top hat', color: 0x2a2a34, need: { matches: 15 } },
    { id: 'crown', name: 'Crown', color: 0xffd23a, glow: true, need: { tourney: 1 } },
    { id: 'beanie', name: 'Pond beanie', color: 0x4fb3e8, need: { stop1: 1 } }, // story reward: Duck Pond
  ],
  headband: [
    { id: 'none', name: 'No headband' },
    { id: 'white', name: 'White headband', color: 0xffffff, need: { matches: 4 } },
    { id: 'red', name: 'Red headband', color: 0xe63946, need: { wins: 4 } },
    { id: 'neon', name: 'Neon headband', color: 0x6dff9a, glow: true, need: { aces: 25 } },
    { id: 'rainbow', name: 'Rainbow headband', color: 0xff5ca8, rainbow: true, need: { streak: 3 } },
    { id: 'market', name: 'Market headband', color: 0xf2a93b, need: { stop2: 1 } }, // story reward: Market Square
  ],
  racket: [
    { id: 'default', name: 'Classic racket' },
    { id: 'pink', name: 'Pink racket', color: 0xff7ab8, need: { wins: 3 } },
    { id: 'gold', name: 'Gold racket', color: 0xffc233, need: { matches: 6 } },
    { id: 'neon', name: 'Neon racket', color: 0x6dff9a, need: { aces: 10 } },
    { id: 'ember', name: 'Ember racket', color: 0xff5a1f, need: { fire: 3 } },
    { id: 'sea', name: 'Harbour racket', color: 0x2f87cf, need: { stop4: 1 } }, // story reward: Harbour Lights
  ],
  ballskin: [
    { id: 'classic', name: 'Classic ball' },
    { id: 'stripes', name: 'Striped ball', pattern: 'stripes', color: 0xe0524d, need: { wins: 5 } },
    { id: 'stars', name: 'Star ball', pattern: 'stars', color: 0xffd23a, need: { daily: 2 } },
    { id: 'golden', name: 'Golden ball', pattern: 'gold', color: 0xffc233, need: { rally: 20 } },
    { id: 'flame', name: 'Flame ball', pattern: 'flame', color: 0xff6a1a, need: { fire: 5 } },
    { id: 'disco', name: 'Disco ball', pattern: 'disco', color: 0x9fe8ff, need: { party: 4 } },
    { id: 'moon', name: 'Moon ball', pattern: 'moon', color: 0xf4f1d6, need: { stop5: 1 } }, // story reward: Hoot's Roost
  ],
  trail: [
    { id: 'none', name: 'No trail' },
    { id: 'sparkle', name: 'Sparkle trail', color: 0xfff2a0, need: { rally: 12 } },
    { id: 'ice', name: 'Ice trail', color: 0x9fe8ff, need: { tourney: 1 } },
    { id: 'rainbow', name: 'Rainbow trail', color: 0xff5ca8, rainbow: true, need: { daily: 1 } },
    { id: 'city', name: 'City lights trail', color: 0xffd978, need: { stop3: 1 } }, // story reward: Rooftop Court
  ],
};
export const SLOT_NAMES = Object.keys(SLOTS);
export const SLOT_LABEL = { collar: 'Collar', hat: 'Hat', headband: 'Headband', racket: 'Racket', ballskin: 'Ball', trail: 'Ball trail' };

const NEED_TEXT = {
  matches: (n) => `Play ${n} matches`, wins: (n) => `Win ${n} ${n === 1 ? 'match' : 'matches'}`, aces: (n) => `Hit ${n} aces`,
  rally: (n) => `Play a ${n}-hit rally`, story: (n) => `Finish ${n === 1 ? 'a story' : `${n} stories`}`, daily: (n) => `Beat ${n} daily ${n === 1 ? 'challenge' : 'challenges'}`,
  party: (n) => `Play ${n} party ${n === 1 ? 'match' : 'matches'}`, streak: (n) => `Reach a ${n}-day daily streak`,
  tourney: (n) => `Win ${n === 1 ? 'a tournament' : `${n} tournaments`}`, fire: (n) => `Win ${n} points with the ball on fire`,
};
export const needText = (need) => (need ? Object.entries(need).map(([k, v]) => (NEED_TEXT[k] ? NEED_TEXT[k](v) : /^stop\d$/.test(k) ? `Clear ${STOPS[Number(k.slice(4))]?.name ?? 'a stop'} in the story` : `${k} ${v}`)).join(', ') : '');

export const isUnlocked = (career, item) => !item.need || Object.entries(item.need).every(([k, v]) => (career[k] ?? 0) >= v);
export const unlockedIn = (career, slot) => SLOTS[slot].filter((it) => isUnlocked(career, it));

export const HISTORY_MAX = 20;
const MODES = ['match', 'party', 'story', 'tourney', 'daily', 'online'];
/** The last matches kept for the career screen: junk is dropped, the list is capped. */
const cleanHistory = (raw) => (Array.isArray(raw) ? raw : []).filter((h) => h && typeof h === 'object').slice(-HISTORY_MAX).map((h) => ({
  at: Number.isFinite(Number(h.at)) ? Number(h.at) : 0, won: !!h.won, hero: Math.max(0, Math.floor(Number(h.hero)) || 0), rival: Math.max(0, Math.floor(Number(h.rival)) || 0),
  mode: MODES.includes(h.mode) ? h.mode : 'match', score: Array.isArray(h.score) ? [Math.max(0, Math.floor(Number(h.score[0])) || 0), Math.max(0, Math.floor(Number(h.score[1])) || 0)] : [0, 0],
}));
const clean = (raw) => {
  const c = NEW_CAREER();
  for (const k of Object.keys(c)) if (typeof c[k] === 'number' && Number.isFinite(Number(raw?.[k])) && Number(raw[k]) >= 0) c[k] = Math.floor(Number(raw[k]));
  c.lastDaily = typeof raw?.lastDaily === 'string' ? raw.lastDaily.slice(0, 10) : '';
  return c;
};

export function loadProgress(storage) {
  let raw = {};
  try { raw = JSON.parse(storage.getItem(KEY) || '{}') || {}; } catch { raw = {}; }
  const career = clean(raw.career);
  const equip = {};
  for (const slot of SLOT_NAMES) {
    const it = SLOTS[slot].find((x) => x.id === raw.equip?.[slot]);
    equip[slot] = it && isUnlocked(career, it) ? it.id : SLOTS[slot][0].id;
  }
  return { career, equip, history: cleanHistory(raw.history) };
}
export function saveProgress(storage, p) { try { storage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: nothing is kept */ } }

/** The cosmetic items currently equipped, as the renderer wants them. */
export function equippedLook(p) {
  const get = (slot) => SLOTS[slot].find((x) => x.id === p.equip[slot]) ?? SLOTS[slot][0];
  const collar = get('collar'), racket = get('racket'), trail = get('trail'), hat = get('hat'), band = get('headband'), skin = get('ballskin');
  return { collar: collar.color != null ? collar : null, racketColor: racket.color ?? null, trail: trail.color != null ? trail : null, hat: hat.color != null ? hat : null, band: band.color != null ? band : null, ballSkin: skin.pattern ? skin : null };
}

/** The look you would have with item `id` worn in `slot`: a preview, nothing is changed. */
export function lookWith(p, slot, id) { return equippedLook({ ...p, equip: { ...p.equip, [slot]: id } }); }

/** Step the equipped item of a slot to the next/previous unlocked one. */
export function cycleEquip(p, slot, dir = 1) {
  const list = unlockedIn(p.career, slot);
  const i = Math.max(0, list.findIndex((x) => x.id === p.equip[slot]));
  p.equip[slot] = list[(i + dir + list.length) % list.length].id;
  return p.equip[slot];
}

const allItems = (career) => SLOT_NAMES.flatMap((slot) => SLOTS[slot].filter((it) => isUnlocked(career, it)).map((it) => `${slot}:${it.id}`));

/** Add a finished match to the career. Returns the cosmetics it unlocked, as [{ slot, item }]. */
export function recordMatch(p, { won = false, aces = 0, longest = 0, winners = 0, points = 0, fire = 0, mode = 'match', hero = 0, rival = 0, score = [0, 0], at = Date.now() } = {}) {
  const before = new Set(allItems(p.career));
  const c = p.career;
  c.matches++; if (won) c.wins++;
  c.aces += aces; c.winners += winners; c.points += points; c.fire += fire;
  c.rally = Math.max(c.rally, longest);
  if (mode === 'party') c.party++;
  p.history = cleanHistory([...(p.history ?? []), { at, won, hero, rival, mode, score }]);
  return newlyUnlocked(p, before);
}
/** A story finished (the boss beaten), a tournament won or a daily challenge beaten. */
export function recordFeat(p, kind, { date = '' } = {}) {
  const before = new Set(allItems(p.career));
  const c = p.career;
  if (kind === 'story') c.story++;
  else if (kind === 'tourney') c.tourney++;
  else if (kind === 'daily') {
    if (c.lastDaily !== date) { c.daily++; c.streak = c.lastDaily && dayBefore(date) === c.lastDaily ? c.streak + 1 : 1; c.lastDaily = date; }
  }
  return newlyUnlocked(p, before);
}
function newlyUnlocked(p, before) {
  const out = [];
  for (const slot of SLOT_NAMES) for (const item of SLOTS[slot]) if (isUnlocked(p.career, item) && !before.has(`${slot}:${item.id}`)) out.push({ slot, item });
  return out;
}
/** 'YYYY-MM-DD' the day before the given one. */
export function dayBefore(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** What the career screen draws from the match list: newest first, the form (W/L), the running win rate after each match and the current win streak. */
export function historyStats(history = []) {
  const list = history.slice(-HISTORY_MAX);
  let wins = 0;
  const rate = list.map((h, i) => { if (h.won) wins++; return wins / (i + 1); });
  let streak = 0;
  for (let i = list.length - 1; i >= 0 && list[i].won; i--) streak++;
  return { recent: [...list].reverse(), form: list.slice(-10).map((h) => (h.won ? 'W' : 'L')), rate, streak };
}

/** A story stop cleared for the first time: its reward cosmetic unlocks. Returns what that unlocked. */
export function recordStop(p, i) {
  if (!(i >= 0 && i < STOPS.length)) return [];
  const before = new Set(allItems(p.career));
  p.career[`stop${i}`] = 1;
  return newlyUnlocked(p, before);
}
/** Stops cleared before rewards existed count too: mark every stop below `upTo` (the furthest any cat's story has got). */
export function markStops(p, upTo) {
  let changed = false;
  for (let i = 0; i < Math.min(upTo, STOPS.length); i++) if (!p.career[`stop${i}`]) { p.career[`stop${i}`] = 1; changed = true; }
  return changed;
}

/** The cosmetic a story stop gives the first time it is cleared: { slot, item } or null. */
export function rewardFor(i) {
  for (const [slot, list] of Object.entries(SLOTS)) { const item = list.find((it) => it.need && it.need[`stop${i}`]); if (item) return { slot, item }; }
  return null;
}
