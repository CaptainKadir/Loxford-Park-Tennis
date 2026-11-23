import test from 'node:test';
import assert from 'node:assert/strict';
import { createStats, summarise, heatSvg, statsHtml, HEAT_ROWS, HEAT_COLS } from '../game/stats.js';

const S = (o = {}) => ({ hits: 0, cpuHits: 0, hitSide: 1, pointsHuman: 0, pointsCpu: 0, labState: 2, serveN: 1, why: 0, ...o });

test('an unreturned serve is an ace; a CPU miss after a rally is a winner', () => {
  const s = createStats();
  s.push(S());
  s.push(S({ hits: 1, hitSide: 0 }));
  s.push(S({ hits: 1, hitSide: 0, pointsHuman: 1, why: 3 }));
  assert.equal(s.data.aces, 1);
  s.push(S({ hits: 2, hitSide: 0, pointsHuman: 1 }));
  s.push(S({ hits: 3, cpuHits: 1, pointsHuman: 1 }));
  s.push(S({ hits: 4, cpuHits: 2, pointsHuman: 2, why: 3 }));
  assert.equal(s.data.aces, 1); assert.equal(s.data.winners, 1);
  assert.equal(s.data.longest, 5);
});

test('errors and double faults are counted against you; serve percentage follows the faults', () => {
  const s = createStats();
  s.push(S());
  s.push(S({ hits: 1, hitSide: 0 }));
  s.push(S({ hits: 1, hitSide: 0, labState: 0, serveN: 2, why: 5 })); // first serve fault
  s.push(S({ hits: 2, hitSide: 0, labState: 5, serveN: 2 }));
  s.push(S({ hits: 2, hitSide: 0, labState: 3, serveN: 2, pointsCpu: 1, why: 5 })); // double fault
  assert.equal(s.data.doubleFaults, 1);
  s.push(S({ hits: 3, hitSide: 1, pointsCpu: 1 }));
  s.push(S({ hits: 3, hitSide: 1, pointsCpu: 2, why: 1 })); // hit it out
  assert.equal(s.data.errors, 2);
  assert.ok(summarise(s.data).servePct <= 50);
});

test('the heat map puts your left on the left and ignores your own half', () => {
  const s = createStats();
  s.landed({ x: 3.5, z: 11 }); // +x is the player's left, deep
  s.landed({ x: -3.5, z: 1 });
  s.landed({ x: 0, z: -4 });
  const h = s.data.heat;
  assert.equal(h[HEAT_ROWS - 1][0], 1);
  assert.equal(h[0][HEAT_COLS - 1], 1);
  assert.equal(h.flat().reduce((a, b) => a + b, 0), 2);
});

test('the stats screen is valid markup and escapes names', () => {
  const s = createStats(); s.landed({ x: 0, z: 5 });
  const html = statsHtml(s.summary(), { names: ['<b>', 'CPU'] });
  assert.ok(html.includes('&lt;b&gt;') && html.includes('<svg') && !html.includes('<b> vs'));
  assert.ok(heatSvg(s.data.heat).startsWith('<svg'));
  s.reset(); assert.equal(s.summary().heatMax, 0);
});
