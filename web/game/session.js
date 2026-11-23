// Game session: the WASM core plus phone input, clock sync and pausing.
import { createClockSync } from './clocksync.js';
import { applyMapping, DEFAULT_MAPPING } from '../shared/mapping.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.1;
const SILENCE_MS = 1000;
const RALLY_STATES = [1, 2, 4, 5]; // LAB_INCOMING, LAB_OUTGOING, LAB_CPU_TURN, LAB_SERVE
const SHOT_LABEL_MS = 1200;

export function createSession(core, { now = () => performance.now(), requirePhone = true, pad = 0 } = {}) {
  let sync = createClockSync();
  let lastPhoneT = -Infinity;
  let acc = 0;
  let controller = false;
  let lastSampleMs = -Infinity;
  let swings = 0;
  let sampleCount = 0, sampleWindowStart = now(), sampleRate = 0;
  let lastLatency = 0;
  let phoneLatency = 0;
  let lastHits = 0;
  let shot = { shot: 0, side: 0, at: -Infinity };
  let paused = false;
  let mapping = DEFAULT_MAPPING;
  let needPhone = requirePhone;

  const inRally = () => RALLY_STATES.includes(core.state().labState);

  const resetPhone = () => {
    core.phoneReset();
    sync = createClockSync();
    lastPhoneT = -Infinity;
  };

  return {
    core,
    /** True when a rally is on and this phone is missing or silent (a two-player match holds both). */
    wouldPause() { return needPhone && inRally() && (!controller || now() - lastSampleMs > SILENCE_MS); },
    setMapping(m) { mapping = m; },
    /** Online: a player who chose to play without a phone must not stop the match for it. */
    setRequirePhone(on) { needPhone = !!on; },
    onMessage(m) {
      if ((m.pad ?? 0) !== pad) return; // another player's phone
      if (m.type === 'controller-joined') {
        controller = true;
        resetPhone();
      } else if (m.type === 'controller-lost') {
        controller = false;
        resetPhone();
      } else if (m.type === 'lat') {
        if (typeof m.ms === 'number' && Number.isFinite(m.ms)) phoneLatency = m.ms;
      } else if (m.type === 's') {
        // Stale, duplicate or out-of-order samples are dropped. A clock that jumps
        // back by more than a second is a reloaded phone page: start over.
        if (m.t <= lastPhoneT) {
          if (lastPhoneT - m.t <= 1) return;
          resetPhone();
        }
        lastPhoneT = m.t;
        controller = true;
        lastSampleMs = now();
        sampleCount++;
        if (typeof m.srv === 'number') lastLatency = Date.now() - m.srv;
        const t = sync.map(m.t, core.state().labT);
        if (core.phoneSample(t, applyMapping(m.q, mapping), m.r, m.a)) swings++;
      }
    },
    /** Advance by a real frame time; returns the number of fixed steps taken. */
    update(realDt, keys) {
      const t = now();
      if (t - sampleWindowStart >= 1000) {
        sampleRate = (sampleCount * 1000) / (t - sampleWindowStart);
        sampleCount = 0;
        sampleWindowStart = t;
      }
      paused = needPhone && inRally() && (!controller || t - lastSampleMs > SILENCE_MS);
      if (paused) return 0;
      acc += Math.min(realDt, MAX_FRAME);
      let steps = 0;
      while (acc >= STEP) {
        core.step(STEP, keys.right, keys.fwd);
        acc -= STEP;
        steps++;
      }
      const st = core.state();
      const mine = st.hits - (st.partnerHits || 0); // doubles: the partner's hits are not the phone's
      if (mine !== lastHits) {
        lastHits = mine;
        shot = { shot: st.hitShot, side: st.hitSide, at: t };
      }
      return steps;
    },
    status() {
      return {
        connected: controller,
        paused,
        swings,
        sampleRate,
        latencyMs: lastLatency + phoneLatency,
        shot: now() - shot.at < SHOT_LABEL_MS ? shot : null,
      };
    },
  };
}
