// HTML for the story screens (strings only, so it can be tested without a browser):
// the trail map, the talk before a match, and the ending.
import { ALL_CATS } from './cats.js';
import { STOPS, STAGES, rivalFor, premiseFor, endingFor } from './story.js';
import { mapSvg } from './mapart.js';
import { rewardFor, SLOT_LABEL } from './progress.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const LEVEL_NAMES = ['Easy', 'Medium', 'Hard', 'Boss'];

/** A small round portrait: the pixel-art head if there is one, else a plain disc in the cat's fur colour. */
export function portrait(catIndex, thumbs, cls = '') {
  const c = ALL_CATS[catIndex % ALL_CATS.length];
  const inner = thumbs?.[catIndex] ? `<img src="${thumbs[catIndex]}" alt="" draggable="false">` : `<i style="background:${hex(c.fur)}"></i>`;
  return `<span class="port ${cls}" aria-hidden="true">${inner}</span>`;
}

/** The panel under the map for the stop picked (sel: a finished stop to replay, or -1 for the next stop / the ending). */
export function stopPanelHtml({ hero, stage, sel = -1, thumbs, retry = false }) {
  const prem = premiseFor(hero), replay = sel >= 0 && sel < stage;
  if (stage >= STAGES && !replay) return `<div class="spanel"><div><h3>The end</h3><p>${esc(endingFor(hero))}</p></div><small class="go">Enter: play the story again &middot; click a stop to replay it &middot; Esc: menu</small></div>`;
  const i = replay ? sel : stage, rival = rivalFor(hero, i), stop = STOPS[i], reward = rewardFor(i);
  return `<div class="spanel">${portrait(rival, thumbs, 'lg')}<div><h3>${esc(stop.name)}${replay ? ' <em>replay</em>' : ''}</h3>
      <p>${esc(ALL_CATS[rival].name)} &middot; ${esc(ALL_CATS[rival].tag)}</p>
      <small>${esc(LEVEL_NAMES[stop.level])} &middot; first to ${stop.games} games${i === 0 && !replay ? ' &middot; ' + esc(prem.title) : ''}${replay ? ' &middot; no new progress' : ''}</small>${reward ? `<small class="srew">${i < stage ? '&#10003; ' : '&#127873; '}Reward: ${esc(reward.item.name)} (${esc(SLOT_LABEL[reward.slot])})</small>` : ''}</div>
      <small class="go">Enter: ${replay ? 'replay this stop' : retry ? 'try again' : 'to the court'} &middot; ${stage > 0 ? 'click a finished stop to replay it &middot; ' : ''}Esc: menu</small></div>`;
}

/**
 * The trail map. stage: the next match to play (STAGES = story finished). from: where the token was
 * (for the walk animation after a win; omit for no animation). sel: a finished stop picked to replay (-1: none).
 */
export function mapHtml({ hero, stage, from = stage, thumbs, note = '', retry = false, sel = -1 }) {
  const done = stage >= STAGES;
  const at = (i) => STOPS[Math.min(i, STAGES - 1)];
  const nodes = STOPS.map((s, i) => {
    const state = i < stage ? 'done' : i === stage ? 'now' : 'lock';
    const boss = i === STAGES - 1 ? ' boss' : '';
    const rival = rivalFor(hero, i);
    return `<div class="node ${state}${boss}${i === sel ? ' sel' : ''}" data-stop="${i}" style="left:${s.x}%;top:${s.y}%"><b>${i < stage ? '✓' : i + 1}</b><span>${esc(s.name)}</span>${state === 'lock' && i < STAGES - 1 ? '' : portrait(rival, thumbs, 'sm')}</div>`;
  }).join('');
  const p0 = at(from), cur = at(stage);
  const token = `<div class="token" data-to="${cur.x},${cur.y}" style="left:${p0.x}%;top:${p0.y}%">${portrait(hero, thumbs, 'tk')}</div>`;
  const prem = premiseFor(hero);
  return `<div class="storymap"><div class="shead"><h2>${esc(ALL_CATS[hero].name)}'s story</h2><div class="steps">${esc(prem.title)}</div></div>
    <div class="trail">${mapSvg(stage)}<canvas class="trail3d" aria-hidden="true"></canvas>${nodes}${token}</div>
    ${note || (stage === 0 && !done) ? `<div class="snote">${esc(note || prem.text)}</div>` : ''}${stopPanelHtml({ hero, stage, sel, thumbs, retry })}</div>`;
}

/** The talk before a match: the 3D scene fills the screen; this is the title and the line in a box (the page types the text in). */
export function talkHtml({ lines, i, stop }) {
  const l = lines[Math.min(i, lines.length - 1)];
  return `<div class="talkbars"></div>
    <div class="talktitle">${esc(stop.name)}<small>Match ${STOPS.indexOf(stop) + 1} of ${STAGES}</small></div>
    <div class="talkbox ${l.mine ? 'l' : 'r'}"><b>${esc(l.name)}</b><p data-full="${esc(l.text)}"></p><small>${i + 1} / ${lines.length} &middot; Enter / swing: next &middot; Esc: skip</small></div>`;
}

/** The boss's entrance before the last talk: a dark sky, a moon, the owl's silhouette and two eyes that open, then his name. */
export function bossIntroHtml(hero) {
  return `<div class="bi-sky"><div class="bi-moon"></div>${Array.from({ length: 22 }, (_, i) => `<i class="bi-star" style="left:${(i * 37) % 100}%;top:${(i * 53) % 55}%;animation-delay:${(i % 7) * 0.35}s"></i>`).join('')}</div>
    <svg class="bi-owl" viewBox="0 0 200 220" aria-hidden="true"><path d="M20 200 H180" stroke="#1a1230" stroke-width="10" stroke-linecap="round"/>
      <path d="M100 40 C60 40 38 76 38 120 C38 168 66 198 100 198 C134 198 162 168 162 120 C162 76 140 40 100 40Z" fill="#120d24"/>
      <path d="M52 62 L44 22 L80 48Z M148 62 L156 22 L120 48Z" fill="#120d24"/>
      <g class="bi-eyes"><circle cx="76" cy="100" r="19" fill="#ffd23a"/><circle cx="124" cy="100" r="19" fill="#ffd23a"/><circle cx="76" cy="100" r="8" fill="#120d24"/><circle cx="124" cy="100" r="8" fill="#120d24"/></g>
      <path d="M100 112 L92 132 L108 132Z" fill="#f0a020"/></svg>
    <div class="bi-name">Professor Hoot<small>The Midnight Owl &middot; ${esc(ALL_CATS[hero % ALL_CATS.length].name)}, this is the last match</small></div>
    <div class="bi-skip">Press any key</div>`;
}
