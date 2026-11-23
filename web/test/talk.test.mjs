import test from 'node:test';
import assert from 'node:assert/strict';
import { POS, YAW, shotFor, shotKind, talkPose, moodOf, TALK_Z } from '../game/render/talkshots.js';
import { mapSvg } from '../game/mapart.js';
import { STOPS } from '../game/story.js';

const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('shots: wide sees both cats, close shots look at the speaker from the baseline side', () => {
  for (const kind of ['wide', 'two']) {
    const s = shotFor(kind);
    assert.ok(s.pos[2] < TALK_Z - 3); // behind the cats, on the baseline side, so the net and stands fill the background
    assert.ok(Math.abs(s.target[0]) < 0.5);
  }
  for (const sp of [0, 1]) {
    const s = shotFor('ots', sp);
    const me = POS[sp];
    assert.ok(Math.abs(s.target[0] - me[0]) < 0.3 && Math.abs(s.target[2] - me[1]) < 0.3, 'looks at the speaker');
    assert.ok(s.pos[2] < TALK_Z, 'camera on the baseline side');
    const d = dist([s.pos[0], s.pos[2]], me);
    assert.ok(d > 2 && d < 6, `distance ${d}`);
    assert.ok(s.pos[1] > 1 && s.pos[1] < 2);
  }
});

test('the hero stands on the screen-left side and the cats face each other', () => {
  assert.ok(POS[0][0] > 0 && POS[1][0] < 0); // the camera looks along +z, where +x is screen-left
  assert.ok(Math.sin(YAW[0]) < -0.9 && Math.sin(YAW[1]) > 0.9); // each faces the other
  assert.ok(Math.cos(YAW[0]) < 0 && Math.cos(YAW[1]) < 0); // and a little towards the camera
});

test('shot order: establishing first, then the speaker, a two-shot to finish', () => {
  assert.deepEqual([0, 1, 2].map((i) => shotKind(i, 3)), ['wide', 'ots', 'two']);
  assert.deepEqual([0, 1].map((i) => shotKind(i, 2)), ['wide', 'ots']);
});

test('talking moves the cat; idle barely does; walking swings the legs', () => {
  const idle = talkPose(1.3, 0, 0), talk = talkPose(1.3, 1, 0), walk = talkPose(1.3, 0, 0, 1);
  assert.ok(talk.hop > idle.hop && Math.abs(talk.headPitch) > Math.abs(idle.headPitch) * 0.9 - 0.2);
  assert.equal(idle.legAmp, 0); assert.equal(walk.legAmp, 1);
  assert.equal(talkPose(0.5, 1, 1).racket.length, 4);
  for (const v of Object.values(talkPose(3.7, 1, -1))) assert.ok(Array.isArray(v) || Number.isFinite(v));
});

test('mood reads the line', () => {
  assert.equal(moodOf('Hmph. Fine.'), -1);
  assert.equal(moodOf('HA! You win!'), 1);
  assert.equal(moodOf('A bench is only borrowed.'), 0);
});

test('the map art draws every stop, marks done/now/locked and stays in the 200 x 100 frame', () => {
  const svg = mapSvg(2);
  for (const k of ['gate', 'pond', 'market', 'rooftop', 'harbour', 'roost']) assert.ok(svg.includes(`data-stop="${k}"`), k);
  assert.equal((svg.match(/class="art done"/g) || []).length, 2);
  assert.equal((svg.match(/class="art now"/g) || []).length, 1);
  assert.equal((svg.match(/class="art lock"/g) || []).length, 3);
  assert.ok(svg.includes('viewBox="0 0 200 100"'));
  assert.ok(!/NaN|undefined/.test(svg));
  for (const s of STOPS) assert.ok(s.x * 2 > 10 && s.x * 2 < 190 && s.y > 10 && s.y < 90); // room for each picture
  const open = (svg.match(/<g[ >]/g) || []).length, close = (svg.match(/<\/g>/g) || []).length;
  assert.equal(open, close);
});
