// Rooms and matches on top of the relay.
//  - A ROOM pairs one player's phone with that player's game page (the default room '' is the local
//    Mac: any number of pages, two phone seats). Phone samples never leave their room.
//  - A MATCH joins two game pages (online play): they pass 'duel' messages to each other through here.
// Pages that arrive through a tunnel (proxy headers) must name a room, so a stranger who finds the
// tunnel address cannot listen to, or steal, the phones of the local game.
import { createRelay } from './relay.js';

export const ROOM_RE = /^[a-z0-9]{8,40}$/;
export const CODE_RE = /^[A-Z0-9]{4,8}$/;
const MAX_DUEL = 4096; // bytes of one relayed message

export function createHub({ localPads = 2 } = {}) {
  const rooms = new Map();
  const matches = new Map();
  const relayFor = (room) => {
    let r = rooms.get(room);
    if (!r) { r = createRelay({ pads: room === '' ? localPads : 1 }); rooms.set(room, r); }
    return r;
  };

  function joinMatch(ws, code) {
    let set = matches.get(code);
    if (!set) { set = new Set(); matches.set(code, set); }
    if (set.size >= 2) { ws.send(JSON.stringify({ type: 'match-full' })); ws.close?.(); return; }
    const others = [...set];
    set.add(ws);
    for (const o of others) { o.send(JSON.stringify({ type: 'peer', here: true })); ws.send(JSON.stringify({ type: 'peer', here: true })); }
    ws.on('message', (data) => {
      if (String(data).length > MAX_DUEL) return;
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (!m || m.type !== 'duel' || typeof m.m !== 'object' || m.m === null) return;
      const out = JSON.stringify({ type: 'duel', m: m.m });
      for (const o of set) if (o !== ws) o.send(out);
    });
    ws.on('close', () => {
      set.delete(ws);
      for (const o of set) o.send(JSON.stringify({ type: 'peer', here: false }));
      if (!set.size) matches.delete(code);
    });
  }

  return {
    /** remote: the request came through a proxy/tunnel. Returns false when the socket was refused. */
    attach(ws, role, { room = '', match = '', seat = -1, remote = false } = {}) {
      if (room && !ROOM_RE.test(room)) { ws.close?.(); return false; }
      if (match && !CODE_RE.test(match)) { ws.close?.(); return false; }
      if (remote && !room) { ws.close?.(); return false; }
      const relay = relayFor(room);
      relay.attach(ws, role, { seat });
      if (role === 'game' && match) joinMatch(ws, match);
      ws.on('close', () => { if (relay.idle() && rooms.get(room) === relay && room !== '') rooms.delete(room); });
      return true;
    },
    sizes: () => ({ rooms: rooms.size, matches: matches.size }),
  };
}
