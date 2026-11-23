// Relays phone samples to game pages. One active controller at a time; extra
// controllers wait as spectators and the oldest is promoted when the slot frees.
const isVec = (v, n) =>
  Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && Number.isFinite(x));

export function validSample(m) {
  return m && m.type === 's' && typeof m.t === 'number' && Number.isFinite(m.t) &&
    isVec(m.q, 4) && isVec(m.r, 3) && isVec(m.a, 3);
}

export function createRelay({ pads = 1 } = {}) {
  const games = new Set();
  const waiting = [];
  const slots = new Array(pads).fill(null); // slot i is player i + 1's phone

  const toGames = (obj) => {
    const s = JSON.stringify(obj);
    for (const g of games) g.send(s);
  };

  function attachGame(ws) {
    games.add(ws);
    ws.on('close', () => games.delete(ws));
    // the game asks a phone to buzz (a hit): {type:'haptic', pad, ms}
    ws.on('message', (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m && m.type === 'haptic' && Number.isInteger(m.pad) && slots[m.pad]) {
        const ms = typeof m.ms === 'number' && m.ms > 0 ? Math.min(m.ms, 200) : 40;
        slots[m.pad].send(JSON.stringify({ type: 'haptic', ms }));
      }
    });
    slots.forEach((c, pad) => { if (c) ws.send(JSON.stringify({ type: 'controller-joined', pad })); });
  }

  function activate(ws, pad) {
    slots[pad] = ws;
    if (pads > 1) ws.send(JSON.stringify({ type: 'slot', pad }));
    toGames({ type: 'controller-joined', pad });
  }

  function attachController(ws, seat = -1) {
    ws.on('message', (data) => {
      const pad = slots.indexOf(ws);
      if (pad < 0) return;
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (validSample(m)) {
        toGames({ type: 's', t: m.t, q: m.q, r: m.r, a: m.a, srv: Date.now(), pad });
      } else if (m && m.type === 'ping' && typeof m.id === 'number') {
        ws.send(JSON.stringify({ type: 'pong', id: m.id }));
      } else if (m && m.type === 'lat' && typeof m.ms === 'number' && Number.isFinite(m.ms)) {
        toGames({ type: 'lat', ms: m.ms, pad });
      } else if (m && m.type === 'emote') {
        toGames({ type: 'emote', pad }); // the emote button: the game decides whether it is allowed right now
      }
    });
    ws.on('close', () => {
      const i = waiting.indexOf(ws);
      if (i >= 0) waiting.splice(i, 1);
      const pad = slots.indexOf(ws);
      if (pad < 0) return;
      slots[pad] = null;
      toGames({ type: 'controller-lost', pad });
      const next = waiting.shift();
      if (next) {
        next.send(JSON.stringify({ type: 'promoted' }));
        activate(next, pad);
      }
    });
    // a phone opened from a seat link (/pad?seat=2) takes that seat, replacing a stale socket still holding it
    if (Number.isInteger(seat) && seat >= 0 && seat < pads) {
      const old = slots[seat];
      activate(ws, seat);
      if (old) { try { old.send(JSON.stringify({ type: 'replaced' })); old.close?.(); } catch { /* already gone */ } }
      return;
    }
    const free = slots.indexOf(null);
    if (free < 0) {
      waiting.push(ws);
      ws.send(JSON.stringify({ type: 'spectator' }));
    } else {
      activate(ws, free);
    }
  }

  return {
    attach(ws, role, { seat = -1 } = {}) {
      if (role === 'game') attachGame(ws);
      else if (role === 'controller') attachController(ws, seat);
    },
    /** True when nobody is attached any more (the hub can forget the room). */
    idle() { return games.size === 0 && waiting.length === 0 && slots.every((x) => !x); },
  };
}
