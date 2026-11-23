import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMenu, cleanSettings, doublesLineup, DEFAULTS } from '../game/menu.js';
import { CATS } from '../game/cats.js';
import { loadCore } from '../game/core.js';
import { buildCat } from '../game/render/cat.js';
import { lookFor } from '../game/cats.js';

const to = (m, ids) => { for (const k of ids) m.press(k); };
const openModes = (m) => { for (let i = 0; i < 4; i++) m.press('down'); assert.equal(m.titleItems()[m.state.index].id, 'modes'); m.press('enter'); assert.equal(m.state.screen, 'modes'); };

test('More modes lists Doubles, and the old entries keep their order', () => {
  const ids = createMenu().modeItems().map((i) => i.id);
  assert.deepEqual(ids, ['daily', 'tourney', 'party', 'doubles', 'practice', 'wardrobe', 'career', 'back']);
});

test('doublesLineup: two different opponents, none of them you or your partner', () => {
  for (let a = 0; a < CATS.length; a++) for (let b = 0; b < CATS.length; b++) {
    if (a === b) continue;
    const { cat2, cat4 } = doublesLineup(a, b);
    assert.equal(new Set([a, b, cat2, cat4]).size, 4, `${a} ${b} -> ${cat2} ${cat4}`);
  }
});

test('doubles menu flow: your cat, your partner, then the court and launch', () => {
  const m = createMenu();
  openModes(m);
  m.press('down'); m.press('down'); m.press('down'); // daily -> tourney -> party -> doubles
  assert.equal(m.modeItems()[m.state.index].id, 'doubles');
  assert.equal(m.press('enter'), 'doubles-pick');
  assert.equal(m.state.doubles, true);
  assert.equal(m.state.settings.players, 0);
  assert.equal(m.state.screen, 'cats'); assert.equal(m.state.who, 0);
  m.press('right'); // pick the second cat for yourself
  assert.equal(m.press('enter'), null);
  assert.equal(m.state.settings.cat1, 1);
  assert.equal(m.state.screen, 'cats'); assert.equal(m.state.who, 1); // now the partner
  assert.notEqual(m.state.index, 1, 'the cursor does not start on your own cat');
  m.state.index = 1;
  m.press('enter'); // cannot pick yourself as the partner
  assert.equal(m.state.who, 1); assert.equal(m.state.screen, 'cats');
  m.press('right');
  m.press('enter');
  const S = m.state.settings;
  assert.equal(m.state.screen, 'court');
  assert.equal(new Set([S.cat1, S.cat2, S.cat3, S.cat4]).size, 4);
  assert.equal(m.press('enter'), 'launch');
  assert.equal(m.state.doubles, true);
});

test('doubles menu: back steps through partner, your cat, then the modes list', () => {
  const m = createMenu();
  openModes(m);
  m.press('down'); m.press('down'); m.press('down'); m.press('enter');
  m.press('enter'); // your cat (default)
  assert.equal(m.state.who, 1);
  m.press('right'); m.press('enter'); assert.equal(m.state.screen, 'court');
  m.press('back'); assert.equal(m.state.screen, 'cats'); assert.equal(m.state.who, 1); assert.equal(m.state.index, m.state.settings.cat3);
  m.press('back'); assert.equal(m.state.who, 0); assert.equal(m.state.screen, 'cats');
  m.press('back'); assert.equal(m.state.screen, 'modes'); assert.equal(m.state.doubles, false);
  assert.equal(m.modeItems()[m.state.index].id, 'doubles');
});

test('picking another mode afterwards is not doubles; settings keep their defaults', () => {
  const m = createMenu();
  openModes(m);
  m.press('down'); m.press('down'); m.press('down'); m.press('enter');
  m.open(); // back to the title
  assert.equal(m.state.doubles, false);
  m.press('enter'); // 1 Player
  assert.equal(m.state.doubles, false);
  assert.deepEqual(cleanSettings(null), DEFAULTS); // cat3 / cat4 are not defaults: the game fills them in
  assert.equal(cleanSettings({ cat3: 2, cat4: 3 }).cat3, 2);
  assert.equal(cleanSettings({ cat3: 99 }).cat3, undefined);
});

test('the WASM core: the state layout matches and a doubles match runs', async () => {
  const core = await loadCore(); // throws if STATE_NAMES and the C enum disagree
  core.setMatchGames(1);
  core.initDoubles(7, true, false, 0, 0);
  let st = core.state();
  assert.equal(st.doubles, 1);
  assert.ok(st.partnerX > 1 && st.cpu2X < -1 && st.playerX < -1 && st.cpuX > 1, 'each stands on their own half');
  const zs = new Set();
  for (let i = 0; i < 60 * 240 && !core.state().matchOver; i++) {
    st = core.state();
    if (st.labState === 5 && st.ballY > 1.6 && st.ballVY < 0) core.demoSwing(8, 0, 0.3); // serve
    core.step(1 / 60, 0, 0);
    zs.add(Math.sign(st.partnerZ));
  }
  st = core.state();
  assert.equal(st.matchOver, 1);
  assert.ok(st.partnerHits > 0 || st.cpu2Hits > 0, 'the extra players hit balls');
  assert.deepEqual([...zs], [-1], 'the partner stays on the near side');
  core.init(3, true, false, 0); // singles afterwards: the extra fields are idle
  st = core.state();
  assert.equal(st.doubles, 0); assert.equal(st.partnerHits, 0); assert.equal(st.cpu2Hits, 0);
});

test('the camera is wider for doubles', async () => {
  const core = await loadCore();
  core.init(3, true, false, 0); core.step(1 / 60, 0, 0);
  const single = core.state().camFov;
  core.initDoubles(3, true, false, 0, 0); core.step(1 / 60, 0, 0);
  assert.ok(core.state().camFov > single + 4);
});

test('two extra cats can be built from the same looks as the others', () => {
  for (let c = 0; c < CATS.length; c++) {
    const cat = buildCat(lookFor(c, 0), null, true);
    cat.update({ x: 2.7, z: -12, vx: 0, vz: 0, racketQuat: [1, 0, 0, 0], inRally: true, mood: 0 }, 1 / 60);
    assert.ok(cat.group instanceof THREE.Group);
  }
});
