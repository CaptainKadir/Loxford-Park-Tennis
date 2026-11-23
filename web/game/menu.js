// Menus as a small state machine, pure so it can be tested without a DOM.
// Screens: title -> (cats -> court -> launch) | tutorial | settings.
import { CATS, ALL_CATS } from './cats.js';
import { SLOT_NAMES } from './progress.js';
import { COURTS, TIMES } from './render/courts.js';

const PERCENTS = Array.from({ length: 11 }, (_, i) => `${i * 10}%`);
export const SETTINGS = [
  { id: 'level', label: 'CPU level', options: ['Easy', 'Medium', 'Hard'], help: 'How well the CPU plays. Easy misses more and hits softer.' },
  { id: 'ball', label: 'Ball', options: ['Real', 'Fast'], help: 'Real is true tennis physics. Fast is a heavier, quicker arcade ball.' },
  { id: 'shots', label: 'Shots', options: ['Basic', 'All'], help: 'Basic: forehand, backhand and lob. All adds topspin, slice and drop shot.' },
  { id: 'hand', label: 'Hand', options: ['Right', 'Left'], help: 'Which hand holds the racket. Takes effect when a new match loads.' },
  { id: 'assist', label: 'Assist', options: ['Off', 'On'], help: 'On gives a wider timing window and a longer reach, so returns are easier.' }, // easier returns: wider timing window, longer reach
  { id: 'aim', label: 'Aim assist', options: ['Normal', 'Strong'], help: 'Strong nudges your shots harder toward the court so more stay in.' }, // Strong: a wider nudge so more shots stay in the court
  { id: 'weather', label: 'Weather', options: ['Clear', 'Rain', 'Windy'], help: 'Rain or wind for the look and the sound. It never changes the ball: the physics stays the same.' },
  { id: 'sfxVol', label: 'Effects volume', options: PERCENTS, help: 'How loud the hits, bounces, crowd and voices are.' },
  { id: 'musicVol', label: 'Music volume', options: PERCENTS, help: 'How loud the music is.' },
  { id: 'shake', label: 'Screen shake', options: ['On', 'Off'], help: 'Off keeps the camera still on hard hits. It starts Off if your system asks for reduced motion.' },
  { id: 'impact', label: 'Impact effects', options: ['On', 'Off'], help: 'A brief hold of the pose and a camera punch on big hits.' },
  { id: 'ballcol', label: 'Ball colour', options: ['Yellow', 'Orange', 'Pink', 'Cyan'], help: 'Pick the colour that stands out most for you. The burning ball glows over any of them.' },
  { id: 'calls', label: 'Close-call review', options: ['On', 'Off'], help: 'A zoomed look at the landing mark when a ball lands within a hand of a line. C reviews the last call.' },
  { id: 'autoreplay', label: 'Auto replay', options: ['On', 'Off'], help: 'Replays match point and the winner of a burning-ball rally by itself (one player only).' },
];
/** The settings are filed under four headings so no screen is a long list. */
export const GROUPS = [
  { id: 'gameplay', label: 'Gameplay', help: 'CPU level, ball, shots, hand, and the helpers.', ids: ['level', 'ball', 'shots', 'hand', 'assist', 'aim'] },
  { id: 'sound', label: 'Sound', help: 'Effects and music volume.', ids: ['sfxVol', 'musicVol'] },
  { id: 'visuals', label: 'Look & feel', help: 'Weather, ball colour, screen shake and impact effects.', ids: ['weather', 'ballcol', 'shake', 'impact'] },
  { id: 'matchx', label: 'Replays & calls', help: 'Close-call review and automatic replays.', ids: ['calls', 'autoreplay'] },
];
export const groupOf = (settingId) => GROUPS.find((g) => g.ids.includes(settingId))?.id;
export const DEFAULTS = { players: 0, cat1: 0, cat2: 1, court: 1, time: 1, level: 1, ball: 0, shots: 1, hand: 0, assist: 1, aim: 1, weather: 0, sfxVol: 8, musicVol: 5, shake: 0, impact: 0, ballcol: 0, calls: 0, autoreplay: 0 };
const LIMITS = { players: 3, cat3: CATS.length, cat4: CATS.length, ...Object.fromEntries(SETTINGS.map((s) => [s.id, s.options.length])), cat1: ALL_CATS.length, cat2: ALL_CATS.length, court: COURTS.length, time: TIMES.length };
export const CAT_COLUMNS = 3;

/** Doubles: the two CPU opponents, the first cats (after yours) that neither you nor your partner are. */
export function doublesLineup(cat1, cat3) {
  const n = CATS.length, out = [];
  for (let k = 1; k < n && out.length < 2; k++) { const c = (cat1 + k) % n; if (c !== cat1 && c !== cat3) out.push(c); }
  return { cat2: out[0], cat4: out[1] };
}

/** Keep only known settings, each a valid index. */
export function cleanSettings(raw) {
  const out = { ...DEFAULTS };
  for (const [id, n] of Object.entries(LIMITS)) {
    const v = Number(raw?.[id]);
    if (raw?.[id] != null && Number.isInteger(v) && v >= 0 && v < n) out[id] = v;
  }
  return out;
}

export function createMenu(settings = DEFAULTS) {
  const m = { open: true, screen: 'title', group: 'gameplay', index: 0, who: 0, story: false, tourney: false, party: false, doubles: false, online: null, joinCode: '', settings: cleanSettings(settings) };
  const two = () => m.settings.players === 1;
  const online = () => m.settings.players === 2;
  const titleItems = () => [
    { id: 'play1', label: '1 Player' },
    { id: 'play2', label: '2 Players' },
    { id: 'online', label: 'Online' },
    { id: 'story', label: 'Story' },
    { id: 'modes', label: 'More modes' },
    { id: 'tutorial', label: 'Tutorial' },
    { id: 'settings', label: 'Settings' },
  ];
  const groupItems = () => [
    ...SETTINGS.filter((x) => groupOf(x.id) === m.group),
    { id: 'groupreset', label: 'Reset to default', help: 'Puts only the settings on this page back to their defaults.' },
    { id: 'back', label: 'Back' },
  ];
  const settingItems = () => [
    ...GROUPS.map((g) => ({ id: `group:${g.id}`, label: g.label, help: g.help, group: g.id })),
    { id: 'reset', label: 'Reset to defaults', help: 'Puts every setting above, the court and the time of day back to their defaults.' },
    { id: 'back', label: 'Back' },
  ];
  const modeItems = () => [
    { id: 'daily', label: 'Daily Challenge', help: 'One small goal a day, the same for everybody. Earn stars and cosmetics.' },
    { id: 'tourney', label: 'Tournament', help: 'Eight places, knock-out. Win three matches to lift the trophy.' },
    { id: 'party', label: 'Party Mode', help: 'Every game changes the rules a little: blazing balls, giant balls, disco lights.' },
    { id: 'doubles', label: 'Doubles', help: 'Two against two: you and a CPU partner take on two CPUs, on the wide doubles court.' },
    { id: 'practice', label: 'Practice', help: 'Target practice and a rally challenge, with a best score to beat.' },
    { id: 'wardrobe', label: 'Wardrobe', help: 'Collars, rackets and ball trails you have unlocked.' },
    { id: 'career', label: 'Career stats', help: 'Everything you have played so far.' },
    { id: 'back', label: 'Back' },
  ];
  const onlineItems = () => [
    { id: 'host', label: 'Host a game', help: 'Pick your cat and court, then send your friend the link.' },
    { id: 'join', label: 'Join with a code', help: 'Your friend gives you a code (or a link, which does this for you).' },
    { id: 'back', label: 'Back' },
  ];
  // Professor Hoot joins the roster once the story is finished, for quick matches only (the story, tournament and doubles are built around the six cats)
  const catCount = () => CATS.length + (m.owl && !m.story && !m.tourney && !m.doubles ? 1 : 0);
  const count = () => m.screen === 'title' ? titleItems().length : m.screen === 'settings' ? settingItems().length : m.screen === 'group' ? groupItems().length
    : m.screen === 'online' ? onlineItems().length : m.screen === 'modes' ? modeItems().length : m.screen === 'wardrobe' ? SLOT_NAMES.length + 1 : m.screen === 'practice' ? 3 : m.screen === 'career' ? 1 : m.screen === 'cats' ? catCount() : COURTS.length;
  const go = (screen, index = 0) => { m.screen = screen; m.index = index; };
  const modeIndex = (id) => Math.max(0, modeItems().findIndex((x) => x.id === id));
  const catKey = () => (m.who === 0 ? 'cat1' : m.doubles ? 'cat3' : 'cat2');
  const partnerStart = () => { const c = m.settings.cat3; return c != null && c !== m.settings.cat1 ? c : (m.settings.cat1 + 1) % CATS.length; };
  return {
    state: m,
    titleItems, settingItems, groupItems, onlineItems, modeItems,
    /** The cat or court the cursor is on, or the item on a list screen. */
    setIndex(i) { m.index = Math.max(0, Math.min(count() - 1, i)); },
    /** The professor is playable (the story is finished). */
    setOwl(on) { m.owl = !!on; },
    /** How many cats the pick screen lists now. */
    catCount,
    /** key: up | down | left | right | enter | back. Returns an event: 'play' | 'tutorial' | 'launch' | a setting id or null. */
    press(key) {
      if (m.screen === 'cats' && m.index >= catCount()) m.index = 0; // a cat that is not on offer in this mode (the owl in the story)
      const n = count();
      if (key === 'back') {
        if (m.screen === 'cats' && m.who === 1) { m.who = 0; m.index = m.settings.cat1; return null; }
        if (m.screen === 'cats' && online()) { m.online = null; go('online'); return null; }
        if (m.screen === 'cats' && m.doubles) { m.doubles = false; go('modes', modeIndex('doubles')); }
        else if (m.screen === 'cats' && (m.tourney || m.party)) { const i = m.tourney ? 1 : 2; m.tourney = false; m.party = false; go('modes', i); }
        else if (m.screen === 'group') go('settings', Math.max(0, GROUPS.findIndex((g) => g.id === m.group)));
        else if (m.screen === 'wardrobe' || m.screen === 'career' || m.screen === 'practice') go('modes', modeIndex(m.screen));
        else if (m.screen === 'modes') go('title', 4);
        else if (m.screen === 'cats' || m.screen === 'settings' || m.screen === 'online') go('title');
        else if (m.screen === 'court') { m.who = two() || m.doubles ? 1 : 0; go('cats', m.settings[catKey()]); }
        return null;
      }
      if (m.screen === 'title') {
        if (key === 'up' || key === 'left') m.index = (m.index + n - 1) % n;
        else if (key === 'down' || key === 'right') m.index = (m.index + 1) % n;
        else if (key === 'enter') {
          const id = titleItems()[m.index].id;
          if (id === 'modes') { m.story = false; m.tourney = false; m.party = false; m.doubles = false; go('modes'); return null; }
          if (id === 'story') { m.story = true; m.doubles = false; m.settings.players = 0; m.who = 0; go('cats', m.settings.cat1); return 'story-pick'; } // one player: pick the cat whose story to play
          if (id === 'online') { m.story = false; m.doubles = false; m.online = null; go('online'); return null; }
          if (id === 'play1' || id === 'play2') { m.story = false; m.doubles = false; m.settings.players = id === 'play2' ? 1 : 0; m.who = 0; go('cats', m.settings.cat1); return 'players'; }
          else if (id === 'settings') go('settings');
          else { m.story = false; m.doubles = false; m.settings.players = 0; return id; } // tutorial is always one player
        }
        return null;
      }
      if (m.screen === 'modes') {
        if (key === 'up' || key === 'left') m.index = (m.index + n - 1) % n;
        else if (key === 'down' || key === 'right') m.index = (m.index + 1) % n;
        else if (key === 'enter') {
          const id = modeItems()[m.index].id;
          if (id === 'back') go('title');
          else if (id === 'daily') { m.settings.players = 0; return 'daily'; }
          else if (id === 'practice') go('practice');
          else if (id === 'wardrobe') go('wardrobe');
          else if (id === 'career') go('career');
          else if (id === 'doubles') { m.tourney = false; m.party = false; m.doubles = true; m.settings.players = 0; m.who = 0; go('cats', m.settings.cat1); return 'doubles-pick'; } // you, then your partner
          else { m.tourney = id === 'tourney'; m.party = id === 'party'; m.settings.players = 0; m.who = 0; go('cats', m.settings.cat1); return id === 'tourney' ? 'tourney-pick' : 'party-pick'; }
        }
        return null;
      }
      if (m.screen === 'wardrobe') {
        if (key === 'up') m.index = (m.index + n - 1) % n;
        else if (key === 'down') m.index = (m.index + 1) % n;
        else if (key === 'left' || key === 'right' || key === 'enter') {
          if (m.index === SLOT_NAMES.length) { if (key === 'enter') go('modes', modeIndex('wardrobe')); return null; } // the Back button sits under the slot rows
          return `wardrobe:${m.index}:${key === 'left' ? -1 : 1}`; // the page cycles the slot (it owns the progress)
        }
        return null;
      }
      if (m.screen === 'practice') {
        if (key === 'up') m.index = (m.index + n - 1) % n;
        else if (key === 'down') m.index = (m.index + 1) % n;
        else if (key === 'enter') { if (m.index === 2) go('modes', modeIndex('practice')); else { m.settings.players = 0; return m.index === 0 ? 'practice:targets' : 'practice:rally'; } }
        return null;
      }
      if (m.screen === 'career') { if (key === 'enter') go('modes', modeIndex('career')); return null; }
      if (m.screen === 'online') {
        if (key === 'up') m.index = (m.index + n - 1) % n;
        else if (key === 'down') m.index = (m.index + 1) % n;
        else if (key === 'enter') {
          const id = onlineItems()[m.index].id;
          if (id === 'back') go('title');
          else if (id === 'host') { m.online = 'host'; m.settings.players = 2; m.who = 0; go('cats', m.settings.cat1); return 'players'; }
          else return 'join-ask'; // the page asks for the code, then calls join(code)
        }
        return null;
      }
      if (m.screen === 'settings') {
        const it = settingItems()[m.index];
        if (key === 'up') m.index = (m.index + n - 1) % n;
        else if (key === 'down') m.index = (m.index + 1) % n;
        else if (it.id === 'back') { if (key === 'enter') go('title'); }
        else if (it.group) { if (key === 'enter' || key === 'right') { m.group = it.group; go('group'); } }
        else if (it.id === 'reset') { if (key === 'enter') { for (const id of [...SETTINGS.map((x) => x.id), 'court', 'time']) m.settings[id] = DEFAULTS[id]; return 'reset'; } }
        return null;
      }
      if (m.screen === 'group') {
        const it = groupItems()[m.index];
        if (key === 'up') m.index = (m.index + n - 1) % n;
        else if (key === 'down') m.index = (m.index + 1) % n;
        else if (it.id === 'back') { if (key === 'enter') go('settings', Math.max(0, GROUPS.findIndex((g) => g.id === m.group))); }
        else if (it.id === 'groupreset') { if (key === 'enter') { for (const id of GROUPS.find((g) => g.id === m.group).ids) m.settings[id] = DEFAULTS[id]; return 'reset'; } }
        else if (key === 'left' || key === 'right' || key === 'enter') {
          const k = it.options.length, d = key === 'left' ? -1 : 1;
          m.settings[it.id] = (m.settings[it.id] + d + k) % k;
          return it.id;
        }
        return null;
      }
      if (m.screen === 'cats') {
        if (key === 'left') m.index = (m.index + n - 1) % n;
        else if (key === 'right') m.index = (m.index + 1) % n;
        else if (key === 'up') m.index = (m.index - CAT_COLUMNS + n) % n;
        else if (key === 'down') m.index = (m.index + CAT_COLUMNS) % n;
        else if (key === 'enter') {
          if (m.doubles && m.who === 1 && m.index === m.settings.cat1) return null; // a partner is a different cat
          m.settings[catKey()] = m.index;
          if (m.doubles && m.who === 0) { m.who = 1; m.index = partnerStart(); }
          else if (m.doubles) { Object.assign(m.settings, doublesLineup(m.settings.cat1, m.settings.cat3)); go('court', m.settings.court); }
          else if (two() && m.who === 0) { m.who = 1; m.index = m.settings.cat2; }
          else {
            if (m.story) return 'story'; // the cat is chosen; the story map takes over
            if (m.tourney) return 'tourney'; // the bracket takes over
            if (online() && m.online === 'join') return 'launch'; // the host chooses the court
            if (!two() && !online()) { // the CPU gets a different cat from yours
              if (m.settings.cat2 === m.settings.cat1) m.settings.cat2 = (m.settings.cat1 + 1) % CATS.length;
            }
            go('court', m.settings.court);
          }
        }
        return null;
      }
      // court
      if (key === 'left') m.index = (m.index + n - 1) % n;
      else if (key === 'right') m.index = (m.index + 1) % n;
      else if (key === 'up' || key === 'down') { m.settings.time = (m.settings.time + (key === 'up' ? TIMES.length - 1 : 1)) % TIMES.length; return 'time'; }
      else if (key === 'enter') { m.settings.court = m.index; return 'launch'; }
      return null;
    },
    /** Set option `opt` of the setting row `i` on a group screen (a click on one of its choices). Returns the setting id, or null. */
    choose(i, opt) {
      const it = m.screen === 'group' ? groupItems()[i] : null;
      if (!it?.options || !Number.isInteger(opt) || opt < 0 || opt >= it.options.length) return null;
      m.index = i; m.settings[it.id] = opt;
      return it.id;
    },
    /** Joining a friend's match (a code typed in, or a ?join= link): pick your cat, then go. */
    join(code) { m.story = false; m.online = 'join'; m.joinCode = code; m.settings.players = 2; m.who = 0; m.open = true; go('cats', m.settings.cat1); },
    open() { m.open = true; go('title'); m.who = 0; m.online = null; m.tourney = false; m.party = false; m.doubles = false; },
    close() { m.open = false; },
  };
}
