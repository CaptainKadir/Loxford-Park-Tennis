// HTML for the lesson cards (strings only, so it can be tested without a browser).
import { LESSONS, LESSON_COUNT } from './lessons.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// the top of the phone page, with the emote button picked out: the cat-face button next to the settings cog
const PHONE_TOP = `<svg class="lphone" viewBox="0 0 220 74" aria-hidden="true">
  <rect x="1" y="1" width="218" height="72" rx="14" fill="#1b1530" stroke="#5a3fd6" stroke-width="2"/>
  <text x="14" y="32" fill="#ffd166" font-family="ui-monospace,monospace" font-weight="800" font-size="13">LOXFORD PARK</text>
  <text x="14" y="50" fill="#fff" font-family="ui-monospace,monospace" font-size="9" letter-spacing="3">TENNIS</text>
  <circle cx="132" cy="37" r="17" fill="#ffd166" opacity=".25"/><circle cx="132" cy="37" r="15" fill="#2a2147" stroke="#ffd166" stroke-width="2.5"/>
  <path d="M123 31 L125 25 L129 28 H135 L139 25 L141 31 Q143 38 138 42 Q132 46 126 42 Q121 38 123 31Z" fill="none" stroke="#ffd166" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="129" cy="35" r="1.2" fill="#ffd166"/><circle cx="135" cy="35" r="1.2" fill="#ffd166"/>
  <circle cx="190" cy="37" r="15" fill="#2a2147"/><circle cx="190" cy="37" r="4" fill="none" stroke="#b9a8ff" stroke-width="2"/><path d="M190 27 V30 M190 44 V47 M180 37 H183 M197 37 H200" stroke="#b9a8ff" stroke-width="2"/>
  <path d="M132 58 V66" stroke="#ffd166" stroke-width="2"/><path d="M127 63 L132 70 L137 63" fill="none" stroke="#ffd166" stroke-width="2"/>
</svg>`;

const ICON = {
  silent: '<svg viewBox="0 0 48 48"><path d="M24 7c-6 0-10 5-10 11v8l-4 6h28l-4-6v-8c0-6-4-11-10-11z" fill="#ffd166"/><circle cx="24" cy="40" r="4" fill="#ffd166"/><path d="M8 8L40 40" stroke="#ff6b6b" stroke-width="5" stroke-linecap="round"/></svg>',
  volume: '<svg viewBox="0 0 48 48"><path d="M7 19h8l10-8v26l-10-8H7z" fill="#ffd166"/><path d="M31 17q6 7 0 14M36 12q10 12 0 24" fill="none" stroke="#7cf2a6" stroke-width="4" stroke-linecap="round"/></svg>',
  flat: '<svg viewBox="0 0 48 48"><path d="M5 34l9-8h26l-9 8z" fill="#5b8dff"/><path d="M14 26h26" stroke="#fff" stroke-opacity=".4" stroke-width="2"/><path d="M24 6v14M18 12l6-6 6 6" fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
// where the swing goes, drawn as one arrow
const ARROW = {
  across: '<svg viewBox="0 0 64 40"><path d="M56 22H10M22 10L10 22l12 12" fill="none" stroke="#7cf2a6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'across-back': '<svg viewBox="0 0 64 40"><path d="M8 22h46M42 10l12 12-12 12" fill="none" stroke="#7cf2a6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 64 40"><path d="M8 34L52 8M36 6l17 2-6 16" fill="none" stroke="#7cf2a6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 64 40"><path d="M8 8l44 26M46 16l6 18-18 2" fill="none" stroke="#7cf2a6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  soft: '<svg viewBox="0 0 64 40"><path d="M12 28h30M34 18l10 10-10 10" fill="none" stroke="#7cf2a6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 9 22 99"/></svg>',
  scoop: '<svg viewBox="0 0 64 40"><path d="M8 12q4 26 30 22M30 22l12 12-4-18" fill="none" stroke="#7cf2a6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/** The card for lesson i; chips: [stroke, speed, screen] for the swing being shown (from lessonChips), if any. */
export function lessonHtml(i, chips = []) {
  const l = LESSONS[i];
  const dots = LESSONS.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('');
  const last = i === LESSON_COUNT - 1;
  const icons = l.icons ? `<div class="licons">${l.icons.map(([k, t]) => `<div>${ICON[k]}<span>${esc(t)}</span></div>`).join('')}</div>` : '';
  return `<div class="lbars"></div>
    <div class="lcard">
      <div class="lhead">${l.arrow ? `<span class="larrow">${ARROW[l.arrow]}</span>` : ''}<h3>${esc(l.title)}</h3><span class="lline">${esc(l.line)}</span></div>
      ${icons}${l.kind === 'emote' ? PHONE_TOP : ''}
      <div class="lchips">${chips.map((c) => `<b>${esc(c)}</b>`).join('')}</div>
      <div class="lfoot"><div class="ldots">${dots}</div><small>${i > 0 ? '&larr; ' : ''}Enter ${last ? '&rarr; practise' : '&rarr;'} &middot; Esc skip</small></div>
    </div>`;
}
