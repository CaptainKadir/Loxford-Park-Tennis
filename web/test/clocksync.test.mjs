import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClockSync } from '../game/clocksync.js';

test('clocksync: maps phone time onto lab time using the fastest delivery', () => {
  const cs = createClockSync();
  // phone clock starts at 1000 s; delivery delay is 20-50 ms.
  const delays = [0.05, 0.02, 0.04, 0.03];
  let last = -Infinity;
  delays.forEach((d, i) => {
    const phoneT = 1000 + i * 0.016;
    const labNow = 5 + i * 0.016 + d;
    const mapped = cs.map(phoneT, labNow);
    assert.ok(mapped <= labNow + 0.05, 'at most one jitter ahead of the lab clock');
    assert.ok(mapped > last, 'strictly increasing');
    last = mapped;
  });
  // the fastest delivery (0.02 s) fixes the offset, so a later sample maps to its true
  // lab time plus that 0.02 s
  const m = cs.map(1000.064, 5.064 + 0.03);
  assert.ok(Math.abs(m - (5.064 + 0.02)) < 1e-6, `got ${m}`);
});

test('clocksync: output stays monotonic when the offset shrinks', () => {
  const cs = createClockSync();
  const a = cs.map(10.0, 3.2);
  const b = cs.map(10.001, 3.0); // far faster delivery: offset drops by 0.2 s
  assert.ok(b > a);
});

test('clocksync: forgets an old minimum so a clock change cannot stick', () => {
  const cs = createClockSync({ windowS: 2 });
  cs.map(10.0, 3.0);
  for (let t = 1; t <= 6; t++) cs.map(10 + t, 3.5 + t); // offset now -6.5+... larger, old min expires
  const m = cs.map(17.0, 10.5);
  assert.ok(Math.abs(m - 10.5) < 0.05, `got ${m}`);
});
