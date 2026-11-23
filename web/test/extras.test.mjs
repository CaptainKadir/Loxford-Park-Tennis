import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, frameAt, clipLength, introCam, introCaption, pauseHtml, INTRO_TIME } from '../game/extras.js';
import { swingKind, swingPose, swingTime } from '../game/render/rig.js';

const st = (labState, extra = {}) => ({ labState, matchOver: 0, ...extra });
const feed = (rec, states) => states.forEach((s) => rec.push(1 / 60, s, null, {}, null));
const rally = (n) => [st(5), ...Array(n).fill(st(1)), st(3), st(3), st(0)];

test('recorder: replays the point just finished, then the previous one once the next serve starts', () => {
  const rec = createRecorder();
  feed(rec, [st(0), st(0), ...rally(60)]);
  assert.equal(rec.clip().length, 64); // serve, 60 rally frames, result x2, wait; the idle wait before the serve is dropped
  feed(rec, [st(5), st(1), st(1)]); // point two just started
  const c = rec.clip();
  assert.ok(c.length > 30 && c[0].st.labState === 5, 'a rally in progress replays the previous point');
});

test('recorder: nothing to replay before a point has been played', () => {
  const rec = createRecorder();
  feed(rec, [st(0), st(0), st(5), st(1)]);
  assert.deepEqual(rec.clip(), []);
});

test('recorder: caps its memory', () => {
  const rec = createRecorder({ maxFrames: 100 });
  feed(rec, [st(5), ...Array(500).fill(st(1))]);
  assert.ok(rec.clip().length <= 100);
});

test('clip helpers: frameAt finds the frame, clamps, and handles empty', () => {
  const clip = Array.from({ length: 61 }, (_, i) => ({ at: i / 60 }));
  assert.equal(frameAt(clip, 0), 0);
  assert.equal(frameAt(clip, 0.5), 30);
  assert.equal(frameAt(clip, 99), 60);
  assert.equal(frameAt([], 1), -1);
  assert.ok(Math.abs(clipLength(clip) - 1) < 1e-9);
});

test('intro camera: ends exactly on the match camera and starts well away from it', () => {
  const base = { ex: 0.5, ey: 2.6, ez: -13, tx: 0, ty: 1, tz: 4, fov: 40 };
  const end = introCam(INTRO_TIME, base);
  for (const k of ['ex', 'ey', 'ez', 'tx', 'ty', 'tz', 'fov']) assert.ok(Math.abs(end[k] - base[k]) < 1e-9, k);
  const start = introCam(0, base);
  assert.ok(Math.hypot(start.ex - base.ex, start.ez - base.ez) > 10 && start.ey >= 6);
  assert.deepEqual(introCam(99, base), end);
});

test('intro caption: names, then PLAY!', () => {
  assert.match(introCaption(1, ['Otis', 'Minu']).big, /Otis.*Minu/);
  assert.equal(introCaption(INTRO_TIME - 0.1, ['a', 'b']).big, 'PLAY!');
});

test('pause screen lists the keys', () => {
  const html = pauseHtml();
  for (const k of ['PAUSED', 'Resume', 'Replay last point', 'Main menu', 'Controls']) assert.ok(html.includes(k), k);
  assert.ok(!html.includes('Esc or P'), 'the key legend is folded away by default');
  assert.ok(pauseHtml(undefined, [], { keysOpen: true }).includes('Esc or P'));
});

test('swing kinds follow the stroke the core reports', () => {
  assert.equal(swingKind(0, 1).name, 'serve');
  assert.equal(swingKind(1, 1).name, 'forehand');
  assert.equal(swingKind(2, 1).name, 'backhand');
  assert.equal(swingKind(2, 1).back, true);
  assert.equal(swingKind(1, 2).name, 'topspin');
  assert.equal(swingKind(2, 3).name, 'slice');
  assert.equal(swingKind(1, 4).name, 'drop');
  assert.equal(swingKind(1, 5).name, 'lob');
});

test('each swing animation is different, finite, and the serve is the longest', () => {
  const names = ['forehand', 'backhand', 'serve', 'topspin', 'slice', 'drop', 'lob'];
  const sigs = new Set();
  for (const n of names) {
    const sig = [];
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const pose = swingPose(p, true, { name: n, back: n === 'backhand' });
      for (const v of Object.values(pose)) assert.ok(Number.isFinite(v), `${n} ${p}`);
      sig.push(pose.twist.toFixed(2), pose.lean.toFixed(2), pose.crouch.toFixed(2), pose.rise.toFixed(2), pose.lunge.toFixed(2));
    }
    sigs.add(sig.join());
  }
  assert.equal(sigs.size, names.length);
  assert.ok(names.every((n) => swingTime({ name: n }) <= swingTime({ name: 'serve' })));
  // backhand turns the shoulders the other way from the forehand and steps in with the other foot
  assert.ok(swingPose(1, true, swingKind(1, 1)).twist * swingPose(1, true, swingKind(2, 1)).twist < 0);
  assert.ok(swingPose(0.5, true, swingKind(1, 1)).lunge * swingPose(0.5, true, swingKind(2, 1)).lunge < 0);
});

test('replay angles swap the camera and keep the ball in frame', async () => {
  const { REPLAY_ANGLES, withReplayAngle } = await import('../game/extras.js');
  const st = { ballX: 2, ballY: 1, ballZ: 9, camEX: 0, camEY: 2.5, camEZ: -13, camTX: 0, camTY: 1, camTZ: 4, camFov: 40, labState: 1 };
  assert.ok(REPLAY_ANGLES.length >= 3);
  assert.equal(withReplayAngle(null, 0), null);
  const side = withReplayAngle(st, 0);
  assert.ok(Math.abs(side.camEX) > 8 && side.camTZ > 0 && side.camTZ <= 7, 'side-on, looking along the ball');
  assert.equal(side.labState, 1, 'the rest of the state is untouched');
  const orig = withReplayAngle(st, REPLAY_ANGLES.length - 1);
  assert.equal(orig.camEZ, -13, 'the last angle is the recorded match view');
  for (let i = 0; i < REPLAY_ANGLES.length; i++) for (const k of ['camEX', 'camEY', 'camEZ', 'camTX', 'camTY', 'camTZ', 'camFov']) assert.ok(Number.isFinite(withReplayAngle(st, i)[k]), `${i} ${k}`);
  assert.equal(withReplayAngle(st, REPLAY_ANGLES.length).camEX, side.camEX, 'wraps around');
});

test('overhead replay camera keeps the baselines horizontal (no sideways eye offset)', async () => {
  const { REPLAY_ANGLES, withReplayAngle } = await import('../game/extras.js');
  const i = REPLAY_ANGLES.findIndex((a) => a.name === 'Overhead');
  const c = withReplayAngle({ ballX: 0, ballY: 1, ballZ: 5 }, i);
  assert.equal(c.camEX, 0);
  assert.equal(c.camTX, 0);
  assert.ok(c.camEY > 10 && Math.abs(c.camEZ - c.camTZ) < 0.1, 'straight down, with a tiny z offset that sets screen-up');
});

import { canEmote, emoteWeight, emoteCam, EMOTE_TIME } from '../game/extras.js';
test('emotes only start between points (waiting or just after a point), never mid-rally or after the match', () => {
  assert.ok(canEmote(st(0)) && canEmote(st(3)));
  for (const mid of [1, 2, 4, 5]) assert.ok(!canEmote(st(mid)), `state ${mid}`); // incoming, outgoing, CPU turn, serve toss
  assert.ok(!canEmote(st(0, { matchOver: 1 })));
});

test('the emote eases in and out and the camera ends close in front of the cat', () => {
  assert.equal(emoteWeight(0), 0);
  assert.equal(emoteWeight(EMOTE_TIME / 2), 1);
  assert.equal(emoteWeight(EMOTE_TIME), 0);
  const a = emoteCam(0, { x: 1, z: -11 }), b = emoteCam(EMOTE_TIME, { x: 1, z: -11 });
  assert.ok(a.ez > -11 && b.ez > -11); // in front of the cat (it faces +z)
  assert.ok(Math.hypot(b.ex - 1, b.ez + 11) < Math.hypot(a.ex - 1, a.ez + 11)); // moves in
  assert.deepEqual([b.tx, b.tz], [1, -11]);
});

import { fireLevel, FIRE_START, FIRE_FULL } from '../game/extras.js';
test('the ball catches fire gradually as the rally gets longer', () => {
  for (let n = 0; n < FIRE_START; n++) assert.equal(fireLevel(n), 0); // a short rally: no flame
  assert.ok(fireLevel(FIRE_START) > 0 && fireLevel(FIRE_START) < 0.15); // first embers
  assert.equal(fireLevel(FIRE_FULL), 1);
  assert.equal(fireLevel(40), 1);
  let prev = 0;
  for (let n = 0; n <= 20; n++) { const k = fireLevel(n); assert.ok(k >= prev && k <= 1); prev = k; } // never dims as the rally goes on
  const mid = fireLevel(Math.round((FIRE_START + FIRE_FULL) / 2));
  assert.ok(mid > 0.3 && mid < 0.8);
});
