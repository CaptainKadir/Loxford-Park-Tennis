import test from 'node:test';
import assert from 'node:assert/strict';
import { danceFor, blendDance, DANCE_NAMES, axisQuat, quatMul } from '../game/render/dances.js';
import { CATS } from '../game/cats.js';

const REST_Q = [0.866, -0.5, 0, 0];
const KEYS = ['hop', 'sway', 'roll', 'spin', 'crouch', 'lean', 'legPhase', 'legAmp', 'tail', 'twist', 'headYaw', 'headPitch', 'headZ', 'mood'];

test('dances: every cat has its own named dance of finite numbers and a unit racket quaternion', () => {
  assert.equal(DANCE_NAMES.length, CATS.length);
  for (let c = 0; c < CATS.length; c++) {
    for (let t = 0; t < 8; t += 0.13) {
      const d = danceFor(c, t);
      KEYS.forEach((k) => assert.ok(Number.isFinite(d[k]), `cat ${c} ${k} at ${t}`));
      assert.ok(Math.abs(Math.hypot(...d.racket) - 1) < 1e-6, `cat ${c} racket at ${t}`);
    }
  }
});

test('dances: no two cats move alike', () => {
  const sig = (c) => Array.from({ length: 40 }, (_, i) => { const d = danceFor(c, i * 0.1); return KEYS.map((k) => d[k].toFixed(2)).concat(d.racket.map((v) => v.toFixed(2))).join(','); }).join('|');
  const all = CATS.map((_, c) => sig(c));
  assert.equal(new Set(all).size, CATS.length);
});

test('dances: they move (not a still pose) and loop without jumps', () => {
  for (let c = 0; c < CATS.length; c++) {
    let moved = 0;
    for (let i = 0; i < 100; i++) {
      const a = danceFor(c, i * 0.05), b = danceFor(c, i * 0.05 + 0.01);
      if (Math.abs(a.hop - b.hop) + Math.abs(a.legPhase - b.legPhase) + Math.abs(a.sway - b.sway) + Math.abs(a.headYaw - b.headYaw) + Math.abs(a.spin - b.spin) > 0) moved++;
    }
    assert.ok(moved > 50, `cat ${c} barely moves`);
  }
  // the ninja's full-turn spin ends where it began, so the 4 s loop has no snap
  assert.ok(Math.abs(Math.sin(danceFor(2, 3.9999).spin) - Math.sin(danceFor(2, 0).spin)) < 1e-2);
});

test('dances: blending in from nothing starts at the plain pose and ends at the full dance', () => {
  const d = danceFor(5, 1.3);
  const none = blendDance(d, 0, REST_Q);
  KEYS.forEach((k) => assert.ok(Math.abs(none[k]) < 1e-12, k));
  none.racket.forEach((v, i) => assert.ok(Math.abs(v - REST_Q[i]) < 1e-3));
  const full = blendDance(d, 1, REST_Q);
  KEYS.forEach((k) => assert.ok(Math.abs(full[k] - d[k]) < 1e-9));
});

test('quaternions: axisQuat and quatMul compose turns', () => {
  const q = quatMul(axisQuat(0.5, 0, 0, 1), axisQuat(0.5, 0, 0, 1));
  const r = axisQuat(1, 0, 0, 1);
  q.forEach((v, i) => assert.ok(Math.abs(v - r[i]) < 1e-9));
});
