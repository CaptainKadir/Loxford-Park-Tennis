// Online play: the same two-player link as local 2P, between two pages through the server's match hub.
// Pure parts (codes, the handshake state machine, the delay estimate) are kept apart from the socket so they can be tested.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function makeCode(rand = Math.random, n = 5) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}
export const cleanCode = (t) => String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const validCode = (t) => /^[A-Z0-9]{4,8}$/.test(t);
/** The phone/page pairing id: unguessable, lowercase letters and digits only. */
export function makeRoom() {
  const a = new Uint8Array(12);
  (globalThis.crypto ?? { getRandomValues: (x) => x.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, '0').slice(-2)).join('').slice(0, 20);
}
/** The link a friend opens to join (base is the tunnel or Wi-Fi address). */
export const joinLink = (base, code) => `${String(base).replace(/\/+$/, '')}/?join=${encodeURIComponent(code)}`;

/**
 * The handshake and shared-freeze rules of one online match, for one side.
 *  - hello: both pages swap cat/court info before any 3D is built.
 *  - epoch/go: every match (and rematch) is numbered; the clock only runs once BOTH sides have finished their intro (sent go for this epoch).
 *  - hold: pause, hidden tab or a missing phone on one side holds both.
 *  - again: a rematch starts when BOTH have asked for it.
 *  - ping/pong: the one-way delay estimate that the ball makes up for.
 */
export function createPeer({ send, now = () => performance.now() }) {
  let here = false, hello = null, mine = null, epoch = 0, myGo = 0, peerGo = 0, peerHold = false, myHold = false, myAgain = false, peerAgain = false;
  let oneWay = 0.05, pingAt = new Map(), pingN = 0;
  const api = {
    get here() { return here; }, get hello() { return hello; }, get epoch() { return epoch; },
    get oneWay() { return oneWay; },
    setHello(h) { mine = h; if (here) send({ k: 'hello', h: mine }); },
    /** The server says the other page is (back) in the match. */
    joined() { here = true; if (mine) send({ k: 'hello', h: mine }); if (myGo) send({ k: 'go', e: myGo }); send({ k: 'hold', on: myHold }); },
    left() { here = false; peerHold = false; },
    newEpoch() { epoch++; myAgain = false; peerAgain = false; return epoch; },
    go() { myGo = epoch; send({ k: 'go', e: epoch }); },
    /** Both intros are over for the current match. */
    get ready() { return here && myGo >= epoch && peerGo >= epoch && epoch > 0; },
    /** Whether this side's clock must stand still. */
    get holding() { return !api.ready || peerHold; },
    hold(on) { on = !!on; if (on !== myHold) { myHold = on; send({ k: 'hold', on }); } },
    get peerHolding() { return peerHold; },
    again() { myAgain = true; send({ k: 'again' }); return api.rematchReady(); },
    get wantsAgain() { return myAgain; }, get peerWantsAgain() { return peerAgain; },
    rematchReady() { return myAgain && peerAgain; },
    ping() { const id = ++pingN; pingAt.set(id, now()); if (pingAt.size > 8) pingAt.delete(pingAt.keys().next().value); send({ k: 'ping', id }); },
    /** A message from the other page. Returns { ev: 'hello' | 'rematch' | ... } for the caller, or null (game messages are the caller's). */
    receive(m) {
      if (!m || typeof m !== 'object') return null;
      switch (m.k) {
        case 'hello': if (m.h && typeof m.h === 'object') { hello = m.h; return { ev: 'hello' }; } return null;
        case 'go': if (Number.isFinite(m.e)) peerGo = Math.max(peerGo, m.e); return { ev: 'go' };
        case 'hold': peerHold = !!m.on; return { ev: 'hold' };
        case 'again': peerAgain = true; return { ev: api.rematchReady() ? 'rematch' : 'again' };
        case 'ping': send({ k: 'pong', id: m.id }); return null;
        case 'pong': {
          const t = pingAt.get(m.id);
          if (t == null) return null;
          pingAt.delete(m.id);
          const rtt = Math.max(0, now() - t) / 1000;
          oneWay = oneWay * 0.7 + (rtt / 2) * 0.3; // smoothed: one slow packet must not throw the ball
          return { ev: 'rtt' };
        }
        default: return null;
      }
    },
  };
  return api;
}

/** The page's socket to the server: phone messages for its room, plus (online) the match channel. Reconnects by itself. */
export function openSocket({ room, match = '', seat = 0, onMessage, onOpen, onClose, WS = globalThis.WebSocket, loc = globalThis.location }) {
  const proto = loc.protocol === 'https:' ? 'wss' : 'ws';
  const qs = new URLSearchParams({ role: 'game' });
  if (room) qs.set('room', room);
  if (match) qs.set('match', match);
  if (seat) qs.set('seat', String(seat));
  let ws = null, closed = false, tries = 0;
  const api = {
    send(obj) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; },
    duel(m) { return api.send({ type: 'duel', m }); },
    close() { closed = true; try { ws?.close(); } catch { /* gone */ } },
    get open() { return !!ws && ws.readyState === 1; },
  };
  const connect = () => {
    ws = new WS(`${proto}://${loc.host}/ws?${qs}`);
    ws.onopen = () => { tries = 0; onOpen?.(); };
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed */ } };
    ws.onclose = () => { onClose?.(); if (!closed) setTimeout(connect, Math.min(4000, 500 * 2 ** tries++)); };
  };
  connect();
  return api;
}
