import test from 'node:test';
import assert from 'node:assert/strict';
import { chaseAt, trackPoint } from '../game/render/titlescene.js';

test('the chaser closes to the lead\'s heels once a period, and falls back after', () => {
  const opts = { period: 8, gapMin: 0.3, gapMax: 1.4 };
  let minGap = 9, maxGap = 0, catches = 0;
  for (let t = 0; t < 32; t += 0.05) { const c = chaseAt(t, opts); minGap = Math.min(minGap, c.gap); maxGap = Math.max(maxGap, c.gap); if (c.catching) catches++; }
  assert.ok(minGap < 0.32 && maxGap > 1.38);
  assert.ok(catches > 0);
  assert.notEqual(chaseAt(1, opts).swap, chaseAt(9, opts).swap, 'the roles swap each period');
});
test('a track is a closed loop', () => {
  const tr = { cx: 1, cz: -8, rx: 4, rz: 2 };
  const a = trackPoint(tr, 0), b = trackPoint(tr, Math.PI * 2);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9);
});
