import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatShotLabel, formatPoints, bannerText, gameCalls, scoreboard, serveText, pointFx } from '../game/hud.js';

test('hud: a label for every shot type and side', () => {
  assert.equal(formatShotLabel(1, 1), 'forehand');
  assert.equal(formatShotLabel(1, 2), 'backhand');
  assert.equal(formatShotLabel(2, 2), 'topspin backhand');
  assert.equal(formatShotLabel(3, 1), 'slice forehand');
  assert.equal(formatShotLabel(4, 1), 'drop shot');
  assert.equal(formatShotLabel(5, 2), 'lob');
  assert.equal(formatShotLabel(0, 0), '');
});

test('hud: points display', () => {
  assert.equal(formatPoints(3, 5), 'YOU 3 : 5 CPU');
});

test('hud: banner explains a lost controller and the rally end reason', () => {
  assert.equal(bannerText({ paused: true, connected: false }, { winner: 0, why: 0 }), 'Reconnect the phone');
  assert.equal(bannerText({ paused: true, connected: true }, { winner: 0, why: 0 }), 'Waiting for the phone...');
  assert.equal(bannerText({ paused: false, connected: true }, { winner: 1, why: 1 }), '');
  assert.equal(bannerText({ paused: false, connected: true }, { winner: 2, why: 3 }), '');
  assert.equal(bannerText({ paused: false, connected: true }, { winner: 0, why: 0 }), '');
});

test('hud: a serve has its own label', () => {
  assert.equal(formatShotLabel(1, 0), 'serve');
});

test('hud: tennis calls, deuce and advantage', () => {
  assert.deepEqual(gameCalls(0, 0), ['0', '0']);
  assert.deepEqual(gameCalls(2, 1), ['30', '15']);
  assert.deepEqual(gameCalls(3, 3), ['Deuce', '']);
  assert.deepEqual(gameCalls(4, 3), ['Ad', '40']);
  assert.deepEqual(gameCalls(3, 4), ['40', 'Ad']);
  assert.deepEqual(gameCalls(5, 5), ['Deuce', '']);
});

test('hud: scoreboard shows games, points and the server', () => {
  const t = scoreboard({ ptsH: 2, ptsC: 1, gamesH: 1, gamesC: 0, server: 0 });
  assert.ok(t.includes('YOU 1') && t.includes('0 CPU') && t.includes('30 - 15'));
  assert.ok(t.startsWith('●'));
  assert.ok(scoreboard({ ptsH: 3, ptsC: 3, gamesH: 0, gamesC: 0, server: 1 }).includes('Deuce'));
});

test('hud: serve and match messages', () => {
  assert.match(serveText({ labState: 5, serveN: 1 }), /Your serve/);
  assert.match(serveText({ labState: 5, serveN: 2 }), /Second serve/);
  assert.equal(serveText({ labState: 0, serveN: 2, why: 5 }), 'Fault');
  assert.match(serveText({ matchOver: 1, matchWinner: 0 }), /You win the match/);
  assert.match(serveText({ matchOver: 1, matchWinner: 1 }), /CPU wins/);
  assert.equal(serveText({ labState: 1, serveN: 1 }), '');
});

test('pointFx: a point, a game, and no change', () => {
  const base = { pointsHuman: 1, pointsCpu: 0, gamesH: 0, gamesC: 0, ptsH: 1, ptsC: 0, why: 1, matchOver: 0 };
  assert.equal(pointFx({ pts: 1, h: 1, c: 0, gh: 0, gc: 0 }, base), null);
  const p = pointFx({ pts: 0, h: 0, c: 0, gh: 0, gc: 0 }, base);
  assert.equal(p.headline, 'Point!'); assert.equal(p.score, '15 - 0'); assert.equal(p.why, 'Out'); assert.ok(p.human);
  const cpu = pointFx({ pts: 1, h: 1, c: 0, gh: 0, gc: 0 }, { ...base, pointsCpu: 1, ptsC: 1, why: 3 });
  assert.equal(cpu.headline, 'CPU point'); assert.ok(!cpu.human);
  const g = pointFx({ pts: 3, h: 3, c: 0, gh: 0, gc: 0 }, { ...base, pointsHuman: 4, gamesH: 1, ptsH: 0, ptsC: 0 });
  assert.equal(g.headline, 'Game YOU'); assert.equal(g.score, 'Games 1 - 0'); assert.ok(g.game);
  assert.equal(pointFx({ pts: 3, h: 3, c: 0, gh: 0, gc: 0 }, { ...base, pointsHuman: 4, gamesH: 4, matchOver: 1 }).headline, 'Match');
});
