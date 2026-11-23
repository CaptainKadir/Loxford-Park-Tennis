import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRelay } from '../server/relay.js';

function fakeSocket() {
  const ws = new EventEmitter();
  ws.sent = [];
  ws.send = (m) => ws.sent.push(JSON.parse(m));
  return ws;
}
const sample = { type: 's', t: 1, q: [1, 0, 0, 0], r: [0, 0, 0], a: [0, 0, 1] };

test('relay forwards samples', () => {
  const relay = createRelay();
  const game = fakeSocket(), pad = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(pad, 'controller');
  pad.emit('message', JSON.stringify(sample));
  const got = game.sent.find((m) => m.type === 's');
  assert.deepEqual(got.q, [1, 0, 0, 0]);
  assert.equal(typeof got.srv, 'number');
});

test('second controller is a spectator and cannot steer', () => {
  const relay = createRelay();
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  relay.attach(b, 'controller');
  assert.deepEqual(b.sent, [{ type: 'spectator' }]);
  b.emit('message', JSON.stringify(sample));
  assert.equal(game.sent.filter((m) => m.type === 's').length, 0);
});

test('controller disconnect notifies game and frees the slot', () => {
  const relay = createRelay();
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  a.emit('close');
  assert.ok(game.sent.some((m) => m.type === 'controller-lost'));
  relay.attach(b, 'controller');
  b.emit('message', JSON.stringify(sample));
  assert.equal(game.sent.filter((m) => m.type === 's').length, 1);
});

test('malformed messages are dropped', () => {
  const relay = createRelay();
  const game = fakeSocket(), pad = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(pad, 'controller');
  pad.emit('message', 'not json');
  pad.emit('message', JSON.stringify({ type: 's', t: 'x', q: [1], r: [], a: [] }));
  pad.emit('message', JSON.stringify({ type: 's', t: 1, q: [1, 0, 0, NaN], r: [0, 0, 0], a: [0, 0, 1] }));
  assert.equal(game.sent.filter((m) => m.type === 's').length, 0);
});

test('relay promotes a waiting spectator when the active controller leaves', () => {
  const relay = createRelay();
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  relay.attach(b, 'controller');
  b.emit('message', JSON.stringify(sample));
  assert.equal(game.sent.filter((m) => m.type === 's').length, 0);
  a.emit('close');
  assert.ok(b.sent.some((m) => m.type === 'promoted'));
  b.emit('message', JSON.stringify(sample));
  assert.equal(game.sent.filter((m) => m.type === 's').length, 1);
});

test('relay answers pings and forwards the phone-measured latency to the game', () => {
  const relay = createRelay();
  const game = fakeSocket(), pad = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(pad, 'controller');
  pad.emit('message', JSON.stringify({ type: 'ping', id: 7 }));
  assert.ok(pad.sent.some((m) => m.type === 'pong' && m.id === 7));
  pad.emit('message', JSON.stringify({ type: 'lat', ms: 23.5 }));
  assert.ok(game.sent.some((m) => m.type === 'lat' && m.ms === 23.5));
  pad.emit('message', JSON.stringify({ type: 'lat', ms: 'x' }));
  assert.equal(game.sent.filter((m) => m.type === 'lat').length, 1);
});

test('with two pads, phones fill both slots and samples carry their player number', () => {
  const relay = createRelay({ pads: 2 });
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket(), c = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  relay.attach(b, 'controller');
  relay.attach(c, 'controller');
  assert.deepEqual(a.sent[0], { type: 'slot', pad: 0 });
  assert.deepEqual(b.sent[0], { type: 'slot', pad: 1 });
  assert.deepEqual(c.sent, [{ type: 'spectator' }]);
  a.emit('message', JSON.stringify(sample));
  b.emit('message', JSON.stringify(sample));
  assert.deepEqual(game.sent.filter((m) => m.type === 's').map((m) => m.pad), [0, 1]);
  a.emit('close'); // the waiting phone takes player one's slot
  assert.ok(c.sent.some((m) => m.type === 'promoted'));
  assert.ok(game.sent.some((m) => m.type === 'controller-joined' && m.pad === 0));
});

test('the game can ask a phone to buzz', () => {
  const relay = createRelay({ pads: 2 });
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  relay.attach(b, 'controller');
  game.emit('message', JSON.stringify({ type: 'haptic', pad: 1, ms: 45 }));
  assert.deepEqual(b.sent.at(-1), { type: 'haptic', ms: 45 });
  assert.ok(!a.sent.some((m) => m.type === 'haptic'));
  game.emit('message', JSON.stringify({ type: 'haptic', pad: 5 })); // no such phone: ignored
  game.emit('message', 'junk');
});

test('the emote button reaches the game with the phone\'s player number, and a game cannot fake one', () => {
  const relay = createRelay({ pads: 2 });
  const game = fakeSocket(), a = fakeSocket(), b = fakeSocket();
  relay.attach(game, 'game');
  relay.attach(a, 'controller');
  relay.attach(b, 'controller');
  b.emit('message', JSON.stringify({ type: 'emote', pad: 0 })); // a phone cannot claim to be player one
  assert.deepEqual(game.sent.filter((m) => m.type === 'emote'), [{ type: 'emote', pad: 1 }]);
  a.emit('message', JSON.stringify({ type: 'emote' }));
  assert.deepEqual(game.sent.filter((m) => m.type === 'emote').at(-1), { type: 'emote', pad: 0 });
  game.emit('message', JSON.stringify({ type: 'emote' })); // only phones send emotes
  assert.equal(game.sent.filter((m) => m.type === 'emote').length, 2);
});
