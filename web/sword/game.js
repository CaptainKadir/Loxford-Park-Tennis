// Third-person Ottoman duel (camera behind your fighter). Phone is the sword; the mouse works as a stand-in (move = aim, fast flick = slash).
import * as THREE from 'three';
import { quatForCursor, createSwingTracker, cursorOf, bladeDir, tuning } from './pose.js';
import { createDuel, ZONES, JANISSARY } from './duel.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9a65c);
scene.fog = new THREE.Fog(0xe9a65c, 8, 30);
const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 60);
camera.position.set(2.3, 2.0, 2.4);
camera.lookAt(0, 1.15, -0.9);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize); resize();

// ---- palace courtyard (placeholder art: flat-shaded primitives)
const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
scene.add(new THREE.HemisphereLight(0xfff0d0, 0x6b4a2a, 1.1));
const sun = new THREE.DirectionalLight(0xffd9a0, 1.3); sun.position.set(-4, 8, 3); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(0xc9a77a)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
for (let i = -3; i <= 3; i++) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 4, 8), mat(0xefe2c4)); col.position.set(i * 3, 2, -9); scene.add(col);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.18, 6, 12, Math.PI), mat(0x2f6f73)); arch.position.set(i * 3 + 1.5, 4, -9); scene.add(arch);
}
const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2f6f73)); dome.position.set(0, 4, -16); scene.add(dome);

const ENEMY_Z = -2.1;
const PIVOT = new THREE.Vector3(0.28, 1.3, -0.15); // sword hand

// ---- enemy (placeholder Janissary)
const enemy = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8), mat(0x1f3f8f)); body.position.y = 0.95; enemy.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xd9a77a)); head.position.y = 1.8; enemy.add(head);
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), mat(0xf2efe6)); hat.position.y = 2.15; hat.rotation.z = 0.15; enemy.add(hat);
const eSword = new THREE.Group(); const eBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.02), mat(0xdfe3e8)); eBlade.position.y = 0.5; eSword.add(eBlade);
eSword.position.set(0.45, 1.2, 0.3); enemy.add(eSword);
enemy.position.set(0, 0, ENEMY_Z); scene.add(enemy);

// ---- my fighter (seen from behind) and blade
const me = new THREE.Group();
const mBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.25, 8), mat(0x8f1f2a)); mBody.position.y = 0.9; me.add(mBody);
const mSash = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.14, 8), mat(0xc9a24a)); mSash.position.y = 0.85; me.add(mSash);
const mHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xc99468)); mHead.position.y = 1.7; me.add(mHead);
const mTurban = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mat(0xf2efe6)); mTurban.scale.set(1, 0.7, 1); mTurban.position.y = 1.9; me.add(mTurban);
const mCape = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.04), mat(0x2f6f73)); mCape.position.set(0, 1.0, 0.3); me.add(mCape);
scene.add(me);

const blade = new THREE.Group();
const steel = new THREE.MeshLambertMaterial({ color: 0xe6eaf0, emissive: 0x30343a, flatShading: true });
// kilij: segments bending toward the edge
for (let i = 0; i < 4; i++) {
  const seg = new THREE.Mesh(new THREE.BoxGeometry(0.06 - i * 0.008, 0.26, 0.012), steel);
  seg.position.set(i * i * 0.012, 0.13 + i * 0.25, 0); seg.rotation.z = -0.07 * i; blade.add(seg);
}
const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), mat(0xc9a24a));
const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 6), mat(0x3a1f12)); grip.position.y = -0.09;
blade.add(guard, grip);
blade.position.copy(PIVOT); scene.add(blade);
const UP = new THREE.Vector3(0, 1, 0);
/** Court-frame blade direction (x right, y at enemy, z up) -> world (z is toward the camera). */
const worldDir = (q) => { const d = bladeDir(q); return new THREE.Vector3(d[0], d[2], -d[1]).normalize(); };
const BLADE_LEN = 1.2;

// ---- sword input: phone samples, else mouse
let q = quatForCursor(0, 0);
let phone = false, lastPhone = 0;
const tracker = createSwingTracker();
const mouse = { x: 0, y: 0 };
addEventListener('mousemove', (e) => { mouse.x = (e.clientX / innerWidth - 0.5) * 2; mouse.y = -(e.clientY / innerHeight - 0.5) * 2; });

// ---- feel panel: live thresholds, saved in this browser
const DEFAULTS = { ...tuning };
try { Object.assign(tuning, JSON.parse(localStorage.getItem('swordTuning') || '{}')); } catch { /* none saved */ }
const SLIDERS = [
  ['start', 'Swing starts', 1, 12, 0.1, 'rad/s the blade must sweep to begin a slash'],
  ['hitSpeed', 'Hit speed', 1, 14, 0.1, 'rad/s needed to damage the enemy'],
  ['stop', 'Swing ends', 0.5, 6, 0.1, 'rad/s under which a slash is over'],
  ['span', 'Aim range', 0.3, 1, 0.01, 'smaller = less tilt needed to reach screen edge'],
  ['parryR', 'Parry zone', 0.2, 1.2, 0.02, 'how close the blade must be to the glow'],
  ['bodyR', 'Body size', 0.2, 1, 0.02, 'how big a target the enemy is'],
  ['smooth', 'Smoothing', 0.2, 1, 0.05, 'lower = steadier speed reading, more lag'],
];
const saveTuning = () => { try { localStorage.setItem('swordTuning', JSON.stringify(tuning)); } catch { /* private mode */ } };
for (const [k, label, lo, hi, step, tip] of SLIDERS) {
  const row = document.createElement('div'); row.className = 'row'; row.title = tip;
  row.innerHTML = `<span>${label}</span><input type="range" min="${lo}" max="${hi}" step="${step}"><span></span>`;
  const [, inp, val] = row.children;
  inp.value = tuning[k]; val.textContent = (+tuning[k]).toFixed(2);
  inp.oninput = () => { tuning[k] = +inp.value; val.textContent = (+inp.value).toFixed(2); saveTuning(); };
  row._sync = () => { inp.value = tuning[k]; val.textContent = (+tuning[k]).toFixed(2); };
  $('sliders').appendChild(row);
}
$('reset').onclick = () => { Object.assign(tuning, DEFAULTS); saveTuning(); [...$('sliders').children].forEach((r) => r._sync()); };
$('copy').onclick = () => navigator.clipboard?.writeText(JSON.stringify(tuning));
const togglePanel = () => $('feel').classList.toggle('open');
$('feelBtn').onclick = togglePanel;
addEventListener('keydown', (e) => { if (e.code === 'KeyF') togglePanel(); });
$('meter').lastElementChild.style.left = '0%';
const stat = { samples: 0, hz: 0, t0: performance.now(), peak: 0, swings: 0, landed: 0 };

let ws;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=game`);
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 's' && (m.pad ?? 0) === 0) { phone = true; lastPhone = performance.now(); q = m.q; stat.samples++; tracker.update(m.t, q); }
    else if (m.type === 'controller-lost') phone = false;
  };
  ws.onclose = () => setTimeout(connect, 1000);
}
connect();
const buzz = (ms) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'haptic', pad: 0, ms })); } catch { /* no phone */ } };

// ---- fight
let duel = createDuel({ enemy: JANISSARY });
const say = (t, ms = 900) => { $('msg').textContent = t; clearTimeout(say.t); if (t) say.t = setTimeout(() => ($('msg').textContent = ''), ms); };
const flash = () => { $('flash').style.opacity = 0.5; setTimeout(() => ($('flash').style.opacity = 0), 120); };
$('ename').textContent = JANISSARY.name.toUpperCase();
$('foot').textContent = 'Third person. Phone: open /pad, Start, Calibrate with the top edge pointing at the screen. Mouse: move to aim, flick fast to slash. Match the glow to parry, slash when it opens.';

const zoneMarks = Object.fromEntries(Object.entries(ZONES).map(([k, z]) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.17, 24), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0, depthTest: false }));
  m.position.copy(PIVOT).addScaledVector(worldDir(quatForCursor(z.x, z.y)), BLADE_LEN); m.lookAt(camera.position); m.renderOrder = 10; scene.add(m); return [k, m];
}));

const events = {
  hit: () => { stat.landed++; say('HIT'); buzz(40); },
  parry: () => { say('PARRY!'); buzz(80); },
  hurt: () => { flash(); buzz(160); },
  enemyDown: () => { say('VICTORY\nclick to fight again', 99999); buzz(200); },
  playerDown: () => { say('DEFEATED\nclick to retry', 99999); },
};
addEventListener('click', () => { if (duel.phase !== 'fight') { duel = createDuel({ enemy: JANISSARY }); say(''); } });

let last = performance.now();
const mouseT = () => performance.now() / 1000;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (phone && now - lastPhone > 1500) phone = false;
  if (!phone) { q = quatForCursor(mouse.x, mouse.y); tracker.update(mouseT(), q); }
  const ev = duel.step(dt, tracker.state);
  const ts = tracker.state;
  if (ts.id !== stat.swings) { stat.swings = ts.id; stat.peak = 0; }
  if (ts.swinging) stat.peak = Math.max(stat.peak, ts.speed);
  if (now - stat.t0 > 1000) { stat.hz = (stat.samples * 1000) / (now - stat.t0); stat.samples = 0; stat.t0 = now; }
  ev.forEach((n) => events[n]?.());

  // blade follows the phone's real direction; the dot marks its tip on screen
  const c = cursorOf(q);
  const wd = worldDir(q);
  blade.quaternion.setFromUnitVectors(UP, wd);
  const tip = PIVOT.clone().addScaledVector(wd, BLADE_LEN).project(camera);

  // enemy telegraph: raise the sword toward the attack zone, lunge on release
  const e = duel.enemy;
  const z = e.dir ? ZONES[e.dir] : { x: 0.5, y: 0 };
  const prep = e.phase === 'windup' ? Math.min(1, e.t / e.dur) : 0;
  eSword.rotation.set(0, 0, -z.x * 1.0 * prep - 0.2);
  eSword.position.y = 1.2 + z.y * 0.5 * prep;
  body.material.color.setHex(e.phase === 'stagger' ? 0xffd166 : e.phase === 'windup' ? 0x8f3f1f : 0x1f3f8f);
  enemy.position.z = ENEMY_Z + (e.phase === 'windup' ? prep * 0.5 : 0);
  enemy.rotation.z = e.phase === 'stagger' ? Math.sin(now / 60) * 0.1 : 0;
  for (const [k, m] of Object.entries(zoneMarks)) m.material.opacity = e.phase === 'windup' && e.dir === k ? 0.4 + 0.6 * prep : 0;

  const dotX = (tip.x * 0.5 + 0.5) * innerWidth, dotY = (-tip.y * 0.5 + 0.5) * innerHeight;
  $('dot').style.left = `${dotX}px`; $('dot').style.top = `${dotY}px`;
  $('dot').classList.toggle('fast', ts.swinging && ts.speed >= tuning.hitSpeed);
  if ($('feel').classList.contains('open')) {
    $('read').textContent = `input   ${phone ? 'PHONE' : 'mouse'}  ${phone ? stat.hz.toFixed(0) + ' Hz' : ''}\nspeed   ${ts.speed.toFixed(1)} rad/s\nlast peak ${stat.peak.toFixed(1)}\nslashes ${stat.swings}   landed ${stat.landed}`;
    const m = $('meter'); m.firstElementChild.style.width = `${Math.min(100, (ts.speed / 14) * 100)}%`;
    m.firstElementChild.style.background = ts.speed >= tuning.hitSpeed ? '#ffd166' : ts.speed >= tuning.start ? '#6aa84f' : '#4a5a3a';
    m.lastElementChild.style.left = `${(tuning.hitSpeed / 14) * 100}%`;
  }
  $('en').firstElementChild.style.width = `${(e.cur / e.hp) * 100}%`;
  $('me').firstElementChild.style.width = `${(duel.playerHp / duel.maxPlayerHp) * 100}%`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__sword = { get duel() { return duel; }, tracker };
