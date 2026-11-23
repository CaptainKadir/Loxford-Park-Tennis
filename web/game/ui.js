// HTML for the menus (strings only, so it can be tested without a browser).
import { CATS, ALL_CATS, SHIRTS } from './cats.js';
import { COURTS, TIMES } from './render/courts.js';
import { SETTINGS, GROUPS, CAT_COLUMNS } from './menu.js';
import { wardrobeHtml, careerHtml, practiceHtml } from './modeui.js';

const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A cat's face as an SVG, in its fur colours, with no shirt. */
export function catFace(cat, shirt = SHIRTS[0]) {
  const f = hex(cat.fur), s = hex(cat.stripe), b = hex(cat.belly), sh = hex(cat.fur);
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
  <path d="M18 120 Q60 84 102 120Z" fill="${sh}"/>
  <path d="M26 44 L34 8 L56 28Z M94 44 L86 8 L64 28Z" fill="${f}"/>
  <path d="M33 38 L36 18 L48 29Z M87 38 L84 18 L72 29Z" fill="#ffa6b8"/>
  <ellipse cx="60" cy="66" rx="42" ry="38" fill="${f}"/>
  <path d="M60 30 V44 M48 32 L50 44 M72 32 L70 44" stroke="${s}" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="60" cy="82" rx="18" ry="13" fill="${b}"/>
  <ellipse cx="44" cy="64" rx="6" ry="8" fill="#1c1426"/><ellipse cx="76" cy="64" rx="6" ry="8" fill="#1c1426"/>
  <circle cx="46" cy="61" r="2" fill="#fff"/><circle cx="78" cy="61" r="2" fill="#fff"/>
  <path d="M55 76 H65 L60 82Z" fill="#ffa6b8"/>
  <path d="M60 82 V86 M60 86 Q54 92 49 88 M60 86 Q66 92 71 88" stroke="#1c1426" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M30 78 L10 74 M30 84 L10 86 M90 78 L110 74 M90 84 L110 86" stroke="${b}" stroke-width="2" stroke-linecap="round"/>
</svg>`;
}

/** A court seen from above: surround, runoff, court, lines and net. */
export function courtThumb(c) {
  const line = hex(c.line);
  return `<svg viewBox="0 0 160 100" aria-hidden="true">
  <rect width="160" height="100" fill="${hex(c.ground)}"/>
  <rect y="22" width="160" height="12" fill="${hex(c.stripe)}"/><rect y="62" width="160" height="12" fill="${hex(c.stripe)}"/>
  <rect x="24" y="8" width="112" height="84" rx="3" fill="${hex(c.run)}"/>
  <rect x="34" y="14" width="92" height="72" fill="${hex(c.court)}"/>
  <g fill="none" stroke="${line}" stroke-width="1.6"><rect x="34" y="14" width="92" height="72"/><rect x="42" y="14" width="76" height="72"/><path d="M42 33 H118 M42 67 H118 M80 33 V67"/></g>
  <rect x="30" y="49" width="100" height="3" fill="#fff" opacity=".9"/>
</svg>`;
}

const svgi = (body) => `<svg class="ticon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const racket = (x, rot) => `<g transform="rotate(${rot} ${x} 24)"><ellipse cx="${x}" cy="15" rx="7" ry="9"/><path d="M${x} 24 V40"/></g>`;
const TITLE_ICONS = {
  play1: svgi(`${racket(24, 20)}<circle cx="38" cy="12" r="3" fill="currentColor"/>`),
  play2: svgi(`${racket(16, -20)}${racket(32, 20)}`),
  online: svgi('<circle cx="24" cy="24" r="15"/><path d="M9 24h30M24 9c-7 8-7 22 0 30M24 9c7 8 7 22 0 30"/>'),
  story: svgi('<path d="M8 38c8-6 8-14 16-14s8-10 16-16"/><circle cx="8" cy="38" r="3" fill="currentColor"/><circle cx="40" cy="8" r="3" fill="currentColor"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/>'),
  modes: svgi('<path d="M24 6l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z"/>'),
  tutorial: svgi('<path d="M6 18l18-8 18 8-18 8z"/><path d="M14 22v10c6 5 14 5 20 0V22"/>'),
  settings: svgi('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>'),
};
const MODE_ICONS = {
  daily: svgi('<rect x="7" y="10" width="34" height="30" rx="5"/><path d="M7 19h34M16 6v8M32 6v8"/><path d="M24 23l2.4 5 5.4.7-4 3.7 1 5.3-4.8-2.7-4.8 2.7 1-5.3-4-3.7 5.4-.7z" fill="currentColor"/>'),
  tourney: svgi('<path d="M15 8h18v12a9 9 0 0 1-18 0z"/><path d="M15 12H8c0 7 3 10 8 11M33 12h7c0 7-3 10-8 11M24 29v8M16 41h16M19 37h10"/>'),
  doubles: svgi('<ellipse cx="14" cy="14" rx="5" ry="7"/><path d="M14 21v8"/><ellipse cx="34" cy="14" rx="5" ry="7"/><path d="M34 21v8"/><path d="M6 40h36M6 34h36"/>'),
  party: svgi('<path d="M8 40l8-22 14 14z"/><path d="M20 22l8 8M13 33l7 7"/><circle cx="33" cy="12" r="2" fill="currentColor"/><circle cx="40" cy="22" r="2" fill="currentColor"/><path d="M26 10l2-4M36 30l5 1M30 20c3-4 7-5 10-4"/>'),
  practice: svgi('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6"/>'),
  wardrobe: svgi('<path d="M17 8l-10 6 4 8 5-2v20h16V20l5 2 4-8-10-6c-1 4-4 6-7 6s-6-2-7-6z"/>'),
  career: svgi('<path d="M8 40V8M8 40h34"/><rect x="14" y="26" width="6" height="10" rx="1"/><rect x="25" y="18" width="6" height="18" rx="1"/><rect x="36" y="10" width="6" height="26" rx="1"/>'),
  back: svgi('<path d="M30 10L16 24l14 14"/>'),
};
const SET_ICONS = {
  gameplay: svgi(`${racket(24, 20)}<circle cx="38" cy="12" r="3" fill="currentColor"/>`),
  sound: svgi('<path d="M8 18h8l10-8v28l-10-8H8z"/><path d="M33 17c3 4 3 10 0 14M38 12c6 7 6 17 0 24"/>'),
  visuals: svgi('<path d="M4 24c6-10 14-14 20-14s14 4 20 14c-6 10-14 14-20 14S10 34 4 24z"/><circle cx="24" cy="24" r="6"/>'),
  matchx: svgi('<path d="M10 24a14 14 0 1 0 5-11"/><path d="M8 6v9h9"/><path d="M21 18l9 6-9 6z" fill="currentColor"/>'),
};
/** A short line of what a settings group is set to right now (its first three values). */
export function groupSummary(group, S) {
  return SETTINGS.filter((x) => group.ids.includes(x.id)).slice(0, 3).map((x) => x.options[S[x.id]]).join(' \u00b7 ');
}
const MODE_SUB = { daily: 'New goal every day', tourney: 'Eight places, three wins', doubles: 'You and a partner, two on two', party: 'Rules change each game', practice: 'Targets and rallies, beat your best', wardrobe: 'Hats, collars, rackets, trails', career: 'Your record so far' };
const TITLE_SUB = { play1: 'vs the CPU', play2: 'one screen', online: 'with a friend', story: 'Beat the five rivals, then Professor Hoot', modes: 'Daily, tournament, party', tutorial: 'Learn to swing', settings: 'Sound, look, play' };
const TITLE_HELP = { play1: 'A quick match against the CPU.', play2: 'Two players side by side, one phone each.', online: 'Host a game or join a friend\'s over the internet.', story: 'A trail through Loxford Park, one rival at a time.', modes: 'Daily challenge, tournament, party mode, wardrobe and career.', tutorial: 'Lessons and practice with the CPU feeding you balls.', settings: 'Gameplay, sound, look and replays.' };

/** The logo mark as 8-bit pixel art: two rackets crossed (one red, one blue) over a bouncing ball, on a 40x40 grid of flat colours with hard edges. */
export function pixelMark() {
  const N = 40, g = Array.from({ length: N }, () => Array(N).fill('.'));
  const d = Math.SQRT1_2;
  // a racket: oval head, throat and striped grip. head = centre, sx = +1 handle runs down-right, -1 down-left; c = [light, mid, dark] frame letters
  const racket = (head, sx, c) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const qx = x + 0.5 - head[0], qy = y + 0.5 - head[1];
      const u = (sx * qx + qy) * d, v = (sx * qx - qy) * d; // u along the handle, v across it
      const e = (u / 8.6) ** 2 + (v / 6.6) ** 2;
      if (e <= 1) {
        if (e > 0.55) g[y][x] = v < -1.5 || u < -3 ? c[0] : v > 2.5 ? c[2] : c[1]; // lit from the upper left, shaded below
        else g[y][x] = (x + y) % 3 === 0 || (x - y + 60) % 3 === 0 ? 'w' : 'f'; // strings over a dark face
      } else if (u > 7.6 && u < 11 && Math.abs(v) < 2.0 - (u - 7.6) * 0.3) g[y][x] = c[1]; // throat
      else if (u >= 11 && u < 22 && Math.abs(v) < 1.6) g[y][x] = Math.floor((u - 11) / 2) % 2 ? 'G' : 'g'; // grip
      else if (u >= 22 && u < 23.5 && Math.abs(v) < 1.9) g[y][x] = c[2]; // butt cap
    }
  };
  racket([10, 10], +1, ['h', 'r', 'R']);
  racket([30, 10], -1, ['i', 'b', 'B']);
  // the ball, with two seams, a highlight, and speed lines under it
  const B = [20, 31], BR = 4.6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - B[0], dy = y + 0.5 - B[1], r = Math.hypot(dx, dy);
    if (r > BR) continue;
    const seam = Math.abs(Math.hypot(dx + 6.5, dy) - 5.6) < 0.7 || Math.abs(Math.hypot(dx - 6.5, dy) - 5.6) < 0.7;
    g[y][x] = seam ? 'w' : dx + dy > 3 ? 'Y' : dx + dy < -3.4 ? 'L' : 'y';
  }
  // outline every shape in the dark colour, then add sparkles and the speed lines (drawn after, so they stay clean)
  const out = g.map((row) => row.slice());
  const empty = (x, y) => x < 0 || y < 0 || x >= N || y >= N || g[y][x] === '.';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== '.' && (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1))) out[y][x] = 'k';
  }
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) out[y][x] = c; };
  for (const [x, y] of [[20, 2], [20, 3], [20, 4], [19, 3], [21, 3]]) put(x, y, 's'); // a plus-shaped sparkle between the heads
  for (const [x, y] of [[4, 25], [5, 25]]) put(x, y, 's');
  for (const [x, y] of [[35, 27], [34, 27], [35, 28]]) put(x, y, 's');
  for (const [x0, y, n] of [[11, 30, 5], [11, 33, 4], [28, 29, 4], [28, 32, 5]]) for (let k = 0; k < n; k++) put(x0 + k, y, 'm');
  const PAL = { k: '#1d1530', h: '#ffc2cf', r: '#ff5c7a', R: '#b3123f', i: '#bfe3ff', b: '#3aa0ff', B: '#1b5fb8', w: '#fff7e0', g: '#e8e8f0', G: '#9a9ab8', y: '#d8ff3a', L: '#f4ffa8', Y: '#9bc41a', f: '#2b2160', s: '#ffd166', m: '#8f86c8' };
  let rects = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; ) {
      const c = out[y][x];
      if (!PAL[c]) { x++; continue; }
      let k = x; while (k < N && out[y][k] === c) k++;
      rects += `<rect x="${x}" y="${y}" width="${k - x}" height="1" fill="${PAL[c]}"/>`;
      x = k;
    }
  }
  return `<svg class="mark pixel" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
const PIXEL_MARK = pixelMark();

// a rubber-stamp credit in the corner of the title page
const STAMP = '<div class="stamp" aria-label="Made by Captain Kadir"><span>Made by</span><b>Captain Kadir</b></div>';
const LOGO = `<div class="logo">
${PIXEL_MARK}
  <div class="l1">LOXFORD PARK</div><div class="l2"><i></i><span>TENNIS</span><i></i></div></div>`;

/** Who stands on each side of the select stage: P1 on the left, P2 or the CPU on the right; the cursor's side is live. */
export function selectSides(menu) {
  const m = menu.state, S = m.settings, hover = m.index;
  if (S.players === 2) return { left: { cat: hover, tag: 'YOU', live: true, shirt: 0 }, right: { cat: S.cat2, tag: 'FRIEND', live: false, shirt: 1 } };
  if (m.doubles) { // you, then your partner: the stage shows the two of you side by side
    return m.who === 0
      ? { left: { cat: hover, tag: 'YOU', live: true, shirt: 0 }, right: { cat: S.cat3 != null && S.cat3 !== hover ? S.cat3 : (hover + 1) % CATS.length, tag: 'PARTNER', live: false, shirt: 1 } }
      : { left: { cat: S.cat1, tag: 'YOU', live: false, shirt: 0 }, right: { cat: hover, tag: 'PARTNER', live: true, shirt: 1 } };
  }
  if (S.players !== 1) {
    const cpu = hover === S.cat2 ? (hover + 1) % CATS.length : S.cat2;
    return { left: { cat: hover, tag: 'P1', live: true, shirt: 0 }, right: { cat: cpu, tag: 'CPU', live: false, shirt: 1 } };
  }
  return m.who === 0
    ? { left: { cat: hover, tag: 'P1', live: true, shirt: 0 }, right: { cat: S.cat2, tag: 'P2', live: false, shirt: 1 } }
    : { left: { cat: S.cat1, tag: 'P1', live: false, shirt: 0 }, right: { cat: hover, tag: 'P2', live: true, shirt: 1 } };
}

/** Fighting-game style select: the 3D stage behind, big name plates on each side, the roster along the bottom. thumbs: optional pixel-art head pictures. */
function renderSelect(menu, two, thumbs) {
  const m = menu.state, S = m.settings;
  const slot = two || m.doubles ? m.who : 0;
  const hover = m.index;
  const { left, right } = selectSides(menu);
  const plate = (x, cls) => {
    const c = ALL_CATS[x.cat];
    return `<div class="plate ${cls}${x.live ? ' live' : ''}"><span class="tagp">${x.tag}</span><b key="${x.cat}">${esc(c.name)}</b><small>${esc(c.tag)}</small></div>`;
  };
  const roster = ALL_CATS.slice(0, menu.catCount()).map((c, i) => {
    const marks = [];
    if (i === hover) marks.push(`<i class="cur p${slot + 1}">P${slot + 1}</i>`);
    if ((two || m.doubles) && m.who === 1 && i === S.cat1) marks.push('<i class="cur p1 locked">P1</i>');
    const pic = thumbs?.[i] ? `<img src="${thumbs[i]}" alt="" draggable="false">` : catFace(c, SHIRTS[slot]);
    return `<button class="card tile${i === hover ? ' sel' : ''}" data-i="${i}" aria-label="${esc(c.name)}">${pic}${marks.join('')}</button>`;
  }).join('');
  const who = m.doubles ? (m.who === 0 ? 'You' : 'Your partner') : two ? `Player ${m.who + 1}` : 'You';
  const steps = m.online === 'join' ? `Joining game ${esc(m.joinCode)}` : m.doubles ? `Doubles &middot; step ${m.who + 1} of 3` : 'Step 1 of 2 &middot; cat';
  return `<div class="selhead"><h2>${esc(who)}: choose your cat</h2><div class="steps">${steps}</div></div>
    <div class="selbottom">${plate(left, 'left')}<div class="roster-wrap"><div class="grid roster" style="--cols:${CAT_COLUMNS}">${roster}</div></div>${plate(right, 'right')}</div><div class="vsmark">VS</div>`
    + hint('&larr; &rarr; choose &middot; Enter select &middot; Esc back');
}

const hint = (t) => `<div class="foot">${t}</div>`;

/** The whole menu overlay for the current screen. */
export function renderMenu(menu, extras = {}) {
  const m = menu.state, S = m.settings;
  const two = S.players === 1;
  if (m.screen === 'title') {
    const items = menu.titleItems();
    const card = (it, i) => `<button class="mbtn tcard t-${it.id}${i === m.index ? ' sel' : ''}" style="--n:${i}" data-i="${i}">${TITLE_ICONS[it.id] ?? ''}<span>${esc(it.label)}</span>${TITLE_SUB[it.id] ? `<small>${esc(TITLE_SUB[it.id])}</small>` : ''}</button>`;
    // the three ways to play on top, the story as a wide banner, and the rest as a row of smaller cards
    return `<div class="tfirst${extras.enter ? ' enter' : ''}">${LOGO}<div class="tgrid">${items.map(card).join('')}</div><p class="sethelp">${esc(TITLE_HELP[items[m.index]?.id] ?? '')}</p>${STAMP}</div>`
      + hint('&larr; &rarr; &uarr; &darr; choose &middot; Enter select &middot; swing the phone to confirm');
  }
  if (m.screen === 'online') {
    const items = menu.onlineItems();
    return `<h2>Play online</h2><div class="buttons">${items.map((it, i) => `<button class="mbtn${i === m.index ? ' sel' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('')}</div>`
      + `<p class="sethelp">${esc(items[m.index]?.help ?? '')}</p>` + hint('&uarr; &darr; choose &middot; Enter select &middot; Esc back');
  }
  if (m.screen === 'modes') {
    const items = menu.modeItems();
    const card = (it, i) => `<button class="mbtn mcard m-${it.id}${i === m.index ? ' sel' : ''}" data-i="${i}">${MODE_ICONS[it.id] ?? ''}<div class="mtxt"><span>${esc(it.label)}</span>${MODE_SUB[it.id] ? `<small>${esc(MODE_SUB[it.id])}</small>` : ''}</div></button>`;
    // the daily goal as a banner, the two big competitions side by side, the keepsakes below, and a small way back
    return `<h2>More modes</h2><div class="mgrid">${items.map(card).join('')}</div>`
      + `<p class="sethelp">${esc(items[m.index]?.help ?? '')}</p>` + hint('&larr; &rarr; &uarr; &darr; choose &middot; Enter select &middot; Esc back');
  }
  if (m.screen === 'wardrobe' && extras.progress) return wardrobeHtml(extras.progress, m.index);
  if (m.screen === 'practice') return practiceHtml(extras.practice, m.index);
  if (m.screen === 'career' && extras.progress) return careerHtml(extras.progress.career, extras.titles, extras.progress.history);
  if (m.screen === 'settings') {
    const items = menu.settingItems();
    const card = (it, i) => `<button class="mbtn scard${i === m.index ? ' sel' : ''}" data-i="${i}">${SET_ICONS[it.group] ?? ''}<div class="mtxt"><span>${esc(it.label)}</span><small>${esc(groupSummary(GROUPS.find((g) => g.id === it.group), S))}</small></div><i class="chev" aria-hidden="true">&rsaquo;</i></button>`;
    const small = (it, i) => `<button class="mbtn${it.id === 'reset' ? ' reset' : ' back'}${i === m.index ? ' sel' : ''}" data-i="${i}">${esc(it.label)}</button>`;
    return `<h2>Settings</h2><div class="slist">${items.filter((it) => it.group).map((it) => card(it, items.indexOf(it))).join('')}</div><div class="srow2">${items.filter((it) => !it.group).map((it) => small(it, items.indexOf(it))).join('')}</div>`
      + `<p class="sethelp">${esc(items[m.index]?.help ?? '')}</p>` + hint('&uarr; &darr; choose &middot; Enter open &middot; Esc back');
  }
  if (m.screen === 'group') {
    const items = menu.groupItems();
    const g = GROUPS.find((x) => x.id === m.group);
    return `<h2>${esc(g?.label ?? 'Settings')}</h2><div class="rows">${items.map((it, i) => {
      const sel = i === m.index ? ' sel' : '';
      if (!it.options) return `<button class="mbtn ${it.id === 'groupreset' ? 'reset' : 'back'}${sel}" data-i="${i}">${esc(it.label)}</button>`;
      const cur = S[it.id], n = it.options.length;
      // few choices: every one is shown and can be clicked; many (the volumes): a bar of notches
      const ctl = n <= 4
        ? `<span class="seg">${it.options.map((o, k) => `<button class="${k === cur ? 'on' : ''}" data-i="${i}" data-opt="${k}">${esc(o)}</button>`).join('')}</span>`
        : `<span class="notches" role="img" aria-label="${esc(it.options[cur])}">${it.options.map((o, k) => `<i style="--k:${k}" class="${k > 0 && k <= cur ? 'on' : ''}" data-i="${i}" data-opt="${k}"></i>`).join('')}</span><b class="nval">${esc(it.options[cur])}</b>`;
      return `<div class="row${sel}" data-i="${i}"><span>${esc(it.label)}</span><span class="val"><button data-act="left" data-i="${i}" aria-label="Previous">&#9664;</button>${ctl}<button data-act="right" data-i="${i}" aria-label="Next">&#9654;</button></span></div>`;
    }).join('')}</div><p class="sethelp">${esc(items[m.index]?.help ?? '')}</p>` + hint('&uarr; &darr; choose &middot; &larr; &rarr; change &middot; Esc back');
  }
  if (m.screen === 'cats') return renderSelect(menu, two, extras.thumbs);
  const cur = COURTS[m.index];
  return `<h2>Choose your court</h2><div class="steps">Step 2 of 2 &middot; court and time of day</div>
    <div class="grid courts">${COURTS.map((c, i) => `<button class="card wide${i === m.index ? ' sel' : ''}" data-i="${i}">${courtThumb(c)}<b>${esc(c.name)}</b>${c.venue !== c.name ? `<small class="venue">${esc(c.venue)}</small>` : ""}</button>`).join('')}</div>
    <div class="times">${TIMES.map((t, i) => `<button class="timebtn${i === S.time ? ' on' : ''}" data-time="${i}">${esc(t.name)}</button>`).join('')}</div>
    <p class="blurb">${esc(cur.blurb)}</p>` + hint('&larr; &rarr; court &middot; &uarr; &darr; time of day &middot; Enter play &middot; Esc back');
}
