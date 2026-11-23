import test from 'node:test';
import assert from 'node:assert/strict';
import { CATS, OWL, BOSS_INDEX, ALL_CATS } from '../game/cats.js';
import { STOPS, STAGES, rivalFor, dialogueFor, defeatLine, endingFor, premiseFor, stopSettings, stageOf, setStage } from '../game/story.js';
import { COURTS, TIMES } from '../game/render/courts.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('six stops, getting harder, ending at the boss', () => {
  assert.equal(STAGES, 6);
  for (let i = 1; i < STAGES; i++) assert.ok(STOPS[i].level >= STOPS[i - 1].level && STOPS[i].games >= STOPS[i - 1].games);
  assert.equal(STOPS[0].level, 0);
  assert.equal(STOPS[STAGES - 1].level, 3); // the boss level
  for (const s of STOPS) { assert.ok(s.court < COURTS.length && s.time < TIMES.length); assert.ok(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 100); }
});

test('every hero meets each other cat once, then the owl', () => {
  for (let h = 0; h < CATS.length; h++) {
    const seen = [];
    for (let s = 0; s < STAGES - 1; s++) seen.push(rivalFor(h, s));
    assert.equal(new Set(seen).size, CATS.length - 1);
    assert.ok(!seen.includes(h));
    assert.equal(rivalFor(h, STAGES - 1), BOSS_INDEX);
    assert.equal(ALL_CATS[BOSS_INDEX], OWL);
  }
});

test('the story differs by starting cat, and every match has a talk with both cats speaking', () => {
  const first = new Set();
  for (let h = 0; h < CATS.length; h++) {
    assert.ok(premiseFor(h).text.length > 40 && endingFor(h).length > 40);
    first.add(dialogueFor(h, 0).map((l) => l.text).join('|'));
    for (let s = 0; s < STAGES; s++) {
      const lines = dialogueFor(h, s);
      assert.ok(lines.length >= 3, `${h}/${s}`);
      assert.ok(lines.some((l) => l.mine && l.speaker === h), `hero speaks ${h}/${s}`);
      assert.ok(lines.some((l) => !l.mine && l.speaker === rivalFor(h, s)), `rival speaks ${h}/${s}`);
      assert.ok(lines.every((l) => l.text && l.name));
      assert.ok(defeatLine(h, s));
    }
  }
  assert.equal(first.size, CATS.length);
});

test('stop settings pick the rival, court, time and level', () => {
  const s = stopSettings(2, 5);
  assert.deepEqual([s.cat1, s.cat2, s.level], [2, BOSS_INDEX, 3]);
});

test('progress is kept per cat and survives junk', () => {
  const st = mem();
  assert.equal(stageOf(st, 1), 0);
  setStage(st, 1, 3); setStage(st, 4, 6);
  assert.equal(stageOf(st, 1), 3); assert.equal(stageOf(st, 4), 6); assert.equal(stageOf(st, 0), 0);
  setStage(st, 1, 99); assert.equal(stageOf(st, 1), STAGES);
  st.setItem('loxford.story', '{{{'); assert.equal(stageOf(st, 1), 0);
});

import { mapHtml, talkHtml } from '../game/storyui.js';
test('the map shows every stop, marks progress and names the next rival', () => {
  const h = mapHtml({ hero: 0, stage: 2 });
  for (const s of STOPS) assert.ok(h.includes(s.name));
  assert.equal((h.match(/class="node done/g) || []).length, 2);
  assert.equal((h.match(/class="node now/g) || []).length, 1);
  assert.ok(h.includes('Market Square') && h.includes('first to 2 games'));
  assert.match(mapHtml({ hero: 3, stage: STAGES }), /The end/); // finished: the ending
  assert.match(mapHtml({ hero: 3, stage: 1, note: 'Lost', retry: true }), /try again/);
  assert.ok(!mapHtml({ hero: 1, stage: 1, note: '<b>x</b>' }).includes('<b>x</b>')); // text is escaped
});

test('the talk shows the speaker and counts the lines', () => {
  const lines = dialogueFor(1, 0);
  const html = talkHtml({ hero: 1, rival: rivalFor(1, 0), lines, i: 0, stop: STOPS[0] });
  assert.match(html, /1 \/ 3/);
  assert.ok(html.includes(lines[0].name));
});

test('the map panel offers a finished stop for replay without new progress', async () => {
  const { stopPanelHtml, mapHtml } = await import('../game/storyui.js');
  const replay = stopPanelHtml({ hero: 0, stage: 3, sel: 1 }), next = stopPanelHtml({ hero: 0, stage: 3, sel: -1 });
  assert.ok(replay.includes('replay this stop') && replay.includes('no new progress'));
  assert.ok(next.includes('to the court') && !next.includes('no new progress'));
  assert.ok(stopPanelHtml({ hero: 0, stage: 6, sel: -1 }).includes('play the story again'));
  assert.ok(stopPanelHtml({ hero: 0, stage: 6, sel: 2 }).includes('replay this stop')); // a finished story can still replay a stop
  const map = mapHtml({ hero: 0, stage: 3, sel: 1 });
  assert.ok(map.includes('data-stop="1"') && /node done[^"]* sel/.test(map));
});

test('the stop panel names the stop reward, ticked once the stop is done', async () => {
  const { stopPanelHtml } = await import('../game/storyui.js');
  assert.ok(stopPanelHtml({ hero: 0, stage: 1, sel: -1 }).includes('Reward: Pond beanie'));
  assert.ok(stopPanelHtml({ hero: 0, stage: 3, sel: 0 }).includes('Reward: Leaf collar'));
});
