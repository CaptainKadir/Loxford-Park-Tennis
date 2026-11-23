import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveRacketArm, idlePose, runPose, swingPose, ARM_REACH, quatRToCore } from '../game/render/rig.js';
import { deviceQuat, rotate } from '../shared/frame.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const shoulder = [0.2, 1.1, -5];
const quats = [[1, 0, 0, 0], deviceQuat(40, 70, -20), deviceQuat(200, 120, 30), deviceQuat(-90, 10, 85)];

test('arm: racket orientation equals the phone quaternion', () => {
  for (const q of quats) {
    const r = solveRacketArm(shoulder, q, true);
    r.racketQuat.forEach((v, i) => assert.ok(Math.abs(v - q[i]) < 1e-9));
  }
});

test('arm: paw and elbow stay within arm reach of the shoulder', () => {
  for (const q of quats) for (const rh of [true, false]) {
    const r = solveRacketArm(shoulder, q, rh);
    assert.ok(dist(r.paw, shoulder) <= ARM_REACH + 1e-9, `paw ${dist(r.paw, shoulder)}`);
    assert.ok(dist(r.elbow, shoulder) <= ARM_REACH + 1e-9);
    assert.deepEqual(r.racketPos, r.paw);
  }
});

test('arm: right-handed elbow bends out toward the right of the cat (-x in core), left-handed the other way', () => {
  const q = [1, 0, 0, 0];
  const right = solveRacketArm(shoulder, q, true);
  const left = solveRacketArm(shoulder, q, false);
  assert.ok(right.elbow[0] - shoulder[0] < 0);
  assert.ok(left.elbow[0] - shoulder[0] > 0);
});

test('frame R to core: a phone yaw turns the racket head about the vertical axis', () => {
  const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));
  const yaw90 = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // +90 deg about R.z (up), turning left
  const q = quatRToCore(yaw90);
  near([q[1], q[3]], [0, 0]); // rotation axis is core y (up) only
  near(rotate(q, [0, 0, 1]), [1, 0, 0]); // forward becomes the cat's left, which is +x in core
  near(rotate(quatRToCore([1, 0, 0, 0]), [0, 0, 1]), [0, 0, 1]);
});

test('frame R to core: tipping the phone top up points the racket head at the sky', () => {
  // +90 deg about R.x (right) raises the top of a forward-pointing phone to up.
  const pitch = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
  const v = rotate(quatRToCore(pitch), [0, 0, 1]);
  assert.ok(Math.abs(v[1] - 1) < 1e-9, `head ${v}`);
});

test('clips: idle bob is small and bounded', () => {
  for (let t = 0; t < 10; t += 0.1) assert.ok(Math.abs(idlePose(t).bob) < 0.03);
});

test('clips: run legs scale with speed and cap at 1', () => {
  assert.equal(runPose(1, 0).legAmp, 0);
  assert.ok(runPose(1, 3).legAmp > 0 && runPose(1, 3).legAmp < runPose(1, 6).legAmp + 1e-9);
  assert.equal(runPose(1, 60).legAmp, 1);
});

test('clips: swing body twist sweeps forward monotonically', () => {
  let prev = -Infinity;
  for (let p = 0; p <= 1.0001; p += 0.1) {
    const tw = swingPose(p, true).twist;
    assert.ok(tw > prev);
    prev = tw;
  }
  assert.ok(swingPose(1, false).twist < swingPose(0, false).twist);
});

test('body yaw: racket head pointing left turns the cat left, right turns right, forward is zero', async () => {
  const { bodyYawFromRacket } = await import('../game/render/rig.js');
  const about = (a) => [Math.cos(a / 2), 0, Math.sin(a / 2), 0]; // rotation about core y: z toward +x
  assert.ok(Math.abs(bodyYawFromRacket([1, 0, 0, 0])) < 1e-9);
  assert.ok(bodyYawFromRacket(about(0.6)) > 0.3);
  assert.ok(bodyYawFromRacket(about(-0.6)) < -0.3);
  assert.ok(Math.abs(bodyYawFromRacket(about(3))) <= 1.7 + 1e-9);
});
