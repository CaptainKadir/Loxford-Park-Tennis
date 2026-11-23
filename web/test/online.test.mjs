import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadCore } from '../game/core.js';
import { createOutbox, applyLink, scoreOf, mirrorScore } from '../game/duel.js';
import { createPeer, makeCode, cleanCode, validCode, makeRoom, joinLink } from '../game/online.js';
import { createHub } from '../server/hub.js';

// ---- codes and links ----
test('codes: unambiguous letters, cleaned and validated', () => {
  const c = makeCode(); assert.match(c, /^[A-HJKMNP-Z2-9]{5}$/); assert.ok(validCode(c));
  assert.equal(cleanCode(' ab-c d5 '), 'ABCD5'); assert.equal(validCode('AB'), false); assert.equal(validCode('ABCDEFGHI'), false);
  assert.match(makeRoom(), /^[a-z0-9]{8,40}$/);
  assert.equal(joinLink('https://x.trycloudflare.com/', 'AB12C'), 'https://x.trycloudflare.com/?join=AB12C');
});

// ---- the handshake state machine ----
function pairUp() {
  const toA = [], toB = [];
  let t = 0;
  const a = createPeer({ send: (m) => toB.push(m), now: () => t });
  const b = createPeer({ send: (m) => toA.push(m), now: () => t });
  const flush = () => { let n = 0; while ((toA.length || toB.length) && n++ < 100) { for (const m of toB.splice(0)) b.receive(m); for (const m of toA.splice(0)) a.receive(m); } };
  return { a, b, flush, clock: (x) => { t = x; } };
}
test('peer: hello is swapped when both are in the match', () => {
  const { a, b, flush } = pairUp();
  a.setHello({ cat: 1 }); b.setHello({ cat: 4 });
  a.joined(); b.joined(); flush();
  assert.equal(a.hello.cat, 4); assert.equal(b.hello.cat, 1);
});
test('peer: the clock runs only when both sides finished their intro; a pause on either side holds both', () => {
  const { a, b, flush } = pairUp();
  a.joined(); b.joined(); flush();
  a.newEpoch(); b.newEpoch();
  assert.equal(a.ready, false);
  a.go(); flush();
  assert.equal(a.ready, false, 'the friend is not done yet');
  assert.equal(a.holding, true);
  b.go(); flush();
  assert.ok(a.ready && b.ready); assert.equal(a.holding, false);
  b.hold(true); flush();
  assert.equal(a.holding, true, 'a pause on one side holds the other');
  b.hold(false); flush();
  assert.equal(a.holding, false);
  a.left();
  assert.equal(a.ready, false, 'a friend who left stops the match');
});
test('peer: a rematch starts only when both ask, and starts a new epoch', () => {
  const { a, b, flush } = pairUp();
  a.joined(); b.joined(); a.newEpoch(); b.newEpoch(); a.go(); b.go(); flush();
  assert.equal(a.again(), false); flush();
  assert.ok(a.wantsAgain && b.peerWantsAgain && !b.wantsAgain);
  assert.equal(b.again(), true, 'the second to ask starts it');
  flush();
  a.newEpoch(); b.newEpoch();
  assert.equal(a.wantsAgain, false); assert.equal(a.ready, false, 'the new match needs a new go from both');
});
test('peer: one-way delay is half the smoothed round trip, and a stray pong changes nothing', () => {
  const { a, b, flush, clock } = pairUp();
  a.joined(); b.joined(); flush();
  for (let i = 0; i < 20; i++) { clock(i * 1000); a.ping(); clock(i * 1000 + 160); flush(); }
  assert.ok(Math.abs(a.oneWay - 0.08) < 0.01, `one way ${a.oneWay}`);
  const before = a.oneWay;
  a.receive({ k: 'pong', id: 999 });
  assert.equal(a.oneWay, before);
  assert.equal(a.receive('junk'), null); assert.equal(a.receive({ k: 'hello', h: 5 }), null);
});

// ---- two cores joined by a slow, jittery link ----
function link(core, role, send) {
  const out = createOutbox();
  return {
    core, out, role,
    pump() {
      for (const m of out.collect(core)) { send(m); if (m.k === 'pt' && role === 'host') send({ k: 'score', r: m.score }); }
    },
    receive(m, delay) {
      if (m.k === 'score' && role === 'host') return;
      const k = applyLink(core, m, delay);
      if (k === 'pt' && role === 'host') send({ k: 'score', r: scoreOf(core.state()) });
    },
  };
}
async function match({ seconds, latency = 0.1, jitter = 0.04, seed = 1 }) {
  const a = await loadCore(), b = await loadCore();
  a.initRemote(11, true, false, 0); b.initRemote(12, true, false, 1);
  let now = 0, rng = seed;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  const toA = [], toB = [];
  const wire = (q) => (m) => q.push({ at: now + latency + (rand() - 0.5) * 2 * jitter, m: JSON.parse(JSON.stringify(m)) }); // really serialised
  const A = link(a, 'host', wire(toB)), B = link(b, 'guest', wire(toA));
  const deliver = (q, L) => { q.sort((x, y) => x.at - y.at); while (q.length && q[0].at <= now) L.receive(q.shift().m, latency); };
  const swing = (c) => {
    const s = c.state();
    if (s.labState === 5 && s.ballY > 2.0 && s.ballVY < 0) c.demoSwing(10, 0, 0); // serve
    else if (s.labState === 1 && s.arrivalT - s.labT < 0.03 && s.arrivalT - s.labT > -0.05) c.demoSwing(4 + rand() * 18, 0, 0); // return, of varying strength so rallies end
  };
  let games = 0;
  for (let i = 0; i < seconds * 60; i++) {
    now += 1 / 60;
    deliver(toA, A); deliver(toB, B);
    a.step(1 / 60, 0, 0); b.step(1 / 60, 0, 0);
    swing(a); swing(b);
    A.pump(); B.pump();
    games = a.state().gamesH + a.state().gamesC;
  }
  // let the last messages land, with both clocks still running, then compare
  for (let i = 0; i < 60 * 3; i++) { now += 1 / 60; deliver(toA, A); deliver(toB, B); a.step(1 / 60, 0, 0); b.step(1 / 60, 0, 0); A.pump(); B.pump(); }
  return { a, b, games };
}
const agree = (a, b) => {
  const x = a.state(), y = mirrorScore(scoreOf(b.state())), s = scoreOf(x);
  for (const k of Object.keys(s)) assert.equal(s[k], y[k], `${k}: host ${s[k]} vs guest(mirrored) ${y[k]}`);
};
test('online: a long match over a 100 ms +-40 ms link keeps both scores identical', async () => {
  const { a, b } = await match({ seconds: 150 });
  const s = a.state();
  assert.ok(s.pointsHuman + s.pointsCpu >= 10, `points played ${s.pointsHuman + s.pointsCpu}`);
  assert.ok(s.hits + s.cpuHits + b.state().hits > 20, 'there were rallies, not only serves');
  agree(a, b);
});
test('online: still consistent at 250 ms with heavy jitter', async () => {
  const { a, b } = await match({ seconds: 120, latency: 0.25, jitter: 0.1, seed: 7 });
  assert.ok(a.state().pointsHuman + a.state().pointsCpu >= 10);
  agree(a, b);
});
test('online: applyLink ignores garbage', async () => {
  const c = await loadCore(); c.initRemote(1, true, false, 0);
  for (const m of [null, 5, {}, { k: 'ball' }, { k: 'ball', s: { outX: 'x' } }, { k: 'pt', w: 'a' }, { k: 'pos', x: NaN, z: 1 }, { k: 'score', r: {} }, { k: 'nope' }]) assert.equal(applyLink(c, m), null);
});

// ---- the server hub ----
function fakeSocket() {
  const ws = new EventEmitter();
  ws.sent = []; ws.closed = false;
  ws.send = (m) => ws.sent.push(JSON.parse(m));
  ws.close = () => { ws.closed = true; ws.emit('close'); };
  return ws;
}
const sample = { type: 's', t: 1, q: [1, 0, 0, 0], r: [0, 0, 0], a: [0, 0, 1] };
test('hub: phones only reach the page in their own room', () => {
  const hub = createHub();
  const g1 = fakeSocket(), g2 = fakeSocket(), p1 = fakeSocket();
  hub.attach(g1, 'game', { room: 'aaaaaaaa11' }); hub.attach(g2, 'game', { room: 'bbbbbbbb22' }); hub.attach(p1, 'controller', { room: 'aaaaaaaa11' });
  p1.emit('message', JSON.stringify(sample));
  assert.equal(g1.sent.filter((m) => m.type === 's').length, 1);
  assert.equal(g2.sent.filter((m) => m.type === 's').length, 0);
});
test('hub: a page that came through a tunnel must name a room, and a bad room or code is refused', () => {
  const hub = createHub();
  const a = fakeSocket(), b = fakeSocket(), c = fakeSocket(), d = fakeSocket();
  assert.equal(hub.attach(a, 'game', { remote: true }), false); assert.ok(a.closed);
  assert.equal(hub.attach(b, 'controller', { remote: true }), false);
  assert.equal(hub.attach(c, 'game', { room: '../etc' }), false);
  assert.equal(hub.attach(d, 'game', { room: 'okroom1234', match: 'x' }), false);
  const e = fakeSocket(); assert.equal(hub.attach(e, 'game', { room: 'okroom1234', remote: true }), true);
});
test('hub: a match joins two pages, relays duel messages, tells each about the other, and holds only two', () => {
  const hub = createHub();
  const a = fakeSocket(), b = fakeSocket(), c = fakeSocket();
  hub.attach(a, 'game', { room: 'roomaaaa11', match: 'ABC12' });
  assert.equal(a.sent.filter((m) => m.type === 'peer').length, 0);
  hub.attach(b, 'game', { room: 'roombbbb22', match: 'ABC12' });
  assert.ok(a.sent.some((m) => m.type === 'peer' && m.here)); assert.ok(b.sent.some((m) => m.type === 'peer' && m.here));
  a.emit('message', JSON.stringify({ type: 'duel', m: { k: 'ball', s: { outX: 1 } } }));
  assert.deepEqual(b.sent.find((m) => m.type === 'duel').m, { k: 'ball', s: { outX: 1 } });
  assert.equal(a.sent.some((m) => m.type === 'duel'), false, 'never echoed back');
  b.emit('message', 'not json'); b.emit('message', JSON.stringify({ type: 'duel', m: 5 })); b.emit('message', JSON.stringify({ type: 'haptic', pad: 9 }));
  assert.equal(a.sent.some((m) => m.type === 'duel'), false);
  hub.attach(c, 'game', { room: 'roomcccc33', match: 'ABC12' });
  assert.ok(c.sent.some((m) => m.type === 'match-full') && c.closed);
  b.close();
  assert.ok(a.sent.some((m) => m.type === 'peer' && m.here === false));
  a.close();
  assert.equal(hub.sizes().matches, 0, 'an empty match is forgotten');
});
test('hub: a phone opened from a seat link takes that seat, replacing a stale one', () => {
  const hub = createHub();
  const g = fakeSocket(), old2 = fakeSocket(), fresh = fakeSocket();
  hub.attach(g, 'game', {}); hub.attach(old2, 'controller', { seat: 1 }); hub.attach(fresh, 'controller', { seat: 1 });
  assert.ok(fresh.sent.some((m) => m.type === 'slot' && m.pad === 1));
  assert.ok(old2.closed);
  assert.ok(old2.sent.some((m) => m.type === 'replaced'), 'the old phone is told to stand down, so it does not reconnect and take the seat back');
  fresh.emit('message', JSON.stringify(sample));
  assert.equal(g.sent.filter((m) => m.type === 's' && m.pad === 1).length, 1);
  const first = fakeSocket(); hub.attach(first, 'controller', {});
  assert.ok(first.sent.some((m) => m.type === 'slot' && m.pad === 0), 'no seat asked: the first free one');
});
