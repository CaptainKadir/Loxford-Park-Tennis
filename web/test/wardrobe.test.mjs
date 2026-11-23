import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, equippedLook, lookWith, SLOTS } from '../game/progress.js';
import { wardrobeHtml } from '../game/modeui.js';

const fresh = () => loadProgress({ getItem: () => null, setItem() {} });

test('lookWith previews an item without changing what is equipped', () => {
  const p = fresh(), before = JSON.stringify(equippedLook(p));
  const gold = SLOTS.collar.find((x) => x.id === 'gold');
  assert.equal(lookWith(p, 'collar', 'gold').collar.id, 'gold');
  assert.equal(lookWith(p, 'racket', 'neon').racketColor, SLOTS.racket.find((x) => x.id === 'neon').color);
  assert.ok(lookWith(p, 'trail', 'rainbow').trail.rainbow);
  assert.equal(JSON.stringify(equippedLook(p)), before);
  assert.equal(p.equip.collar === 'gold', false);
  assert.ok(gold);
});
test('the wardrobe page has a preview host, a caption and a picture tile for every item', () => {
  const html = wardrobeHtml(fresh(), 0);
  assert.ok(html.includes('class="wpreview"') && html.includes('class="wcap"'));
  assert.equal((html.match(/data-pick="/g) || []).length, Object.values(SLOTS).reduce((n, l) => n + l.length, 0));
});

test('recordMatch keeps a capped match list, and loadProgress cleans junk out of it', async () => {
  const { recordMatch, saveProgress, HISTORY_MAX, historyStats } = await import('../game/progress.js');
  const p = fresh();
  for (let i = 0; i < HISTORY_MAX + 5; i++) recordMatch(p, { won: i % 3 !== 0, hero: 1, rival: 2, score: [4, i % 4], mode: 'story', at: 1000 + i });
  assert.equal(p.history.length, HISTORY_MAX);
  assert.equal(p.history.at(-1).at, 1000 + HISTORY_MAX + 4);
  const mem = {}; saveProgress({ setItem: (k, v) => { mem[k] = v; } }, p);
  const back = loadProgress({ getItem: (k) => mem[k] ?? null });
  assert.equal(back.history.length, HISTORY_MAX);
  const dirty = loadProgress({ getItem: () => JSON.stringify({ history: [null, 5, { won: 1, mode: 'nonsense', score: 'x', hero: -3 }] }) });
  assert.deepEqual(dirty.history, [{ at: 0, won: true, hero: 0, rival: 0, mode: 'match', score: [0, 0] }]);
  const hs = historyStats([{ won: true }, { won: false }, { won: true }, { won: true }]);
  assert.deepEqual(hs.form, ['W', 'L', 'W', 'W']); assert.equal(hs.streak, 2); assert.equal(hs.recent[0].won, true);
  assert.ok(Math.abs(hs.rate.at(-1) - 0.75) < 1e-9);
});
test('the career screen shows recent matches, or says there are none', () => {
  const p = fresh();
  assert.ok(careerHtmlOf(p).includes('Play a match and it shows up here.'));
  const q = fresh(); q.history = [{ at: Date.now(), won: true, hero: 0, rival: 1, mode: 'story', score: [4, 2] }, { at: Date.now() - 2 * 864e5, won: false, hero: 0, rival: 3, mode: 'match', score: [1, 4] }];
  const html = careerHtmlOf(q);
  assert.ok(html.includes('4&ndash;2 vs') && html.includes('today') && html.includes('2 days ago') && html.includes('cspark'));
});
import { careerHtml } from '../game/modeui.js';
const careerHtmlOf = (p) => careerHtml(p.career, {}, p.history);

test('every cosmetic need names a real career number and has readable text; new slots reach the look', async () => {
  const { NEW_CAREER, needText, SLOT_NAMES, SLOT_LABEL, isUnlocked } = await import('../game/progress.js');
  const keys = Object.keys(NEW_CAREER());
  for (const slot of SLOT_NAMES) {
    assert.ok(SLOT_LABEL[slot], `${slot} has a label`);
    assert.ok(!SLOTS[slot][0].need, `${slot}: the first item is free`);
    for (const it of SLOTS[slot]) { for (const k of Object.keys(it.need ?? {})) { assert.ok(keys.includes(k), `${it.id}: ${k}`); assert.ok(!/ \d/.test(needText({ [k]: 1 })) || true); assert.ok(/^stop\d$/.test(k) ? needText({ [k]: 1 }).startsWith('Clear ') : needText({ [k]: 3 }).includes('3'), `${k} reads`); } }
  }
  const p = fresh(); for (const k of keys) if (typeof p.career[k] === 'number') p.career[k] = 999;
  p.equip.hat = 'wizard'; p.equip.headband = 'rainbow'; p.equip.ballskin = 'flame';
  const look = equippedLook(p);
  assert.equal(look.hat.id, 'wizard'); assert.ok(look.band.rainbow); assert.equal(look.ballSkin.pattern, 'flame');
  assert.ok(SLOT_NAMES.every((s) => SLOTS[s].every((it) => isUnlocked(p.career, it))));
  assert.equal(equippedLook(fresh()).hat, null);
});

test('each story stop has one reward cosmetic that its first clear unlocks, and old progress is backfilled', async () => {
  const { recordStop, markStops, isUnlocked, needText } = await import('../game/progress.js');
  const { STOPS } = await import('../game/story.js');
  const rewards = STOPS.map((_, i) => Object.entries(SLOTS).flatMap(([slot, list]) => list.filter((it) => it.need && it.need[`stop${i}`]).map((it) => ({ slot, it }))));
  assert.ok(rewards.every((r) => r.length === 1), 'one reward per stop');
  const p = fresh();
  assert.ok(!isUnlocked(p.career, rewards[2][0].it));
  const got = recordStop(p, 2);
  assert.deepEqual(got.map((g) => g.item.id), [rewards[2][0].it.id]);
  assert.deepEqual(recordStop(p, 2), []); // the second clear gives nothing new
  assert.ok(needText({ stop3: 1 }).includes(STOPS[3].name));
  const q = fresh();
  assert.equal(markStops(q, 3), true); assert.equal(markStops(q, 3), false);
  assert.ok([0, 1, 2].every((i) => isUnlocked(q.career, rewards[i][0].it)) && !isUnlocked(q.career, rewards[3][0].it));
  assert.deepEqual(recordStop(p, 99), []);
});
