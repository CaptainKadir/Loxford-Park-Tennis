import test from 'node:test';
import assert from 'node:assert/strict';
import { stopGround, stopState, walkIndex, MAP_W, MAP_H } from '../game/render/mapscene.js';
import { STOPS } from '../game/story.js';

test('stops stand on the slab, x east and z south of its middle', () => {
  for (const s of STOPS) { const g = stopGround(s); assert.ok(Math.abs(g.x) <= MAP_W / 2 && Math.abs(g.z) <= MAP_H / 2, s.id); }
  assert.deepEqual(stopGround({ x: 50, y: 50 }), { x: 0, z: 0 });
  assert.ok(stopGround(STOPS[0]).x < stopGround(STOPS[5]).x);
});
test('a stop is done, now or locked by the stage', () => {
  assert.deepEqual([0, 1, 2].map((i) => stopState(i, 1)), ['done', 'now', 'lock']);
  assert.equal(stopState(5, 6), 'done');
});
test('the token walks smoothly from one stop to the next', () => {
  assert.equal(walkIndex(1, 2, 0), 1);
  assert.equal(walkIndex(1, 2, 1), 2);
  assert.ok(walkIndex(1, 2, 0.5) > 1.4 && walkIndex(1, 2, 0.5) < 1.6);
  assert.equal(walkIndex(2, 3, 5), 3); // clamped
});
