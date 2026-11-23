// Shot trainer. For each shot: (1) an example return plays in the real game view, (2) the player
// records imitations with the phone while a virtual bat mirrors it, between Start and Stop recording.
// The recorded swings are measured by the core, then the shot thresholds are fitted to them.
import { loadCore } from './core.js';
import { createWorld } from './render/world.js';
import { createBatView } from './bat.js';
import { formatShotLabel, bannerText } from './hud.js';
import { createClockSync } from './clocksync.js';
import { applyMapping, cleanMapping, headAngles, DEFAULT_MAPPING } from '../shared/mapping.js';
import { DEMOS, demoQuat } from './demo.js';
import { PROMPTS as BASIC_PROMPTS, ALL_PROMPTS, REPS, SHOT_NAMES, DEFAULT_TUNING, classify, accuracy, fitTuning, confusion } from './shots.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const rightHanded = !q.has('lefty');
const PROMPTS = q.has('all') ? ALL_PROMPTS : BASIC_PROMPTS; // ?all = topspin, slice, drop shot too

// Two separate cores: `play` is the live game the phone controls, `demo` plays the example returns.
const play = await loadCore(); // your turn: fed by the phone, a real rally
play.init((Math.random() * 1e9) >>> 0, rightHanded, false, 0);
play.setShotTuning(DEFAULT_TUNING);
const demo = await loadCore();
demo.setShotTuning(DEFAULT_TUNING);

const world = createWorld($('ex'), { rightHanded, res: 640, fit: false });
const playWorld = createWorld($('play'), { rightHanded, res: 640, fit: false });
const bat = createBatView($('bat'));

// ---------------------------------------------------------------- example return (game camera)
const LAB_INCOMING = 1, LAB_RESULT = 3;
const STEP = 1 / 60;
let ex = null; // current example run
let exAcc = 0;

function newExample() {
  const p = PROMPTS[idx];
  demo.init((Math.random() * 1e9) >>> 0, rightHanded, false, 0);
  demo.setShotTuning(DEFAULT_TUNING);
  demo.setTutorial(p.back ? 2 : 1); // the CPU feeds the ball (no human serve in the trainer)
  demo.demoPrepare(p.back);
  ex = { id: p.id, hit: false, start: null, doneAt: null, label: '' };
  $('tags').textContent = '';
}

function exampleFrame(dt) {
  if (!ex || finished) return;
  const d = DEMOS[ex.id];
  exAcc += Math.min(dt, 0.1);
  while (exAcc >= STEP) {
    exAcc -= STEP;
    demo.step(STEP, 0, 0);
    const s = demo.state();
    if (!ex.hit && s.labState === LAB_INCOMING && s.arrivalT < 1e8) {
      ex.start = s.arrivalT - d.hit * d.secs; // racket motion is timed so contact lands on the ball
      if (s.labT >= s.arrivalT) {
        ex.hit = demo.demoSwing(d.params.speed, d.params.face, d.params.path);
        if (!ex.hit) { newExample(); return; } // ball out of reach: try another serve
        ex.hitAt = s.labT;
      }
    } else if (ex.hit && ex.doneAt === null && (s.labState === LAB_RESULT || s.labT - ex.hitAt > 5)) {
      ex.doneAt = s.labT;
    }
    if (ex.doneAt !== null && s.labT - ex.doneAt > 1.2) { newExample(); return; }
  }
  const st = { ...demo.state(), labState: demo.state().labState };
  const u = ex.start === null ? 0 : Math.min(1, Math.max(0, (st.labT - ex.start) / d.secs));
  [st.racketW, st.racketX, st.racketY, st.racketZ] = demoQuat(ex.id, u);
  if (ex.hit) {
    const named = formatShotLabel(st.hitShot, st.hitSide);
    $('tags').textContent = `${named}\n${d.params.speed} m/s · face ${d.params.face} · path ${d.params.path}`;
  }
  world.update(st, { swingFlash: false }, dt);
}

// ---------------------------------------------------------------- state
let idx = 0;
let samples = []; // recorded swings
let finished = false;
let recording = false;
let lastSwingN = 0;
let lastQ = [1, 0, 0, 0];
let sync = createClockSync();
let pAcc = 0;
let pHits = 0;
let rallyHit = false; // the ball was hit in the current rally
let stopAfterReturn = false, stopTimer = 0;
let awaiting = null; // last recorded swing whose return has not happened yet
const ring = []; // recent phone samples [t, w, x, y, z]
const RING_S = 1.3;
let replay = null; // {trace, t0}
let sampleCount = 0, sampleRate = 0, connected = false, lastSampleAt = 0;

const forPrompt = (p) => samples.filter((s) => s.promptId === p.id);

// A fresh rally for the live game: the phone is fed in only while recording.
function newRally() {
  play.init((Math.random() * 1e9) >>> 0, rightHanded, false, 0);
  play.setShotTuning(DEFAULT_TUNING);
  play.phoneReset();
  // Your turn: the ball is returned exactly like the example, whatever your swing was like.
  // Your swing is measured and saved as this shot.
  play.forceStroke(DEMOS[PROMPTS[idx].id].params);
  play.setTutorial(PROMPTS[idx].back ? 2 : 1); // the CPU feeds the ball (no human serve in the trainer)
  play.demoPrepare(PROMPTS[idx].back);
  awaiting = null; stopAfterReturn = false; stopTimer = 0;
  sync = createClockSync();
  lastT = -Infinity;
  lastSwingN = 0; pHits = 0; pAcc = 0; rallyHit = false;
  $('tags2').textContent = '';
}

function setRecording(on) {
  recording = on;
  bat.setRecording(on);
  if (on) {
    bat.clearTrail();
    newRally();
  }
  $('rec').classList.toggle('on', on);
  $('rec').textContent = on ? '■ Stop recording' : '● Start recording';
  $('rec-badge').textContent = on ? '● RECORDING' : 'not recording';
  $('rec-badge').classList.toggle('on', on);
}

function toggleRecording() {
  if (finished) return;
  if (!recording && forPrompt(PROMPTS[idx]).length >= REPS) {
    $('last').textContent = `Already have ${REPS} swings for this shot. Discard one or go to the next shot.`;
    return;
  }
  const was = recording;
  setRecording(!recording);
  if (was) {
    const mine = forPrompt(PROMPTS[idx]);
    if (mine.length) startReplay(mine[mine.length - 1].trace);
  } else {
    replay = null;
    $('last').textContent = 'Recording. Swing now. Anything you do before pressing start or after stop is ignored.';
  }
}

function renderBar() {
  $('bar').textContent = '';
  PROMPTS.forEach((p, i) => {
    const n = forPrompt(p).length;
    const s = document.createElement('span');
    s.className = 'step' + (i === idx && !finished ? ' cur' : n >= REPS ? ' done' : '');
    s.textContent = `${p.title.toLowerCase()} ${n}/${REPS}`;
    s.onclick = () => goTo(i);
    s.style.cursor = 'pointer';
    $('bar').appendChild(s);
  });
}

function renderPrompt() {
  const p = PROMPTS[idx];
  $('title').textContent = p.title;
  $('how').textContent = p.how;
  $('ask').textContent = `Now you: press Start recording, then swing your phone the way you want a ${p.title.toLowerCase()} to register. The ball is returned like the example whatever you do; your swing is recorded as this shot. ${REPS} times.`;
  $('dots').textContent = '';
  const n = forPrompt(p).length;
  for (let i = 0; i < REPS; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i < n ? ' done' : '');
    $('dots').appendChild(d);
  }
  $('prev').disabled = idx === 0;
  $('next').textContent = idx === PROMPTS.length - 1 ? 'Finish ›' : 'Next shot ›';
  $('discard').disabled = n === 0;
  $('replaySwing').disabled = n === 0;
  renderBar();
}

function goTo(i) {
  if (finished || i < 0 || i >= PROMPTS.length) return;
  if (recording) setRecording(false);
  idx = i;
  replay = null;
  bat.clearTrail();
  renderPrompt();
  newExample();
}

function next() {
  if (idx < PROMPTS.length - 1) goTo(idx + 1);
  else finish();
}

function discardLast() {
  if (finished) return;
  const i = samples.map((s) => s.promptId).lastIndexOf(PROMPTS[idx].id);
  if (i >= 0) { samples.splice(i, 1); $('last').textContent = 'Discarded the last swing.'; renderPrompt(); }
}

// ---------------------------------------------------------------- the phone's swings
function describeSwing(s) {
  const p = PROMPTS.find((x) => x.id === s.promptId);
  const ret = s.hit ? `ball returned like the example (${s.gameCalled})` : 'waiting for the ball to arrive...';
  $('last').textContent =
    `swing ${s.number}/${REPS} recorded as ${p.title.toLowerCase()}: ${s.speed.toFixed(1)} m/s · face ${s.face.toFixed(2)} · path ${s.path.toFixed(2)}`
    + `  → ${ret}.  (current thresholds would name this swing: ${s.nowCalled})`;
}

function onSwing(st, info = { hit: false, label: '' }) {
  const p = PROMPTS[idx];
  if (finished || !recording) {
    $('last').textContent = '(a swing was seen but you are not recording, so it was ignored)';
    return;
  }
  const t1 = ring.length ? ring[ring.length - 1][0] : 0;
  const trace = ring.filter((r) => r[0] >= t1 - RING_S).map((r) => r.map((v, i) => (i ? Math.round(v * 1e4) / 1e4 : v)));
  const face = p.back ? st.swingFaceB : st.swingFaceF;
  const s = { promptId: p.id, type: p.type, speed: st.swingSpeed, face, path: st.swingPath,
    faceF: st.swingFaceF, faceB: st.swingFaceB, hit: info.hit, gameCalled: info.label, gameShot: info.shot ?? 0, trace };
  samples.push(s);
  const n = forPrompt(p).length;
  s.nowCalled = SHOT_NAMES[classify(s.speed, s.face, s.path, DEFAULT_TUNING)];
  s.number = n;
  if (!info.hit) awaiting = s;
  describeSwing(s);
  renderPrompt();
  if (n >= REPS) {
    stopAfterReturn = true;
  }
}

function startReplay(trace) {
  if (!trace || trace.length < 2) return;
  bat.clearTrail();
  replay = { trace, t0: performance.now(), i: 0 };
}
function replayFrame(now) {
  if (!replay) return;
  const tr = replay.trace;
  const speed = 0.5; // slow motion
  const el = ((now - replay.t0) / 1000) * speed;
  const base = tr[0][0];
  while (replay.i < tr.length - 1 && tr[replay.i + 1][0] - base <= el) {
    replay.i++;
    bat.setQuat(tr[replay.i].slice(1));
    bat.addTrail(0xff9a4d);
  }
  if (replay.i >= tr.length - 1 && el > tr[tr.length - 1][0] - base + 0.8) replay = null;
}

// ---------------------------------------------------------------- results
function finish() {
  if (recording) setRecording(false);
  finished = true;
  $('train').style.display = 'none';
  $('result').style.display = 'block';
  $('title2').textContent = 'Results';
  const fitted = fitTuning(samples, DEFAULT_TUNING);
  const before = accuracy(samples, DEFAULT_TUNING), after = accuracy(samples, fitted);
  $('summary').textContent = samples.length
    ? `${samples.length} swings. Current thresholds name ${(before * 100).toFixed(0)}% as you intended; ` +
      `fitted thresholds name ${(after * 100).toFixed(0)}%.`
    : 'No swings recorded.';
  const rowsB = confusion(samples, DEFAULT_TUNING), rowsA = confusion(samples, fitted);
  const fmt = (r) => (r ? Object.entries(r.counts).map(([k, v]) => `${SHOT_NAMES[k]} ×${v}`).join(', ') : '-');
  $('table').textContent = '';
  const head = $('table').insertRow();
  for (const h of ['you meant', 'now', 'with fitted']) head.insertCell().outerHTML = `<th>${h}</th>`;
  for (const p of PROMPTS) {
    const r = $('table').insertRow();
    r.insertCell().textContent = p.title.toLowerCase();
    const ok = (row) => row && Object.keys(row.counts).every((k) => Number(k) === p.type);
    for (const row of [rowsB[p.id], rowsA[p.id]]) {
      const c = r.insertCell();
      c.textContent = fmt(row);
      c.className = ok(row) ? 'ok' : 'no';
    }
  }
  $('save').disabled = samples.length < 8;
  $('save').onclick = async () => {
    $('saved').textContent = 'Saving...';
    try {
      const res = await fetch('/api/tuning', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tuning: fitted, samples, rightHanded }) });
      if (!res.ok) throw new Error(await res.text());
      $('saved').textContent = 'Saved as a trial (web/tuning.trial.json). The game is unchanged until you promote it.';
    } catch (e) {
      $('saved').textContent = `Could not save: ${e.message}. Open this page from http://localhost:8080/train (saving only works on this Mac).`;
    }
  };
  $('again').onclick = () => {
    samples = []; idx = 0; finished = false;
    $('result').style.display = 'none'; $('train').style.display = 'block';
    renderPrompt(); newExample();
  };
}

// ---------------------------------------------------------------- controls
const click = (id, fn) => { $(id).onclick = (e) => { fn(); e.currentTarget.blur(); }; };
click('rec', toggleRecording);
click('discard', discardLast);
click('replaySwing', () => { const m = forPrompt(PROMPTS[idx]); if (m.length) startReplay(m[m.length - 1].trace); });
click('replayEx', newExample);
click('prev', () => goTo(idx - 1));
click('next', next);
click('done', finish);
window.addEventListener('keydown', (e) => {
  if (finished || e.repeat) return;
  const map = { Enter: toggleRecording, Space: next, Backspace: discardLast, ArrowLeft: () => goTo(idx - 1),
    ArrowRight: next, KeyE: newExample, KeyP: () => $('replaySwing').click() };
  const fn = map[e.code];
  if (fn) { e.preventDefault(); fn(); }
});

// ---------------------------------------------------------------- phone link
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
let lastT = -Infinity;
// ---- mapping: make the bat match the hand ----
let mapping = DEFAULT_MAPPING;
try { mapping = cleanMapping(JSON.parse(localStorage.getItem('oc-mapping') || 'null')); } catch { /* none */ }
fetch('/mapping.json').then((r) => (r.ok && r.status !== 204 ? r.json() : null)).then((m) => { if (m) { mapping = cleanMapping(m); syncMappingUi(); } }).catch(() => {});
function syncMappingUi() {
  $('m-lr').checked = mapping.flipLR; $('m-ud').checked = mapping.flipUD; $('m-tw').value = String(mapping.twist);
}
function readMappingUi() {
  mapping = cleanMapping({ flipLR: $('m-lr').checked, flipUD: $('m-ud').checked, twist: Number($('m-tw').value) });
  try { localStorage.setItem('oc-mapping', JSON.stringify(mapping)); } catch { /* private mode */ }
  $('m-msg').textContent = '';
}
for (const id of ['m-lr', 'm-ud', 'm-tw']) $(id).onchange = readMappingUi;
$('m-save').onclick = async (e) => {
  e.currentTarget.blur();
  try {
    const r = await fetch('/api/mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mapping) });
    if (!r.ok) throw new Error(await r.text());
    $('m-msg').textContent = 'Saved as a trial (web/mapping.trial.json). The game is unchanged until you promote it.';
  } catch (err) { $('m-msg').textContent = `Could not save: ${err.message} (open this page at http://localhost:8080/train)`; }
};
syncMappingUi();

function onSample(raw) {
  const m = { ...raw, q: applyMapping(raw.q, mapping) };
  const a = headAngles(m.q);
  $('m-read').textContent = `phone top points ${Math.abs(a.yaw).toFixed(0)}° ${a.yaw >= 0 ? 'LEFT' : 'RIGHT'} of the net, ${Math.abs(a.pitch).toFixed(0)}° ${a.pitch >= 0 ? 'UP' : 'DOWN'}`;
  connected = true;
  lastSampleAt = performance.now();
  sampleCount++;
  if (m.t <= lastT) { if (lastT - m.t > 1) { play.phoneReset(); sync = createClockSync(); lastT = -Infinity; } else return; }
  lastT = m.t;
  lastQ = m.q;
  ring.push([m.t, m.q[0], m.q[1], m.q[2], m.q[3]]);
  while (ring.length && ring[0][0] < m.t - RING_S - 0.2) ring.shift();
  if (!replay) {
    bat.setQuat(m.q);
    if (recording) bat.addTrail();
  }
  if (!recording || finished) return; // movements outside a recording never reach the game
  const hitsBefore = play.state().hits;
  const t = sync.map(m.t, play.state().labT); // phone clock -> game clock, as in the real game
  if (play.phoneSample(t, m.q, m.r, m.a)) {
    const st = play.state();
    if (st.swingN !== lastSwingN) {
      lastSwingN = st.swingN;
      const hit = st.hits > hitsBefore;
      if (hit) { rallyHit = true; pHits = st.hits; }
      onSwing(st, { hit, label: hit ? formatShotLabel(st.hitShot, st.hitSide) : '', shot: st.hitShot });
    }
  }
}
function connect() {
  const ws = new WebSocket(`${proto}://${location.host}/ws?role=game`);
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'controller-joined') { connected = true; play.phoneReset(); sync = createClockSync(); lastT = -Infinity; ring.length = 0; }
    else if (m.type === 'controller-lost') connected = false;
    else if (m.type === 's') onSample(m);
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();
setInterval(() => {
  sampleRate = sampleCount; sampleCount = 0;
  const live = connected && performance.now() - lastSampleAt < 1500;
  $('conn').className = live ? '' : 'bad';
  $('conn').textContent = live
    ? `phone connected · ${sampleRate} samples/s`
    : 'Phone not sending. Close the game page tab, open the phone link, tap Start, then Calibrate.';
}, 1000);

function playFrame(dt) {
  if (finished) return;
  if (recording) {
    pAcc += Math.min(dt, 0.1);
    while (pAcc >= STEP) { pAcc -= STEP; play.step(STEP, 0, 0); }
  }
  const st = { ...play.state() };
  if (st.hits > pHits) {
    pHits = st.hits;
    rallyHit = true;
    if (awaiting) {
      awaiting.hit = true; awaiting.gameCalled = formatShotLabel(st.hitShot, st.hitSide); awaiting.gameShot = st.hitShot;
      describeSwing(awaiting);
      awaiting = null;
    }
  }
  if (recording && stopAfterReturn) {
    stopTimer += dt;
    if ((!awaiting && stopTimer > 1.8) || stopTimer > 4) {
      const mine = forPrompt(PROMPTS[idx]);
      setRecording(false);
      if (mine.length) startReplay(mine[mine.length - 1].trace);
      $('last').textContent += `   — got ${REPS} swings, recording stopped. Press Next shot.`;
    }
  }
  // the cat's racket always mirrors the phone, recording or not
  [st.racketW, st.racketX, st.racketY, st.racketZ] = lastQ;
  const result = st.labState === LAB_RESULT && rallyHit;
  if (recording && result) $('tags2').textContent = bannerText({ paused: false }, { winner: st.winner, why: st.why }) || '';
  else if (recording && !rallyHit) $('tags2').textContent = st.labState === LAB_INCOMING ? 'Ball coming: swing when it reaches you' : 'Get ready...';
  else if (!recording) $('tags2').textContent = 'Press Start recording to get a ball';
  playWorld.update(st, { swingFlash: false }, dt);
}

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  exampleFrame(dt);
  playFrame(dt);
  replayFrame(now);
  bat.render();
  requestAnimationFrame(frame);
}

setRecording(false);
renderPrompt();
newExample();
requestAnimationFrame(frame);
globalThis.trainer = { samples: () => samples, bat, demo, play, feed: onSample };
