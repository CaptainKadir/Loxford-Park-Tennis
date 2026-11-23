import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from '../game/core.js';
import { createSession } from '../game/session.js';

async function newSession() {
  const core = await loadCore();
  let nowMs = 0;
  const s = createSession(core, { now: () => nowMs });
  return { core, s, advance: (ms) => (nowMs += ms), setNow: (ms) => (nowMs = ms) };
}
const none = { right: 0, fwd: 0 };
const sampleMsg = (t) => ({ type: 's', t, q: [1, 0, 0, 0], r: [0, 0, 0], a: [0, 0, 1], srv: 0 });

function runUntilRally(s, advance) {
  for (let i = 0; i < 900; i++) {
    s.update(1 / 60, none);
    advance(1000 / 60);
    if ([1, 2, 4].includes(s.core.state().labState)) return true;
  }
  return false;
}

test('session: a phone swing is counted once', async () => {
  const { s, advance } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  for (let i = 0; i < 90; i++) {
    const t = 100 + i / 60;
    const r = t >= 100.5 && t < 100.75 ? 8 : 0;
    s.onMessage({ ...sampleMsg(t), r: [0, 0, r] });
    s.update(1 / 60, none);
    advance(1000 / 60);
  }
  assert.equal(s.status().swings, 1);
});

test('session: pauses mid-rally when samples stop, resumes on the next one', async () => {
  const { s, advance } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  s.onMessage(sampleMsg(1));
  assert.ok(runUntilRally(s, advance));
  s.onMessage(sampleMsg(1.001));
  advance(1500);
  s.update(1 / 60, none);
  assert.equal(s.status().paused, true);
  const before = s.core.state().ballX + s.core.state().ballZ;
  s.update(1 / 60, none);
  assert.equal(s.core.state().ballX + s.core.state().ballZ, before, 'no stepping while paused');
  s.onMessage(sampleMsg(2));
  s.update(1 / 60, none);
  assert.equal(s.status().paused, false);
});

test('session: controller loss pauses a rally and no swing is invented', async () => {
  const { s, advance } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  s.onMessage(sampleMsg(1));
  assert.ok(runUntilRally(s, advance));
  s.onMessage({ type: 'controller-lost' });
  s.update(1 / 60, none);
  assert.equal(s.status().paused, true);
  assert.equal(s.status().swings, 0);
});

test('session: long frames are capped, not simulated in one lump', async () => {
  const { s } = await newSession();
  const n = s.update(5, none);
  assert.ok(n <= 6, `steps ${n}`); // 0.1 s cap at 1/60
});

const rot = (deg) => [Math.cos((deg * Math.PI) / 360), 0, 0, Math.sin((deg * Math.PI) / 360)];
const racketZ = (s) => s.core.state().racketZ;

test('session: duplicate and out-of-order phone samples never move the racket back', async () => {
  const { s } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  s.onMessage({ ...sampleMsg(10.0), q: rot(10) });
  s.onMessage({ ...sampleMsg(10.02), q: rot(40) });
  const good = racketZ(s);
  s.onMessage({ ...sampleMsg(10.01), q: rot(70) }); // older than the last one
  s.onMessage({ ...sampleMsg(10.02), q: rot(90) }); // duplicate time
  assert.equal(racketZ(s), good);
  s.update(1 / 60, none);
  s.onMessage({ ...sampleMsg(10.03), q: rot(60) });
  assert.notEqual(racketZ(s), good);
});

test('session: out-of-order samples stay ignored deep into a run', async () => {
  const { s, advance } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  for (let i = 0; i < 600; i++) {
    s.onMessage({ ...sampleMsg(50 + i * 0.01), q: rot(i % 90) });
    if (i % 2 === 0) s.update(1 / 60, none);
    advance(10);
  }
  const before = racketZ(s);
  s.onMessage({ ...sampleMsg(50 + 599 * 0.01 - 0.005), q: rot(80) });
  assert.equal(racketZ(s), before);
});

test('session: a phone clock that jumps back (page reload) is accepted again', async () => {
  const { s } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  s.onMessage({ ...sampleMsg(1000), q: rot(10) });
  s.onMessage({ ...sampleMsg(1000.5), q: rot(20) });
  s.onMessage({ ...sampleMsg(5), q: rot(30) });
  const a = racketZ(s);
  s.update(1 / 60, none);
  s.onMessage({ ...sampleMsg(5.02), q: rot(60) });
  assert.notEqual(racketZ(s), a);
});

test('session: a swing half-seen before a disconnect does not complete after it', async () => {
  const { s } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  for (let i = 0; i < 6; i++) s.onMessage({ ...sampleMsg(1 + i / 60), r: [0, 0, 8] });
  s.onMessage({ type: 'controller-lost' });
  s.onMessage({ type: 'controller-joined' });
  for (let i = 0; i < 30; i++) s.onMessage({ ...sampleMsg(2 + i / 60), r: [0, 0, 0] });
  assert.equal(s.status().swings, 0);
});

test('session: latency shown adds the phone-measured one-way delay to the server hop', async () => {
  const { s } = await newSession();
  s.onMessage({ type: 'controller-joined' });
  s.onMessage({ type: 'lat', ms: 24 });
  s.onMessage({ ...sampleMsg(1), srv: Date.now() - 3 });
  const l = s.status().latencyMs;
  assert.ok(l >= 26 && l < 40, `latency ${l}`);
});

test('session: a player who chose to play without a phone never holds the match for it', async () => {
  const { s, advance } = await newSession();
  assert.equal(runUntilRally(s, advance), true);
  advance(5000);
  assert.equal(s.wouldPause(), true, 'with no phone a rally would hold');
  s.setRequirePhone(false);
  assert.equal(s.wouldPause(), false);
  s.update(1 / 60, none);
  assert.equal(s.status().paused, false);
});
