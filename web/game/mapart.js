// Illustrated backdrop for the story map: the park, a pond, a market, rooftops, a harbour and the clock tower,
// drawn as one SVG (viewBox 200 x 100, the same 2:1 shape as the map box, so stops line up with their art).
// Strings only, so it needs no browser. Each stop's picture is a group with a state class (done / now / lock).
import { STOPS } from './story.js';

const f = (n) => Math.round(n * 100) / 100;
const px = (stop) => [f(stop.x * 2), f(stop.y)]; // a stop's place in map units

// A smooth road through the stops (Catmull-Rom turned into cubic curves).
function roadPath(pts) {
  const p = [[-4, pts[0][1] + 8], ...pts];
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], e = p[Math.min(p.length - 1, i + 2)];
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return d;
}

const tree = (x, y, s = 1, c = '#2f8a4c') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="1.4" rx="3.2" ry="1" fill="#0b2a18" opacity=".35"/><rect x="-.5" y="-1" width="1" height="2.6" fill="#6b4a2b"/><circle cx="0" cy="-3.2" r="3.1" fill="${c}"/><circle cx="-1.5" cy="-2.2" r="2.2" fill="#256f3d"/><circle cx="1.2" cy="-4.4" r="1.8" fill="#4aa65f"/></g>`;
const pine = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-.4" y="0" width=".8" height="2" fill="#5a3d22"/><path d="M0 -7 L3 -2.6 H1.4 L3.6 .6 H-3.6 L-1.4 -2.6 H-3 Z" fill="#1f6b46"/><path d="M0 -7 L1.4 -4 L0 -3 Z" fill="#2f8a5c"/></g>`;
const bush = (x, y, s = 1, c = '#3f9b57') => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="2.6" ry="1.5" fill="${c}"/><ellipse cx="-1" cy="-.4" rx="1.4" ry="1" fill="#57b46c"/></g>`;
const flowers = (x, y, cols = ['#ff7a9c', '#ffd166', '#fff']) => cols.map((c, i) => `<circle cx="${f(x + i * 1.3 - 1.3)}" cy="${f(y + (i % 2) * .8)}" r=".55" fill="${c}"/>`).join('');

// ---- the six stops: each drawn around (0,0), the place on the road, with the picture sitting above it ----
const ART = {
  // a stone gateway with an iron arch, fence and lamps
  gate: () => `
    <ellipse cx="0" cy="1.2" rx="17" ry="2.2" fill="#0b2a18" opacity=".3"/>
    ${[-17, -14, -11, 11, 14, 17].map((x) => `<rect x="${x - .35}" y="-6" width=".7" height="7" fill="#2b3a52"/>`).join('')}
    <path d="M-19 -5.5 H-9 M9 -5.5 H19" stroke="#2b3a52" stroke-width=".8"/>
    <rect x="-9.5" y="-14" width="4.6" height="15" fill="#b9b2a2"/><rect x="4.9" y="-14" width="4.6" height="15" fill="#b9b2a2"/>
    <rect x="-10.2" y="-15.4" width="6" height="2" fill="#d4cdbc"/><rect x="4.2" y="-15.4" width="6" height="2" fill="#d4cdbc"/>
    <path d="M-9.5 -9 H-4.9 M-9.5 -5 H-4.9 M4.9 -9 H9.5 M4.9 -5 H9.5" stroke="#8d8676" stroke-width=".4"/>
    <path d="M-5 -12 Q0 -21 5 -12" fill="none" stroke="#1d2740" stroke-width="1.1"/>
    <path d="M-5 -12 Q0 -19.4 5 -12" fill="none" stroke="#1d2740" stroke-width=".5" stroke-dasharray=".6 .9"/>
    <rect x="-3.6" y="-15.6" width="7.2" height="2.6" rx=".6" fill="#ffd166" stroke="#7a4a12" stroke-width=".3"/>
    <path d="M-2.6 -14.3 H2.6" stroke="#7a4a12" stroke-width=".5" stroke-dasharray="1 .5"/>
    ${[-22, 22].map((x) => `<g transform="translate(${x} 0)"><rect x="-.3" y="-9" width=".6" height="9.5" fill="#1d2740"/><circle cx="0" cy="-10" r="1.5" fill="#ffe9a0"/><circle cx="0" cy="-10" r="3.2" fill="#ffe9a0" opacity=".22"/></g>`).join('')}
    ${flowers(-14, 2.4)}${flowers(14, 2.4, ['#ffd166', '#ff7a9c', '#fff'])}${flowers(-24, 4)}
    ${bush(-26, 0, .9)}${bush(26, 0, .9)}`,
  // a pond with lily pads, ducks, reeds and a willow
  pond: () => `
    <ellipse cx="2" cy="-4" rx="19" ry="10.5" fill="#7a6a3c"/>
    <ellipse cx="2" cy="-4.6" rx="17.6" ry="9.3" fill="#2f8fcf"/>
    <ellipse cx="0" cy="-5.2" rx="14" ry="6.6" fill="#4fb3e8" opacity=".7"/>
    <path d="M-9 -8 q2 -1 4 0 M3 -2 q2.4 -1 4.8 0 M-3 -1.4 q1.6 -.8 3.2 0 M8 -9 q1.6 -.8 3.2 0" stroke="#d7f1ff" stroke-width=".4" fill="none"/>
    ${[[-6, -6], [8, -4], [1, -1.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.2" fill="#3ea35a"/><path d="M${x} ${y} L${x + 2} ${y - .4}" stroke="#4fb3e8" stroke-width=".4"/><circle cx="${x - .4}" cy="${y - .5}" r=".6" fill="#ff8fb0"/>`).join('')}
    <g transform="translate(-1 -6)"><ellipse cx="0" cy="0" rx="2.3" ry="1.4" fill="#fff"/><circle cx="1.7" cy="-1.3" r="1" fill="#fff"/><path d="M2.5 -1.4 l1.2 .3 l-1.2 .4z" fill="#ff9a2e"/><circle cx="1.9" cy="-1.5" r=".18" fill="#111"/><path d="M-2 0 l-1 -.5" stroke="#ddd" stroke-width=".4"/></g>
    <g transform="translate(6 -7) scale(.8)"><ellipse cx="0" cy="0" rx="2.3" ry="1.4" fill="#ffe27a"/><circle cx="-1.7" cy="-1.3" r="1" fill="#ffe27a"/><path d="M-2.5 -1.4 l-1.2 .3 l1.2 .4z" fill="#ff9a2e"/><circle cx="-1.9" cy="-1.5" r=".18" fill="#111"/></g>
    ${[-17, -15.5, 18.5, 20].map((x, i) => `<path d="M${x} 0 q${i % 2 ? 1 : -1} -4 ${i % 2 ? .4 : -.4} -7" stroke="#5c8f3a" stroke-width=".5" fill="none"/><ellipse cx="${x + (i % 2 ? .4 : -.4)}" cy="-7.4" rx=".5" ry="1" fill="#6b4a2b"/>`).join('')}
    <g transform="translate(-19 -2)"><rect x="-.7" y="-4" width="1.4" height="7" fill="#6b4a2b"/><circle cx="0" cy="-7" r="5.2" fill="#6bbf5a"/><path d="M-5 -6 q-1 6 -1.6 9 M-2.6 -3 q-.4 5 -.8 8 M2.5 -3 q.6 5 .8 8 M5 -6 q1.2 5 1.6 8" stroke="#4a9a46" stroke-width=".7" fill="none"/></g>
    <g fill="#8a8f9c"><ellipse cx="14" cy="-.2" rx="1.6" ry=".9"/><ellipse cx="-12" cy="1" rx="1.2" ry=".7"/></g>`,
  // paved square, striped stalls, bunting, crates
  market: () => `
    <ellipse cx="0" cy="1" rx="22" ry="3" fill="#000" opacity=".22"/>
    <path d="M-21 1 L-17 -10 H17 L21 1 Z" fill="#d9c7a0"/>
    <path d="M-19 -3 H19 M-17.6 -7 H17.6 M-6 -10 L-8 1 M6 -10 L8 1 M0 -10 V1" stroke="#b8a37c" stroke-width=".35" fill="none"/>
    ${[[-12, '#e0524d'], [0, '#2f7fd0'], [12, '#f2a93b']].map(([x, c]) => `<g transform="translate(${x} 0)">
      <rect x="-4.2" y="-7" width="8.4" height="6" fill="#7a5230"/><rect x="-4.2" y="-3.2" width="8.4" height="1.2" fill="#9a6d3f"/>
      <path d="M-5.6 -9 L5.6 -9 L4.6 -12.6 H-4.6 Z" fill="${c}"/>
      ${[-3.3, -1.1, 1.1, 3.3].map((s, i) => `<path d="M${s} -12.6 h1.1 l.3 3.6 h-1.7 Z" fill="${i % 2 ? '#fff' : c}" opacity="${i % 2 ? .95 : 0}"/>`).join('')}
      <path d="M-5.6 -9 q1.4 1.4 2.8 0 q1.4 1.4 2.8 0 q1.4 1.4 2.8 0 q1.4 1.4 2.8 0" fill="${c}" stroke="${c}" stroke-width=".2"/>
      <circle cx="-2" cy="-3.9" r=".9" fill="#e8483b"/><circle cx="0" cy="-3.9" r=".9" fill="#ffd166"/><circle cx="2" cy="-3.9" r=".9" fill="#7ac74f"/></g>`).join('')}
    <path d="M-20 -14 Q-10 -10.5 0 -14 Q10 -10.5 20 -14" fill="none" stroke="#5b4a35" stroke-width=".4"/>
    ${Array.from({ length: 9 }, (_, i) => { const x = -18 + i * 4.5, y = -13.6 + Math.sin((i / 8) * Math.PI * 2) * -0 + (Math.abs(i - 4) < 4 ? Math.sin((i / 8) * Math.PI) * 2.6 : 0); return `<path d="M${f(x)} ${f(y - .2)} l1.6 0 l-.8 2z" fill="${['#ff7a9c', '#ffd166', '#6bd0ff'][i % 3]}"/>`; }).join('')}
    <g transform="translate(-19 1)"><rect x="-2" y="-3" width="4" height="3" fill="#a9763f"/><path d="M-2 -1.5 H2" stroke="#7a5230" stroke-width=".3"/></g>
    <g transform="translate(18.6 1)"><rect x="-2" y="-3.6" width="4" height="3.6" fill="#b8854a"/><path d="M-2 -1.8 H2 M0 -3.6 V0" stroke="#7a5230" stroke-width=".3"/></g>
    <g transform="translate(-5 -1.4)"><path d="M-1.6 0 q1.6 -1.6 3.2 0 q-1.6 1.6 -3.2 0z" fill="#7fb7e8"/><path d="M1.6 0 l1 -.9 v1.8z" fill="#7fb7e8"/></g>`,
  // a block of flats with a tennis court on its roof, water tank and skyline
  rooftop: () => `
    <ellipse cx="0" cy="1" rx="19" ry="2.4" fill="#000" opacity=".25"/>
    <rect x="-24" y="-13" width="9" height="14" fill="#6a7a99"/><rect x="15" y="-17" width="9" height="18" fill="#56688a"/>
    ${[-22, -19, 17, 20].flatMap((x) => [-9, -5, -1].map((y) => `<rect x="${x}" y="${y}" width="1.6" height="1.8" fill="#ffd978" opacity=".85"/>`)).join('')}
    <rect x="-15" y="-9" width="30" height="10" fill="#8aa0c4"/><rect x="-15" y="-9" width="30" height="1.4" fill="#a8bbd8"/>
    ${[-12, -7, -2, 3, 8, 13].flatMap((x) => [-6, -2].map((y) => `<rect x="${x}" y="${y}" width="2.4" height="2.2" fill="${(x + y) % 3 ? '#ffe39a' : '#3a4a6d'}"/>`)).join('')}
    <path d="M-17 -9 L-10 -17.6 H12 L19 -9 Z" fill="#3b7fbf"/><path d="M-17 -9 L-10 -17.6 H12 L19 -9 Z" fill="none" stroke="#fff" stroke-width=".4"/>
    <path d="M-9 -17.6 L-12.6 -9 M11 -17.6 L14.6 -9 M-14.6 -13.4 H16.6 M1 -17.6 V-9" stroke="#fff" stroke-width=".35" fill="none"/>
    <path d="M-1 -13.4 V-9" stroke="#fff" stroke-width=".35"/><rect x="-4" y="-14.6" width="8" height=".9" fill="#fff" opacity=".9"/>
    <g transform="translate(-13 -17)"><rect x="-1.4" y="-2" width="2.8" height="3" fill="#9a6d3f"/><ellipse cx="0" cy="-2" rx="1.4" ry=".5" fill="#b8854a"/><path d="M-1.6 -2 L0 -4 L1.6 -2z" fill="#6d4a2b"/><path d="M-1 1 L-1.6 3.5 M1 1 L1.6 3.5" stroke="#6d4a2b" stroke-width=".3"/></g>
    <rect x="9.6" y="-22" width="1.6" height="4.6" fill="#7a6a5a"/><rect x="9.2" y="-22.6" width="2.4" height=".8" fill="#5a4a3a"/>
    <path d="M18 -17 V-23 M16.4 -21.6 H19.6 M17 -19.6 H19" stroke="#2b3a52" stroke-width=".35"/>
    <path d="M-15 -9.6 Q-6 -6.6 2 -9.6 Q10 -6.6 17 -9.6" fill="none" stroke="#2b3a52" stroke-width=".3"/>
    ${Array.from({ length: 7 }, (_, i) => `<circle cx="${-13 + i * 4.4}" cy="${f(-8.8 + Math.sin(i * 1.05) * 1.1)}" r=".55" fill="${['#ff7a9c', '#ffd166', '#6bd0ff'][i % 3]}"/>`).join('')}`,
  // sea, a pier, boats, a lighthouse and a crane
  harbour: () => `
    <path d="M-24 -2 Q-12 -6 0 -2 T24 -2 V9 H-24 Z" fill="#2a6fb0" opacity=".0"/>
    <ellipse cx="2" cy="-1" rx="25" ry="10" fill="#2a77c0"/><ellipse cx="2" cy="-1" rx="22" ry="8" fill="#3d93d9" opacity=".7"/>
    <path d="M-16 -4 q2 -1 4 0 t4 0 M2 -7 q2 -1 4 0 t4 0 M6 2 q2 -1 4 0 t4 0 M-14 2 q2 -1 4 0 t4 0" stroke="#d7f1ff" stroke-width=".45" fill="none"/>
    <rect x="-22" y="-2" width="21" height="3.6" fill="#8a5d34"/><path d="M-22 -.6 H-1 M-22 .8 H-1" stroke="#6d4a2b" stroke-width=".3"/>
    ${[-20, -14, -8, -2].map((x) => `<rect x="${x}" y="1.6" width="1" height="2.4" fill="#5a3d22"/>`).join('')}
    <g transform="translate(-15 -2)"><rect x="-1.6" y="-3.6" width="3.2" height="3.6" fill="#b8854a"/><path d="M-1.6 -1.8 H1.6 M0 -3.6 V0" stroke="#7a5230" stroke-width=".3"/></g>
    <g transform="translate(-9 -2)"><ellipse cx="0" cy="-1.8" rx="1.6" ry="1.9" fill="#4a6fa5"/><path d="M-1.6 -2.4 H1.6" stroke="#2b3a52" stroke-width=".3"/></g>
    <g transform="translate(-4 -2)" stroke="#2b3a52" stroke-width=".4" fill="none"><path d="M0 0 V-9 L6 -9 M6 -9 V-6.4"/><path d="M0 -9 L-2.4 -7"/></g>
    <g transform="translate(9 -1)"><path d="M-6 1 L6 1 L4.4 4 H-4.4 Z" fill="#e0524d"/><path d="M-6 1 H6" stroke="#fff" stroke-width=".5"/><rect x="-.3" y="-10" width=".6" height="11" fill="#6d4a2b"/><path d="M.7 -10 L5 -1.2 H.7 Z" fill="#fff"/><path d="M-.7 -8 L-4.4 -1.2 H-.7 Z" fill="#f2e4c0"/></g>
    <g transform="translate(18 2) scale(.7)"><path d="M-6 1 L6 1 L4.4 4 H-4.4 Z" fill="#f2a93b"/><rect x="-.3" y="-7" width=".6" height="8" fill="#6d4a2b"/><path d="M.7 -7 L4 -.6 H.7 Z" fill="#fff"/></g>
    <g transform="translate(22 -8)"><path d="M-2.4 10 L-1.6 -8 H1.6 L2.4 10 Z" fill="#fff"/><path d="M-2.1 3 H2.1 L1.9 -.6 H-1.9 Z M-1.7 -5 H1.7 L1.6 -8 H-1.6 Z" fill="#e0524d"/><rect x="-2" y="-11" width="4" height="3" fill="#ffe9a0"/><path d="M-2.6 -11 L0 -14 L2.6 -11 Z" fill="#e0524d"/><path d="M2 -9.5 L16 -13 V-6 Z" fill="#ffe9a0" opacity=".28"/></g>
    <path d="M-6 -12 l1.2 -1 l1.2 1 M4 -15 l1.2 -1 l1.2 1 M13 -11 l1 -.8 l1 .8" stroke="#fff" stroke-width=".4" fill="none"/>`,
  // the clock tower on its rock, with a moon, bats and the owl on top
  roost: () => `
    <circle cx="-9" cy="-19" r="6" fill="#f4f1d6" opacity=".95"/><circle cx="-7" cy="-20" r="5" fill="#fff9dc" opacity=".5"/><circle cx="-9" cy="-19" r="11" fill="#f4f1d6" opacity=".12"/>
    <path d="M-17 2 L-11 -7 L-5 -3 L0 -9 L6 -4 L11 -8 L17 2 Z" fill="#3f4561"/><path d="M-11 -7 L-8.6 -4.2 L-12.6 -3.6 Z M0 -9 L2.4 -5.6 L-1.6 -5 Z M11 -8 L12.8 -4.4 L9.4 -4.2 Z" fill="#59608a"/>
    <rect x="-5.2" y="-26" width="10.4" height="28" fill="#8e8aa0"/><rect x="-5.2" y="-26" width="3" height="28" fill="#a6a2b8"/><rect x="2.2" y="-26" width="3" height="28" fill="#767290"/>
    <path d="M-5.2 -14 H5.2 M-5.2 -8 H5.2 M-5.2 -20 H5.2" stroke="#6f6b88" stroke-width=".35"/>
    <path d="M-7 -26 L0 -37 L7 -26 Z" fill="#4a3f72"/><path d="M0 -37 L2.6 -26 H7 Z" fill="#3a3160"/>
    <circle cx="0" cy="-20" r="3.7" fill="#f4eed2" stroke="#3a3160" stroke-width=".6"/><path d="M0 -20 V-22.4 M0 -20 L1.8 -19" stroke="#2b2342" stroke-width=".5"/>
    ${Array.from({ length: 4 }, (_, i) => `<path d="M${f(Math.cos(i * Math.PI / 2) * 3.1)} ${f(-20 + Math.sin(i * Math.PI / 2) * 3.1)} l${f(Math.cos(i * Math.PI / 2) * .5)} ${f(Math.sin(i * Math.PI / 2) * .5)}" stroke="#2b2342" stroke-width=".5"/>`).join('')}
    <path d="M-2 -6 V-10.4 Q0 -12.4 2 -10.4 V-6 Z" fill="#ffd36a"/><path d="M-1.6 -5.2 H1.6 V2 H-1.6 Z" fill="#3a3160"/>
    <g transform="translate(0 -38.4)"><ellipse cx="0" cy="0" rx="1.8" ry="2" fill="#5b4632"/><path d="M-1.6 -1.6 l-.4 -1.4 l1 .8 M1.6 -1.6 l.4 -1.4 l-1 .8" fill="#5b4632"/><circle cx="-.7" cy="-.4" r=".6" fill="#ffd23a"/><circle cx=".7" cy="-.4" r=".6" fill="#ffd23a"/><circle cx="-.7" cy="-.4" r=".22" fill="#111"/><circle cx=".7" cy="-.4" r=".22" fill="#111"/></g>
    ${[[-14, -28], [13, -24], [9, -33]].map(([x, y]) => `<path d="M${x} ${y} q1.4 -1.8 2.8 0 q1.4 -1.8 2.8 0 q-1.4 .8 -2.8 1 q-1.4 -.2 -2.8 -1z" fill="#1a1530"/>`).join('')}
    ${Array.from({ length: 5 }, (_, i) => `<circle cx="${f(-22 + i * 11 + (i % 2) * 3)}" cy="${f(-34 + (i % 3) * 2)}" r=".35" fill="#fff" opacity=".8"/>`).join('')}`,
};
const STOP_KEYS = ['gate', 'pond', 'market', 'rooftop', 'harbour', 'roost'];

/** The whole map picture. stage: how far the story has got (stops before it are done, it is "now", the rest "lock"). */
export function mapSvg(stage = 0) {
  const pts = STOPS.map(px);
  const road = roadPath(pts);
  // the sea (bottom right), the rocky hill (top right) and the city (top middle)
  const sea = 'M138 100 L138 80 Q146 72 156 78 Q168 84 178 76 Q190 70 200 74 V100 Z';
  const sand = 'M134 100 L134 79 Q146 69 157 75 Q169 81 178 73 Q190 67 200 71 V76 Q190 72 178 78 Q168 86 156 80 Q146 74 138 82 L138 100 Z';
  const stops = STOPS.map((s, i) => {
    const [x, y] = pts[i];
    const state = i < stage ? 'done' : i === stage ? 'now' : 'lock';
    return `<g class="art ${state}" data-stop="${STOP_KEYS[i]}" transform="translate(${x} ${f(y - 4)}) scale(${STOP_KEYS[i] === 'roost' ? 0.8 : 1.3})">${ART[STOP_KEYS[i]]()}</g>`;
  }).join('');
  const trees = [
    [6, 52, 1.2], [3, 60, 1], [22, 56, 1.1], [34, 66, 1], [40, 84, 1.2], [26, 90, 1], [60, 90, 1.1], [72, 82, 1], [70, 60, 1.1],
    [84, 44, 1], [96, 50, 1.2], [110, 56, 1], [112, 82, 1.1], [124, 70, 1], [10, 30, 1.3], [38, 20, 1.2], [20, 16, 1], [70, 22, 1.1],
    [82, 12, 1], [100, 30, 1.1], [150, 36, 1], [142, 50, 1.2], [160, 46, 1.1], [190, 50, 1.2], [180, 40, 1], [4, 92, 1.2],
  ].map(([x, y, s], i) => (i % 3 === 0 ? pine(x, y, s) : tree(x, y, s, i % 2 ? '#2f8a4c' : '#3a9a55'))).join('');
  const bushes = [[30, 76], [50, 56], [78, 70], [104, 66], [120, 48], [140, 62], [12, 44], [60, 30]].map(([x, y], i) => bush(x, y, 1 + (i % 2) * .3)).join('');
  return `<svg viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="mgrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c9a58"/><stop offset=".55" stop-color="#3d8a50"/><stop offset="1" stop-color="#2f7345"/></linearGradient>
      <pattern id="mstripe" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="6" height="12" fill="#fff" opacity=".045"/></pattern>
      <radialGradient id="msun" cx=".2" cy=".15" r=".7"><stop offset="0" stop-color="#fff6c8" stop-opacity=".35"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
      <linearGradient id="mdusk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0a0a30" stop-opacity=".5"/></linearGradient>
      <linearGradient id="mwater" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a9ad8"/><stop offset="1" stop-color="#1f5f9f"/></linearGradient>
    </defs>
    <rect width="200" height="100" fill="url(#mgrass)"/><rect width="200" height="100" fill="url(#mstripe)"/><rect width="200" height="100" fill="url(#msun)"/>
    <path d="M150 0 H200 V46 Q184 40 172 46 Q160 40 150 44 Z" fill="#434a6e"/><path d="M150 0 H200 V20 Q186 14 170 20 Q158 14 150 18 Z" fill="#59608a"/>
    <path d="M108 20 H140 V36 H108 Z M114 12 H126 V22 H114 Z M128 16 H138 V28 H128 Z" fill="#4d5d82" opacity=".85"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${110 + (i % 7) * 4.2}" y="${24 + Math.floor(i / 7) * 5}" width="1.6" height="2" fill="#ffd978" opacity=".7"/>`).join('')}
    <path d="${sand}" fill="#e8d29a"/><path d="${sea}" fill="url(#mwater)"/>
    <path d="M144 90 q3 -1.2 6 0 t6 0 M160 94 q3 -1.2 6 0 t6 0 M176 88 q3 -1.2 6 0 t6 0 M150 97 q3 -1.2 6 0 t6 0" stroke="#d7f1ff" stroke-width=".5" fill="none" opacity=".75"/>
    <path d="M30 100 Q34 84 46 78 Q60 72 58 58" fill="none" stroke="#4fb3e8" stroke-width="1.8" opacity=".85"/><path d="M30 100 Q34 84 46 78 Q60 72 58 58" fill="none" stroke="#d7f1ff" stroke-width=".3" stroke-dasharray="1.4 2"/>
    ${trees}${bushes}
    <path d="${road}" fill="none" stroke="#5a3d22" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${road}" fill="none" stroke="#d9b87c" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${road}" fill="none" stroke="#f1d9a2" stroke-width=".5" stroke-linecap="round" stroke-dasharray="1.6 2.2"/>
    ${flowers(26, 72)}${flowers(70, 52)}${flowers(118, 74, ['#fff', '#ff7a9c', '#ffd166'])}${flowers(100, 36)}${flowers(48, 14)}
    ${stops}
    <rect width="200" height="100" fill="url(#mdusk)"/>
    <g transform="translate(11 11)" opacity=".85"><circle r="5.2" fill="#0b1a30" opacity=".55"/><path d="M0 -4.6 L1.2 0 L0 4.6 L-1.2 0Z" fill="#ffd166"/><path d="M-4.6 0 L0 -1.2 L4.6 0 L0 1.2Z" fill="#e8eefc"/><circle r=".8" fill="#0b1a30"/></g>
  </svg>`;
}
