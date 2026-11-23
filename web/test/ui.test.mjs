import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenu } from '../game/menu.js';
import { renderMenu, catFace, courtThumb } from '../game/ui.js';
import { CATS } from '../game/cats.js';
import { COURTS } from '../game/render/courts.js';

test('title shows the game name and the play button', () => {
  const html = renderMenu(createMenu());
  assert.match(html, /LOXFORD PARK/);
  assert.match(html, /TENNIS/);
  assert.match(html, /1 Player/);
  assert.match(html, /2 Players/);
});

test('the cat screen lists every cat and the court screen every court', () => {
  const m = createMenu();
  m.press('enter');
  const cats = renderMenu(m);
  for (const c of CATS) assert.ok(cats.includes(c.name));
  assert.match(cats, /choose your cat/);
  m.press('enter');
  const courts = renderMenu(m);
  for (const c of COURTS) assert.ok(courts.includes(c.name));
  assert.match(courts, /Step 2 of 2/);
});

test('two players: the heading names the player', () => {
  const m = createMenu();
  m.press('down'); m.press('enter');
  assert.match(renderMenu(m), /Player 1: choose/);
  m.press('enter');
  assert.match(renderMenu(m), /Player 2: choose/);
});

test('faces and courts are valid svg in the right colours', () => {
  assert.match(catFace(CATS[0]), /^<svg/);
  assert.ok(catFace(CATS[2]).includes('#3a3a46'));
  assert.ok(courtThumb(COURTS.find((c) => c.id === 'clay')).includes('#c8643c'));
});

test('title page carries the maker stamp', () => {
  assert.match(renderMenu(createMenu()), /Made by[\s\S]*Captain Kadir/);
});
