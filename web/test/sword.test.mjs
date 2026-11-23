import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cursorOf, quatForCursor, createSwingTracker, segmentHitsCircle } from '../sword/pose.js';
import { createDuel, ZONES } from '../sword/duel.js';

test('cursor round-trips through quatForCursor', () => {
  for (const [x, y] of [[0, 0], [0.5, 0.2], [-0.7, 0.6], [0.3, -0.4]]) {
    const c = cursorOf(quatForCursor(x, y));
    assert.ok(Math.abs(c.x - x) < 1e-6 && Math.abs(c.y - y) < 1e-6, `${x},${y} -> ${c.x},${c.y}`);
  }
});

function sweep(tracker, from, to, secs, t0 = 0) {
  let done = null;
  const n = Math.round(secs * 60);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const r = tracker.update(t0 + i / 60, quatForCursor(from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k));
    if (r) done = r;
  }
  return done;
}

test('a fast sweep is one swing, a slow drift is none', () => {
  const t = createSwingTracker();
  t.update(0, quatForCursor(-0.8, 0));
  const s = sweep(t, [-0.8, 0], [0.8, 0], 0.2, 0.02);
  const end = [0.8, 0]; // settle so the swing ends
  for (let i = 0; i < 10; i++) t.update(0.3 + i / 60, quatForCursor(...end));
  assert.equal(t.state.id, 1);
  const slow = createSwingTracker();
  slow.update(0, quatForCursor(-0.8, 0));
  sweep(slow, [-0.8, 0], [0.8, 0], 3, 0.02);
  assert.equal(slow.state.id, 0);
  assert.equal(s === null || typeof s.peak === 'number', true);
});

test('segment vs circle', () => {
  assert.ok(segmentHitsCircle({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0.2 }, 0.3));
  assert.ok(!segmentHitsCircle({ x: -1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 0 }, 0.3));
});

const idleSword = { cursor: { x: 0, y: 0 }, prev: { x: 0, y: 0 }, speed: 0, swinging: false, id: 0 };

function runUntil(duel, sword, pred, maxSteps = 600) {
  const all = [];
  for (let i = 0; i < maxSteps; i++) {
    const ev = duel.step(1 / 60, typeof sword === 'function' ? sword(duel) : sword);
    all.push(...ev);
    if (pred(ev, duel)) return all;
  }
  return all;
}

test('enemy strike with blade in the wrong place hurts the player', () => {
  const duel = createDuel({ rng: () => 0.01 }); // dir = left
  const ev = runUntil(duel, idleSword, (e) => e.includes('hurt'));
  assert.ok(ev.includes('tell') && ev.includes('hurt'));
  assert.equal(duel.playerHp, 4);
});

test('blade in the zone parries, then the stagger doubles damage', () => {
  const duel = createDuel({ rng: () => 0.01 });
  const guard = (d) => ({ ...idleSword, cursor: d.enemy.dir ? { ...ZONES[d.enemy.dir] } : { x: 0, y: 0 } });
  const ev = runUntil(duel, guard, (e) => e.includes('parry'));
  assert.ok(ev.includes('parry'));
  assert.equal(duel.playerHp, 5);
  assert.equal(duel.enemy.phase, 'stagger');
  const hit = { cursor: { x: 0.2, y: 0.1 }, prev: { x: -0.6, y: 0.1 }, speed: 8, swinging: true, id: 1 };
  duel.step(1 / 60, hit);
  assert.equal(duel.enemy.cur, 3);
  duel.step(1 / 60, hit); // same swing id: no double count
  assert.equal(duel.enemy.cur, 3);
});

test('enough hits win, enough strikes lose', () => {
  const d1 = createDuel();
  for (let i = 1; i <= 5; i++) d1.step(1 / 60, { cursor: { x: 0.2, y: 0.1 }, prev: { x: -0.6, y: 0.1 }, speed: 8, swinging: true, id: i });
  assert.equal(d1.phase, 'won');
  const d2 = createDuel({ rng: () => 0.5 });
  runUntil(d2, idleSword, () => d2.phase === 'lost', 6000);
  assert.equal(d2.phase, 'lost');
});
