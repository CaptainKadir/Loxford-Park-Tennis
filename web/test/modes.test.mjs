import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, hashOf, rng, challengeFor, challengeById, targetsFor, createRun, starsFor, starText, shareText, loadDaily, saveDaily, CHALLENGES, TARGET_R } from '../game/challenge.js';
import { modFor, rulesWith, lookOf, MODS } from '../game/party.js';
import { newTournament, nextMatch, report, ROUNDS, loadTournament, saveTournament, addTitle, loadTitles } from '../game/tournament.js';
import { loadProgress, saveProgress, recordMatch, recordFeat, isUnlocked, unlockedIn, cycleEquip, equippedLook, SLOTS, needText, dayBefore, NEW_CAREER } from '../game/progress.js';
import { BOSS_INDEX, CATS } from '../game/cats.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const S = (o = {}) => ({ hits: 0, cpuHits: 0, hitShot: 1, pointsHuman: 0, pointsCpu: 0, why: 0, ...o });

test('the same day gives the same challenge, seed and targets everywhere', () => {
  assert.equal(dayKey(new Date(2026, 10, 20)), '2026-11-20');
  const a = challengeFor('2026-11-20'), b = challengeFor('2026-11-20');
  assert.deepEqual(a, b);
  assert.deepEqual(targetsFor(a.seed), targetsFor(a.seed));
  const days = new Set(Array.from({ length: 30 }, (_, i) => challengeFor(`2026-12-${String(i + 1).padStart(2, '0')}`).def.id));
  assert.ok(days.size >= 3, 'the days rotate through the challenges');
  assert.equal(hashOf('x'), hashOf('x')); assert.notEqual(hashOf('x'), hashOf('y'));
  const r = rng(5); assert.ok(r() >= 0 && r() < 1);
});

test('targets stay on the CPU side, inside the court and apart', () => {
  for (let s = 1; s < 40; s++) {
    const t = targetsFor(s);
    assert.equal(t.length, 3);
    for (const x of t) { assert.ok(x.z > 3 && x.z < 11.9 && Math.abs(x.x) < 4.115); }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(t[i].x - t[j].x, t[i].z - t[j].z) > 2.5);
  }
});

test('Bullseye: hit all three targets within six balls', () => {
  const { def, seed } = challengeById('targets', '2026-11-20');
  const run = createRun({ def, seed });
  const [t0, t1, t2] = run.run.targets;
  run.landed({ x: t0.x + 0.2, z: t0.z }); run.landed({ x: t1.x, z: t1.z - 0.3 });
  assert.equal(run.run.over, false);
  run.landed({ x: t2.x, z: t2.z });
  assert.ok(run.run.over && run.run.won);
  assert.equal(starsFor(run.run), 3);
  const bad = createRun({ def, seed });
  for (let i = 0; i < 6; i++) bad.landed({ x: 0, z: 0.5 });
  assert.ok(bad.run.over && !bad.run.won && starsFor(bad.run) === 0);
  assert.ok(TARGET_R > 0.5);
});

test('Marathon: a 14-hit rally won, or five points lost', () => {
  const { def, seed } = challengeById('marathon');
  const run = createRun({ def, seed });
  run.push(S());
  let h = 0, c = 0;
  for (let i = 0; i < 7; i++) { run.push(S({ hits: ++h, cpuHits: c })); run.push(S({ hits: h, cpuHits: ++c })); }
  run.push(S({ hits: h, cpuHits: c, pointsHuman: 1, why: 3 }));
  assert.ok(run.run.won, run.run.note);
  const lose = createRun({ def, seed });
  lose.push(S());
  for (let i = 1; i <= 5; i++) lose.push(S({ pointsCpu: i, why: 1 }));
  assert.ok(lose.run.over && !lose.run.won);
});

test('Drop Shot Dancer needs a winning drop shot (shot 4), not any winner', () => {
  const { def, seed } = challengeById('dropshot');
  const run = createRun({ def, seed });
  run.push(S());
  run.push(S({ hits: 1, hitShot: 1 })); run.push(S({ hits: 1, hitShot: 1, pointsHuman: 1, why: 3 }));
  assert.equal(run.run.over, false);
  run.push(S({ hits: 2, hitShot: 4, pointsHuman: 1 })); run.push(S({ hits: 2, hitShot: 4, pointsHuman: 2, why: 3 }));
  assert.ok(run.run.won);
});

test('Fireball ends the moment the rally reaches 16 hits', () => {
  const { def, seed } = challengeById('fireball');
  const run = createRun({ def, seed });
  run.push(S());
  let h = 0, c = 0;
  for (let i = 0; i < 8; i++) { run.push(S({ hits: ++h, cpuHits: c })); run.push(S({ hits: h, cpuHits: ++c })); }
  assert.ok(run.run.won);
  assert.ok(run.hud().includes('16'));
});

test('daily results keep the best stars, per day, and share text reads well', () => {
  const st = mem();
  saveDaily(st, '2026-11-20', 2); const all = saveDaily(st, '2026-11-20', 1);
  assert.equal(all['2026-11-20'], 2);
  assert.equal(loadDaily(st)['2026-11-20'], 2);
  assert.equal(starText(2), '★★☆');
  assert.ok(shareText(CHALLENGES[0], '2026-11-20', 3).includes('Bullseye'));
  assert.deepEqual(loadDaily({ getItem: () => 'garbage' }), {});
});

test('party mode: a modifier every game, never the same twice running, same for the same seed', () => {
  let prev = null;
  for (let g = 0; g < 20; g++) { const m = modFor(7, g); assert.notEqual(m.id, prev); prev = m.id; assert.equal(modFor(7, g).id, m.id); }
  assert.ok(MODS.some((m) => m.kind === 'rule') && MODS.some((m) => m.kind === 'look'));
  const gentle = MODS.find((m) => m.id === 'easy');
  assert.deepEqual(rulesWith({ easy: false, aim: true, shots: false }, gentle), { easy: true, aim: true, shots: false });
  assert.equal(lookOf(MODS.find((m) => m.id === 'blaze')).burn, 1);
  assert.equal(lookOf(null).ballScale, 1);
});

test('tournament: the owl is seeded last, your matches come in order, and the bracket is stable', () => {
  const t = newTournament(0, 123);
  assert.equal(t.rounds[0].length, 4);
  const first = nextMatch(t);
  assert.equal(first.name, ROUNDS[0]); assert.ok(first.rival !== 0 && first.rival !== BOSS_INDEX && first.rival < CATS.length);
  assert.deepEqual(newTournament(0, 123), t, 'same seed, same bracket');
  report(t, true);
  assert.equal(nextMatch(t).name, ROUNDS[1]);
  report(t, true);
  const fin = nextMatch(t);
  assert.equal(fin.name, ROUNDS[2]); assert.equal(fin.games, 3);
  report(t, true);
  assert.equal(t.champion, 0); assert.equal(nextMatch(t), null);
});

test('tournament: losing knocks you out and the bracket still finishes', () => {
  const t = newTournament(2, 9);
  report(t, false);
  assert.equal(t.alive, false); assert.notEqual(t.champion, -1); assert.notEqual(t.champion, 2); assert.equal(nextMatch(t), null);
  const st = mem(); saveTournament(st, t);
  assert.deepEqual(loadTournament(st), t);
  assert.equal(loadTournament({ getItem: () => '{"bad":1}' }), null);
  addTitle(st, 1); assert.equal(addTitle(st, 1)[1], 2); assert.equal(loadTitles(st)[1], 2);
});

test('progress: cosmetics unlock from what you do and only equip when unlocked', () => {
  const p = loadProgress(mem());
  assert.equal(p.equip.collar, 'none');
  assert.ok(!isUnlocked(p.career, SLOTS.collar.find((x) => x.id === 'blue')));
  const got = recordMatch(p, { won: true, aces: 2, longest: 13, winners: 4, points: 20 });
  assert.ok(got.some((g) => g.item.id === 'blue') && got.some((g) => g.item.id === 'sparkle'));
  assert.deepEqual(recordMatch(p, { won: false }).filter((g) => g.item.id === 'blue'), [], 'only announced once');
  cycleEquip(p, 'collar', 1);
  assert.ok(unlockedIn(p.career, 'collar').some((x) => x.id === p.equip.collar));
  assert.ok(equippedLook(p).collar === null || equippedLook(p).collar.color != null);
  for (let i = 0; i < 5; i++) recordMatch(p, { won: true });
  assert.ok(isUnlocked(p.career, SLOTS.racket.find((x) => x.id === 'gold')));
  assert.ok(needText({ aces: 10 }).includes('10'));
});

test('progress: a daily streak counts consecutive days, and junk storage is ignored', () => {
  const p = loadProgress(mem());
  recordFeat(p, 'daily', { date: '2026-11-20' }); recordFeat(p, 'daily', { date: '2026-11-20' });
  assert.equal(p.career.daily, 1);
  recordFeat(p, 'daily', { date: '2026-11-21' }); assert.equal(p.career.streak, 2);
  recordFeat(p, 'daily', { date: '2026-11-25' }); assert.equal(p.career.streak, 1);
  assert.equal(dayBefore('2026-03-01'), '2026-02-28');
  recordFeat(p, 'tourney'); assert.ok(isUnlocked(p.career, SLOTS.trail.find((x) => x.id === 'ice')));
  const st = mem(); saveProgress(st, p); assert.equal(loadProgress(st).career.daily, 3);
  const junk = loadProgress({ getItem: () => '{"career":{"wins":"x","aces":-4},"equip":{"collar":"gold"}}' });
  assert.deepEqual(junk.career, NEW_CAREER()); assert.equal(junk.equip.collar, 'none', 'a locked item cannot be equipped from storage');
});

// ---- practice ----
import { PRACTICE, isPractice, loadPractice, savePractice } from '../game/challenge.js';
import { createMenu as createMenuP } from '../game/menu.js';

test('target practice: ten balls, a hit scores and moves the ring, a miss only costs the ball', () => {
  const ch = challengeById('practice-targets', '2026-01-01', 1234), r = createRun(ch);
  assert.ok(isPractice(ch.def)); assert.equal(r.run.targets.length, 4);
  const first = { ...r.run.targets[0] };
  r.landed({ x: first.x, z: first.z });
  assert.equal(r.run.score, 1);
  assert.ok(r.run.targets[0].x !== first.x || r.run.targets[0].z !== first.z, 'the ring moved on');
  r.landed({ x: 0, z: -3 }); // your own side: not counted
  assert.equal(r.run.balls, 1);
  for (let i = 0; i < 9; i++) r.landed({ x: 100, z: 100 }); // misses
  assert.equal(r.run.over, true); assert.equal(r.run.won, true); assert.equal(r.run.score, 1); assert.equal(r.run.balls, 10);
  assert.ok(TARGET_R > 0);
});
test('rally challenge: the score is the best rally, the game ends on the third lost point', () => {
  const r = createRun(challengeById('practice-rally', '2026-01-01', 7));
  const st = (o) => ({ hits: 0, cpuHits: 0, pointsHuman: 0, pointsCpu: 0, hitShot: 1, why: 3, ...o });
  r.push(st({}));
  let hits = 0, cpu = 0, ph = 0, pc = 0;
  for (const rallyLen of [4, 9, 2]) { for (let i = 0; i < rallyLen; i++) { hits++; r.push(st({ hits, cpuHits: cpu, pointsHuman: ph, pointsCpu: pc })); cpu++; r.push(st({ hits, cpuHits: cpu, pointsHuman: ph, pointsCpu: pc })); } pc++; r.push(st({ hits, cpuHits: cpu, pointsHuman: ph, pointsCpu: pc })); }
  assert.equal(r.run.over, true); assert.equal(r.run.score, r.run.best); assert.ok(r.run.best >= 9);
});
test('practice best scores are kept and only a higher one replaces them', () => {
  const mem = {}, store = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  assert.deepEqual(savePractice(store, 'practice-rally', 12), { best: 12, isNew: true });
  assert.deepEqual(savePractice(store, 'practice-rally', 9), { best: 12, isNew: false });
  assert.equal(loadPractice(store)['practice-rally'], 12);
  assert.equal(PRACTICE.length, 2);
});
test('the Practice screen: two games and Back, launching with an event', () => {
  const m = createMenuP();
  for (let i = 0; i < 4; i++) m.press('down');
  m.press('enter'); // More modes
  m.state.index = m.modeItems().findIndex((x) => x.id === 'practice');
  m.press('enter'); assert.equal(m.state.screen, 'practice');
  assert.equal(m.press('enter'), 'practice:targets');
  m.press('down'); assert.equal(m.press('enter'), 'practice:rally');
  m.press('down'); m.press('enter'); assert.equal(m.state.screen, 'modes');
  assert.equal(m.modeItems()[m.state.index].id, 'practice'); // back where you were
});
