import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleToCsv } from '../scripts/jsonl-to-csv.mjs';

test('csv: a wire sample becomes a P line the C parser reads', () => {
  const line = sampleToCsv({ t: 1.5, q: [1, 0, 0, 0], r: [0, 0, 8], a: [0, 0, 1] });
  assert.equal(line, 'P,1.5000,1.00000,0.00000,0.00000,0.00000,0.0000,0.0000,8.0000,0.0000,0.0000,1.0000');
});
