// Markup for the close-call review, the tournament bracket, the wardrobe and the career screen (strings only, so they are tested without a browser).
import { ALL_CATS } from './cats.js';
import { COURT, nearestLine, reviewMark } from './feel.js';
import { SLOTS, SLOT_NAMES, SLOT_LABEL, unlockedIn, isUnlocked, needText, historyStats } from './progress.js';
import { ROUNDS } from './tournament.js';
import { starText, PRACTICE } from './challenge.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** The close-call picture: the line, the court on one side and the run-off on the other, and the ball's mark, in a window 0.6 m across. */
export function hawkHtml(call, mark, { serve = false } = {}) {
  const m = reviewMark(mark, call.verdict, { serve });
  const n = nearestLine(m.x, m.z, { serve });
  const W = 0.6, S = 200 / W; // metres to svg units
  // which way the line runs, and where it sits: a sideline or centre line is vertical (x fixed), a baseline or service line horizontal (z fixed)
  const vertical = n.line === 'sideline' || n.line === 'centre line';
  const lineAt = n.line === 'sideline' ? Math.sign(m.x || 1) * COURT.halfW : n.line === 'baseline' ? Math.sign(m.z || 1) * COURT.halfL : n.line === 'service line' ? Math.sign(m.z || 1) * COURT.service : 0;
  const u = (vertical ? m.x : m.z) - lineAt, w = (vertical ? m.z : m.x); // across the line, along the line
  const px = 100 + u * S, along = 100; // the mark: u metres off the line, centred along it
  const inSide = (n.line === 'sideline' ? -Math.sign(lineAt) : n.line === 'baseline' ? -Math.sign(lineAt) : n.line === 'service line' ? -Math.sign(lineAt) : 0);
  const courtSide = vertical ? (inSide > 0 ? `<rect x="100" y="0" width="100" height="200" fill="#2a4f8f"/>` : `<rect x="0" y="0" width="100" height="200" fill="#2a4f8f"/>`) : (inSide > 0 ? `<rect x="0" y="100" width="200" height="100" fill="#2a4f8f"/>` : `<rect x="0" y="0" width="200" height="100" fill="#2a4f8f"/>`);
  const lw = 0.05 * S;
  const mx = vertical ? px : along, my = vertical ? along : px;
  const svg = `<svg viewBox="0 0 200 200" role="img" aria-label="Close call: ${esc(call.verdict)}"><rect width="200" height="200" fill="#3a7a4a"/>${courtSide}`
    + (vertical ? `<rect x="${100 - lw / 2}" y="0" width="${lw}" height="200" fill="#fff"/>` : `<rect x="0" y="${100 - lw / 2}" width="200" height="${lw}" fill="#fff"/>`)
    + `<ellipse cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" rx="${(0.075 * S).toFixed(1)}" ry="${(0.055 * S).toFixed(1)}" fill="#d8ff3a" stroke="#1a1030" stroke-width="2" transform="rotate(${vertical ? 0 : 90} ${mx.toFixed(1)} ${my.toFixed(1)})"/></svg>`;
  const cm = Math.max(0, Math.round(call.dist * 100));
  return `${svg}<div class="hv">${esc(call.verdict)}</div><small>${esc(call.line)}${cm ? ` · ${cm} cm` : ' · on the line'}</small>`;
}

/** The knock-out bracket: one column per round, your matches outlined. thumbs: optional cat head pictures. */
export function bracketHtml(t, thumbs = []) {
  const pic = (c) => (c < 0 ? '' : thumbs[c] ? `<span class="port"><img src="${thumbs[c]}" alt=""></span>` : '');
  const nm = (c) => (c < 0 ? 'bye' : ALL_CATS[c].name);
  const cols = ROUNDS.map((name, r) => {
    const round = t.rounds[r];
    const items = round ? round.map((m) => {
      const mine = m.a === t.hero || m.b === t.hero;
      const row = (c) => `<div class="bn${m.winner === c && c >= 0 ? ' w' : ''}${c === t.hero ? ' me' : ''}">${pic(c)}${esc(nm(c))}</div>`;
      return `<div class="bmatch${mine ? ' mine' : ''}">${row(m.a)}${row(m.b)}</div>`;
    }).join('') : [0, 1].slice(0, r === 1 ? 2 : 1).map(() => '<div class="bmatch"><div class="bn">?</div><div class="bn">?</div></div>').join('');
    return `<div class="col"><h4>${esc(name)}</h4>${items}</div>`;
  }).join('');
  return `<div class="bracket">${cols}</div>`;
}

/** A small picture of one cosmetic (collar, hat, headband, racket, ball skin or ball trail), drawn in the item's own colour. */
function itemArt(slot, it, locked) {
  const col = it.color != null ? hex(it.color) : null;
  const glow = it.glow ? ` filter="url(#wg)"` : '';
  let body;
  if (slot === 'collar') {
    const c = col ?? '#c9c4b8';
    body = `<circle cx="32" cy="34" r="17" fill="#f4a949" stroke="#3a2a1a" stroke-width="2.5"/>`
      + (col ? `<path d="M15 38q17 14 34 0v7q-17 14-34 0z" fill="${it.id === 'rainbow' ? 'url(#wr)' : c}" stroke="#3a2a1a" stroke-width="2.5" stroke-linejoin="round"${glow}/><circle cx="32" cy="50" r="3.2" fill="#ffd23a" stroke="#3a2a1a" stroke-width="1.5"/>`
        : `<path d="M20 40q12 8 24 0" fill="none" stroke="#3a2a1a" stroke-width="2" stroke-dasharray="3 4" opacity=".5"/>`);
  } else if (slot === 'racket') {
    const c = col ?? '#e8e2d2';
    body = `<g transform="rotate(35 32 32)"><rect x="29" y="38" width="6" height="20" rx="3" fill="#7a4a24" stroke="#3a2a1a" stroke-width="2"/>`
      + `<ellipse cx="32" cy="24" rx="13" ry="16" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="4.5"/><ellipse cx="32" cy="24" rx="13" ry="16" fill="none" stroke="#3a2a1a" stroke-width="1.5"/>`
      + `<path d="M32 9v30M22 14l20 20M42 14L22 34M20 24h24" stroke="#fff" stroke-opacity=".7" stroke-width="1"/></g>`;
  } else if (slot === 'hat') {
    const c = col ?? '#c9c4b8', ink = 'stroke="#3a2a1a" stroke-width="2" stroke-linejoin="round"';
    const head = '<circle cx="32" cy="42" r="15" fill="#f4a949" stroke="#3a2a1a" stroke-width="2.5"/><path d="M20 30l-3-10 9 5zM44 30l3-10-9 5z" fill="#f4a949" stroke="#3a2a1a" stroke-width="2"/>';
    const hats = {
      cap: `<path d="M17 34Q17 14 32 14Q47 14 47 34Z" fill="${c}" ${ink}/><path d="M40 33H60Q60 40 47 38Z" fill="#a8302b" ${ink}/><circle cx="32" cy="14" r="2.2" fill="#fff"/>`,
      party: `<path d="M32 4L46 36H18Z" fill="${c}" ${ink}/><circle cx="29" cy="22" r="2" fill="#fff"/><circle cx="35" cy="28" r="2" fill="#ffd23a"/><circle cx="26" cy="31" r="2" fill="#6bd0ff"/><circle cx="32" cy="5" r="4" fill="#fff" ${ink}/>`,
      wizard: `<ellipse cx="32" cy="35" rx="25" ry="6" fill="${c}" ${ink}/><path d="M32 3Q38 18 44 34H20Q27 18 32 3Z" fill="${c}" ${ink}/><path d="M24 30h16" stroke="#ffd23a" stroke-width="3"/><circle cx="31" cy="20" r="1.8" fill="#ffd23a"/><circle cx="35" cy="26" r="1.4" fill="#ffd23a"/>`,
      beanie: `<path d="M17 36Q17 12 32 12Q47 12 47 36Z" fill="${c}" ${ink}/><rect x="15" y="32" width="34" height="7" rx="3" fill="#fff" ${ink}/><circle cx="32" cy="10" r="5" fill="#fff" ${ink}/>`,
      tophat: `<rect x="8" y="33" width="48" height="6" rx="2" fill="${c}" ${ink}/><rect x="18" y="9" width="28" height="26" rx="2" fill="${c}" ${ink}/><rect x="18" y="26" width="28" height="6" fill="#e0524d"/>`,
      crown: `<path d="M13 36V14L23 25L32 9L41 25L51 14V36Z" fill="${c}" ${ink}${glow}/><circle cx="32" cy="31" r="2.6" fill="#e0524d"/><circle cx="21" cy="31" r="2" fill="#6bd0ff"/><circle cx="43" cy="31" r="2" fill="#7ac74f"/>`,
    };
    body = head + (hats[it.id] ?? '<path d="M18 22Q32 6 46 22" fill="none" stroke="#3a2a1a" stroke-width="2" stroke-dasharray="3 4" opacity=".5"/>');
  } else if (slot === 'headband') {
    const c = it.rainbow ? 'url(#wr)' : (col ?? '#c9c4b8');
    body = '<circle cx="32" cy="34" r="17" fill="#f4a949" stroke="#3a2a1a" stroke-width="2.5"/><path d="M19 24l-3-11 9 5zM45 24l3-11-9 5z" fill="#f4a949" stroke="#3a2a1a" stroke-width="2"/>'
      + (col ? `<path d="M15.5 27Q32 21 48.5 27V34Q32 28 15.5 34Z" fill="${c}" stroke="#3a2a1a" stroke-width="2" stroke-linejoin="round"${glow}/>` : '<path d="M17 30Q32 25 47 30" fill="none" stroke="#3a2a1a" stroke-width="2" stroke-dasharray="3 4" opacity=".5"/>')
      + '<circle cx="26" cy="38" r="1.8" fill="#1c1426"/><circle cx="38" cy="38" r="1.8" fill="#1c1426"/>';
  } else if (slot === 'ballskin') {
    const skins = {
      stripes: '<circle cx="32" cy="32" r="19" fill="#fff"/><path d="M14 26Q32 38 50 26M14 38Q32 50 50 38" stroke="#e0524d" stroke-width="5" fill="none"/>',
      stars: '<circle cx="32" cy="32" r="19" fill="#25356b"/><path d="M32 18l3 8 8 .5-6.3 5 2.3 8-7-4.7-7 4.7 2.3-8-6.3-5 8-.5z" fill="#ffd23a"/>',
      gold: '<circle cx="32" cy="32" r="19" fill="#e0a21f"/><path d="M18 26Q24 14 38 15" stroke="#fff3b0" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M16 38Q32 54 48 38" stroke="#b9770f" stroke-width="3" fill="none"/>',
      flame: '<circle cx="32" cy="32" r="19" fill="#ff6a1a"/><path d="M16 44Q20 30 25 36Q26 22 32 18Q33 30 40 28Q38 36 46 34Q46 46 32 50Q20 50 16 44Z" fill="#ffd23a"/><path d="M24 46Q28 36 32 40Q36 32 40 46Z" fill="#fff3b0"/>',
      moon: '<circle cx="32" cy="32" r="19" fill="#f1ecd2"/><circle cx="26" cy="26" r="4" fill="#c9c3a4"/><circle cx="38" cy="36" r="5" fill="#c9c3a4"/><circle cx="27" cy="40" r="2.5" fill="#c9c3a4"/>',
      disco: '<circle cx="32" cy="32" r="19" fill="#8e96aa"/>' + Array.from({ length: 16 }, (_, k) => `<rect x="${17 + (k % 4) * 8.5}" y="${17 + Math.floor(k / 4) * 8.5}" width="7" height="7" fill="${['#9fe8ff', '#ff9ad5', '#fff3b0', '#c9b6ff'][(k * 7) % 4]}" opacity=".85"/>`).join('') + '<circle cx="32" cy="32" r="19" fill="none" stroke="#3a2a1a" stroke-width="2"/>',
    };
    body = (skins[it.id] ?? '<circle cx="32" cy="32" r="19" fill="#d8ff3a"/><path d="M16 22Q30 32 16 42M48 22Q34 32 48 42" stroke="#fff" stroke-width="3" fill="none"/>') + '<circle cx="32" cy="32" r="19" fill="none" stroke="#3a2a1a" stroke-width="2.5"/>';
  } else {
    const c = it.rainbow ? 'url(#wr)' : (col ?? '#bbb');
    body = it.id === 'none'
      ? `<circle cx="46" cy="32" r="8" fill="#e6ff4a" stroke="#3a2a1a" stroke-width="2"/><path d="M8 32h24" stroke="#3a2a1a" stroke-width="2" stroke-dasharray="3 4" opacity=".5"/>`
      : `<path d="M8 38q12-6 24-6t14 0" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none" opacity=".45"/><path d="M14 34q10-4 20-2" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"/>`
        + `<circle cx="20" cy="26" r="2" fill="${c}"/><circle cx="30" cy="42" r="1.6" fill="${c}"/><circle cx="46" cy="32" r="8" fill="#e6ff4a" stroke="#3a2a1a" stroke-width="2"/>`;
  }
  return `<svg class="wart" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="wr" x1="0" x2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".33" stop-color="#ffd23a"/><stop offset=".66" stop-color="#4dd2ff"/><stop offset="1" stop-color="#c04dff"/></linearGradient>`
    + `<filter id="wg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${body}</svg>`;
}

/** The wardrobe: a row of picture tiles for each slot. Locked ones are dimmed with their goal; tap a tile to wear it. */
export function wardrobeHtml(p, index = 0) {
  const rows = SLOT_NAMES.map((slot, i) => {
    const tiles = SLOTS[slot].map((it, k) => {
      const open = isUnlocked(p.career, it), on = p.equip[slot] === it.id || (!p.equip[slot] && k === 0);
      return `<button class="wtile${on ? ' on' : ''}${open ? '' : ' locked'}" data-i="${i}" data-pick="${i}:${k}" aria-label="${esc(it.name)}${open ? '' : ` (locked: ${esc(needText(it.need))})`}" aria-pressed="${on}">`
        + `${itemArt(slot, it, !open)}<span class="wn">${esc(it.id === 'none' ? 'None' : it.name.replace(/ (collar|racket|trail|headband|ball)$/i, ''))}</span>${open ? '' : `<span class="wlock">&#128274;<small>${esc(needText(it.need))}</small></span>`}</button>`;
    }).join('');
    return `<div class="wrow${i === index ? ' sel' : ''}" data-i="${i}"><h3>${esc(SLOT_LABEL[slot])}</h3><div class="wtiles">${tiles}</div></div>`;
  }).join('');
  const capSlot = SLOT_NAMES[Math.min(index, SLOT_NAMES.length - 1)], capItem = SLOTS[capSlot].find((x) => x.id === p.equip[capSlot]) ?? SLOTS[capSlot][0];
  const capName = capItem.name, capNote = 'Wearing now';
  const total = SLOT_NAMES.reduce((n, s) => n + SLOTS[s].length, 0), got = SLOT_NAMES.reduce((n, s) => n + unlockedIn(p.career, s).length, 0);
  return `<h2>Wardrobe</h2><div class="steps">${got} of ${total} unlocked</div>`
    + `<div class="wlayout"><div class="wpreview" aria-hidden="true"><div class="wcap"><b>${esc(capName)}</b><small>${esc(capNote)}</small></div></div>`
    + `<div class="rows wardrobe">${rows}<button class="mbtn back${index === SLOT_NAMES.length ? ' sel' : ''}" data-i="${SLOT_NAMES.length}">Back</button></div></div>`
    + '<div class="foot">Tap to wear &middot; point to preview &middot; &uarr; &darr; &larr; &rarr; change &middot; Esc back</div>';
}

/** Career: a win-rate ring, a tile for each number, bars toward the next cosmetics, and the tournament titles. */
export function careerHtml(career, titles = {}, history = [], now = Date.now()) {
  const n = (v) => Number(v).toLocaleString('en');
  const rate = career.matches ? career.wins / career.matches : 0, R = 34, C = 2 * Math.PI * R;
  const ring = `<div class="cring" role="img" aria-label="Won ${career.wins} of ${career.matches} matches"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9"/>`
    + `${rate ? '' : '<!--'}<circle cx="40" cy="40" r="${R}" fill="none" stroke="#ffd166" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(C * rate).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/>${rate ? '' : '-->'}</svg>`
    + `<b>${career.matches ? Math.round(rate * 100) : '–'}${career.matches ? '<small>%</small>' : ''}</b><span>win rate</span></div>`;
  const tile = (icon, v, l) => `<div class="ctile"><i aria-hidden="true">${icon}</i><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
  const tiles = [
    tile('&#127934;', n(career.matches), 'matches'), tile('&#127942;', n(career.wins), 'wins'), tile('&#9889;', n(career.aces), 'aces'), tile('&#127919;', n(career.winners), 'winners'),
    tile('&#128257;', n(career.rally), 'longest rally'), tile('&#128293;', n(career.streak), 'daily streak'), tile('&#128197;', n(career.daily), 'dailies beaten'), tile('&#128062;', n(career.story), 'stories done'),
  ].join('');
  // the closest locked cosmetics: how far each goal has come
  const goals = [];
  for (const slot of SLOT_NAMES) for (const it of SLOTS[slot]) {
    if (isUnlocked(career, it)) continue;
    const fr = Object.entries(it.need).reduce((m, [k, v]) => Math.min(m, Math.min(1, (career[k] ?? 0) / v)), 1);
    goals.push({ it, slot, fr });
  }
  goals.sort((a, b) => b.fr - a.fr);
  const next = goals.slice(0, 3).map(({ it, slot, fr }) => `<div class="cgoal"><div class="cgt"><span>${esc(it.name)}</span><small>${esc(needText(it.need))}</small></div><div class="cbar"><i style="width:${Math.max(3, Math.round(fr * 100))}%"></i></div></div>`).join('');
  const champs = Object.entries(titles).map(([c, k]) => `<span class="cchip">&#127942; ${esc(ALL_CATS[c]?.name ?? '?')}${k > 1 ? ` ×${k}` : ''}</span>`).join('');
  const hs = historyStats(history), ago = (t) => { const d = Math.floor((now - t) / 864e5); return !t ? '' : d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  const MODE_LABEL = { match: 'Match', party: 'Party', story: 'Story', tourney: 'Tournament', daily: 'Daily', online: 'Online' };
  const spark = hs.rate.length > 1
    ? `<svg class="cspark" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label="Win rate over your last ${hs.rate.length} matches"><path d="M0 18 H100" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 3" fill="none"/><polyline fill="none" stroke="#ffd166" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${hs.rate.map((r, i) => `${((i / (hs.rate.length - 1)) * 100).toFixed(1)},${(34 - r * 32).toFixed(1)}`).join(' ')}"/></svg>`
    : '';
  const rows = hs.recent.slice(0, 5).map((h) => `<div class="crow ${h.won ? 'w' : 'l'}"><b>${h.won ? 'W' : 'L'}</b><span>${h.score[0]}&ndash;${h.score[1]} vs ${esc(ALL_CATS[h.rival]?.name ?? '?')}</span><small>${MODE_LABEL[h.mode] ?? 'Match'}${h.at ? ` &middot; ${ago(h.at)}` : ''}</small></div>`).join('');
  const historyBox = hs.recent.length
    ? `<div class="cbox"><h3>Recent matches <b>${hs.streak > 1 ? `${hs.streak} in a row` : ''}</b></h3><div class="cform">${hs.form.map((f) => `<i class="${f === 'W' ? 'w' : 'l'}">${f}</i>`).join('')}${spark}</div><div class="crows">${rows}</div></div>`
    : '<div class="cbox"><h3>Recent matches</h3><div class="cnone">Play a match and it shows up here.</div></div>';
  return `<h2>Career</h2><div class="career"><div class="chead">${ring}<div class="ctiles">${tiles}</div></div>${historyBox}`
    + `<div class="cbox"><h3>Tournament titles <b>${n(career.tourney)}</b></h3><div class="cchips">${champs || '<span class="cnone">None yet</span>'}</div></div>`
    + `${next ? `<div class="cbox"><h3>Closest unlocks</h3>${next}</div>` : ''}</div>`
    + '<div class="foot">Enter or Esc: back</div>';
}

/** The result card after a daily challenge. */
export function dailyEndHtml(run, stars, { date = '', best = 0, streak = 0 } = {}) {
  return `<div class="sttitle">${run.won ? 'Challenge beaten!' : 'Not this time'}</div><div class="stwho">${esc(run.def.name)} · ${esc(date)}</div>`
    + `<div class="sttitle" style="font-size:clamp(30px,7vw,64px)">${starText(stars)}</div><div class="stwho">${esc(run.note)}</div>`
    + `<div class="stwho">${best ? `Best today ${starText(best)}` : ''}${streak > 1 ? ` · ${streak}-day streak` : ''}</div>`
    + '<div class="sthint">Enter: back to the menu &middot; C: copy to share &middot; R: try again</div>';
}

/** The practice screen: the two games with your best score on each. best: { [id]: score }. */
export function practiceHtml(best = {}, index = 0) {
  const card = (def, i, icon, sub) => `<button class="mbtn pcard${i === index ? ' sel' : ''}" data-i="${i}"><i aria-hidden="true">${icon}</i><div class="mtxt"><span>${esc(def.name)}</span><small>${esc(sub)}</small></div><b class="pbest">${best[def.id] ? `Best ${best[def.id]}` : 'No score yet'}</b></button>`;
  return `<h2>Practice</h2><div class="steps">Beat your own best</div><div class="rows">`
    + card(PRACTICE[0], 0, '&#127919;', 'Ten balls, hit the rings') + card(PRACTICE[1], 1, '&#128257;', 'Keep a rally alive, three lives')
    + `<button class="mbtn back${index === 2 ? ' sel' : ''}" data-i="2">Back</button></div><div class="foot">&uarr; &darr; choose &middot; Enter play &middot; Esc back</div>`;
}
/** After a practice game: the score, the best, and whether it is a new one. */
export function practiceEndHtml(run, { best = 0, isNew = false } = {}) {
  const score = run.def.id === 'practice-rally' ? run.best : run.score;
  return `<div class="sttitle">${esc(run.def.name)}</div><div class="sttitle" style="font-size:clamp(40px,10vw,96px)">${score}</div>`
    + `<div class="stwho">${esc(run.note)}</div><div class="stwho">${isNew ? 'New best!' : `Best ${best}`}</div>`
    + '<div class="sthint">Enter: back to the menu &middot; R: play again</div>';
}
