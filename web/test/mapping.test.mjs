import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMapping, headAngles, cleanMapping } from '../shared/mapping.js';

const qz = (a) => [Math.cos(a / 2), 0, 0, Math.sin(a / 2)]; // yaw left by a (radians)

test('identity mapping changes nothing', () => {
  const q = qz(0.7);
  applyMapping(q, { flipLR: false, flipUD: false, twist: 0 }).forEach((v, i) => assert.ok(Math.abs(v - q[i]) < 1e-12));
});

test('headAngles: turning left is positive yaw', () => {
  assert.ok(Math.abs(headAngles(qz(0)).yaw) < 1e-9);
  assert.ok(Math.abs(headAngles(qz(Math.PI / 4)).yaw - 45) < 1e-6);
});

test('flipLR mirrors the yaw, flipUD does not touch yaw', () => {
  const q = qz(0.5);
  const lr = applyMapping(q, { flipLR: true, flipUD: false, twist: 0 });
  assert.ok(Math.abs(headAngles(lr).yaw + headAngles(q).yaw) < 1e-6);
  const ud = applyMapping(q, { flipLR: false, flipUD: true, twist: 0 });
  assert.ok(Math.abs(headAngles(ud).yaw - headAngles(q).yaw) < 1e-6);
});

test('twist about the head axis keeps where the head points; results stay unit quaternions', () => {
  const q = qz(0.9);
  for (const twist of [90, 180, 270]) {
    const r = applyMapping(q, { flipLR: false, flipUD: false, twist });
    assert.ok(Math.abs(Math.hypot(...r) - 1) < 1e-9);
    assert.ok(Math.abs(headAngles(r).yaw - headAngles(q).yaw) < 1e-6);
  }
});

test('cleanMapping rejects junk', () => {
  assert.deepEqual(cleanMapping({ flipLR: 1, twist: 45, extra: 1 }), { flipLR: true, flipUD: false, twist: 0 });
});
