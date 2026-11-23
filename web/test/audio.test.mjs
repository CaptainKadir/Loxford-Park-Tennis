import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundsFor } from '../game/audio.js';

const base = { hits: 0, cpuHits: 0, hitSide: 1, hitSpeed: 8, ballX: 0, ballY: 1, ballZ: -5, ballVY: 0, ballVZ: 5, playerX: 0, playerVX: 0, playerVZ: 0, cpuX: 0,
  pointsHuman: 0, pointsCpu: 0, labState: 1, serveN: 1, why: 0 };

test('a racket hit, soft or hard, and a serve each have their own sound', () => {
  assert.equal(soundsFor(base, { ...base, hits: 1 })[0].bank, 'hitLight');
  assert.equal(soundsFor(base, { ...base, hits: 1, hitSpeed: 14 })[0].bank, 'hitHard');
  assert.equal(soundsFor(base, { ...base, hits: 1, hitSide: 0 })[0].bank, 'serve');
});

test('bounce: only when the ball falls to the ground and rises', () => {
  const falling = { ...base, ballY: 0.4, ballVY: -6 };
  assert.deepEqual(soundsFor(falling, { ...base, ballY: 0.05, ballVY: 4 }).map((s) => s.bank), ['bounce']);
  assert.deepEqual(soundsFor(base, { ...base, ballY: 2, ballVY: 3 }), []);
});

test('no cheering on points: silent for yours, a soft thud when the CPU scores', () => {
  assert.deepEqual(soundsFor(base, { ...base, pointsHuman: 1 }), []);
  assert.deepEqual(soundsFor(base, { ...base, pointsCpu: 1 }).map((s) => s.bank), ['lost']);
});

test('a game gets applause and the match end a whistle', () => {
  assert.ok(soundsFor(base, { ...base, gamesH: 1 }).some((s) => s.bank === 'applause'));
  assert.ok(soundsFor(base, { ...base, matchOver: 1 }).some((s) => s.bank === 'whistle'));
});

test('footsteps only when running and a step is due', () => {
  const run = { ...base, playerVX: 3, playerVZ: 2 };
  assert.equal(soundsFor(base, run, { stepDue: true })[0].bank, 'step');
  assert.deepEqual(soundsFor(base, run, { stepDue: false }), []);
  assert.deepEqual(soundsFor(base, base, { stepDue: true }), []);
});

test('a fault gets a sound, silence before any state exists', () => {
  assert.equal(soundsFor({ ...base, labState: 5 }, { ...base, labState: 0, serveN: 2, why: 5 })[0].bank, 'fault');
  assert.deepEqual(soundsFor(null, base), []);
});

import { VOICES } from '../game/audio.js';
test('voices: an angry meow swoops up and down with a sweeping mouth; an owl hoot is low and short', () => {
  const m = VOICES.angryMeow, h = VOICES.hoot;
  assert.ok(m.pitch[1] > m.pitch[0] && m.pitch[1] > m.pitch[2] && m.f1.length === 3 && m.growl > 0);
  assert.ok(h.pitch.every((f) => f < 400) && h.len < m.len && !h.growl);
});

test('grunts: several shapes, never the same twice running, backhands and big hits get their own', async () => {
  const { pickEffort, EFFORTS } = await import('../game/audio.js');
  assert.ok(EFFORTS.length >= 8);
  let seed = 3; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const seen = new Set(); let last = '';
  for (let i = 0; i < 200; i++) { const e = pickEffort({ side: 1, speed: 22 }, last, rnd); assert.notEqual(e.id, last); seen.add(e.id); last = e.id; }
  assert.ok(seen.size >= 7, `variety ${seen.size}`);
  const soft = new Set(); for (let i = 0; i < 100; i++) soft.add(pickEffort({ side: 1, speed: 16 }, '', rnd).id);
  assert.ok(![...soft].some((id) => EFFORTS.find((e) => e.id === id).power || EFFORTS.find((e) => e.id === id).back), 'a medium forehand gets no power or backhand grunts');
  const back = new Set(); for (let i = 0; i < 200; i++) back.add(pickEffort({ side: 2, speed: 12 }, '', rnd).id);
  assert.ok(back.has('ngh') || back.has('urgh') || back.has('oof'));
});
