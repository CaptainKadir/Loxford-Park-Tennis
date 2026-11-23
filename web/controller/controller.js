import { calibrate, driftCorrect, deviceQuat, phoneToCourt } from '/shared/frame.js';
import { buildSample } from '/shared/sample.js';

const $ = (id) => document.getElementById(id);
const msg = (t) => ($('msg').textContent = t);

let ws = null;
let replaced = false; // another phone took this seat: do not fight for it
let playerNo = 0;
let started = false;
let calib = { yaw0: 0 };
let calibrated = false;
let sign;
let stillFor = 0;
let lastT = 0;
let sent = 0, rateHz = 0, rateWindowStart = performance.now();
let latest = { orient: null, rate: null, acc: null };
let recording = false;
let recorded = [];
let wakeLock = null;
const pings = new Map();
let pingId = 0;
setInterval(() => {
  if (!ws || ws.readyState !== 1) return;
  pings.set(++pingId, performance.now());
  ws.send(JSON.stringify({ type: 'ping', id: pingId }));
  if (pings.size > 10) pings.delete(pings.keys().next().value);
}, 1000);

function show() {
  const on = !!(ws && ws.readyState === 1);
  $('conn').classList.toggle('on', on);
  $('connText').textContent = on ? (playerNo ? `Player ${playerNo}` : 'Connected') : 'Not connected';
  $('rate').textContent = rateHz.toFixed(0);
  $('hits').textContent = buzzCount;
  $('start').classList.toggle('done', started);
  $('calib').classList.toggle('done', calibrated);
  $('recNote').textContent = recording ? `Recording: ${recorded.length} samples` : 'Save raw swings to a file';
}

// A short buzz when the racket hits the ball. Android has navigator.vibrate. iPhone Safari does not, so
// there a hidden iOS "switch" checkbox is toggled, which makes the system tick, but iOS only allows that
// right after a touch. For that case the "thump" option plays a short low sound from the phone instead.
let buzzCount = 0, thumpOn = true, actx = null; // the thump is on by default
function thump() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state !== 'running') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.12);
  } catch { /* no audio */ }
}
function buzz(ms = 40) {
  buzzCount++;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
    else $('hap').click();
  } catch { /* no haptics here */ }
  if (thumpOn) thump();
  show();
}
// settings sheet (the gear): thump, vibration test, record swings
const setSettings = (open) => {
  document.body.classList.toggle('settings', open);
  $('gear').setAttribute('aria-expanded', String(open));
  $('sheet').setAttribute('aria-hidden', String(!open));
};
$('gear').onclick = () => setSettings(!document.body.classList.contains('settings'));
$('emote').onclick = () => { // the game plays the emote only between points
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'emote' }));
  $('emote').classList.add('sent'); setTimeout(() => $('emote').classList.remove('sent'), 250);
};
$('close').onclick = $('backdrop').onclick = () => setSettings(false);
$('buzzTest').onclick = () => {
  buzz(60);
  $('buzzNote').textContent = navigator.vibrate ? 'Vibration sent.' : 'This browser cannot vibrate (iPhone): the thump sound is used instead.';
};
$('thump').onclick = () => { thumpOn = !thumpOn; $('thump').setAttribute('aria-pressed', String(thumpOn)); if (thumpOn) thump(); };

// The game page's link carries which game this phone belongs to (?room=, online) and which player it is (?seat=1|2, two players on one screen).
const params = new URLSearchParams(location.search);
const wsQuery = new URLSearchParams({ role: 'controller' });
if (/^[a-z0-9]{8,40}$/.test(params.get('room') || '')) wsQuery.set('room', params.get('room'));
if (/^[12]$/.test(params.get('seat') || '')) wsQuery.set('seat', params.get('seat'));
function connect() {
  ws = new WebSocket(`wss://${location.host}/ws?${wsQuery}`);
  ws.onopen = show;
  ws.onclose = () => { show(); if (!replaced) setTimeout(connect, 1000); };
  ws.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'replaced') { replaced = true; msg('Another phone took this seat. Reload this page to take it back.'); }
    else if (m.type === 'spectator') msg('Another phone is already the controller. Waiting to take over...');
    else if (m.type === 'slot') { playerNo = m.pad + 1; msg(''); show(); }
    else if (m.type === 'promoted') msg('You are now the controller.');
    else if (m.type === 'haptic') buzz(m.ms);
    else if (m.type === 'pong' && pings.has(m.id)) {
      const rtt = performance.now() - pings.get(m.id);
      pings.delete(m.id);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'lat', ms: rtt / 2 }));
    }
  };
}

async function requestMotion() {
  if (!window.isSecureContext) {
    msg('This page must be opened over https.');
    return false;
  }
  if (typeof DeviceMotionEvent === 'undefined') {
    msg('No motion sensors in this browser.');
    return false;
  }
  // Start both requests in the same tap: iOS only honours requestPermission() inside the user
  // gesture, and an await between the two calls can make the second one fail as "denied".
  const asks = [DeviceMotionEvent, DeviceOrientationEvent]
    .filter((E) => typeof E.requestPermission === 'function')
    .map((E) => E.requestPermission().then((r) => r, (err) => `error: ${err && err.name}`));
  const results = await Promise.all(asks);
  const bad = results.find((r) => r !== 'granted');
  if (bad) {
    msg(bad === 'denied'
      ? 'Motion permission was denied. Fully quit Safari (swipe it away), reopen this page and tap Allow. If it never asks, clear this site\'s data: Settings > Apps > Safari > Advanced > Website Data.'
      : `Motion permission failed (${bad}). Reload the page and tap Start again.`);
    return false;
  }
  return true;
}

function currentQuat() {
  const o = latest.orient;
  return o ? deviceQuat(o.alpha, o.beta, o.gamma) : null;
}

window.addEventListener('deviceorientation', (e) => {
  latest.orient = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
});

window.addEventListener('devicemotion', (e) => {
  const t = performance.now() / 1000;
  const rr = e.rotationRate;
  const acc = e.accelerationIncludingGravity;
  const raw = { t, orient: latest.orient, rate: rr, acc };
  if (acc && sign === undefined) {
    const mag = Math.hypot(acc.x || 0, acc.y || 0, acc.z || 0) / 9.80665;
    if (mag > 0.85 && mag < 1.15) {
      const r = buildSample(raw, calib);
      if (r) sign = r.sign;
    }
  }
  const built = buildSample(raw, calib, sign);
  if (!built || !ws || ws.readyState !== 1) return;

  const dt = t - lastT;
  lastT = t;
  const speed = Math.hypot(...built.sample.r);
  stillFor = speed < 0.15 ? stillFor + (dt < 0.5 ? dt : 0) : 0;
  if (calibrated && stillFor > 0) {
    const q = currentQuat();
    if (q) calib = driftCorrect(calib, q, stillFor, dt < 0.5 ? dt : 0);
  }
  ws.send(JSON.stringify(built.sample));
  if (recording) recorded.push(built.sample);
  sent++;
  const now = performance.now();
  if (now - rateWindowStart > 1000) {
    rateHz = (sent * 1000) / (now - rateWindowStart);
    sent = 0;
    rateWindowStart = now;
    show();
  }
});

$('start').onclick = async () => {
  if (!(await requestMotion())) return;
  msg('');
  started = true;
  $('calib').disabled = false;
  $('rec').disabled = false;
  $('start').disabled = true;
  if (thumpOn) { try { actx ??= new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { /* no audio */ } } // unlock the thump sound with this tap
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
  connect();
  show();
};

$('calib').onclick = () => {
  const q = currentQuat();
  const c = q && calibrate(q);
  if (!c) {
    msg('Hold the phone flat-ish with its top pointing at the net, then tap again.');
    return;
  }
  calib = c;
  calibrated = true;
  msg('Calibrated. Swing away!');
  show();
};

$('rec').onclick = () => {
  if (!recording) {
    recorded = [];
    recording = true;
    $('rec').textContent = 'Stop';
  } else {
    recording = false;
    $('rec').textContent = 'Start';
    const blob = new Blob([recorded.map((s) => JSON.stringify(s)).join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `swings-${Date.now()}.jsonl`;
    a.click();
  }
  show();
};

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && wakeLock) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* optional */ }
  }
});
