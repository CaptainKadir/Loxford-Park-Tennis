// Two-player link: each player has their own core (their own court view, with the other player as
// the "CPU"). After every step the link hands shots, point results and positions across, mirrored.
// The same messages are used by local two-player (handed straight over) and by online play (sent
// through a socket, see online.js), so there is one rule for both.
const SERVE = ['sX', 'sY', 'sZ', 'sVX', 'sVY', 'sVZ', 'sSX', 'sSY', 'sSZ'];
const BALL = ['outX', 'outY', 'outZ', 'outVX', 'outVY', 'outVZ', 'outSX', 'outSY', 'outSZ', 'outAge', 'outBounced'];
const pick = (s, keys) => Object.fromEntries(keys.map((k) => [k, s[k]]));

/** The score as one side sees it ([0] is that side's player). */
export const scoreOf = (s) => ({ pts0: s.ptsH, pts1: s.ptsC, g0: s.gamesH, g1: s.gamesC, server: s.server, over: !!s.matchOver, winner: s.matchWinner, t0: s.pointsHuman, t1: s.pointsCpu });
/** The same score seen from the other player. */
export const mirrorScore = (r) => ({ pts0: r.pts1, pts1: r.pts0, g0: r.g1, g1: r.g0, server: r.server ? 0 : 1, over: r.over, winner: r.winner ? 0 : 1, t0: r.t1, t1: r.t0 });

/** Watches one core and turns what it just did into messages for the other side:
 * { k: 'serve' | 'ball' | 'pt', ... }. Position is separate (it is sent often, and may be thinned out). */
export function createOutbox() {
  let seen = { out: 0, pt: 0, sv: 0 };
  return {
    reset() { seen = { out: 0, pt: 0, sv: 0 }; },
    collect(core) {
      const s = core.state(), msgs = [];
      if (s.serveSeq !== seen.sv) { seen.sv = s.serveSeq; msgs.push({ k: 'serve', s: pick(s, SERVE) }); }
      if (s.outSeq !== seen.out) { seen.out = s.outSeq; msgs.push({ k: 'ball', s: pick(s, BALL) }); }
      if (s.ptSeq !== seen.pt) { seen.pt = s.ptSeq; msgs.push({ k: 'pt', w: s.ptWinner, why: s.ptWhy, score: scoreOf(s) }); }
      return msgs;
    },
    pos(core) { const s = core.state(); return { k: 'pos', x: s.playerX, z: s.playerZ }; },
  };
}

/** Applies one message from the other side to this core. delay: seconds the message spent travelling,
 * which the ball makes up for by flying that much further. Returns the message kind when it was applied. */
export function applyLink(core, m, delay = 0) {
  if (!m || typeof m !== 'object') return null;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (m.k === 'serve' && m.s && SERVE.every((k) => num(m.s[k]))) core.remoteServe(m.s);
  else if (m.k === 'ball' && m.s && BALL.slice(0, 10).every((k) => num(m.s[k]))) core.remoteBall({ ...m.s, outAge: m.s.outAge + Math.max(0, Math.min(0.6, delay)) });
  else if (m.k === 'pt' && num(m.w) && num(m.why)) core.remotePoint(m.w, m.why);
  else if (m.k === 'pos' && num(m.x) && num(m.z)) core.remotePos(m.x, m.z);
  else if (m.k === 'score' && m.r && ['pts0', 'pts1', 'g0', 'g1', 'server', 'winner', 't0', 't1'].every((k) => num(m.r[k]))) core.remoteScore(mirrorScore(m.r));
  else return null;
  return m.k;
}

export function createDuel(a, b) {
  const out = new Map([[a, createOutbox()], [b, createOutbox()]]);
  const reset = () => { for (const o of out.values()) o.reset(); };
  const carry = (from, to) => {
    const o = out.get(from);
    for (const m of o.collect(from)) applyLink(to, m);
    applyLink(to, o.pos(from));
  };
  return { reset, pump() { carry(a, b); carry(b, a); } };
}
