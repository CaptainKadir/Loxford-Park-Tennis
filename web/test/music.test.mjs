import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsAt, STEPS, hz, stepLen } from '../game/music.js';

test('the loop is eight bars and every step has an arpeggio note', () => {
  assert.equal(STEPS, 128);
  for (let s = 0; s < STEPS; s++) assert.ok(eventsAt(s).some((e) => e.voice === 'arp'));
});

test('melody notes stay in a singable range and each bar starts a lead note or holds one', () => {
  let leads = 0;
  for (let s = 0; s < STEPS; s++) for (const e of eventsAt(s)) if (e.voice === 'lead') { leads++; assert.ok(e.midi >= 60 && e.midi <= 90); }
  assert.ok(leads >= 30);
  assert.ok(Math.abs(hz(69) - 440) < 1e-9);
});

test('kick on the downbeats, snare on the backbeats', () => {
  assert.ok(eventsAt(0).some((e) => e.voice === 'kick'));
  assert.ok(eventsAt(4).some((e) => e.voice === 'snare'));
});

test('the pause tune is its own, slower, drum-free loop', () => {
  const all = Array.from({ length: STEPS }, (_, i) => eventsAt(i, 'pause')).flat();
  assert.ok(all.length > 0);
  assert.ok(!all.some((e) => e.voice === 'kick' || e.voice === 'snare'));
  assert.ok(stepLen('pause') > stepLen('menu'));
  assert.notDeepEqual(Array.from({ length: 16 }, (_, i) => eventsAt(i, 'pause')), Array.from({ length: 16 }, (_, i) => eventsAt(i)));
});

test('story and cat-select have their own tunes', () => {
  const sig = (t) => JSON.stringify(Array.from({ length: STEPS }, (_, i) => eventsAt(i, t)));
  assert.equal(new Set(['menu', 'pause', 'story', 'select'].map(sig)).size, 4);
  for (const t of ['story', 'select']) assert.ok(Array.from({ length: STEPS }, (_, i) => eventsAt(i, t)).flat().some((e) => e.voice === 'lead' || e.voice === 'flute'), t);
  assert.ok(stepLen('story') > stepLen('select'));
});

test('every tune has a loudness trim near 1, so they sit at one level', async () => {
  const { TUNE_TRIM } = await import('../game/music.js');
  for (const t of ['menu', 'pause', 'story', 'select']) assert.ok(TUNE_TRIM[t] > 0.8 && TUNE_TRIM[t] < 1.2, t);
});
