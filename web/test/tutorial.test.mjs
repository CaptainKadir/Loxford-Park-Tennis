import test from 'node:test';
import assert from 'node:assert/strict';
import { createTutorial, STEPS } from '../game/tutorial.js';

const st = (o = {}) => ({ hits: 0, hitSide: 0, pointsHuman: 0, ...o });

test('serve, forehand and backhand steps count only the right hits', () => {
  const t = createTutorial();
  t.update(st());
  assert.equal(t.update(st({ hits: 1, hitSide: 1 })).step, 0); // a forehand is not a serve
  assert.equal(t.update(st({ hits: 2, hitSide: 0 })).step, 1); // a serve moves on
  let v = t.view();
  assert.equal(v.side, 1);
  for (let i = 1; i <= 3; i++) v = t.update(st({ hits: 2 + i, hitSide: 1 }));
  assert.equal(v.step, 2);
  assert.equal(v.side, 2);
  assert.match(v.text, /left/);
});

test('the last step needs a point and then the tutorial is done with feeds turned off', () => {
  const t = createTutorial();
  t.update(st());
  t.skip(); t.skip(); t.skip();
  assert.equal(t.view().side, 3);
  const v = t.update(st({ pointsHuman: 1 }));
  assert.ok(v.done && v.side === 0 && /COMPLETE/.test(v.label));
  assert.equal(STEPS.length, 4);
});
