import test from 'node:test';
import assert from 'node:assert/strict';
import { smash, slamAmount, createChase, SMASHES, START, CYCLE, HIT_AT, CHASE_START } from '../game/render/tantrum.js';

test('the racket winds up, slams down on the ground and counts every smash', () => {
  assert.equal(smash(0).landed, 0);
  let last = 0, impacts = 0;
  for (let t = 0; t < CHASE_START; t += 1 / 60) {
    const { theta, landed } = smash(t);
    assert.ok(theta > -2.2 && theta < 1.8);
    if (landed > last) { impacts++; last = landed; }
  }
  assert.equal(impacts, SMASHES);
  assert.ok(smash(START + HIT_AT + 0.001).theta > 1.4); // tipped well down at the first impact
  assert.ok(smash(START + 0.36).theta < -1.7);           // raised high before the slam
});

test('the body dips at each impact only', () => {
  assert.ok(slamAmount(START + HIT_AT) > 0.9);
  assert.equal(slamAmount(START + 0.1), 0);
  assert.equal(slamAmount(START + SMASHES * CYCLE + 1), 0);
});

test('the owl catches up with the cat but the cat stays on its own half', () => {
  const c = createChase({ catX: 0, catZ: -9, half: -1, owlX: 7.6, owlY: 3, owlZ: 0, seed: 3 });
  let close = 0;
  for (let i = 0; i < 60 * 20; i++) {
    c.update(1 / 60);
    assert.ok(c.cat.z <= -2.5 + 1e-6 && c.cat.z >= -11 - 1e-6 && Math.abs(c.cat.x) <= 5 + 1e-6);
    if (Math.hypot(c.owl.x - c.cat.x, c.owl.z - c.cat.z) < 2.5) close++;
  }
  assert.ok(close > 60, 'the owl gets close to the cat');
});
