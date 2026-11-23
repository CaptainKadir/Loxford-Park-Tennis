import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHub } from '../server/hub.js';
import { createPeer } from '../game/online.js';

const sock = () => { const ws = new EventEmitter(); ws.sent = []; ws.send = (m) => ws.sent.push(JSON.parse(m)); ws.close = () => ws.emit('close'); return ws; };
const duel = (ws, m) => ws.emit('message', JSON.stringify({ type: 'duel', m }));

test('soak: half an hour of play with the friend dropping and coming back every minute', () => {
  const hub = createHub();
  const room = 'abcdefgh1234', code = 'SOAK1';
  let host = sock(), guest = sock();
  hub.attach(host, 'game', { room: 'hostroom1234', match: code, remote: true });
  hub.attach(guest, 'game', { room: 'guestroom123', match: code, remote: true });
  let delivered = 0;
  for (let minute = 0; minute < 30; minute++) {
    for (let s = 0; s < 60 * 20; s++) { duel(host, { k: 'pos', x: 1, z: 2 }); duel(guest, { k: 'pos', x: 1, z: 2 }); } // 20 position updates a second each way
    delivered += host.sent.filter((m) => m.type === 'duel').length + guest.sent.filter((m) => m.type === 'duel').length;
    host.sent.length = 0; guest.sent.length = 0;
    // the guest's wifi flips: its socket dies, a new one joins the same match
    guest.emit('close');
    assert.ok(host.sent.some((m) => m.type === 'peer' && m.here === false), 'the host is told the friend left');
    host.sent.length = 0;
    guest = sock();
    hub.attach(guest, 'game', { room: 'guestroom123', match: code, remote: true });
    assert.ok(host.sent.some((m) => m.type === 'peer' && m.here === true), 'the host is told the friend is back');
    assert.ok(guest.sent.some((m) => m.type === 'peer' && m.here === true));
    assert.deepEqual(hub.sizes(), { rooms: 2, matches: 1 }, 'no rooms or matches pile up');
  }
  assert.equal(delivered, 30 * 2 * 1200);
  host.emit('close'); guest.emit('close');
  assert.deepEqual(hub.sizes(), { rooms: 0, matches: 0 }, 'everything is cleaned up when both leave');
});

test('a rejoining page gets the handshake again, so both sides pick the match up where it was', () => {
  const sent = { a: [], b: [] };
  const a = createPeer({ send: (m) => sent.a.push(m), now: () => 0 }), b = createPeer({ send: (m) => sent.b.push(m), now: () => 0 });
  a.setHello({ cat: 1 }); b.setHello({ cat: 2 });
  a.newEpoch(); a.go();
  a.joined(); a.left(); // the link drops
  assert.equal(a.here, false);
  a.joined(); // and comes back
  assert.ok(sent.a.filter((m) => m.k === 'hello').length >= 2, 'hello is sent again');
  assert.ok(sent.a.some((m) => m.k === 'go' && m.e === 1), 'the intro-finished signal is sent again');
  assert.ok(sent.a.some((m) => m.k === 'hold'), 'and the pause state');
  assert.equal(b.here, false);
});
