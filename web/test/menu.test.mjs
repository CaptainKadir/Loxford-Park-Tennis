import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu, cleanSettings, CAT_COLUMNS } from '../game/menu.js';
import { CATS } from '../game/cats.js';
import { COURTS } from '../game/render/courts.js';

test('cleanSettings drops junk and clamps', () => {
  const d = { players: 0, cat1: 0, cat2: 1, court: 1, time: 1, level: 1, ball: 0, shots: 1, hand: 0, assist: 1, aim: 1, weather: 0, sfxVol: 8, musicVol: 5, shake: 0, impact: 0, ballcol: 0, calls: 0, autoreplay: 0 };
  assert.deepEqual(cleanSettings({ level: 5, ball: 1, hand: 'x', extra: 1, court: 9 }), { ...d, ball: 1 });
  assert.deepEqual(cleanSettings(null), d);
  assert.equal(cleanSettings({ court: COURTS.length - 1 }).court, COURTS.length - 1);
});

test('title: play goes to cat choice, then the court, then launches', () => {
  const m = createMenu();
  assert.equal(m.state.screen, 'title');
  assert.equal(m.press('enter'), 'players'); // "1 Player"
  assert.equal(m.state.settings.players, 0);
  assert.equal(m.state.screen, 'cats');
  m.press('right'); // second cat
  m.press('enter');
  assert.equal(m.state.settings.cat1, 1);
  assert.equal(m.state.screen, 'court'); // one player: straight to the court
  assert.notEqual(m.state.settings.cat2, m.state.settings.cat1); // the CPU gets a different cat
  m.press('right');
  assert.equal(m.press('enter'), 'launch');
  assert.equal(m.state.settings.court, 2); // the cursor starts on the default (hard, the middle one) and moved right to grass
});

test('two players: each picks a cat, then the court', () => {
  const m = createMenu();
  m.press('down'); // "2 Players" is on the main menu
  assert.equal(m.press('enter'), 'players');
  assert.equal(m.state.settings.players, 1);
  m.press('enter'); // player one keeps cat 0
  assert.equal(m.state.screen, 'cats');
  assert.equal(m.state.who, 1);
  m.press('down');
  m.press('enter');
  assert.equal(m.state.settings.cat2, (1 + CAT_COLUMNS) % CATS.length);
  assert.equal(m.state.screen, 'court');
  m.press('back'); // back to player two's pick
  assert.equal(m.state.screen, 'cats');
  assert.equal(m.state.who, 1);
  m.press('back');
  assert.equal(m.state.who, 0);
  m.press('back');
  assert.equal(m.state.screen, 'title');
});

test('main menu has 1 and 2 players and the tutorial; settings cycle and go back', () => {
  const m = createMenu({ players: 1 });
  assert.deepEqual(m.titleItems().map((i) => i.id), ['play1', 'play2', 'online', 'story', 'modes', 'tutorial', 'settings']);
  m.press('down'); m.press('down'); m.press('down'); m.press('down'); m.press('down');
  assert.equal(m.press('enter'), 'tutorial');
  assert.equal(m.state.settings.players, 0); // the tutorial is one player
  m.press('down');
  m.press('enter');
  assert.equal(m.state.screen, 'settings');
  assert.ok(!m.settingItems().some((i) => i.id === 'players')); // chosen on the main menu now
  assert.deepEqual(m.settingItems().slice(0, 4).map((i) => i.id), ['group:gameplay', 'group:sound', 'group:visuals', 'group:matchx']);
  assert.equal(m.press('enter'), null); // Gameplay opens its own list
  assert.equal(m.state.screen, 'group');
  assert.equal(m.press('right'), 'level');
  m.press('up'); // wraps to Back
  assert.equal(m.groupItems()[m.state.index].id, 'back');
  m.press('enter');
  assert.equal(m.state.screen, 'settings');
  assert.equal(m.state.index, 0, 'the cursor is back on Gameplay');
  m.press('back');
  assert.equal(m.state.screen, 'title');
});

test('cat grid wraps and moves by rows; open() returns to the title', () => {
  const m = createMenu();
  m.press('enter');
  m.press('left');
  assert.equal(m.state.index, CATS.length - 1);
  m.press('down');
  assert.equal(m.state.index, (CATS.length - 1 + CAT_COLUMNS) % CATS.length);
  m.open();
  assert.equal(m.state.screen, 'title');
});

test('time of day is chosen on the court screen with up and down', async () => {
  const { TIMES } = await import('../game/render/courts.js');
  const m = createMenu();
  m.press('enter'); m.press('enter'); // cat, then the court screen
  assert.equal(m.state.screen, 'court');
  assert.equal(m.state.settings.time, 1); // sunset is the default
  assert.equal(m.press('down'), 'time');
  assert.equal(m.state.settings.time, 2);
  m.press('up'); m.press('up'); m.press('up');
  assert.equal(m.state.settings.time, TIMES.length - 1);
  assert.equal(m.state.index, 1); // the court cursor did not move (it started on hard)
  assert.equal(cleanSettings({ time: 9 }).time, 1);
});

test('defaults: hard court in the middle of the list, sunset', async () => {
  const { COURTS, TIMES } = await import('../game/render/courts.js');
  const m = createMenu();
  assert.equal(COURTS[m.state.settings.court].id, 'hard');
  assert.equal(COURTS.findIndex((c) => c.id === 'hard'), 1);
  assert.equal(TIMES[m.state.settings.time].id, 'sunset');
});

test('settings: Reset to defaults restores every setting, the court and the time, but not the cats', async () => {
  const { DEFAULTS } = await import('../game/menu.js');
  const m = createMenu({ level: 0, ball: 1, shots: 0, hand: 1, assist: 0, aim: 1, weather: 2, sfxVol: 1, musicVol: 0, shake: 1, impact: 1, ballcol: 3, calls: 1, autoreplay: 1, court: 2, time: 2, cat1: 4, cat2: 5 });
  m.press('down'); m.press('down'); m.press('down'); m.press('down'); m.press('down'); m.press('down'); m.press('enter'); // title -> Settings
  assert.equal(m.state.screen, 'settings');
  const items = m.settingItems();
  const iReset = items.findIndex((it) => it.id === 'reset');
  assert.ok(iReset > 0 && items[iReset + 1].id === 'back', 'Reset sits just above Back');
  for (let i = 0; i < iReset; i++) m.press('down');
  assert.equal(m.press('left'), null, 'arrows do not reset');
  assert.equal(m.press('enter'), 'reset');
  const s = m.state.settings;
  for (const k of ['level', 'ball', 'shots', 'hand', 'assist', 'aim', 'weather', 'sfxVol', 'musicVol', 'shake', 'impact', 'ballcol', 'calls', 'autoreplay', 'court', 'time']) assert.equal(s[k], DEFAULTS[k], k);
  assert.equal(s.cat1, 4); assert.equal(s.cat2, 5);
  assert.equal(m.state.screen, 'settings', 'stays on the screen so you can see the values change');
});

test('story: pick a cat from the title menu, then the story map takes over (no court step)', () => {
  const m = createMenu({ players: 1, cat1: 2 });
  m.press('down'); m.press('down'); m.press('down'); // Story
  assert.equal(m.press('enter'), 'story-pick');
  assert.equal(m.state.screen, 'cats');
  assert.equal(m.state.settings.players, 0); // story is one player
  assert.equal(m.state.index, 2);
  m.press('right');
  assert.equal(m.press('enter'), 'story');
  assert.equal(m.state.settings.cat1, 3);
  assert.equal(m.state.screen, 'cats'); // the page shows the map; the menu does not go on to the court
  m.press('back'); assert.equal(m.state.screen, 'title');
  // a normal 1 Player game afterwards is not a story
  m.press('enter'); // back on the title the cursor is on 1 Player
  m.press('enter');
  assert.equal(m.state.screen, 'court');
});

test('Professor Hoot is pickable only once unlocked, and only in quick matches', () => {
  const m = createMenu({ cat2: 6 });
  assert.equal(m.state.settings.cat2, 6); // an owl can always be the CPU opponent in settings
  assert.equal(m.catCount(), CATS.length); // locked: not on the pick screen
  m.setOwl(true);
  assert.equal(m.catCount(), CATS.length + 1);
  m.state.story = true; assert.equal(m.catCount(), CATS.length); m.state.story = false;
  m.state.doubles = true; assert.equal(m.catCount(), CATS.length); m.state.doubles = false;
  m.state.screen = 'cats'; m.state.index = CATS.length; // the owl's card
  m.press('enter'); assert.equal(m.state.settings.cat1, CATS.length);
  const s = createMenu({ cat1: 0 }); s.setOwl(true); s.state.story = true; s.state.screen = 'cats'; s.state.index = CATS.length;
  s.press('right'); assert.ok(s.state.index < CATS.length, 'the cursor never rests on a cat that is not on offer');
});

test('online: host picks cat then court; a joiner picks a cat and goes straight on', () => {
  const m = createMenu({ cat1: 1 });
  m.press('down'); m.press('down'); // Online
  assert.equal(m.press('enter'), null);
  assert.equal(m.state.screen, 'online');
  assert.deepEqual(m.onlineItems().map((i) => i.id), ['host', 'join', 'back']);
  assert.equal(m.press('enter'), 'players'); // Host
  assert.equal(m.state.settings.players, 2);
  assert.equal(m.state.screen, 'cats');
  assert.equal(m.state.who, 0); // only your cat: the friend brings theirs
  assert.equal(m.press('enter'), null);
  assert.equal(m.state.screen, 'court');
  m.press('back'); assert.equal(m.state.screen, 'cats');
  m.press('back'); assert.equal(m.state.screen, 'online'); // back out of the cat screen to the online choices
  m.press('down'); assert.equal(m.press('enter'), 'join-ask');
  m.join('ABCDE');
  assert.equal(m.state.online, 'join'); assert.equal(m.state.joinCode, 'ABCDE'); assert.equal(m.state.screen, 'cats');
  assert.equal(m.press('enter'), 'launch'); // no court step for a joiner
  m.open();
  assert.equal(m.state.online, null);
});

test('every setting is filed under exactly one heading, and each heading is short', async () => {
  const { GROUPS, SETTINGS, groupOf } = await import('../game/menu.js');
  for (const s of SETTINGS) assert.ok(groupOf(s.id), `${s.id} has a heading`);
  assert.equal(GROUPS.flatMap((g) => g.ids).length, SETTINGS.length);
  for (const g of GROUPS) assert.ok(g.ids.length <= 6);
});

test('settings: a click on a choice sets it; summaries show the current values', async () => {
  const { groupSummary } = await import('../game/ui.js');
  const { GROUPS } = await import('../game/menu.js');
  const m = createMenu();
  m.state.screen = 'settings'; m.state.index = 0; m.press('enter'); // Gameplay
  assert.equal(m.state.screen, 'group');
  assert.equal(m.choose(0, 2), 'level'); assert.equal(m.state.settings.level, 2);
  assert.equal(m.choose(0, 9), null); assert.equal(m.choose(0, -1), null); assert.equal(m.choose(99, 0), null);
  assert.equal(m.state.settings.level, 2);
  assert.match(groupSummary(GROUPS[0], m.state.settings), /^Hard · /);
  m.press('back'); assert.equal(m.choose(0, 1), null, 'only on a group screen');
});

test('a group has its own reset that touches only that page', () => {
  const m = createMenu({ players: 1 });
  for (let i = 0; i < 6; i++) m.press('down');
  m.press('enter'); // Settings
  m.press('enter'); // Gameplay
  m.press('right'); // level 1 -> 2
  m.state.settings.sfxVol = 3; // a setting on another page
  const items = m.groupItems().map((x) => x.id);
  assert.deepEqual(items.slice(-2), ['groupreset', 'back']);
  m.press('up'); m.press('up'); // wraps: Back, then Reset
  assert.equal(m.groupItems()[m.state.index].id, 'groupreset');
  assert.equal(m.press('enter'), 'reset');
  assert.equal(m.state.settings.level, 1);
  assert.equal(m.state.settings.sfxVol, 3);
  assert.equal(m.state.screen, 'group');
});
