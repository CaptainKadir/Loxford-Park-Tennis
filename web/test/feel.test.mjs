import test from 'node:test';
import assert from 'node:assert/strict';
import { impactOf, holdFor, punchFor, rallyIntensity, crowdBed, surfaceFor, catPitch, racketLayers, reactionsFor, matchPoint, createBounceTracker, nearestLine, closeCall, reviewMark, createChallenges, COURT } from '../game/feel.js';

const st = (o = {}) => ({ hits: 0, cpuHits: 0, hitSpeed: 0, hitSide: 1, pointsHuman: 0, pointsCpu: 0, ptsH: 0, ptsC: 0, gamesH: 0, gamesC: 0, matchOver: false, ballX: 0, ballY: 1, ballZ: 0, ballVY: 0, labT: 0, ...o });

test('impact grows with ball speed and a burning rally; a gentle rally hit has none', () => {
  assert.equal(impactOf(st(), st({ hits: 1, hitSpeed: 7 })), 0);
  assert.ok(impactOf(st(), st({ hits: 1, hitSpeed: 22 })) >= 0.99);
  assert.ok(impactOf(st(), st({ hits: 1, hitSpeed: 12 }), { rally: 18 }) > impactOf(st(), st({ hits: 1, hitSpeed: 12 })));
  assert.equal(impactOf(st({ hits: 1 }), st({ hits: 1, hitSpeed: 30 })), 0, 'no new hit, no impact');
  assert.equal(holdFor(0.1), 0);
  assert.ok(holdFor(1) <= 0.1 && holdFor(1) > holdFor(0.3), 'the pose is held for at most a tenth of a second');
  assert.ok(punchFor(1) > 0 && punchFor(1) < 5);
});

test('the crowd builds up through a rally and calms between points', () => {
  assert.equal(rallyIntensity(0), 0);
  assert.equal(rallyIntensity(40), 1);
  assert.ok(crowdBed(15, true) > crowdBed(5, true));
  assert.equal(crowdBed(2, true), 0, 'no murmur until a rally is going');
  assert.equal(crowdBed(15, false), 0, 'and none between points');
});

test('each court has its own surface; unknown courts fall back to hard', () => {
  assert.ok(surfaceFor('clay').dustN > surfaceFor('hard').dustN);
  assert.ok(surfaceFor('grass').bounceHz < surfaceFor('hard').bounceHz, 'a soft court has a duller bounce');
  assert.equal(surfaceFor('lava'), surfaceFor('hard'));
});

test('every cat has a voice pitch (the owl lowest, wrapping for odd indexes)', () => {
  for (let i = 0; i < 7; i++) assert.ok(catPitch(i) > 0);
  assert.ok(catPitch(6) < catPitch(0));
  assert.equal(catPitch(7), catPitch(0));
});

test('racket layers: a soft ball gets a wood knock, a hard one a louder crack', () => {
  assert.ok(racketLayers(5).knock.gain > 0);
  assert.equal(racketLayers(25).knock.gain, 0);
  assert.ok(racketLayers(25).crack.gain > racketLayers(8).crack.gain);
});

test('crowd and cats react to a long rally, a close call and match point', () => {
  const won = reactionsFor(st(), st({ pointsHuman: 1 }), { rally: 12 });
  assert.equal(won[0].sound, 'cheer');
  const lost = reactionsFor(st(), st({ pointsCpu: 1 }), { rally: 12 });
  assert.equal(lost[0].sound, 'groan');
  assert.deepEqual(reactionsFor(st(), st({ pointsCpu: 1 }), { rally: 2 }), [], 'a short lost point is quiet');
  assert.ok(reactionsFor(st(), st({ pointsCpu: 1 }), { rally: 2, closeCall: true }).some((r) => r.sound === 'gasp'));
  assert.ok(reactionsFor(st(), st({ hits: 1, hitSpeed: 20 })).some((r) => r.sound === 'effort'));
  assert.ok(reactionsFor(st(), st({ hits: 1, hitSpeed: 11, hitSide: 2 })).some((r) => r.sound === 'effort'), 'a decent backhand grunts');
  assert.ok(!reactionsFor(st(), st({ hits: 1, hitSpeed: 11, hitSide: 1 })).some((r) => r.sound === 'effort'), 'a gentle forehand does not');
  const mp = reactionsFor(st({ ptsH: 2, gamesH: 3 }), st({ ptsH: 3, gamesH: 3 }));
  assert.ok(mp.some((r) => r.sound === 'stinger'));
  assert.deepEqual(reactionsFor(null, st()), []);
});

test('match point follows the core rule (4 games, win by two at 3-3)', () => {
  assert.equal(matchPoint(st({ ptsH: 3, ptsC: 1, gamesH: 3, gamesC: 0 })), true);
  assert.equal(matchPoint(st({ ptsH: 3, ptsC: 1, gamesH: 2, gamesC: 0 })), false);
  assert.equal(matchPoint(st({ ptsH: 1, ptsC: 3, gamesH: 0, gamesC: 3 })), true);
  assert.equal(matchPoint(st({ ptsH: 3, ptsC: 3, gamesH: 3, gamesC: 0 })), false, 'deuce is not game point');
  assert.equal(matchPoint(st({ ptsH: 4, ptsC: 2, gamesH: 3, gamesC: 3 })), true);
  assert.equal(matchPoint(st({ ptsH: 3, ptsC: 0, gamesH: 3, gamesC: 0, matchOver: true })), false);
  assert.equal(matchPoint(st({ ptsH: 3, ptsC: 0, gamesH: 1, gamesC: 0 }), 2), true, 'story matches are shorter');
});

test('the bounce tracker finds where the ball landed, between two frames', () => {
  const t = createBounceTracker();
  assert.equal(t.push(st({ ballX: 0, ballY: 0.3, ballZ: 5, ballVY: -6 })), null);
  const b = t.push(st({ ballX: 1, ballY: 0.1, ballZ: 7, ballVY: 4 }));
  assert.ok(b && b.x > 0.5 && b.x < 0.9 && b.z > 6 && b.z < 6.7, `landed at ${b?.x}, ${b?.z}`);
  assert.equal(t.push(st({ ballX: 1, ballY: 0.8, ballZ: 7.5, ballVY: 3 })), null);
});

test('lines: the nearest line, close calls, and the review mark always agrees with the ruling', () => {
  assert.equal(nearestLine(4.1, 3).line, 'sideline');
  assert.equal(nearestLine(2, 11.8).line, 'baseline');
  assert.equal(nearestLine(0.02, 4, { serve: true }).line, 'centre line');
  assert.equal(closeCall({ x: 1, z: 3 }), null, 'mid-court is no close call');
  const c = closeCall({ x: 4.1, z: 3 });
  assert.equal(c.verdict, 'IN'); assert.equal(c.line, 'sideline');
  assert.equal(closeCall({ x: 4.2, z: 3 }).verdict, 'OUT');
  assert.equal(closeCall({ x: 4.2, z: 3 }, { ruledIn: true }).verdict, 'IN', 'the core\'s ruling wins');
  const m = reviewMark({ x: 4.2, z: 3 }, 'IN');
  assert.ok(Math.abs(m.x) <= COURT.halfW && m.nudged);
  assert.equal(reviewMark({ x: 4.0, z: 3 }, 'IN').nudged, false);
  assert.ok(Math.abs(reviewMark({ x: 4.0, z: 3 }, 'OUT').x) > COURT.halfW);
});

test('three reviews a match', () => {
  const c = createChallenges();
  const call = { verdict: 'IN' };
  assert.ok(c.use(call)); assert.ok(c.use(call)); assert.ok(c.use(call));
  assert.equal(c.use(call), null); assert.equal(c.left, 0);
  c.reset(); assert.equal(c.left, 3);
  assert.equal(c.use(null), null);
});
