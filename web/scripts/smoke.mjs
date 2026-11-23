// Browser smoke test: starts the game server on spare ports, opens the game in headless Chromium and walks the main screens
// (title, settings, wardrobe, career, the story map, a match, pause and its settings page), failing on any page error,
// console error or failed request. Run with `npm run smoke` (needs `npx playwright install chromium` once).
// Not part of `npm test`: it needs the browser and takes a while.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8499, LOCAL = 8099, BASE = `http://localhost:${LOCAL}`;
const problems = [], steps = [];
const fail = (m) => problems.push(m);
const ok = (name) => steps.push(name);

const server = spawn(process.execPath, ['server/index.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), LOCAL_PORT: String(LOCAL) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
const stop = () => { try { server.kill(); } catch { /* already gone */ } };
process.on('exit', stop);

const until = async (fn, what, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const v = await fn(); if (v) return v; } catch { /* keep trying */ } await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`timed out waiting for ${what}`);
};

try {
  await until(async () => (await fetch(`${BASE}/`)).ok, 'the server', 20000);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fail(`console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) fail(`${r.status()} ${r.url()}`); });
  const press = async (key, wait = 350) => { await page.keyboard.press(key); await page.waitForTimeout(wait); };
  const clickText = async (re, scope = 'button') => { const loc = page.locator(scope).filter({ hasText: re }).first(); await loc.click(); await page.waitForTimeout(500); };

  // ---- title and menus ----
  await page.goto(`${BASE}/?nophone`);
  await until(() => page.locator('.tcard').count().then((n) => n >= 5), 'the title cards');
  ok('title');
  await clickText(/settings/i, '.tcard');
  await until(() => page.locator('.scard').count().then((n) => n === 4), 'four settings pages');
  await clickText(/gameplay/i, '.scard');
  await until(() => page.locator('.mbtn.reset').count().then((n) => n >= 1), 'the page reset button');
  await press('Escape'); await press('Escape');
  ok('settings');
  await clickText(/more modes/i, '.tcard');
  await clickText(/wardrobe/i, '.mcard');
  await until(() => page.locator('.wtile').count().then((n) => n === 37), 'thirty-seven wardrobe tiles');
  await until(() => page.locator('.wpreview.live canvas').count().then((n) => n === 1), 'the wardrobe preview canvas');
  await page.locator('.wtile:not(.locked)').nth(1).hover(); await page.waitForTimeout(400);
  ok('wardrobe');
  await press('Escape');
  await clickText(/career/i, '.mcard');
  await until(() => page.locator('.ctile').count().then((n) => n === 8), 'eight career tiles');
  ok('career');

  await page.close(); // one busy WebGL page at a time keeps a slow machine from timing out

  // A fresh page per area (listening for errors like the first), optionally with storage set before the game starts.
  const open = async (url, init = null, arg = null) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => fail(`page error (${url}): ${e.message}`));
    p.on('console', (x) => { if (x.type() === 'error' && !/Failed to load resource/.test(x.text())) fail(`console error (${url}): ${x.text()}`); });
    p.on('response', (r) => { if (r.status() >= 400) fail(`${r.status()} ${r.url()}`); });
    if (init) await p.addInitScript(init, arg);
    await p.goto(`${BASE}${url}`);
    return p;
  };
  const shown = (p, sel) => p.locator(sel).evaluate((el) => getComputedStyle(el).display !== 'none');
  const storyInit = ({ stage, auto }) => { try { sessionStorage.setItem('loxford.storyHero', '0'); if (!sessionStorage.getItem('smoke-seen')) { sessionStorage.setItem('loxford.auto', auto); sessionStorage.setItem('smoke-seen', '1'); } localStorage.setItem('loxford.story', JSON.stringify({ 0: stage })); } catch { /* none */ } };

  // ---- the story: the map, picking a stop to replay, the talk, the boss entrance ----
  const story = await open('/?nophone', storyInit, { stage: 3, auto: 'storymap' });
  await until(() => story.locator('.trail.is3d .node').count().then((n) => n === 6), 'the 3D story map with six pins');
  await until(() => shown(story, '#story'), 'the story map to be visible (not just built)');
  ok('story map');
  await story.locator('.node[data-stop="1"]').click({ force: true }); await story.waitForTimeout(300);
  if (!(await story.locator('.spanel em').count())) fail('clicking a finished stop did not offer a replay');
  await story.locator('.node[data-stop="3"]').click({ force: true }); await story.waitForTimeout(300);
  if (await story.locator('.spanel em').count()) fail('the next stop is offered as a replay');
  await story.keyboard.press('Enter');
  await until(() => shown(story, '#talk'), 'the story talk scene');
  if (!/rooftop court/i.test(await story.locator('#talk .talktitle').innerText())) fail('the talk is not for the next stop (Rooftop Court)');
  ok('story talk for the next stop');
  await story.close();
  const replay = await open('/?nophone', storyInit, { stage: 3, auto: 'storymap' });
  await until(() => shown(replay, '#story'), 'the story map (replay page)');
  await replay.locator('.node[data-stop="0"]').click({ force: true }); await replay.waitForTimeout(300);
  await replay.keyboard.press('Enter');
  await until(() => shown(replay, '#talk'), 'the replay talk scene');
  if (!/park gate/i.test(await replay.locator('#talk .talktitle').innerText())) fail('the replay talk is not for Park Gate');
  ok('story replay');
  await replay.close();
  const boss = await open('/?nophone', storyInit, { stage: 5, auto: 'storymap' });
  await until(() => shown(boss, '#story'), 'the story map (boss page)');
  await boss.keyboard.press('Enter');
  await until(() => shown(boss, '#bossintro'), 'the boss entrance', 30000);
  await until(() => shown(boss, '#talk'), 'the boss talk after the entrance', 30000);
  ok('boss entrance and talk');
  await boss.close();

  // ---- the tutorial, two players, doubles and practice ----
  const tut = await open('/?nophone');
  await until(() => tut.locator('.tcard').count().then((n) => n >= 5), 'the title (tutorial page)');
  await tut.locator('.tcard').filter({ hasText: /tutorial/i }).click();
  await until(() => shown(tut, '#lesson'), 'the tutorial lessons');
  for (let i = 0; i < 16 && !(await shown(tut, '#tut')); i++) { await tut.keyboard.press('Enter'); await tut.waitForTimeout(1300); }
  await until(() => shown(tut, '#tut'), 'the practice prompts after the lessons', 20000);
  ok('tutorial');
  await tut.close();

  const two = await open('/?nophone');
  await until(() => two.locator('.tcard').count().then((n) => n >= 5), 'the title (two-player page)');
  await two.locator('.tcard').filter({ hasText: /2 players/i }).click();
  await until(() => two.locator('.roster .tile').count().then((n) => n >= 6), 'the two-player cat pick');
  ok('two-player pick');
  await two.close();

  const dbl = await open('/?nophone&games=1');
  await until(() => dbl.locator('.tcard').count().then((n) => n >= 5), 'the title (doubles page)');
  await dbl.locator('.tcard').filter({ hasText: /more modes/i }).click(); await dbl.waitForTimeout(500);
  await dbl.locator('.mcard').filter({ hasText: /doubles/i }).click();
  await until(() => dbl.locator('.roster .tile').count().then((n) => n >= 6), 'the doubles cat pick');
  await dbl.mouse.move(2, 2); // (a pointer resting over a card would move the cursor onto it)
  for (let i = 0; i < 8 && !(await dbl.locator('#menu').evaluate((el) => getComputedStyle(el).display === 'none')); i++) { await dbl.waitForTimeout(700); await dbl.keyboard.press('Enter'); }
  await until(() => dbl.locator('#menu').evaluate((el) => getComputedStyle(el).display === 'none'), 'the doubles match to start', 30000);
  await dbl.waitForTimeout(3000);
  ok('doubles match starts');
  await dbl.close();

  const prac = await open('/?nophone');
  await until(() => prac.locator('.tcard').count().then((n) => n >= 5), 'the title (practice page)');
  await prac.locator('.tcard').filter({ hasText: /more modes/i }).click(); await prac.waitForTimeout(500);
  await prac.locator('.mcard').filter({ hasText: /practice/i }).click();
  await until(() => prac.locator('.pcard').count().then((n) => n === 2), 'the two practice games');
  await prac.locator('.pcard').first().click();
  await until(() => prac.locator('#stats').evaluate((el) => getComputedStyle(el).display !== 'none' && /Practice/.test(el.innerText)), 'the practice intro', 30000);
  ok('practice game opens');
  await prac.close();

  // ---- a match, pause and the pause settings page ----
  const m = await open('/?nophone&games=1');
  await m.locator('.tcard').filter({ hasText: /1 player|play/i }).first().click({ timeout: 60000 });
  for (let i = 0; i < 6; i++) {
    await m.waitForTimeout(500);
    if (await m.locator('#menu').evaluate((el) => getComputedStyle(el).display === 'none')) break;
    await m.keyboard.press('Enter');
  }
  await until(() => m.locator('#menu').evaluate((el) => getComputedStyle(el).display === 'none'), 'the menu to close for the match', 20000);
  await until(() => m.locator('#intro').evaluate((el) => getComputedStyle(el).display === 'none'), 'the intro to finish', 30000);
  await m.waitForTimeout(3000); // some play
  const paused = () => m.locator('#pause').evaluate((el) => getComputedStyle(el).display !== 'none');
  for (let i = 0; i < 6 && !(await paused()); i++) { await m.keyboard.press('Escape'); await m.waitForTimeout(600); } // (a page that reloads for its court can swallow the first press)
  if (!(await paused())) throw new Error('the pause screen never showed');
  await m.keyboard.press('KeyS'); await m.waitForTimeout(400);
  await until(() => m.locator('#pause .srow').count().then((n) => n >= 10), 'the pause settings rows');
  await m.keyboard.press('Escape'); await m.waitForTimeout(300);
  await m.keyboard.press('Escape'); await m.waitForTimeout(500);
  ok('match, pause and its settings');
  await m.close();
  await browser.close();
} catch (e) {
  fail(process.env.SMOKE_STACK ? e.stack : e.message);
}
stop();

for (const s of steps) console.log(`ok   ${s}`);
for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length) { console.log(`\n${problems.length} problem(s). Server output:\n${serverLog.slice(-600)}`); process.exit(1); }
console.log('\nsmoke test passed');
