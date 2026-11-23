import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, LESSON_COUNT, SLOWMO, lessonCycle, lessonFrame, lessonChips, stepLesson, contactsBetween } from '../game/lessons.js';
import { flyShot, launchShot, stepShot, SHOT_KIND } from '../game/lessonshots.js';
import { lessonHtml } from '../game/lessonui.js';
import { DEMOS, demoQuat } from '../game/demo.js';

test('the lessons cover setup, every stroke, the serve and the emote button', () => {
  const ids = LESSONS.map((l) => l.id);
  for (const id of ['setup', 'grip', 'forehand', 'backhand', 'topspin', 'slice', 'drop', 'lob', 'serve', 'emote']) assert.ok(ids.includes(id), id);
  assert.equal(LESSON_COUNT, LESSONS.length);
  assert.deepEqual(LESSONS[0].icons.map((i) => i[1]), ['Silent off', 'Volume up', 'Calibrate flat']); // the phone setup, as pictures
  for (const l of LESSONS) { assert.ok(l.title && (l.line || l.icons)); assert.ok((l.line || '').length <= 45, `${l.id}: keep it short`); if (l.kind === 'swing') for (const d of l.demos) assert.ok(DEMOS[d], d); }
});

test('swing lessons play each demo slowly with a rest before and a hold after, on repeat', () => {
  const l = LESSONS.find((x) => x.id === 'topspin');
  assert.equal(l.demos.length, 2);
  const cyc = lessonCycle(l);
  assert.ok(cyc > SLOWMO * (DEMOS['fh-topspin'].secs + DEMOS['bh-topspin'].secs));
  assert.equal(lessonFrame(l, 0).phase, 'ready');
  assert.equal(lessonFrame(l, 0).id, 'fh-topspin');
  let sawSwing = false, sawSecond = false, prevU = 0;
  for (let t = 0; t < cyc; t += 0.02) {
    const f = lessonFrame(l, t);
    assert.ok(f.u >= 0 && f.u <= 1);
    if (f.phase === 'swing') { sawSwing = true; if (f.n === 0) assert.ok(f.u >= prevU - 1e-9 || prevU > 0.95); prevU = f.u; }
    if (f.id === 'bh-topspin') sawSecond = true;
  }
  assert.ok(sawSwing && sawSecond);
  assert.deepEqual(lessonFrame(l, cyc + 0.01), lessonFrame(l, 0.01)); // loops
  assert.equal(lessonFrame(LESSONS[0], 5).id, null); // no swing in the setup lesson
});

test('every example swing gives a usable phone orientation all the way through', () => {
  for (const l of LESSONS.filter((x) => x.kind === 'swing')) {
    const cyc = lessonCycle(l);
    for (let t = 0; t < cyc; t += 0.05) {
      const f = lessonFrame(l, t), q = demoQuat(f.id, f.u);
      assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-6 && q.every(Number.isFinite));
    }
  }
});

test('lesson chips name the stroke, the speed and the screen angle', () => {
  assert.deepEqual(lessonChips('fh-slice'), ['Forehand', 'medium swing', 'screen open (tilted up)']);
  assert.equal(lessonChips('lob')[0], 'Lob');
  assert.ok(lessonChips('bh-topspin').every((c) => c.length < 30));
});

test('stepping stops at the ends and walks off the end to leave', () => {
  assert.equal(stepLesson(0, -1), -1);
  assert.equal(stepLesson(2, 1), 3);
  assert.equal(stepLesson(LESSON_COUNT - 1, 1), LESSON_COUNT);
});

test('the lesson card is short: a title, one line, chips, dots', () => {
  const h = lessonHtml(2, ['Forehand', 'medium-fast swing', 'screen upright']);
  assert.match(h, /Forehand/); assert.match(h, /medium-fast swing/); assert.match(h, /<svg/); // the arrow
  assert.ok(!h.includes('lphone'));
  assert.ok(h.replace(/<svg.*?<\/svg>/gs, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length < 40, 'minimal text');
  const e = lessonHtml(LESSONS.findIndex((l) => l.id === 'emote'));
  assert.ok(e.includes('lphone') && /practise/.test(lessonHtml(LESSON_COUNT - 1)));
  const setup = lessonHtml(0);
  assert.ok(setup.includes('Silent off') && setup.includes('Volume up') && setup.includes('licons'));
  assert.ok(!lessonHtml(0, ['<b>x</b>']).includes('<b>x</b>'));
});

test('contacts fire once per swing, at the moment of contact, and again each loop', () => {
  const l = LESSONS.find((x) => x.id === 'topspin');
  const cyc = lessonCycle(l);
  let fired = [];
  for (let t = 0; t < cyc * 2; t += 1 / 60) fired.push(...contactsBetween(l, t, t + 1 / 60));
  assert.deepEqual(fired, ['fh-topspin', 'bh-topspin', 'fh-topspin', 'bh-topspin']);
  assert.deepEqual(contactsBetween(LESSONS[0], 0, 100), []); // no swing, no shot
});

test('every demo has an example shot that clears the net and lands in the far court', () => {
  for (const id of Object.keys(SHOT_KIND)) {
    const r = flyShot(id);
    assert.ok(r.netY > 0.95, `${id} net ${r.netY}`);
    assert.ok(r.landZ > 0.5 && r.landZ < 11.9, `${id} lands ${r.landZ}`);
    assert.ok(Math.abs(r.landX) < 4.1, `${id} wide ${r.landX}`);
  }
});

test('the shots look like themselves: topspin kicks, slice skids, drop dies, lob floats', () => {
  const drive = flyShot('fh-drive'), top = flyShot('fh-topspin'), slice = flyShot('fh-slice'), drop = flyShot('drop'), lob = flyShot('lob');
  assert.ok(top.bounceApex > drive.bounceApex * 1.8); // kicks up high after the bounce
  assert.ok(slice.bounceApex < drive.bounceApex * 0.5); // stays low
  assert.ok(drop.landZ < 3 && drop.landZ < drive.landZ / 2); // just over the net
  assert.ok(lob.apex > 5 && lob.apex > top.apex * 2); // high and slow
  assert.ok(flyShot('fh-drive').landX > 0 && flyShot('bh-drive').landX < 0); // forehands and backhands cross the court
});

test('a shot ends: it never runs for ever', () => {
  const s = launchShot('lob');
  for (let i = 0; i < 2000 && !s.done; i++) stepShot(s, 1 / 60);
  assert.ok(s.done);
});
