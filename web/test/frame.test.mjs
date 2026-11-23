import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceQuat, rotate, phoneToCourt, calibrate, driftCorrect, fixAccelSign } from '../shared/frame.js';

const near = (a, b, tol = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < tol, `${a} vs ${b}`));
const deg = Math.PI / 180;

test('deviceQuat: flat is identity, upright phone points top up', () => {
  near(deviceQuat(0, 0, 0), [1, 0, 0, 0]);
  near(rotate(deviceQuat(0, 90, 0), [0, 1, 0]), [0, 0, 1], 1e-9);
});

test('frame: identity after calibrate', () => {
  const q = deviceQuat(137, 20, -10);
  // phone pointing roughly forward: top of phone horizontal
  const flat = deviceQuat(137, 0, 0);
  const calib = calibrate(flat);
  near(phoneToCourt(flat, calib), [1, 0, 0, 0], 1e-9);
  assert.ok(phoneToCourt(q, calib).length === 4);
});

test('frame: yaw +90 after calibrating points racket to the left', () => {
  const calib = calibrate(deviceQuat(0, 0, 0));
  const turned = deviceQuat(90, 0, 0);
  near(rotate(phoneToCourt(turned, calib), [0, 1, 0]), [-1, 0, 0], 1e-9);
});

test('frame: output is a unit quaternion', () => {
  const calib = calibrate(deviceQuat(40, 5, 0));
  const q = phoneToCourt(deviceQuat(200, 55, 33), calib);
  assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9);
});

test('calibrate: upright phone has no usable heading, returns null', () => {
  assert.equal(calibrate(deviceQuat(0, 90, 0)), null);
});

test('driftCorrect: small drift is pulled back, large turn is left alone', () => {
  const calib = { yaw0: 0 };
  const small = driftCorrect(calib, deviceQuat(10, 0, 0), 3);
  assert.ok(Math.abs(small.yaw0) > 0 && Math.abs(small.yaw0) <= 10 * deg);
  const big = driftCorrect(calib, deviceQuat(60, 0, 0), 3);
  assert.equal(big.yaw0, 0);
  const notStill = driftCorrect(calib, deviceQuat(10, 0, 0), 0.5);
  assert.equal(notStill.yaw0, 0);
});

test('fixAccelSign: flips when the platform reports gravity inverted', () => {
  const q = deviceQuat(0, 0, 0); // flat, face up: gravity along +z in the device frame
  assert.deepEqual(fixAccelSign(q, [0, 0, 1]).a, [0, 0, 1]);
  const flipped = fixAccelSign(q, [0, 0, -1]);
  assert.deepEqual(flipped.a, [0, 0, 1]);
  assert.equal(flipped.sign, -1);
});

test('driftCorrect: correction is scaled by elapsed time, not applied per call', () => {
  const calib = { yaw0: 0 };
  const q = deviceQuat(20, 0, 0);
  let c = calib;
  for (let i = 0; i < 100; i++) c = driftCorrect(c, q, 3, 0.01); // 1 s total
  const one = driftCorrect(calib, q, 3, 1.0);
  assert.ok(Math.abs(c.yaw0 - one.yaw0) < 0.05, `${c.yaw0} vs ${one.yaw0}`);
});
