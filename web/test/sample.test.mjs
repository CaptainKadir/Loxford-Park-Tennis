import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSample } from '../shared/sample.js';

const base = {
  t: 12.5,
  orient: { alpha: 0, beta: 0, gamma: 0 },
  rate: { alpha: 0, beta: 0, gamma: 0 },
  acc: { x: 0, y: 0, z: 9.80665 },
};

test('buildSample converts deg/s to rad/s in device order and m/s2 to g', () => {
  const { sample } = buildSample({ ...base, rate: { alpha: 0, beta: 180, gamma: 0 } }, { yaw0: 0 });
  assert.equal(sample.type, 's');
  assert.equal(sample.t, 12.5);
  assert.ok(Math.abs(sample.r[0] - Math.PI) < 1e-9); // beta -> device x
  assert.ok(Math.abs(sample.a[2] - 1) < 1e-9);
  assert.deepEqual(sample.q.map((v) => Math.round(v * 1e6) / 1e6), [1, 0, 0, 0]);
});

test('buildSample treats null sensor fields as zero', () => {
  const { sample } = buildSample(
    { ...base, rate: { alpha: null, beta: null, gamma: null }, acc: { x: null, y: null, z: 9.80665 } },
    { yaw0: 0 });
  assert.deepEqual(sample.r, [0, 0, 0]);
  assert.equal(sample.a[0], 0);
});

test('buildSample returns null when orientation is missing', () => {
  assert.equal(buildSample({ ...base, orient: null }, { yaw0: 0 }), null);
  assert.equal(buildSample({ ...base, orient: { alpha: null, beta: 1, gamma: 2 } }, { yaw0: 0 }), null);
});
