// Match statistics, worked out from the core's state as it changes: aces, winners, errors, first-serve %, longest rally and where
// your shots landed (a heat map of the CPU's half). Pure, so it is tested without a browser.
import { COURT } from './feel.js';

export const HEAT_COLS = 6, HEAT_ROWS = 8;
const WHY_OUT = 1, WHY_NET = 2, WHY_MISS = 3, WHY_BOUNCE = 4, WHY_FAULT = 5;

export function createStats() {
  const s = {
    pointsWon: 0, pointsLost: 0, aces: 0, winners: 0, forced: 0, errors: 0, doubleFaults: 0,
    serves: 0, faults: 0, longest: 0, rallyTotal: 0, rallies: 0, hits: 0,
    heat: Array.from({ length: HEAT_ROWS }, () => new Array(HEAT_COLS).fill(0)),
  };
  let prev = null, rally = 0, lastHitter = -1, cpuTouched = false, serveHits = 0;
  return {
    data: s,
    reset() { Object.assign(s, createStats().data); prev = null; rally = 0; lastHitter = -1; cpuTouched = false; serveHits = 0; },
    /** Call every frame with the core state. */
    push(cur) {
      if (!prev) { prev = cur; return; }
      // hits: the human's (cur.hits) and the CPU's / the other player's (cur.cpuHits)
      if (cur.hits > prev.hits) {
        rally++; lastHitter = 0; s.hits++;
        if (cur.hitSide === 0) { s.serves++; serveHits++; }
      }
      if (cur.cpuHits > prev.cpuHits) { rally++; lastHitter = 1; cpuTouched = true; }
      // first serve fault: the lab is waiting again on the second serve with a fault reason
      if (cur.labState === 0 && prev.labState !== 0 && cur.serveN === 2 && cur.why === WHY_FAULT) s.faults++;
      const pts = cur.pointsHuman + cur.pointsCpu, was = prev.pointsHuman + prev.pointsCpu;
      if (pts > was) {
        const won = cur.pointsHuman > prev.pointsHuman;
        if (won) s.pointsWon++; else s.pointsLost++;
        s.longest = Math.max(s.longest, rally);
        s.rallyTotal += rally; s.rallies++;
        const why = cur.why;
        if (won) {
          if (!cpuTouched && rally === 1 && serveHits > 0 && why !== WHY_FAULT) s.aces++; // the serve was never touched
          else if (why === WHY_MISS || why === WHY_BOUNCE) s.winners++; // the CPU could not reach or return it
          else s.forced++; // it hit the net or went out
        } else if (why === WHY_FAULT) { s.doubleFaults++; s.faults++; s.errors++; }
        else if (why === WHY_OUT || why === WHY_NET || why === WHY_MISS || why === WHY_BOUNCE) s.errors++;
        rally = 0; lastHitter = -1; cpuTouched = false; serveHits = 0;
      }
      prev = cur;
    },
    /** A landing mark of one of the human's shots on the CPU's half (z > 0). */
    landed(mark) {
      if (!mark || mark.z <= 0) return;
      const col = Math.min(HEAT_COLS - 1, Math.max(0, Math.floor(((COURT.halfW - mark.x) / (2 * COURT.halfW)) * HEAT_COLS))); // +x is the player's left, so flip it: your left is the picture's left
      const row = Math.min(HEAT_ROWS - 1, Math.max(0, Math.floor((mark.z / COURT.halfL) * HEAT_ROWS)));
      s.heat[row][col]++;
    },
    summary() { return summarise(s); },
  };
}

/** Plain numbers for the stats screen. */
export function summarise(s) {
  const played = s.pointsWon + s.pointsLost;
  const firstIn = s.serves > 0 ? Math.max(0, s.serves - s.faults) : 0;
  return {
    points: `${s.pointsWon} - ${s.pointsLost}`,
    pointsWon: s.pointsWon, pointsLost: s.pointsLost, played,
    aces: s.aces, winners: s.winners, forced: s.forced, errors: s.errors, doubleFaults: s.doubleFaults,
    servePct: s.serves > 0 ? Math.round((firstIn / s.serves) * 100) : null,
    longest: s.longest,
    avgRally: s.rallies > 0 ? Math.round((s.rallyTotal / s.rallies) * 10) / 10 : 0,
    heat: s.heat,
    heatMax: Math.max(0, ...s.heat.flat()),
  };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The heat map as an SVG of the CPU's half of the court, seen from behind your baseline (your left is on the left). */
export function heatSvg(heat) {
  const max = Math.max(1, ...heat.flat());
  const W = 180, H = 200, cw = W / HEAT_COLS, ch = H / HEAT_ROWS;
  let cells = '';
  for (let r = 0; r < HEAT_ROWS; r++) for (let c = 0; c < HEAT_COLS; c++) {
    const v = heat[r][c];
    if (!v) continue;
    // the net is the bottom edge, the CPU's baseline the top: row 0 is nearest the net, so draw it at the bottom
    cells += `<rect x="${c * cw}" y="${H - (r + 1) * ch}" width="${cw}" height="${ch}" fill="#ffd166" opacity="${(0.2 + 0.8 * (v / max)).toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Where your shots landed">`
    + `<rect width="${W}" height="${H}" fill="#2a4f8f"/>${cells}`
    + `<g fill="none" stroke="#fff" stroke-width="1.5"><rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}"/><path d="M0 ${H - (H * COURT.service) / COURT.halfL} H${W} M${W / 2} ${H - (H * COURT.service) / COURT.halfL} V${H}"/></g>`
    + `<rect y="${H - 3}" width="${W}" height="3" fill="#fff"/></svg>`;
}

/** The stats screen (the pause menu and the end of a match show it). names: [you, opponent]. */
export function statsHtml(sum, { title = 'Match stats', names = ['YOU', 'CPU'] } = {}) {
  const row = (label, value) => `<div class="strow"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const rows = [
    row('Points', sum.points),
    row('Aces', sum.aces),
    row('Winners', sum.winners),
    row('Won on an error', sum.forced),
    row('Your errors', sum.errors),
    row('Double faults', sum.doubleFaults),
    row('Serves in', sum.servePct == null ? '-' : `${sum.servePct}%`),
    row('Longest rally', `${sum.longest} hits`),
    row('Average rally', `${sum.avgRally} hits`),
  ].join('');
  return `<div class="sttitle">${esc(title)}</div><div class="stwho">${esc(names[0])} vs ${esc(names[1])}</div>`
    + `<div class="stbody"><div class="stcol">${rows}</div><div class="stcol stmap">${heatSvg(sum.heat)}<small>Where your shots landed</small></div></div>`;
}
