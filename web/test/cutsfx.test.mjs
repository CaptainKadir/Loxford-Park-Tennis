import test from 'node:test';
import assert from 'node:assert/strict';
import { blipFor, lineSounds, sceneOpen, sceneClose, mapSounds } from '../game/cutsfx.js';

test('blips skip spaces, punctuation and every other letter, and each speaker has a pitch', () => {
  assert.equal(blipFor(0, ' ', 0), null);
  assert.equal(blipFor(0, '!', 0), null);
  assert.equal(blipFor(0, 'a', 1), null);
  const hero = blipFor(0, 'a', 0).tone, rival = blipFor(1, 'a', 0).tone, boss = blipFor(1, 'a', 0, { boss: true }).tone;
  assert.ok(hero.hz[0] > rival.hz[0] && rival.hz[0] > boss.hz[0]);
});
test('a line always pops; grumbles meow, cheerful lines chirp, the boss hoots', () => {
  assert.ok(lineSounds('Hello there.', 0).length >= 1);
  assert.ok(lineSounds('Hmph. Whatever.', 1).some((e) => e.voice === 'angryMeow'));
  assert.ok(lineSounds('Let us play!', 0).filter((e) => e.tone).length >= 3);
  assert.ok(lineSounds('Do you dare?', 1, { boss: true }).some((e) => e.voice === 'hoot'));
  assert.ok(!lineSounds('Do you dare?', 0, { boss: true }).some((e) => e.voice === 'hoot')); // only the boss's own lines
});
test('the scene opens and closes with a sting', () => {
  assert.ok(sceneOpen().length >= 2 && sceneClose().length >= 2);
});
test('the map: a chime, footsteps when walking, a defeat thud, a fanfare when the story is done', () => {
  const plain = mapSounds();
  assert.ok(plain.length >= 1 && !plain.some((e) => e.bank));
  assert.equal(mapSounds({ walked: true }).filter((e) => e.bank === 'step').length, 4);
  assert.ok(mapSounds({ lost: true }).some((e) => e.bank === 'lost'));
  assert.ok(mapSounds({ finished: true }).some((e) => e.bank === 'applause'));
});

test('the boss entrance has a drone, a hoot and a sting', async () => {
  const { bossIntroSounds } = await import('../game/cutsfx.js');
  const l = bossIntroSounds();
  assert.ok(l.some((e) => e.tone && e.tone.len > 3) && l.some((e) => e.bank === 'owl') && l.filter((e) => e.tone).length >= 4);
});
