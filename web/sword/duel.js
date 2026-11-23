// Duel rules, no rendering. Feed it the sword state each step, read the events it returns.
import { segmentHitsCircle, tuning } from './pose.js';

export const ZONES = { left: { x: -0.75, y: 0.05 }, right: { x: 0.75, y: 0.05 }, high: { x: 0, y: 0.8 } };
const BODY = { x: 0, y: 0.1 };

export const JANISSARY = { id: 'janissary', name: 'Janissary', hp: 5, idle: [0.7, 1.4], tell: 0.95, recover: 0.8, stagger: 1.4, dirs: ['left', 'right', 'high'] };

export function createDuel({ enemy = JANISSARY, playerHp = 5, rng = Math.random } = {}) {
  const e = { ...enemy, cur: enemy.hp, phase: 'idle', t: 0, dir: null, dur: 0 };
  const d = { enemy: e, playerHp, maxPlayerHp: playerHp, phase: 'fight', lastSwingHit: -1, time: 0 };
  const pick = (a) => a[Math.floor(rng() * a.length) % a.length];
  const rand = (lo, hi) => lo + (hi - lo) * rng();
  const setPhase = (p, dur = 0) => { e.phase = p; e.t = 0; e.dur = dur; };
  setPhase('idle', rand(...e.idle));

  /** sword: {cursor, prev, speed, swinging, id}. Returns a list of event names. */
  d.step = (dt, sword) => {
    const ev = [];
    if (d.phase !== 'fight') return ev;
    d.time += dt;
    e.t += dt;

    // player hits
    if (sword.swinging && sword.speed >= tuning.hitSpeed && sword.id !== d.lastSwingHit &&
        segmentHitsCircle(sword.prev, sword.cursor, BODY, tuning.bodyR)) {
      d.lastSwingHit = sword.id;
      const dmg = e.phase === 'stagger' ? 2 : 1;
      e.cur = Math.max(0, e.cur - dmg);
      ev.push(e.cur === 0 ? 'enemyDown' : 'hit');
      if (e.cur === 0) { d.phase = 'won'; return ev; }
      if (e.phase === 'windup') setPhase('recover', e.recover); // a counter breaks the attack
    }

    if (e.phase === 'idle' && e.t >= e.dur) { e.dir = pick(e.dirs); setPhase('windup', e.tell); ev.push('tell'); }
    else if (e.phase === 'windup' && e.t >= e.dur) {
      const z = ZONES[e.dir], c = sword.cursor;
      if (Math.hypot(c.x - z.x, c.y - z.y) <= tuning.parryR) { setPhase('stagger', e.stagger); ev.push('parry'); }
      else {
        d.playerHp--;
        ev.push('hurt');
        setPhase('recover', e.recover);
        if (d.playerHp <= 0) { d.phase = 'lost'; ev.push('playerDown'); }
      }
    } else if ((e.phase === 'recover' || e.phase === 'stagger') && e.t >= e.dur) setPhase('idle', rand(...e.idle));
    return ev;
  };
  return d;
}
