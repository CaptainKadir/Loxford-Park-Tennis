import { test } from 'node:test';
import assert from 'node:assert/strict';
import { axesFromKeys } from '../game/input.js';

test('input: WASD and arrows map to axes', () => {
  assert.deepEqual(axesFromKeys(new Set(['ArrowRight'])), { right: 1, fwd: 0 });
  assert.deepEqual(axesFromKeys(new Set(['KeyA'])), { right: -1, fwd: 0 });
  assert.deepEqual(axesFromKeys(new Set(['KeyW', 'KeyD'])), { right: 1, fwd: 1 });
  assert.deepEqual(axesFromKeys(new Set(['ArrowDown'])), { right: 0, fwd: -1 });
});

test('input: opposing keys cancel', () => {
  assert.deepEqual(axesFromKeys(new Set(['ArrowLeft', 'ArrowRight'])), { right: 0, fwd: 0 });
  assert.deepEqual(axesFromKeys(new Set(['KeyW', 'ArrowDown'])), { right: 0, fwd: 0 });
});
