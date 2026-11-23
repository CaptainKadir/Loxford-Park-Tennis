// Text overlay: score, shot label, banners, diagnostics.
const SHOT = ['', 'drive', 'topspin', 'slice', 'drop shot', 'lob'];
const WHY = ['', 'out', 'net', 'you missed', 'double bounce', 'double fault'];
const LAB_RESULT = 3;
const LAB_WAIT = 0, LAB_SERVE = 5;

/** Same wording as shot_name() in core/shot.c. side: 1 forehand, 2 backhand. */
export function formatShotLabel(shot, side) {
  if (!shot) return '';
  if (side === 0) return 'serve';
  const bh = side === 2;
  if (shot === 1) return bh ? 'backhand' : 'forehand';
  if (shot === 2) return bh ? 'topspin backhand' : 'topspin forehand';
  if (shot === 3) return bh ? 'slice backhand' : 'slice forehand';
  return SHOT[shot] ?? '';
}

export const formatPoints = (human, cpu) => `YOU ${human} : ${cpu} CPU`;

const CALL = ['0', '15', '30', '40'];
/** Tennis calls for the current game from the raw points: ['30', '15'], ['Deuce', ''], ['Ad', '40'] ... */
export function gameCalls(h, c) {
  if (h >= 3 && c >= 3) {
    if (h === c) return ['Deuce', ''];
    return h > c ? ['Ad', '40'] : ['40', 'Ad'];
  }
  return [CALL[Math.min(h, 3)], CALL[Math.min(c, 3)]];
}

/** Set an element's text, and replay a CSS animation class when the text changes. */
export function setText(el, text, cls) {
  if (el.textContent === text) return;
  el.textContent = text;
  if (!cls || !text) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
}

/** Two-line scoreboard text. */
export function scoreboard(st, names = ['YOU', 'CPU']) {
  const [h, c] = gameCalls(st.ptsH, st.ptsC);
  const mark = (side) => (st.server === side ? '●' : ' ');
  const pts = h === 'Deuce' ? 'Deuce' : `${h} - ${c}`;
  return `${mark(0)}${names[0]} ${st.gamesH}   ${st.gamesC} ${names[1]}${mark(1)}\n${pts}`;
}

const escH = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Broadcast-style scoreboard: one row per player with a serve dot, games won and the current game call. */
export function scoreboardHtml(st, names = ['YOU', 'CPU']) {
  const [h, c] = gameCalls(st.ptsH, st.ptsC);
  const deuce = h === 'Deuce';
  const row = (i, games, pts) => `<div class="sbrow${st.server === i ? ' srv' : ''}"><i class="sbdot"></i><b class="sbname">${escH(names[i])}</b><span class="sbgames">${games}</span><span class="sbpts">${escH(pts)}</span></div>`;
  return row(0, st.gamesH, deuce ? 'DEUCE' : h) + row(1, st.gamesC, deuce ? '' : c);
}

/** Set an element's HTML, and replay a CSS animation class when it changes. */
export function setHtml(el, html, cls) {
  if (el.dataset.h === html) return;
  el.dataset.h = html;
  el.innerHTML = html;
  if (!cls) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Keep the scoreboard inside the picture when the window is not 16:9 and the canvas is letterboxed. */
function fitScore(doc) {
  const cv = doc.getElementById('view');
  const r = cv && cv.getBoundingClientRect();
  if (!r || !r.width) return;
  const root = doc.documentElement.style;
  root.setProperty('--sb-top', `${Math.max(0, Math.round(r.top)) + 12}px`);
  root.setProperty('--sb-right', `${Math.max(0, Math.round(doc.documentElement.clientWidth - r.right)) + 12}px`);
}

/** Match, serve and fault messages. Empty when there is nothing to say. */
export function serveText(st, opponent = 'CPU', { button = false } = {}) {
  const hint = button ? 'R: replay. Esc: pause' : 'Enter or swing: rematch. R: replay. Esc: pause'; // with a rematch button on screen there is no swing hint
  if (st.matchOver) return st.matchWinner === 0 ? `You win the match!\n${hint}` : `${opponent} wins the match\n${hint}`;
  if (st.labState === LAB_SERVE) return st.serveN === 2 ? 'Second serve: swing when the ball is high' : 'Your serve: swing when the ball is high';
  if (st.labState === LAB_WAIT && st.serveN === 2 && st.why === 5) return 'Fault';
  return '';
}

export function bannerText(status, { winner, why }) {
  if (status.paused) return status.connected ? 'Waiting for the phone...' : 'Reconnect the phone';
  return ''; // the point itself is announced by the animation in the middle of the screen (pointFx)
}

export function updateHud(session, doc, { names = ['YOU', 'CPU'], opponent = 'CPU', button = false } = {}) {
  const st = session.core.state();
  const s = session.status();
  setHtml(doc.getElementById('score'), scoreboardHtml(st, names), 'bump');
  fitScore(doc);
  setText(doc.getElementById('shot'), s.shot ? formatShotLabel(s.shot.shot, s.shot.side) : '', 'pop');
  const result = st.labState === LAB_RESULT;
  const banner = bannerText(s, { winner: result ? st.winner : 0, why: st.why });
  const b = doc.getElementById('banner');
  const serve = serveText(st, opponent, { button });
  setText(b, s.paused ? banner : serve, 'pop');
  b.style.display = s.paused || st.matchOver ? 'flex' : 'none';
  if (!st.matchOver && serve && !s.paused) setText(doc.getElementById('shot'), serve, 'pop');
  // Diagnostics only with ?debug; otherwise just a short hint while the phone is missing.
  const debug = typeof location !== 'undefined' && location.search.includes('debug');
  doc.getElementById('hud').textContent =
    (debug ? `phone: ${s.connected ? 'connected' : 'not connected'}  samples/s: ${s.sampleRate.toFixed(0)}  latency: ${s.latencyMs.toFixed(0)} ms  swings: ${s.swings}\n` : '') +
    (!s.connected ? (typeof location !== 'undefined' && location.search.includes('nophone') ? 'Keyboard mode: arrows or WASD move. Esc pauses.\n' : 'Open the phone link, tap Start, then Calibrate.\n') : '') +
    (banner && !s.paused && !serve ? banner + '\n' : '');
}

/** Two-player HUD: one scoreboard in the middle, a message and shot label in each half. */
export function updateHud2(sessions, doc) {
  const [a, b] = sessions;
  const st = a.core.state();
  setHtml(doc.getElementById('score'), scoreboardHtml(st, ['P1', 'P2']), 'bump');
  const paused = a.status().paused || b.status().paused;
  const lost = sessions.findIndex((s) => !s.status().connected);
  const banner = doc.getElementById('banner');
  banner.textContent = paused ? `Waiting for player ${(lost < 0 ? 0 : lost) + 1}'s phone...` : st.matchOver ? serveText(st, 'P2', { button: true }).replace('You win', 'P1 wins').replace('the match!', 'the match') : '';
  banner.style.display = paused || st.matchOver ? 'flex' : 'none';
  sessions.forEach((s, i) => {
    const cs = s.core.state();
    const shot = s.status().shot;
    const text = !paused && !cs.matchOver ? serveText(cs, i === 0 ? 'P2' : 'P1') : '';
    setText(doc.getElementById(i ? 'shotR' : 'shotL'), text || (shot ? formatShotLabel(shot.shot, shot.side) : ''), 'pop');
  });
  doc.getElementById('hud').textContent = sessions.map((s, i) => (s.status().connected ? '' : `Player ${i + 1}: open the phone link, tap Start, then Calibrate.\n`)).join('');
}

const WHY_FX = { out: 'Out', net: 'Into the net', miss: 'Missed', bounce: 'Double bounce', fault: 'Double fault' };

/** What to flash in the middle of the screen when a point has just been won; null if the score did not change.
 * prev: the last { pts, h, c, gh, gc } seen (pts = points played in total), st: core state. */
export function pointFx(prev, st, names = ['YOU', 'CPU']) {
  const pts = st.pointsHuman + st.pointsCpu;
  if (!prev || pts <= prev.pts) return null;
  const humanWon = st.pointsHuman > prev.h;
  const winner = humanWon ? names[0] : names[1];
  const gameWon = st.gamesH + st.gamesC !== prev.gh + prev.gc;
  const w = st.why;
  const why = w === 1 ? WHY_FX.out : w === 2 ? WHY_FX.net : w === 3 ? (humanWon ? `${names[1]} missed` : `${names[0] === 'YOU' ? 'You' : names[0]} missed`)
    : w === 4 ? WHY_FX.bounce : w === 5 ? WHY_FX.fault : '';
  const [a, b] = gameCalls(st.ptsH, st.ptsC);
  const score = gameWon ? `Games ${st.gamesH} - ${st.gamesC}` : a === 'Deuce' ? 'Deuce' : `${a} - ${b}`;
  const headline = st.matchOver ? 'Match' : gameWon ? 'Game' : names[0] === 'YOU' && humanWon ? 'Point!' : `${winner} point`;
  return { human: humanWon, headline: gameWon && !st.matchOver ? `Game ${winner}` : headline, why, score, game: gameWon };
}
