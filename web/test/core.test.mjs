import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from '../game/core.js';

test('core serves and moves ball', async () => {
  const core = await loadCore();
  core.init(1, true, true, 1);
  const s0 = { ...core.state() };
  for (let i = 0; i < 180; i++) core.step(1 / 60, 0, 0);
  const s1 = core.state();
  const moved = Math.hypot(s1.ballX - s0.ballX, s1.ballY - s0.ballY, s1.ballZ - s0.ballZ);
  assert.ok(moved > 0.5, `ball moved ${moved}`);
  for (const [k, v] of Object.entries(s1)) assert.ok(Number.isFinite(v), `${k} finite`);
});

test('phone sample triggers exactly one swing', async () => {
  const core = await loadCore();
  core.init(1, true, true, 1);
  let swings = 0;
  for (let i = 0; i < 75; i++) {
    const t = i / 60;
    const r = t >= 0.5 && t < 0.75 ? 8 : 0;
    if (core.phoneSample(t, [1, 0, 0, 0], [0, 0, r], [0, 0, 1])) swings++;
  }
  assert.equal(swings, 1);
});

test('backwards phone timestamps are ignored', async () => {
  const core = await loadCore();
  core.init(1, true, true, 1);
  core.phoneSample(1.0, [1, 0, 0, 0], [0, 0, 0], [0, 0, 1]);
  assert.equal(core.phoneSample(0.5, [1, 0, 0, 0], [0, 0, 20], [0, 0, 1]), false);
});

test('state exposes the lab clock, which advances with steps', async () => {
  const core = await loadCore();
  core.init(1, true, true, 1);
  const t0 = core.state().labT;
  for (let i = 0; i < 60; i++) core.step(1 / 60, 0, 0);
  assert.ok(Math.abs(core.state().labT - t0 - 1) < 0.05, `labT ${core.state().labT}`);
});

test('left-handed core runs a rally without bad numbers', async () => {
  const core = await loadCore();
  core.init(2, false, true, 1);
  for (let i = 0; i < 600; i++) core.step(1 / 60, 0, 0);
  for (const [k, v] of Object.entries(core.state())) assert.ok(Number.isFinite(v), `${k} finite`);
});

test('shot classifier in JS matches the core, and fitting recovers separable shots', async () => {
  const { classify, fitTuning, accuracy, DEFAULT_TUNING } = await import('../game/shots.js');
  const core = await loadCore();
  core.init(1, true, false, 0);
  core.setShotTuning(DEFAULT_TUNING);
  for (let i = 0; i < 400; i++) {
    const s = 3 + ((i * 7) % 30), f = -0.5 + ((i * 13) % 100) / 100 + 0.003, p = -0.6 + ((i * 29) % 120) / 100 + 0.003; // off the exact boundaries (float32)
    assert.equal(core.classifyShot(s, f, p), classify(s, f, p), `${s} ${f} ${p}`);
  }
  // A player whose topspin is gentler and whose slice is quicker than the defaults expect.
  const mk = (type, speed, face, path) => ({ type, speed, face, path });
  const data = [
    ...[8.2, 8.8, 9.2, 9.6].map((v) => mk(2, v, -0.35, 0.3)),   // topspin, slower than the default 10.5
    ...[11, 12, 13, 14].map((v) => mk(3, v, 0.35, -0.3)),       // slice
    ...[7.2, 7.5, 7.8, 8.0].map((v) => mk(1, v, 0.0, 0.1)),     // drive
    ...[3, 4, 5, 5.5].map((v) => mk(4, v, 0.35, -0.4)),         // drop shot
    ...[3.5, 4, 4.5, 5].map((v) => mk(5, v, 0.35, 0.5)),        // lob
  ];
  assert.ok(accuracy(data, DEFAULT_TUNING) < 0.9);
  const fit = fitTuning(data);
  assert.ok(accuracy(data, fit) >= 0.99, `fitted accuracy ${accuracy(data, fit)}`);
  core.setShotTuning(fit);
  for (const d of data) assert.equal(core.classifyShot(d.speed, d.face, d.path), d.type);
});
