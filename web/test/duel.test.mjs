import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from '../game/core.js';
import { createDuel } from '../game/duel.js';

async function pair() {
  const a = await loadCore(), b = await loadCore();
  a.initRemote(1, true, false, 0); // player one serves first
  b.initRemote(2, true, false, 1);
  return { a, b, duel: createDuel(a, b) };
}
const run = (a, b, duel, seconds) => {
  for (let i = 0; i < seconds * 60; i++) { a.step(1 / 60, 0, 0); b.step(1 / 60, 0, 0); duel.pump(); }
};

test('server tosses, receiver waits with no ball', async () => {
  const { a, b, duel } = await pair();
  run(a, b, duel, 2);
  assert.equal(a.state().labState, 5); // LAB_SERVE
  assert.equal(b.state().labState, 0); // LAB_WAIT, waiting for the serve
  assert.equal(a.state().server, 0);
  assert.equal(b.state().server, 1);
});

test('a good serve arrives in the other core, and an unreturned ball is a point for the server', async () => {
  const { a, b, duel } = await pair();
  let swung = false, arrived = false;
  for (let i = 0; i < 60 * 8; i++) {
    a.step(1 / 60, 0, 0); b.step(1 / 60, 0, 0); duel.pump();
    const s = a.state();
    if (!swung && s.labState === 5 && s.ballY > 2.0 && s.ballVY < 0) swung = a.demoSwing(10, 0, 0);
    if (b.state().labState === 1) arrived = true;
  }
  assert.ok(swung && arrived, 'the serve reached the receiver');
  assert.equal(a.state().pointsHuman, 1);
  assert.equal(b.state().pointsCpu, 1);
});

test('a point ruled in one core is ruled in the other', async () => {
  const { a, b, duel } = await pair();
  run(a, b, duel, 1.5);
  a.remotePoint(0, 1); // the other player won (as seen by a)
  assert.equal(a.state().pointsCpu, 1);
  b.remotePoint(1, 1);
  assert.equal(b.state().pointsHuman, 1);
});

test('the receiver sees the serve fly (no teleport): ghost ball, then the real ball from the same spot', async () => {
  const { a, b, duel } = await pair();
  let swung = false, ghostFrames = 0, jump = 0, prev = null;
  for (let i = 0; i < 60 * 8; i++) {
    a.step(1 / 60, 0, 0); b.step(1 / 60, 0, 0); duel.pump();
    const s = a.state();
    if (!swung && s.labState === 5 && s.ballY > 2.0 && s.ballVY < 0) swung = a.demoSwing(10, 0, 0);
    const r = b.state();
    const shown = r.ghost === 1 ? [r.gX, r.gY, r.gZ] : (r.labState === 1 ? [r.ballX, r.ballY, r.ballZ] : null);
    if (r.ghost === 1) ghostFrames++;
    if (shown && prev) jump = Math.max(jump, Math.hypot(shown[0] - prev[0], shown[1] - prev[1], shown[2] - prev[2]));
    prev = shown;
  }
  assert.ok(swung);
  assert.ok(ghostFrames > 10, `ghost frames ${ghostFrames}`);
  assert.ok(jump < 1.2, `max per-frame jump ${jump.toFixed(2)} m`); // a 25 m/s ball moves about 0.4 m per frame
});
