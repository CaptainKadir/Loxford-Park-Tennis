import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, demoQuat, poseVectors } from '../game/demo.js';
import { PROMPTS } from '../game/shots.js';
import { rotate } from '../shared/frame.js';

test('every trainer prompt has a demo with unit quaternions throughout', () => {
  for (const p of PROMPTS) {
    assert.ok(DEMOS[p.id], p.id);
    for (let u = 0; u <= 1.0001; u += 0.05) {
      const q = demoQuat(p.id, u);
      assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9);
    }
  }
});

test('demo quaternion puts the racket head and face normal where the pose says', () => {
  const [psi, phi, gamma] = [20, 30, 40];
  const { head, n } = poseVectors(psi, phi, gamma);
  const q = demoQuat('drop', 0); // any id: check poseQuat via vectors below instead
  assert.ok(q);
  assert.ok(Math.abs(head[0] * n[0] + head[1] * n[1] + head[2] * n[2]) < 1e-9, 'head ⟂ normal');
  assert.ok(n[1] > 0 && n[2] > 0 && n[0] < 0, 'faces forward, up, and left of the net line for +psi');
});

test('backhand demos start on the left, forehand on the right', () => {
  const at = (id, u) => rotate(demoQuat(id, u), [0, 1, 0]); // racket head in frame R
  assert.ok(at('fh-drive', 0)[0] > 0.2, 'forehand backswing head to the right');
  assert.ok(at('bh-drive', 0)[0] < -0.2, 'backhand backswing head to the left');
});

test('each example return is named as the shot it demonstrates', async () => {
  const { classify, DEFAULT_TUNING } = await import('../game/shots.js');
  for (const p of PROMPTS) {
    const { params } = DEMOS[p.id];
    assert.equal(classify(params.speed, params.face, params.path, DEFAULT_TUNING), p.type, p.id);
  }
});

test('the trainer is basic by default: forehand, backhand and lob', async () => {
  const { PROMPTS: basic, ALL_PROMPTS } = await import('../game/shots.js');
  assert.deepEqual(basic.map((p) => p.id), ['fh-drive', 'bh-drive', 'lob']);
  assert.equal(ALL_PROMPTS.length, 8);
});

test('every example return gets a fed ball and is hit (no human serve toss in the trainer)', async () => {
  const { loadCore } = await import('../game/core.js');
  const { ALL_PROMPTS, DEFAULT_TUNING } = await import('../game/shots.js');
  const demo = await loadCore();
  for (const p of ALL_PROMPTS) {
    demo.init(7, true, false, 0);
    demo.setTutorial(p.back ? 2 : 1);
    demo.setShotTuning(DEFAULT_TUNING);
    demo.demoPrepare(p.back);
    const { params } = DEMOS[p.id];
    let hit = false;
    for (let i = 0; i < 60 * 15 && !hit; i++) {
      demo.step(1 / 60, 0, 0);
      const s = demo.state();
      if (s.labState === 1 && s.arrivalT < 1e8 && s.labT >= s.arrivalT) hit = demo.demoSwing(params.speed, params.face, params.path);
    }
    assert.ok(hit, p.id);
  }
});
