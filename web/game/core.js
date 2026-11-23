// Loads the WASM build of core/ and wraps the flat oc_* API.
import createModule from '../build/core.js';

// Same order as the enum in web/wasm_api.c.
export const STATE_NAMES = [
  'ballX', 'ballY', 'ballZ', 'ballVX', 'ballVY', 'ballVZ',
  'playerX', 'playerY', 'playerZ', 'playerVX', 'playerVZ',
  'cpuX', 'cpuZ',
  'pointsHuman', 'pointsCpu',
  'labState', 'winner', 'why',
  'hits', 'hitSpeed', 'hitSpin', 'hitFace', 'hitPath', 'hitSide', 'hitShot',
  'cpuHits',
  'camEX', 'camEY', 'camEZ', 'camTX', 'camTY', 'camTZ', 'camFov',
  'racketW', 'racketX', 'racketY', 'racketZ',
  'labT',
  'swingN', 'swingSpeed', 'swingFaceF', 'swingFaceB', 'swingPath',
  'arrivalT',
  'ptsH', 'ptsC', 'gamesH', 'gamesC', 'server', 'matchOver', 'matchWinner', 'serveN',
  'outSeq', 'outX', 'outY', 'outZ', 'outVX', 'outVY', 'outVZ', 'outSX', 'outSY', 'outSZ',
  'outAge', 'outBounced', 'ptSeq', 'ptWinner', 'ptWhy',
  'serveSeq', 'sX', 'sY', 'sZ', 'sVX', 'sVY', 'sVZ', 'sSX', 'sSY', 'sSZ', 'ghost', 'gX', 'gY', 'gZ',
  'waitingForServe',
  'doubles', 'partnerX', 'partnerZ', 'cpu2X', 'cpu2Z', 'partnerHits', 'cpu2Hits', 'nearOwner', 'farHitter', 'serverPlayer',
];

export async function loadCore() {
  const m = await createModule();
  if (m._oc_state_len() !== STATE_NAMES.length) throw new Error('state layout mismatch');
  return {
    init: (seed, rightHanded, arcade, cpuLevel) =>
      m._oc_init(seed, rightHanded ? 1 : 0, arcade ? 1 : 0, cpuLevel),
    initDoubles: (seed, rightHanded, arcade, cpuLevel, partnerLevel) =>
      m._oc_init_doubles(seed, rightHanded ? 1 : 0, arcade ? 1 : 0, cpuLevel, partnerLevel),
    initRemote: (seed, rightHanded, arcade, firstServer) =>
      m._oc_init_remote(seed, rightHanded ? 1 : 0, arcade ? 1 : 0, firstServer),
    remoteBall: (s) => m._oc_remote_ball(s.outX, s.outY, s.outZ, s.outVX, s.outVY, s.outVZ, s.outSX, s.outSY, s.outSZ, s.outAge, s.outBounced ? 1 : 0),
    remoteServe: (s) => m._oc_remote_serve(s.sX, s.sY, s.sZ, s.sVX, s.sVY, s.sVZ, s.sSX, s.sSY, s.sSZ),
    setMatchGames: (n) => m._oc_set_match_games(n | 0),
    setTutorial: (side) => m._oc_set_tutorial(side),
    remotePoint: (winner, why) => m._oc_remote_point(winner, why),
    remotePos: (x, z) => m._oc_remote_pos(x, z),
    remoteScore: (r) => m._oc_remote_score(r.pts0, r.pts1, r.g0, r.g1, r.server, r.over ? 1 : 0, r.winner, r.t0, r.t1),
    step: (dt, inRight, inFwd) => m._oc_step(dt, inRight, inFwd),
    phoneSample: (t, q, rate, acc) =>
      m._oc_phone_sample(t, q[0], q[1], q[2], q[3], rate[0], rate[1], rate[2],
                         acc[0], acc[1], acc[2]) === 1,
    phoneReset: () => m._oc_phone_reset(),
    setShotTuning: (t) => m._oc_set_shot_tuning(t.slowSpeed, t.fastSpeed, t.openFace, t.closedFace, t.lobPath),
    setBasicShots: (on) => m._oc_set_basic_shots(on ? 1 : 0),
    setStrongAim: (on) => m._oc_set_strong_aim(on ? 1 : 0),
    setEasyReturns: (on) => m._oc_set_easy_returns(on ? 1 : 0),
    forceStroke: (p) => (p ? m._oc_force_stroke(1, p.speed, p.face, p.path) : m._oc_force_stroke(0, 0, 0, 0)),
    demoPrepare: (backhand) => m._oc_demo_prepare(backhand ? 1 : 0),
    demoSwing: (speed, face, path) => m._oc_demo_swing(speed, face, path) === 1,
    classifyShot: (speed, face, path) => m._oc_classify_shot(speed, face, path),
    state() {
      const base = m._oc_state() >> 2;
      const out = {};
      for (let i = 0; i < STATE_NAMES.length; i++) out[STATE_NAMES[i]] = m.HEAPF32[base + i];
      return out;
    },
  };
}
