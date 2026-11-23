import './migrate.js'; // first: moves saved data to the current key names before anything reads it
import { loadCore } from './core.js';
import { createSession } from './session.js';
import { cleanMapping } from '../shared/mapping.js';
import { createInput } from './input.js';
import { updateHud, updateHud2, pointFx } from './hud.js';
import { createDuel, createOutbox, applyLink, scoreOf } from './duel.js';
import { createPeer, openSocket, makeCode, makeRoom, cleanCode, validCode, joinLink } from './online.js';
import { lookFor } from './cats.js';
import { createTitleScene } from './render/titlescene.js';
import { createMapScene } from './render/mapscene.js';
import { createWardrobeStage } from './render/wardrobestage.js';
import { blipFor, lineSounds, sceneOpen, sceneClose, mapSounds, bossIntroSounds } from './cutsfx.js';
import { createWorld } from './render/world.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { createMenu, cleanSettings, SETTINGS, doublesLineup } from './menu.js';
import { renderMenu, selectSides } from './ui.js';
import { createSelectStage, renderCatThumbs, setIdleQ } from './render/select.js';
import { CATS, ALL_CATS } from './cats.js';
import { COURTS, TIMES } from './render/courts.js';
import { STAGES, stageOf, setStage, stopSettings, dialogueFor, defeatLine } from './story.js';
import { mapHtml, stopPanelHtml, talkHtml, bossIntroHtml } from './storyui.js';
import { createTalkStage } from './render/talkstage.js';
import { createLessonStage } from './render/lessonstage.js';
import { LESSONS, LESSON_COUNT, lessonFrame, lessonChips, stepLesson, contactsBetween } from './lessons.js';
import { lessonHtml } from './lessonui.js';
import { demoQuat } from './demo.js';
import { moodOf } from './render/talkshots.js';
import { createTutorial } from './tutorial.js';
import { pauseHtml, createRecorder, frameAt, clipLength, REPLAY_ANGLES, withReplayAngle, introCam, introCaption, INTRO_TIME, EMOTE_TIME, canEmote, emoteWeight, emoteCam } from './extras.js';
import { danceFor, blendDance, DANCE_NAMES } from './render/dances.js';
import { impactOf, holdFor, punchFor, rallyZoom, reactionsFor, createBounceTracker, closeCall, createChallenges, matchPoint } from './feel.js';
import { createStats, statsHtml } from './stats.js';
import { CHALLENGES, challengeFor, challengeById, createRun, starsFor, shareText, saveDaily, loadDaily, dayKey, PRACTICE, isPractice, loadPractice, savePractice } from './challenge.js';
import { MODS, modFor, rulesWith, lookOf } from './party.js';
import { newTournament, nextMatch, report as tourneyReport, loadTournament, saveTournament, addTitle, loadTitles, ROUNDS } from './tournament.js';
import { loadProgress, saveProgress, recordMatch, recordFeat, recordStop, markStops, cycleEquip, equippedLook, lookWith, SLOTS, SLOT_NAMES, isUnlocked, needText } from './progress.js';
import { hawkHtml, bracketHtml, dailyEndHtml, practiceEndHtml } from './modeui.js';
import { FIRE_FULL } from './extras.js';

const core = await loadCore();
let core2 = null; // the second player's core in a two-player match
const q = new URLSearchParams(location.search);
// Choices come from the title menu (saved in this browser); URL flags still win:
// ?lefty, ?arcade, ?shots, ?level=0|1|2, ?res=240..1920, ?style=...
let saved = {};
try { saved = JSON.parse(localStorage.getItem('loxford.settings') || '{}'); } catch { /* none */ }
try { // the courts were reordered (clay, hard, grass): keep a saved pick pointing at the same court
  if (localStorage.getItem('loxford.courtOrder') !== '2') { if (saved.court != null) { saved.court = [1, 0, 2][saved.court] ?? 1; localStorage.setItem('loxford.settings', JSON.stringify(saved)); } localStorage.setItem('loxford.courtOrder', '2'); }
} catch { /* no storage */ }
const menu = createMenu(saved);
const S = menu.state.settings;
// Story mode: this page is built for one stop (its rival, court and time of day), so moving to the next stop reloads it.
const store = { getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
let storyHero = -1;
try { const h = sessionStorage.getItem('loxford.storyHero'); if (h != null && Number.isInteger(Number(h)) && Number(h) >= 0 && Number(h) < CATS.length) storyHero = Number(h); } catch { /* no storage */ }
const inStory = storyHero >= 0;
let storyStage = inStory ? stageOf(store, storyHero) : 0; // the next match to play (STAGES = the story is finished)
// a finished stop picked on the map to play again (kept across the page reload a new court needs); -1 means the next stop
const readPlay = () => { try { const raw = sessionStorage.getItem('loxford.storyPlay'); const v = raw == null || raw === '' ? NaN : Number(raw); return Number.isInteger(v) && v >= 0 && v < STAGES ? v : -1; } catch { return -1; } }; // (Number(null) is 0: a missing key must not mean stop 0)
let storyPlay = inStory ? readPlay() : -1, storySel = -1; // storySel: the pin picked on the map right now
const isReplay = () => inStory && storyPlay >= 0 && storyPlay < storyStage;
const playIdx = () => (isReplay() ? storyPlay : Math.min(storyStage, STAGES - 1));
const setPlay = (i) => { storyPlay = i; try { if (i >= 0) sessionStorage.setItem('loxford.storyPlay', String(i)); else sessionStorage.removeItem('loxford.storyPlay'); } catch { /* none */ } };
const storyStop = () => stopSettings(storyHero, playIdx());
const applyStop = () => { const t = storyStop(); Object.assign(S, { players: 0, cat1: t.cat1, cat2: t.cat2, court: t.court, time: t.time }); };
if (inStory) applyStop();
// More modes: a daily challenge, a tournament, party mode. Each is a page built for one setup (like the story), so choosing one reloads.
const progress = loadProgress(store);
const owlUnlocked = () => progress.career.story >= 1; // finishing the story adds Professor Hoot as a playable cat (quick matches)
const heroCat = () => (S.cat1 < CATS.length ? S.cat1 : 0); // the story, tournament and daily challenge are for the six cats
if (!owlUnlocked() && !inStory) { if (S.cat1 >= CATS.length) S.cat1 = 0; if (S.cat2 >= CATS.length) S.cat2 = 1; } // (the story sets its own rival: the boss is the owl, even before he is unlocked to play)
menu.setOwl(owlUnlocked());
try { const furthest = Math.max(0, ...Array.from({ length: CATS.length }, (_, h) => stageOf(store, h))); if (markStops(progress, furthest)) saveProgress(store, progress); } catch { /* no storage */ } // stops cleared before rewards existed still count
const BALL_COLORS = [0xd8ff3a, 0xff9a2a, 0xff5ca8, 0x3de8ff];
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (saved.shake == null && prefersReduced) S.shake = 1; // reduced motion starts with the screen shake off
let dailyCfg = null;
try { dailyCfg = JSON.parse(sessionStorage.getItem('loxford.daily') || 'null'); } catch { /* none */ }
const dailyCh = dailyCfg && !inStory && [...CHALLENGES, ...PRACTICE].some((c) => c.id === dailyCfg.id) ? challengeById(dailyCfg.id, dailyCfg.date, dailyCfg.seed) : null;
const inDaily = !!dailyCh;
const practiceOn = inDaily && isPractice(dailyCh.def); // a practice game: the daily machinery, but no streak, no stars, a best score instead
let tourneyHero = -1;
try { const h = sessionStorage.getItem('loxford.tourneyHero'); if (h != null && Number.isInteger(Number(h)) && Number(h) >= 0 && Number(h) < CATS.length) tourneyHero = Number(h); } catch { /* none */ }
const inTourney = tourneyHero >= 0 && !inStory && !inDaily;
let tourney = null;
if (inTourney) { tourney = loadTournament(store); if (!tourney || tourney.hero !== tourneyHero || (tourney.champion !== -1)) { tourney = newTournament(tourneyHero, (Math.random() * 1e9) >>> 0); saveTournament(store, tourney); } }
const tourneyMatch = () => (tourney ? nextMatch(tourney) : null);
let partyOn = false;
try { partyOn = sessionStorage.getItem('loxford.party') === '1' && !inStory && !inDaily && !inTourney; } catch { /* none */ }
const applyDaily = () => { const d = dailyCh.def; Object.assign(S, { players: 0, cat1: dailyCfg.cat ?? 0, cat2: ((dailyCfg.cat ?? 0) + 1) % CATS.length, court: d.court, time: d.time, shots: d.shots === 'all' ? 1 : 0, level: d.level }); };
const applyTourney = () => { const m = tourneyMatch(); if (m) Object.assign(S, { players: 0, cat1: tourneyHero, cat2: m.rival, court: m.court, time: m.time }); else Object.assign(S, { players: 0, cat1: tourneyHero }); };
if (inDaily) applyDaily();
if (inTourney) applyTourney();
const rightHanded = !(q.has('lefty') || S.hand === 1);
// Online play: this page is built for one friend's match (a code, and whether this page is the host). A plain refresh does not resume it.
let onlineCfg = null;
const directCode = cleanCode(q.get('online')); // ?online=CODE (host) or ?online=CODE&guest goes straight to a match, for testing
if (validCode(directCode)) onlineCfg = { code: directCode, host: !q.has('guest') };
else try {
  const o = JSON.parse(sessionStorage.getItem('loxford.online') || 'null');
  if (o && validCode(o.code) && sessionStorage.getItem('loxford.auto') === 'online') onlineCfg = { code: o.code, host: !!o.host };
  else sessionStorage.removeItem('loxford.online');
} catch { /* no storage: no online */ }
const online = !!onlineCfg && !inStory;
const two = S.players === 1 && !online;
// Doubles: you and a CPU partner against two CPUs. Like party mode, a page is built for it (the extra cats are made once), so choosing it reloads.
let doublesOn = false;
try { doublesOn = sessionStorage.getItem('loxford.doubles') === '1' && !inStory && !inDaily && !inTourney && !online && !two; } catch { /* none */ }
if (doublesOn) {
  if (S.cat3 == null || S.cat3 === S.cat1) S.cat3 = (S.cat1 + 1) % CATS.length;
  Object.assign(S, doublesLineup(S.cat1, S.cat3));
}
menu.state.doubles = doublesOn;
const TEAMS = doublesOn ? [`${CATS[S.cat1].name} & ${CATS[S.cat3].name}`.toUpperCase(), `${CATS[S.cat2].name} & ${CATS[S.cat4].name}`.toUpperCase()] : null;
const NAMES = two ? ['P1', 'P2'] : online ? ['YOU', 'FRIEND'] : TEAMS ?? ['YOU', 'CPU'];
if (two) core2 = await loadCore();
const duel = two ? createDuel(core, core2) : null;
let netArcade = null; // online: the host's ball rules both sides
let partyMod = null; // party mode: this game's modifier (party.js)
const flags = () => {
  const own = { easy: q.has('assist') || S.assist === 1, aim: q.has('aim') || S.aim === 1, shots: q.has('shots') || S.shots === 1 };
  const r = partyOn ? rulesWith(own, partyMod) : own;
  return {
    arcade: netArcade ?? (q.has('arcade') || S.ball === 1),
    level: inStory ? storyStop().level : inTourney ? (tourneyMatch()?.level ?? S.level) : q.has('level') ? Math.min(2, Math.max(0, Number(q.get('level')) || 0)) : S.level,
    shots: r.shots, assist: r.easy, aim: r.aim,
  };
};
// the shot-naming setting is shared by every core in the page (one WASM module each)
const applyShots = () => {
  core.setBasicShots(!flags().shots); core2?.setBasicShots(!flags().shots);
  core.setEasyReturns(flags().assist); core2?.setEasyReturns(flags().assist);
  core.setStrongAim(flags().aim); core2?.setStrongAim(flags().aim);
};
applyShots();
try { // shot thresholds fitted by the trainer (/train), if any
  const r = await fetch(q.has('trial') ? '/tuning.trial.json' : '/tuning.json'); // ?trial = try the trainer's unpromoted fit
  if (r.ok && r.status !== 204) { const t = await r.json(); core.setShotTuning(t); core2?.setShotTuning(t); } // the extra shots still need the All setting
} catch { /* defaults */ }
// ---- online: the socket, the lobby (wait for the friend and your phone), and the handshake that fixes both cats and the court ----
const roomId = (() => { try { let r = sessionStorage.getItem('loxford.room'); if (!/^[a-z0-9]{8,40}$/.test(r || '')) { r = makeRoom(); sessionStorage.setItem('loxford.room', r); } return r; } catch { return makeRoom(); } })();
const early = []; // phone messages that arrive before the match is built
let route = (m) => early.push(m);
let onSockOpen = null;
let noPhoneChosen = false; // online: the lobby's "Play without a phone"
const sock = openSocket({ room: online ? roomId : '', match: online ? onlineCfg.code : '', onMessage: (m) => route(m), onOpen: () => onSockOpen?.() });
const sessionId = makeRoom();
const sendPeer = (m) => sock.duel(m);
const peer = online ? createPeer({ send: sendPeer }) : null;
const lobbyEl = document.getElementById('lobby');
const leaveOnline = () => { try { sessionStorage.removeItem('loxford.online'); sessionStorage.removeItem('loxford.auto'); } catch { /* none */ } location.reload(); };
if (online) {
  const hostSide = onlineCfg.host;
  peer.setHello({ sid: sessionId, cat: S.cat1, court: S.court, time: S.time, arcade: flags().arcade });
  let phoneUp = false, full = false, info = { publicUrl: '', lanUrl: '', tunnel: false }, lastHtml = '', skipPhone = q.has('nophone');
  fetch('/online-info').then((r) => r.json()).then((j) => { info = j; }).catch(() => {});
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const step = (done, title, small = '') => `<div class="step${done ? ' done' : ''}"><i></i><div>${title}${small ? `<small>${small}</small>` : ''}</div></div>`;
  const friendHere = () => peer.here && !!peer.hello;
  const draw = () => {
    const link = joinLink(info.publicUrl || info.lanUrl || location.origin, onlineCfg.code);
    const html = `<h2>${hostSide ? 'Online game' : 'Joining a game'}</h2>`
      + `<div class="code">${esc(onlineCfg.code)}</div>`
      + (hostSide ? `<div class="note">Send your friend this link (or the code):</div><div class="link"><input id="lobbylink" readonly value="${esc(link)}"><button data-lact="copy">Copy link</button></div>`
        + (info.tunnel ? '' : '<div class="note warn">This link only works on your Wi-Fi. To play over the internet, start the game with <b>make online</b>.</div>') : '')
      + `<div class="steps">${step(friendHere(), friendHere() ? 'Friend is here' : hostSide ? 'Waiting for your friend...' : 'Connecting to the game...', full ? 'This game already has two players.' : '')}`
      + `${step(phoneUp || skipPhone, phoneUp ? 'Your phone is connected' : 'Connect your phone', phoneUp ? '' : 'Scan the code with your phone camera, tap Start, then Calibrate.')}</div>`
      + (phoneUp || skipPhone ? '' : `<div class="qr"><img alt="QR code to open the phone controller" src="/phone-qr.svg?room=${roomId}"></div>`)
      + `<div class="row2"><button data-lact="cancel">Cancel</button>${phoneUp || skipPhone ? '' : '<button data-lact="nophone">Play without a phone</button>'}</div>`;
    if (html === lastHtml) return;
    const keep = document.activeElement?.id === 'lobbylink';
    lastHtml = html; lobbyEl.innerHTML = html; lobbyEl.style.display = 'flex';
    if (keep) document.getElementById('lobbylink')?.select();
  };
  await new Promise((resolve) => {
    const finish = () => { if (friendHere() && (phoneUp || skipPhone)) { clearInterval(tick); lobbyEl.style.display = 'none'; resolve(); } };
    route = (m) => {
      if (m.type === 'duel') { peer.receive(m.m); }
      else if (m.type === 'peer') { if (m.here) peer.joined(); else peer.left(); }
      else if (m.type === 'match-full') full = true;
      else {
        if (m.type === 'controller-joined' || m.type === 's') phoneUp = true;
        else if (m.type === 'controller-lost') phoneUp = false;
        early.push(m);
      }
      draw(); finish();
    };
    onSockOpen = () => draw();
    lobbyEl.onclick = (e) => {
      const a = e.target.closest('[data-lact]')?.dataset.lact;
      if (a === 'cancel') leaveOnline();
      else if (a === 'nophone') { skipPhone = true; noPhoneChosen = true; draw(); finish(); }
      else if (a === 'copy') { const el = document.getElementById('lobbylink'); el?.select(); navigator.clipboard?.writeText(el?.value ?? '').catch(() => {}); }
    };
    const tick = setInterval(() => { draw(); finish(); }, 700);
    draw();
  });
  const h = peer.hello, okInt = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  S.cat2 = okInt(h.cat, CATS.length) ? h.cat : (S.cat1 + 1) % CATS.length;
  if (!hostSide) { // the host picks the court, the time of day and the ball
    if (okInt(h.court, COURTS.length)) S.court = h.court;
    if (okInt(h.time, TIMES.length)) S.time = h.time;
    netArcade = !!h.arcade;
  } else netArcade = flags().arcade;
  applyShots();
  setInterval(() => { if (peer.here) peer.ping(); }, 1000);
}

const outbox = createOutbox();
let rtarget = null, rcur = null, posSentAt = 0; // online: where the friend's cat is heading, and where it is drawn
let peerEmote = null; // the friend's emote { t }
let rec = createRecorder(); // every frame of the last two points, for the replay
let world = null, world2 = null; // the views (built below, after the match exists)
let dailyRun = null, dailyDone = false, practiceResult = { best: 0, isNew: false };
const stats = createStats(), bounces = createBounceTracker(), challenges = createChallenges();
let prevSt = null, rallyCount = 0, lastBounce = null, pendingCall = null, lastCall = null, endedRally = 0, matchRecorded = false, partyGame = -1, autoReplayAt = -1, gameSwellUntil = 0, winnerSince = -1;
function resetMatchTracking() { stats.reset(); bounces.reset(); challenges.reset(); prevSt = null; rallyCount = 0; lastBounce = null; pendingCall = null; lastCall = null; endedRally = 0; matchRecorded = false; partyGame = -1; autoReplayAt = -1; winnerSince = -1; world?.setEmote?.(null); world?.setCpuEmote?.(null); world?.hideTrophy?.(); }
newMatch();
const requirePhone = !location.search.includes('nophone');
const session = createSession(core, { requirePhone, pad: 0 });
const session2 = two ? createSession(core2, { requirePhone, pad: 1 }) : null;
if (noPhoneChosen) session.setRequirePhone(false);
try { // how the phone lines up with the racket, saved from the trainer (/train)
  const r = await fetch('/mapping.json');
  if (r.ok && r.status !== 204) { const mp = cleanMapping(await r.json()); session.setMapping(mp); session2?.setMapping(mp); }
} catch { /* defaults */ }
const input = createInput(window);

// After the match: Enter, or a swing of the phone, starts a new one.
function newMatch() {
  const f = flags(), seed = inDaily ? dailyCh.seed : (Math.random() * 1e9) >>> 0;
  core.setMatchGames(inStory ? storyStop().games : inTourney ? (tourneyMatch()?.games ?? 0) : (Number(q.get('games')) || 0)); // story and tournament matches are short; ?games=N shortens any other
  if (two) { core.initRemote(seed, rightHanded, f.arcade, 0); core2.initRemote(seed + 1, rightHanded, f.arcade, 1); duel.reset(); }
  else if (online) { core.initRemote(seed, rightHanded, f.arcade, onlineCfg.host ? 0 : 1); outbox.reset(); rtarget = null; peer.newEpoch(); } // the host serves first
  else if (doublesOn) core.initDoubles(seed, rightHanded, f.arcade, f.level, f.level); // the partner plays at the opponents' level
  else core.init(seed, rightHanded, f.arcade, f.level);
  applyShots();
  rec = createRecorder();
  if (inDaily) { core.setTutorial(dailyCh.def.feed); dailyRun = createRun(dailyCh); dailyDone = false; world?.setTargets?.(dailyRun.run.targets.length ? dailyRun.run.targets : null); }
  resetMatchTracking();
}
const menuEl = document.getElementById('menu');
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'enter', Space: 'enter', Escape: 'back', Backspace: 'back' };
// The character select shows the in-game cats on a 3D stage behind the menu (built the first time it is needed).
const stageEl = document.getElementById('stage');
if (q.get('ui')) document.body.classList.add(`ui-${q.get('ui')}`);
const chunky16 = q.get('ui') === '16bit';
let stage = null, thumbs = null, stageHover = -1;
function ensureStage() {
  if (stage) return;
  try {
    thumbs = renderCatThumbs(ALL_CATS, 0, chunky16 ? 48 : 72);
    stage = createSelectStage(stageEl, { court: S.court, time: S.time, aspect: Math.min(2.2, Math.max(0.5, innerWidth / innerHeight)), ...(chunky16 ? { res: 320, levels: 6 } : {}) });
  } catch (e) { console.warn('select stage unavailable, using flat pictures:', e); stage = null; thumbs = null; }
}
// The title page's backdrop: the cats chase each other round the court (built the first time the title is shown).
const titleEl = document.getElementById('titlescene');
let titleScene = null, titleTried = false;
function ensureTitleScene() {
  if (titleScene || titleTried) return;
  titleTried = true;
  try { titleScene = createTitleScene(titleEl, { court: S.court, time: S.time, aspect: Math.min(2.2, Math.max(1, innerWidth / innerHeight)), ...(chunky16 ? { res: 320, levels: 6 } : {}) }); }
  catch (e) { console.warn('title scene unavailable:', e); }
}
let lastMenuScreen = null;
const fadeEl = document.getElementById('fade');
const SCREEN_DEPTH = { title: 0, modes: 1, online: 1, settings: 1, group: 2, cats: 2, wardrobe: 2, practice: 2, career: 2, court: 3 };
// the wardrobe preview: one 3D stage whose canvas is moved into the page each time the screen is drawn
let wardrobeStage = null, wardrobeCv = null, wardrobePeek = null; // wardrobePeek: { slot, id } while the pointer is on a tile
function attachWardrobe() {
  const host = menuEl.querySelector('.wpreview');
  if (!host) return;
  try {
    if (!wardrobeStage) { wardrobeCv = document.createElement('canvas'); wardrobeStage = createWardrobeStage(wardrobeCv, { cat: S.cat1, calm: reduceMotionNow }); wardrobeStage.cat = S.cat1; }
    else if (wardrobeStage.cat !== S.cat1) { wardrobeStage.setCat(S.cat1); wardrobeStage.cat = S.cat1; }
  } catch (e) { console.warn('wardrobe preview unavailable:', e); wardrobeStage = null; return; }
  host.prepend(wardrobeCv); host.classList.add('live');
  wardrobeStage.resize(); refreshWardrobeLook();
}
function refreshWardrobeLook() {
  if (!wardrobeStage) return;
  wardrobeStage.setLook(wardrobePeek ? lookWith(progress, wardrobePeek.slot, wardrobePeek.id) : equippedLook(progress));
}
const reduceMotionNow = matchMedia('(prefers-reduced-motion: reduce)').matches;
function drawMenu() {
  if (menu.state.open) { paused = false; replay = null; if (intro) endIntro(); }
  syncOverlays();
  const picking = menu.state.open && menu.state.screen === 'cats';
  menuEl.className = (q.get('ui') ? `ui-${q.get('ui')}` : '') + (picking ? ' pick' : '');
  menuEl.style.display = menu.state.open ? 'flex' : 'none';
  document.body.classList.toggle('menu-open', menu.state.open);
  if (picking) ensureStage();
  stageEl.style.display = picking && stage ? 'block' : 'none';
  if (menu.state.open) { const enter = menu.state.screen === 'title' && lastMenuScreen !== 'title'; wardrobePeek = null; menuEl.innerHTML = renderMenu(menu, { thumbs, progress, titles: loadTitles(store), practice: loadPractice(store), enter }); if (menu.state.screen === 'wardrobe') attachWardrobe(); }
  if (!menu.state.open && lastMenuScreen && !reduceMotionNow) { fadeEl.classList.remove('go'); void fadeEl.offsetWidth; fadeEl.classList.add('go'); } // menu to match: a quick fade up from dark
  if (menu.state.open && lastMenuScreen && lastMenuScreen !== menu.state.screen && menu.state.screen !== 'title' && !reduceMotionNow) { // slide the new screen in: from the right going deeper, from the left going back
    const cls = (SCREEN_DEPTH[menu.state.screen] ?? 1) >= (SCREEN_DEPTH[lastMenuScreen] ?? 1) ? 'sw-fwd' : 'sw-back';
    for (const c of menuEl.children) if (getComputedStyle(c).position !== 'fixed') c.classList.add(cls);
  }
  const onTitle = menu.state.open && menu.state.screen === 'title' && !reduceMotionNow;
  if (onTitle) ensureTitleScene();
  titleEl.style.display = onTitle && titleScene ? 'block' : 'none';
  menuEl.classList.toggle('title', onTitle && !!titleScene);
  lastMenuScreen = menu.state.open ? menu.state.screen : null; // the title's entrance plays when it appears, not on every key press
  if (picking && stage) {
    const { left, right } = selectSides(menu);
    const changed = stageHover !== menu.state.index;
    stage.setSides(left, right);
    if (changed) stage.flex(left.live ? 0 : 1);
    stageHover = menu.state.index;
  } else stageHover = -1;
}
// Pause, the last-point replay and the pre-match cut scene all freeze the match while they run.
let paused = false, replay = null, intro = null; // replay: { clip, t, len }, intro: { t }
let emote = null; // the emote cut scene { t }
let lessons = null; // the tutorial's how-to-play lessons { i, t }
let bossIntro = null; // the owl's entrance { timer } before the last talk
let talk = null, storyScreen = null; // story: the talk before a match { lines, i }, and the map { }
const pauseEl = document.getElementById('pause'), replayEl = document.getElementById('replay'), introEl = document.getElementById('intro'), talkEl = document.getElementById('talk'), lessonEl = document.getElementById('lesson'), storyEl = document.getElementById('story');
const toastEl = document.getElementById('toast'), hawkEl = document.getElementById('hawk'), statsEl = document.getElementById('stats'), chalEl = document.getElementById('chal');
let toastTimer = 0, hawkTimer = 0, statsOpen = null; // statsOpen: null | 'stats' | 'daily' | 'dailyintro'
const frozen = () => !!bossIntro || paused || !!replay || !!intro || !!talk || !!storyScreen || (!!emote && !online) || !!lessons;
const REPLAY_SPEED = 0.85;
let replayAngle = 0; // which REPLAY_ANGLES entry the replay camera uses; C cycles it
const replayHint = () => { replayEl.querySelector('small').textContent = `C: angle (${REPLAY_ANGLES[replayAngle].name}) \u00B7 R / Esc / Enter: skip`; };
// Settings shown on the pause screen: the first three take effect at once, the others from the next match.
const PAUSE_SETTINGS = [['shots', ''], ['assist', ''], ['aim', ''], ['sfxVol', ''], ['musicVol', ''], ['shake', ''], ['impact', ''], ['weather', ''], ['ballcol', ''], ['calls', ''], ['autoreplay', ''], ['level', 'next match'], ['ball', 'next match']].filter(([id]) => !((inStory || inTourney || inDaily) && id === 'level') && !(partyOn && ['shots', 'assist', 'aim'].includes(id))); // the story, tournament and daily challenge set the CPU level; party mode sets the rules
let pauseIdx = 0, keysOpen = false, pauseSettings = false; // pauseSettings: the pause screen shows its settings page
function renderPause() {
  const rows = PAUSE_SETTINGS.map(([id, note], i) => { const d = SETTINGS.find((x) => x.id === id); return { i, label: d.label, note, value: d.options[S[id]], sel: i === pauseIdx, help: d.help }; });
  pauseEl.innerHTML = pauseHtml(undefined, rows, { keysOpen, restart: !online, stats: true, settingsOpen: pauseSettings });
}
function pauseStep(i, dir) {
  const [id] = PAUSE_SETTINGS[i], d = SETTINGS.find((x) => x.id === id), k = d.options.length;
  pauseIdx = i;
  S[id] = (S[id] + dir + k) % k;
  saveSettings(); applyShots(); applySettings(); renderPause();
}
renderPause();
function syncOverlays() {
  const live = !menu.state.open;
  pauseEl.style.display = paused && live && !statsOpen ? 'flex' : 'none';
  statsEl.style.display = statsOpen && live ? 'flex' : 'none';
  if (paused && live && !statsOpen) renderPause();
  replayEl.style.display = replay && live ? 'block' : 'none';
  introEl.style.display = (intro || emote) && live ? 'flex' : 'none';
  talkEl.style.display = talk && live ? 'block' : 'none';
  storyEl.style.display = storyScreen && live ? 'flex' : 'none';
  document.body.classList.toggle('talking', !!talk);
  lessonEl.style.display = lessons && live ? 'block' : 'none';
  document.body.classList.toggle('lessoning', !!lessons);
  document.body.classList.toggle('replaying', !!replay);
  document.body.classList.toggle('intro', !!intro || !!emote);
}
function setPaused(on) { if (statsOpen) return; pauseSettings = false; paused = on && !menu.state.open && !replay && !intro && !talk && !storyScreen && (!emote || online) && !lessons; syncOverlays(); syncHold(); }
function startReplay() {
  if (online) return false; // a replay would stop only this side
  const clip = rec.clip();
  if (!clip.length || menu.state.open) return false;
  paused = false; intro = null;
  replay = { clip, t: 0, len: clipLength(clip) };
  replayHint();
  syncOverlays();
  return true;
}
function endReplay() { replay = null; world.resync(core.state()); world2?.resync(core2.state()); syncOverlays(); } // the world forgets the recorded frames, so no phantom hit or cheer fires
function startIntro() {
  if (q.has('nointro') || tutorial) { intro = null; syncOverlays(); if (online) peer.go(); return; }
  paused = false; replay = null; intro = { t: 0 };
  syncOverlays();
}
// The emote: a cat shows off in a short cut scene. Only between points (never mid-rally).
// One player: your cat, the match waits. Two players: that player's cat in that player's view, both views wait. Online: the match goes on and the friend sees the dance too.
const coreOf = (pad) => (pad === 1 ? core2 : core);
const worldOf = (pad) => (pad === 1 ? world2 : world);
function tryEmote(pad = 0) {
  if (tutorial || menu.state.open || frozen() || emote || !coreOf(pad) || !canEmote(coreOf(pad).state())) return false;
  if (online && (!peer.ready || peer.peerHolding)) return false;
  emote = { t: 0, pad };
  const cat = pad === 1 ? S.cat2 : S.cat1;
  introEl.dataset.phase = 'emote';
  introEl.innerHTML = '<div class="ibig"></div><div class="ismall"></div>';
  introEl.querySelector('.ibig').textContent = DANCE_NAMES[cat % DANCE_NAMES.length];
  introEl.querySelector('.ismall').textContent = ALL_CATS[cat % ALL_CATS.length].name;
  audio.play('applause', { gain: 0.7 }); worldOf(pad).cheer();
  if (online) sendPeer({ k: 'emote' });
  syncOverlays();
  return true;
}
function endEmote() { const pad = emote?.pad ?? 0; emote = null; worldOf(pad)?.setEmote(null); (pad === 1 ? world : world2)?.setCpuEmote(null); worldOf(pad)?.resync(coreOf(pad).state()); syncOverlays(); }
function endIntro() {
  if (intro?.crowd) intro.crowd.fadeOut(0.4); // skipping the cut scene quietens the crowd too
  intro = null; syncOverlays();
  if (online) peer.go(); // online: the clock starts when both sides' intros are over
}
function goMenu() { if (inStory) return leaveStory(); if (inTourney) return leaveTourney(); if (inDaily) return leaveDaily(); if (online) return leaveOnline(); paused = false; tutorial = null; core.setTutorial(0); menu.open(); syncOverlays(); drawMenu(); }
const rematch = () => { newMatch(); startIntro(); };
// Online: a rematch needs both players to ask for it.
function wantRematch() { if (peer.again()) rematch(); }
// ---- story mode screens: the trail map, the talk before a match, and what happens when a match ends ----
let storyThumbs = null;
const getStoryThumbs = () => { if (!storyThumbs) { try { storyThumbs = renderCatThumbs(ALL_CATS, 0, 96); } catch { storyThumbs = []; } } return storyThumbs; };
function leaveStory() { if (inTourney) return leaveTourney(); try { sessionStorage.removeItem('loxford.storyHero'); sessionStorage.removeItem('loxford.storyPlay'); sessionStorage.removeItem('loxford.auto'); } catch { /* none */ } location.reload(); }
// the map is a 3D diorama drawn by the main frame loop while it is up; without WebGL the painted SVG map stays
let mapScene = null;
function stopMapScene() { if (mapScene) { mapScene.dispose(); mapScene = null; } }
function startMapScene(from) {
  stopMapScene();
  const trail = storyEl.querySelector('.trail'), cv = storyEl.querySelector('.trail3d');
  if (!trail || !cv) return false;
  try {
    mapScene = createMapScene(cv, { stage: from, calm: reduceMotionNow });
    mapScene.bind(trail.querySelectorAll('.node'), trail.querySelector('.token'));
    trail.classList.add('is3d');
    mapScene.resize();
    if (from !== storyStage) { mapScene.walkTo(from, storyStage); setTimeout(() => mapScene?.setStage(storyStage), 1300); }
    return true;
  } catch { mapScene = null; trail.classList.remove('is3d'); return false; }
}
storyEl.addEventListener('pointermove', (e) => { const r = storyEl.querySelector('.trail')?.getBoundingClientRect(); if (r && mapScene) mapScene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1); });
storyEl.addEventListener('pointerleave', () => mapScene?.setPointer(0, 0));
function showMap({ from = storyStage, note = '', retry = false } = {}) {
  menu.close(); paused = false; replay = null; intro = null; talk = null; tutorial = null;
  storyScreen = {};
  storySel = -1;
  storyEl.innerHTML = mapHtml({ hero: storyHero, stage: storyStage, from, thumbs: getStoryThumbs(), note, retry, sel: -1 });
  const is3d = startMapScene(from);
  playCutSfx(mapSounds({ walked: from !== storyStage, lost: retry, finished: storyStage >= STAGES && from !== storyStage }));
  syncOverlays(); drawMenu();
  if (!is3d && from !== storyStage) requestAnimationFrame(() => requestAnimationFrame(() => { // the cat walks to the next stop (flat map)
    const t = storyEl.querySelector('.token'); if (!t) return;
    const [x, y] = t.dataset.to.split(',');
    t.style.left = `${x}%`; t.style.top = `${y}%`;
  }));
}
function storyGo() { // Enter on the map: on to the talk and the match
  if (inTourney) return tourneyGo();
  if (storyStage >= STAGES && storySel < 0) { storyStage = 0; setStage(store, storyHero, 0); } // the story is finished: play it again
  setPlay(storySel >= 0 && storySel < storyStage ? storySel : -1); // a finished stop picked on the map is replayed
  storyScreen = null;
  applyStop();
  if (configKey() !== loadedKey) { // a new rival or court is built with the page
    try { sessionStorage.setItem('loxford.auto', 'storytalk'); } catch { /* then it shows the map again */ }
    location.reload();
    return;
  }
  startTalk();
}
const talkCanvas = document.getElementById('talkview');
let talkStage = null;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function ensureTalkStage() { // the cut scene is a 3D scene of the two cats; if it cannot be built the live court shows behind the text
  if (talkStage) return talkStage;
  try {
    const t = storyStop();
    talkStage = createTalkStage(talkCanvas, { court: t.court, time: t.time, aspect: Math.min(2.1, Math.max(1.2, innerWidth / innerHeight)), res: Number(q.get('res')) || 800, levels: chunky16 ? 6 : 0, hero: t.cat1, rival: t.cat2 });
  } catch (e) { console.warn('cut scene stage unavailable:', e); talkStage = null; }
  return talkStage;
}
/** Hand a list of cut-scene sound events (from cutsfx.js) to the audio engine. */
function playCutSfx(list) {
  if (!audioReady) return; // the first map is built while the page starts up, before the audio engine exists (and sound is locked then anyway)
  for (const e of list) {
    if (e.tone) audio.tone(e.tone);
    else if (e.noise) audio.noise(e.noise);
    else if (e.voice) audio.voice(e.voice, { gain: e.gain });
    else if (e.bank) setTimeout(() => audio.play(e.bank, { gain: e.gain }), (e.after ?? 0) * 1000);
  }
}
let audioReady = false;
const talkBoss = () => playIdx() >= STAGES - 1; // the last stop's rival is the owl
function renderTalk() {
  const t = storyStop();
  talkEl.innerHTML = talkHtml({ lines: talk.lines, i: talk.i, stop: t.stop });
  const l = talk.lines[talk.i];
  talk.full = l.text; talk.chars = reduceMotion ? l.text.length : 0; talk.shown = -1;
  talkStage?.setLine(talk.i, talk.lines.length, l.mine ? 0 : 1, moodOf(l.text));
  talk.blipped = 0;
  playCutSfx(lineSounds(l.text, l.mine ? 0 : 1, { boss: talkBoss() }));
}
const bossEl = document.getElementById('bossintro');
function endBossIntro() { if (!bossIntro) return; clearTimeout(bossIntro.timer); bossIntro = null; bossEl.style.display = 'none'; bossEl.innerHTML = ''; beginTalk(); }
function startTalk() {
  if (playIdx() >= STAGES - 1 && !reduceMotion && !bossIntro) { // the last stop opens with the boss's entrance
    menu.close(); paused = false; replay = null; intro = null; storyScreen = null; syncOverlays();
    bossEl.innerHTML = bossIntroHtml(storyHero); bossEl.style.display = 'block';
    bossIntro = { timer: setTimeout(endBossIntro, 4200) };
    playCutSfx(bossIntroSounds()); drawMenu();
    return;
  }
  beginTalk();
}
function beginTalk() {
  menu.close(); paused = false; replay = null; intro = null; storyScreen = null;
  talk = { lines: dialogueFor(storyHero, playIdx()), i: 0, chars: 0, full: '' };
  ensureTalkStage();
  talkCanvas.style.display = talkStage ? 'block' : 'none';
  playCutSfx(sceneOpen());
  renderTalk(); syncOverlays(); drawMenu();
}
function advanceTalk() {
  if (!talk) return;
  if (talk.chars < talk.full.length) { talk.chars = talk.full.length; return; } // the first press finishes the line
  talk.i++;
  if (talk.i >= talk.lines.length) endTalk(); else renderTalk();
}
function endTalk() { playCutSfx(sceneClose()); talk = null; talkCanvas.style.display = 'none'; syncOverlays(); startMatch(); }
function storyContinue() { // Enter or a swing once a story match is over
  const st = core.state();
  if (isReplay()) { // a replayed stop changes nothing in the story
    const rival = ALL_CATS[storyStop().cat2].name, won = st.matchWinner === 0;
    setPlay(-1);
    showMap({ note: won ? `Replay won against ${rival}. Your story stays where it was.` : `${rival} won this replay. Your story stays where it was.` });
    return;
  }
  if (st.matchWinner === 0) {
    const from = storyStage, rival = ALL_CATS[storyStop().cat2].name;
    const quip = `${rival}: \u201C${defeatLine(storyHero, from)}\u201D`;
    storyStage = Math.min(STAGES, storyStage + 1);
    setStage(store, storyHero, storyStage);
    const reward = recordStop(progress, from); saveProgress(store, progress); // the first time a stop is cleared (by any cat) it gives its cosmetic
    if (reward.length) setTimeout(() => toast(`Reward: ${reward.map((g) => g.item.name).join(', ')}`, 'Wear it in More modes \u203A Wardrobe'), 600);
    if (storyStage >= STAGES && from < STAGES) { const got = recordFeat(progress, 'story'); saveProgress(store, progress); if (got.length) setTimeout(() => toast(`Unlocked: ${got.map((g) => g.item.name).join(', ')}`, 'See the Wardrobe'), 800); menu.setOwl(true); setTimeout(() => toast('Professor Hoot joins the roster', 'Pick him in a quick match'), 3200); }
    showMap({ from, note: quip });
  } else showMap({ note: 'Lost this one. Shake it off and go again.', retry: true });
}
/** A plain match (not story, tournament or daily) ends with a Rematch button in the middle of the screen. */
const rematchBtn = () => !inStory && !inTourney && !inDaily;
const rematchEl = document.getElementById('rematch');
rematchEl.addEventListener('click', () => { if (core.state().matchOver && !paused) matchOverNext(); });
function syncRematch() {
  const on = rematchBtn() && core.state().matchOver && !paused && !replay && !intro && !menu.state.open && !statsOpen;
  document.body.classList.toggle('matchend', on);
  const label = online && peer.wantsAgain && !peer.peerWantsAgain ? 'Waiting for your friend...' : online && peer.peerWantsAgain && !peer.wantsAgain ? 'Accept rematch' : 'Rematch';
  if (rematchEl.textContent !== label) rematchEl.textContent = label;
  rematchEl.disabled = online && peer.wantsAgain && !peer.peerWantsAgain;
}
const matchOverNext = () => (inStory ? storyContinue() : inTourney ? tourneyContinue() : inDaily ? null : online ? wantRematch() : rematch());
let tutorial = null;
const tutEl = document.getElementById('tut');
function startMatch() { tutorial = null; paused = false; replay = null; menu.close(); newMatch(); startIntro(); drawMenu(); }
function startTutorial() { // first the how-to-play lessons, then practice (?practice skips the lessons)
  if (q.has('practice')) return beginPractice();
  paused = false; replay = null; intro = null; tutorial = null; menu.close(); newMatch();
  lessons = { i: 0, t: 0 };
  ensureLessonStage();
  lessonCanvas.style.display = lessonStage ? 'block' : 'none';
  showLesson(); syncOverlays(); drawMenu();
}
function beginPractice() { // practice serve, forehand, backhand and a point, with the CPU feeding balls
  paused = false; replay = null; intro = null; menu.close(); newMatch(); tutorial = createTutorial(); core.setTutorial(0); syncOverlays(); drawMenu();
}
const lessonCanvas = document.getElementById('lessonview');
let lessonStage = null;
function ensureLessonStage() { // your cat on the court with a virtual phone; if it cannot be built the live court shows behind the text
  if (lessonStage) return lessonStage;
  try {
    lessonStage = createLessonStage(lessonCanvas, { court: S.court, time: S.time, aspect: Math.min(2.1, Math.max(1.2, innerWidth / innerHeight)), res: Number(q.get('res')) || 800, levels: chunky16 ? 6 : 0, cat: S.cat1 });
  } catch (e) { console.warn('lesson stage unavailable:', e); lessonStage = null; }
  return lessonStage;
}
function showLesson() {
  const l = LESSONS[lessons.i];
  lessons.t = 0;
  lessonEl.innerHTML = lessonHtml(lessons.i, []); lessons.chips = '';
  lessonStage?.clearTrail();
  lessonStage?.setPose({ qR: null, dance: null, serve: l.kind === 'serve', phone: l.kind === 'swing' });
}
function stepLessons(dir) {
  const n = stepLesson(lessons.i, dir);
  if (n < 0) return;
  if (n >= LESSON_COUNT) return endLessons();
  lessons.i = n; showLesson();
}
function endLessons() { lessons = null; lessonCanvas.style.display = 'none'; syncOverlays(); beginPractice(); }
// The cats, court and views are built once per page, so a different pick needs a fresh page, which then starts straight away.
const configKey = () => [S.players, S.cat1, S.cat2, S.hand, S.court, S.time, menu.state.doubles ? `d${S.cat3}.${S.cat4}` : ''].join();
const loadedKey = configKey();
const saveSettings = () => { if (inStory || online) return; /* the story's court and cats are not the player's choices */ try { localStorage.setItem('loxford.settings', JSON.stringify(cleanSettings(S))); } catch { /* private mode */ } };
function launch(kind) {
  saveSettings();
  try { sessionStorage.setItem('loxford.party', menu.state.party && kind === 'match' ? '1' : '0'); sessionStorage.setItem('loxford.doubles', menu.state.doubles && kind === 'match' ? '1' : '0'); } catch { /* none */ }
  partyOn = !!menu.state.party && kind === 'match';
  if (configKey() !== loadedKey) {
    try { sessionStorage.setItem('loxford.auto', kind); } catch { /* then it just shows the menu again */ }
    location.reload();
    return;
  }
  if (kind === 'tutorial') startTutorial(); else startMatch();
}
function launchDaily() {
  const ch = challengeFor();
  try { sessionStorage.setItem('loxford.daily', JSON.stringify({ id: ch.def.id, date: ch.date, cat: heroCat() })); sessionStorage.setItem('loxford.auto', 'daily'); for (const k of ['storyHero', 'tourneyHero', 'online', 'party']) sessionStorage.removeItem(`loxford.${k}`); } catch { return drawMenu(); }
  location.reload();
}
function launchPractice(kind) { // target practice or the rally challenge: a page built for one game, like the daily challenge
  const id = kind === 'rally' ? 'practice-rally' : 'practice-targets';
  try { sessionStorage.setItem('loxford.daily', JSON.stringify({ id, date: dayKey(), cat: heroCat(), seed: (Math.random() * 1e9) >>> 0 })); sessionStorage.setItem('loxford.auto', 'daily'); for (const k of ['storyHero', 'tourneyHero', 'online', 'party', 'storyPlay']) sessionStorage.removeItem(`loxford.${k}`); } catch { return drawMenu(); }
  location.reload();
}
function launchTourney() {
  saveSettings();
  try { sessionStorage.setItem('loxford.tourneyHero', String(heroCat())); sessionStorage.setItem('loxford.auto', 'tourneymap'); for (const k of ['daily', 'storyHero', 'online', 'party']) sessionStorage.removeItem(`loxford.${k}`); } catch { return drawMenu(); }
  location.reload();
}
function launchOnline() {
  saveSettings();
  try { sessionStorage.removeItem('loxford.daily'); sessionStorage.removeItem('loxford.tourneyHero'); sessionStorage.removeItem('loxford.party'); } catch { /* none */ }
  const m = menu.state, host = m.online === 'host';
  const code = host ? makeCode() : m.joinCode;
  try { sessionStorage.setItem('loxford.online', JSON.stringify({ code, host })); sessionStorage.setItem('loxford.auto', 'online'); sessionStorage.removeItem('loxford.storyHero'); } catch { return drawMenu(); }
  location.reload();
}
function askJoinCode() {
  const code = cleanCode(prompt('Enter the game code your friend gave you:') || '');
  if (!validCode(code)) { if (code) alert('That code does not look right. It has 4 to 8 letters and numbers.'); return; }
  menu.join(code); drawMenu();
}
function menuPress(key) {
  const r = menu.press(key);
  if (r === 'join-ask') return askJoinCode();
  if (r === 'daily') return launchDaily();
  if (typeof r === 'string' && r.startsWith('practice:')) return launchPractice(r.slice(9));
  if (r === 'tourney') return launchTourney();
  if (typeof r === 'string' && r.startsWith('wardrobe:')) { const [, i, d] = r.split(':'); cycleEquip(progress, SLOT_NAMES[Number(i)], Number(d)); saveProgress(store, progress); world.setCosmetics(equippedLook(progress)); return drawMenu(); }
  if (r === 'launch' && menu.state.online) return launchOnline();
  if (r === 'story') { // a hero is chosen: the story page is built for the first stop it has not beaten
    saveSettings();
    try { sessionStorage.removeItem('loxford.daily'); sessionStorage.removeItem('loxford.tourneyHero'); sessionStorage.removeItem('loxford.party'); sessionStorage.setItem('loxford.storyHero', String(heroCat())); sessionStorage.setItem('loxford.auto', 'storymap'); } catch { /* no storage: no story */ return drawMenu(); }
    location.reload();
    return;
  }
  if (r === 'launch') return launch('match');
  if (r === 'tutorial') return launch('tutorial');
  if (r) { saveSettings(); if (r === 'shots' || r === 'assist' || r === 'aim' || r === 'reset') applyShots(); applySettings(); }
  drawMenu();
}
window.addEventListener('keydown', (e) => {
  if (statsOpen && !menu.state.open) {
    if (e.repeat) return;
    e.preventDefault();
    if (statsOpen === 'dailyintro') { if (['Enter', 'Space'].includes(e.code)) { closeStats(); startMatch(); } else if (e.code === 'Escape') leaveDaily(); }
    else if (statsOpen === 'daily') { if (e.code === 'Enter') leaveDaily(); else if (e.code === 'KeyC' && !practiceOn) copyShare(); else if (e.code === 'KeyR') { closeStats(); startMatch(); } else if (e.code === 'Escape') leaveDaily(); }
    else if (['Escape', 'KeyT', 'Enter', 'Space'].includes(e.code)) { closeStats(); if (e.code === 'Escape' && !core.state().matchOver) setPaused(true); }
    return;
  }
  if (menu.state.open) { const k = KEYS[e.code]; if (k) { e.preventDefault(); menuPress(k); } return; }
  if (bossIntro) { if (!e.repeat) endBossIntro(); return; }
  if (storyScreen) { if (e.repeat) return; if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); stepStopSelection(e.code === 'ArrowLeft' ? -1 : 1); } else if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); storyGo(); } else if (['Escape', 'Backspace'].includes(e.code)) leaveStory(); return; }
  if (talk) { if (e.repeat) return; if (['Enter', 'Space'].includes(e.code)) { e.preventDefault(); advanceTalk(); } else if (e.code === 'Escape') endTalk(); return; }
  if (e.repeat && !(paused && e.code.startsWith('Arrow'))) return; // held arrows keep stepping a pause setting
  if (e.code === 'Space') e.preventDefault();
  if (lessons) {
    if (e.repeat) return;
    if (['Enter', 'Space', 'ArrowRight'].includes(e.code)) { e.preventDefault(); stepLessons(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepLessons(-1); }
    else if (['Escape', 'Backspace'].includes(e.code)) endLessons();
    return;
  }
  if (emote && emote.t > 0.8 && ['Escape', 'Enter', 'Space'].includes(e.code)) { endEmote(); return; }
  if (emote && !online) return;
  if (replay) { if (e.code === 'KeyC') { replayAngle = (replayAngle + 1) % REPLAY_ANGLES.length; replayHint(); } else if (['Escape', 'KeyR', 'Enter', 'Space'].includes(e.code)) endReplay(); return; }
  if (intro) { if (['Escape', 'Enter', 'Space'].includes(e.code)) endIntro(); return; }
  if (paused && pauseSettings && ['Escape', 'KeyP', 'Enter', 'Space', 'Backspace'].includes(e.code)) { e.preventDefault(); pauseSettings = false; renderPause(); return; }
  if (paused && !pauseSettings && e.code === 'KeyS') { pauseSettings = true; renderPause(); return; }
  if (paused && pauseSettings && e.code.startsWith('Arrow')) {
    e.preventDefault();
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { pauseIdx = (pauseIdx + PAUSE_SETTINGS.length + (e.code === 'ArrowUp' ? -1 : 1)) % PAUSE_SETTINGS.length; renderPause(); }
    else pauseStep(pauseIdx, e.code === 'ArrowLeft' ? -1 : 1);
  } else if (e.code === 'Escape' || e.code === 'KeyP') setPaused(!paused);
  else if (e.code === 'KeyR') startReplay();
  else if (e.code === 'KeyT' && !paused && (!online || core.state().matchOver)) openStats('stats');
  else if (e.code === 'KeyC' && !paused) reviewLast();
  else if (e.code === 'KeyE' && !paused) { if (tryEmote(0)) haptic(0); }
  else if (e.code === 'Slash' && two && !paused) { if (tryEmote(1)) haptic(1); }
  else if (paused && (e.code === 'KeyM' || e.code === 'Backspace')) goMenu();
  else if ((e.code === 'Enter' || e.code === 'Space') && paused) setPaused(false);
  else if (e.code === 'Enter' && core.state().matchOver) matchOverNext();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !core.state().matchOver) setPaused(true); });
pauseEl.addEventListener('click', (e) => {
  const pa = e.target.closest('[data-pact]');
  if (pa) { const a = pa.dataset.pact; if (a === 'resume') setPaused(false); else if (a === 'settings') { pauseSettings = true; renderPause(); } else if (a === 'back') { pauseSettings = false; renderPause(); } else if (a === 'restart') restartMatch(); else if (a === 'stats') { paused = false; openStats('stats'); } else if (a === 'replay') { paused = false; if (!startReplay()) { paused = true; syncOverlays(); } } else if (a === 'menu') goMenu(); return; }
  if (e.target.closest('[data-pkeys]')) { keysOpen = !keysOpen; renderPause(); return; }
  const row = e.target.closest('[data-i]');
  if (row) { const act = e.target.closest('[data-act]'); if (act) pauseStep(Number(row.dataset.i), act.dataset.act === 'left' ? -1 : 1); else { pauseIdx = Number(row.dataset.i); renderPause(); } return; }
  if (!e.target.closest('.khelp, .pset')) { if (pauseSettings) { pauseSettings = false; renderPause(); } else setPaused(false); }
});
replayEl.addEventListener('click', endReplay);
introEl.addEventListener('click', endIntro);
lessonEl.addEventListener('click', () => stepLessons(1));
talkEl.addEventListener('click', advanceTalk);
function selectStop(i) { // click or arrow on the map: pick the stop shown in the panel (a finished stop to replay, or the next one)
  const pick = i >= 0 && i < storyStage ? i : -1;
  storySel = pick;
  const panel = storyEl.querySelector('.spanel'); if (panel) panel.outerHTML = stopPanelHtml({ hero: storyHero, stage: storyStage, sel: pick, thumbs: getStoryThumbs() });
  storyEl.querySelectorAll('.node').forEach((n) => n.classList.toggle('sel', Number(n.dataset.stop) === pick));
}
function stepStopSelection(dir) { // Left / Right on the map walk through the stops you can play
  const last = Math.min(storyStage, STAGES - 1), list = [...Array(last + 1).keys()].map((k) => (k < storyStage ? k : -1)); // the next stop is -1
  if (storyStage >= STAGES) list.push(-1); // finished: the ending is the last stop
  const at = Math.max(0, list.indexOf(storySel)), nx = list[(at + dir + list.length) % list.length];
  selectStop(nx);
}
bossEl.addEventListener('click', endBossIntro);
storyEl.addEventListener('click', (e) => {
  const pin = e.target.closest('.node');
  if (pin && storyScreen) { const i = Number(pin.dataset.stop); if (i <= storyStage) selectStop(i === storyStage ? -1 : i); return; } // a locked stop does nothing
  storyGo();
});
// mouse and touch: hover moves the highlight, a click confirms (or steps a setting's arrows)
function peekWardrobe(tile) { // point at a tile to see it on the cat; leave it and the equipped look returns
  const cap = menuEl.querySelector('.wcap');
  if (tile) {
    const [si, k] = tile.dataset.pick.split(':').map(Number), slot = SLOT_NAMES[si], item = SLOTS[slot][k];
    wardrobePeek = item ? { slot, id: item.id } : null;
    if (cap && item) { cap.querySelector('b').textContent = item.name; cap.querySelector('small').textContent = isUnlocked(progress.career, item) ? (progress.equip[slot] === item.id ? 'Wearing now' : 'Tap to wear') : `Locked: ${needText(item.need)}`; }
  } else {
    wardrobePeek = null;
    const slot = SLOT_NAMES[Math.min(menu.state.index, SLOT_NAMES.length - 1)], item = SLOTS[slot].find((x) => x.id === progress.equip[slot]) ?? SLOTS[slot][0];
    if (cap) { cap.querySelector('b').textContent = item.name; cap.querySelector('small').textContent = 'Wearing now'; }
  }
  refreshWardrobeLook();
}
menuEl.addEventListener('mouseover', (e) => {
  if (menu.state.screen === 'wardrobe') { const tile = e.target.closest('.wtile'); if (tile) peekWardrobe(tile); else if (wardrobePeek && !e.target.closest('.wtile')) peekWardrobe(null); }
  const it = e.target.closest('[data-i]');
  if (!it || Number(it.dataset.i) === menu.state.index) return;
  menu.setIndex(Number(it.dataset.i));
  if (menu.state.screen === 'cats') { drawMenu(); return; }
  menuEl.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel'));
  menuEl.querySelectorAll(`.mbtn[data-i="${menu.state.index}"], .card[data-i="${menu.state.index}"], .row[data-i="${menu.state.index}"]`).forEach((x) => x.classList.add('sel'));
});
menuEl.addEventListener('pointermove', (e) => { const w = e.target.closest('.wpreview'); if (w && wardrobeStage) { const r = w.getBoundingClientRect(); wardrobeStage.setPointer(((e.clientX - r.left) / r.width) * 2 - 1); } });
menuEl.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-time]');
  if (tb) { menu.state.settings.time = Number(tb.dataset.time); saveSettings(); drawMenu(); return; }
  const pk = e.target.closest('[data-pick]');
  if (pk && menu.state.screen === 'wardrobe') {
    const [si, k] = pk.dataset.pick.split(':').map(Number), slot = SLOT_NAMES[si], item = SLOTS[slot][k];
    menu.setIndex(si);
    if (item && isUnlocked(progress.career, item)) { progress.equip[slot] = item.id; saveProgress(store, progress); world.setCosmetics(equippedLook(progress)); }
    drawMenu(); return; // (drawMenu rebuilds the screen and its preview)
  }
  const ch = e.target.closest('[data-opt]');
  if (ch) { const r = menu.choose(Number(ch.dataset.i), Number(ch.dataset.opt)); if (r) { saveSettings(); if (r === 'shots' || r === 'assist' || r === 'aim') applyShots(); applySettings(); } drawMenu(); return; }
  const it = e.target.closest('[data-i]');
  if (!it) return;
  menu.setIndex(Number(it.dataset.i));
  const act = e.target.closest('[data-act]');
  menuPress(act ? act.dataset.act : 'enter');
});
// a friend's link (?join=CODE) opens straight on the cat pick for that game
const joinParam = cleanCode(q.get('join'));
if (!online && validCode(joinParam)) {
  menu.join(joinParam);
  try { const u = new URLSearchParams(location.search); u.delete('join'); history.replaceState(null, '', location.pathname + (u.toString() ? `?${u}` : '')); } catch { /* no history */ }
}
drawMenu();
// after a reload for a new cat or court: go straight into the match or tutorial
try {
  const auto = sessionStorage.getItem('loxford.auto');
  sessionStorage.removeItem('loxford.auto');
  if (inStory) { if (auto === 'storytalk') startTalk(); else showMap(); } // a story page always opens on the map (or the talk, after moving on)
  else if (inTourney) { if (auto === 'tourneymatch' && tourneyMatch()) startMatch(); else showBracket(); }
  else if (inDaily) { menu.close(); openStats('dailyintro'); drawMenu(); }
  else if (auto === 'tutorial' && !two) startTutorial(); else if (auto || online) startMatch();
} catch (e) { console.error('startup:', e); } // (no storage is fine; anything else is a bug worth seeing)
let swingsSeen = 0;

// What the page does with a message from the server: phones, the friend (online), emotes.
const seatCount = two ? 2 : 1;
function onDuel(m) {
  const r = peer.receive(m);
  if (r) {
    if (r.ev === 'rematch') rematch();
    return;
  }
  if (!m || typeof m !== 'object') return;
  if (m.k === 'emote') { peerEmote = { t: 0 }; world.cheer(); return; }
  if (m.k === 'pos') { if (Number.isFinite(m.x) && Number.isFinite(m.z)) rtarget = { x: m.x, z: m.z }; return; }
  if (m.k === 'score' && onlineCfg.host) return; // the host's score is the truth
  const k = applyLink(core, m, peer.oneWay);
  if (k === 'pt' && onlineCfg.host) sendPeer({ k: 'score', r: scoreOf(core.state()) }); // the guest ruled a point: tell it the host's score back
}
route = (m) => {
  if (m.type === 'duel') { if (online) onDuel(m.m); return; }
  if (m.type === 'peer') { if (!online) return; if (m.here) peer.joined(); else peer.left(); return; }
  if (m.type === 'emote') { const pad = m.pad ?? 0; if (pad < seatCount && tryEmote(pad)) haptic(pad); return; }
  if (m.type === 's' && (paused || replay)) return;
  // ready check: tell the player when a phone joins or drops, and what to do next
  if (m.type === 'controller-joined' && !menu.state.open) toast(`Phone${two ? ` ${(m.pad ?? 0) + 1}` : ''} connected \u2713`, 'Tap Calibrate on the phone, point it at the net, then swing');
  else if (m.type === 'controller-lost' && !menu.state.open) toast(`Phone${two ? ` ${(m.pad ?? 0) + 1}` : ''} disconnected`, 'Open the phone link again to carry on');
  session.onMessage(m); session2?.onMessage(m);
};
for (const m of early.splice(0)) if (m.type !== 'emote') route(m); // phone messages that came in while the lobby was open
document.addEventListener('visibilitychange', syncHold);

// ?style=chunky|retro|clean|soft to compare looks. ?res overrides the pixel width.
const STYLES = {
  chunky: { res: 960, levels: 0, edge: 1 },   // today's look
  retro: { res: 320, levels: 5, edge: 1 },    // big pixels, few colours, like an old console
  clean: { res: 1920, levels: 0, edge: 0.8 }, // no visible pixels, thin outlines
  soft: { res: 1920, levels: 0, edge: 0 },    // no outlines, flat storybook colour
};
const style = STYLES[q.get('style') ?? (q.get('ui') === '16bit' ? 'retro' : '')] ?? STYLES.chunky;
const look1 = lookFor(S.cat1, 0), look2 = lookFor(S.cat2, 1);
const teamLooks = doublesOn ? { partnerLook: lookFor(S.cat3, 0), cpu2Look: lookFor(S.cat4, 1) } : {};
const view = document.getElementById('view');
const worldOpts = { court: S.court, time: S.time, aspect: 16 / 9, rightHanded, res: Number(q.get('res')) || (two ? Math.round(style.res / 1.5) : style.res), levels: style.levels, edge: style.edge };
if (two) {
  document.body.classList.add('two');
  // each view fills its half of the window: render at that shape (kept between square and wide) and let CSS cover the rest
  const wide = innerWidth >= innerHeight;
  worldOpts.aspect = Math.min(1.78, Math.max(0.95, wide ? innerWidth / 2 / innerHeight : innerWidth / (innerHeight / 2)));
  view.classList.add('half');
  world = createWorld(view, { ...worldOpts, fit: false, humanLook: look1, cpuLook: look2 });
  world2 = createWorld(document.getElementById('view2'), { ...worldOpts, fit: false, humanLook: look2, cpuLook: look1 });
} else {
  // fill the whole window: render at the window's shape (kept between 4:3 and ultrawide) and scale to cover the window, so there are no black bars
  worldOpts.aspect = Math.min(2.1, Math.max(1.33, innerWidth / innerHeight));
  world = createWorld(view, { ...worldOpts, cover: true, humanLook: look1, cpuLook: look2, ...teamLooks });
}
world.setCosmetics(equippedLook(progress)); // what you have unlocked and equipped
if (dailyRun) world.setTargets(dailyRun.run.targets.length ? dailyRun.run.targets : null);
globalThis.loxford = { setIdleQ, core, core2, session, session2, world, world2, online: online ? { peer, sock, get cfg() { return onlineCfg; } } : null, get audio() { return audio; }, get music() { return music; } };
globalThis.loxford.dbg = { toast: (t, sm) => toast(t, sm), openStats: (k) => openStats(k), closeStats: () => closeStats(), review: () => reviewLast(), restart: () => restartMatch(), stats, progress, get lastBounce() { return lastBounce; }, hawk: (x, z, ruledIn, serve = false) => { const call = closeCall({ x, z }, { serve, ruledIn }); if (call) showHawk(call, { x, z }, serve); return call; }, fakeBounce: (x, z, serve = false) => { lastBounce = { mark: { x, z }, serve, call: closeCall({ x, z }, { serve }), t: 0, ruledIn: undefined }; } }; // for tests and the browser console
globalThis.loxford.story = { hero: storyHero, get stage() { return storyStage; }, next: () => storyContinue(), go: () => storyGo() }; // for tests

const audio = createAudio();
const music = createMusic();
audioReady = true;
/** Push the settings that act at once (volumes, shake, ball colour, weather, the court's sound) into the audio and the views. */
function applySettings() {
  audio.setVolume(S.sfxVol / 8); music.setVolume(S.musicVol / 5); // the defaults (80% and 50%) are the loudness the game always had; 100% is louder
  for (const w of [world, world2]) { w?.setShake(S.shake === 0); w?.setBallColor(BALL_COLORS[S.ballcol] ?? BALL_COLORS[0]); w?.setWeather(weatherNow()); }
  audio.setWeather(weatherNow()); audio.setSurface(COURTS[S.court]?.id ?? 'hard');
}
function weatherNow() { return inStory ? (storyStop().stop.weather ?? S.weather) : S.weather; }
applySettings();
const lastHits = [0, 0];
const haptic = (pad) => { sock.send({ type: 'haptic', pad, ms: 45 }); };

// A point just won: flash it in the middle of the screen.
const fxEl = document.getElementById('pointfx');
let fxPrev = null, fxTimer = 0;
function showPointFx() {
  const st = core.state();
  const cur = { pts: st.pointsHuman + st.pointsCpu, h: st.pointsHuman, c: st.pointsCpu, gh: st.gamesH, gc: st.gamesC };
  if (menu.state.open || st.pointsHuman + st.pointsCpu === 0 || (fxPrev && cur.pts < fxPrev.pts)) { fxPrev = cur; if (menu.state.open) fxEl.classList.remove('go'); return; }
  const fx = pointFx(fxPrev, st, NAMES);
  fxPrev = cur;
  if (!fx) return;
  fxEl.className = `${fx.human ? 'win' : 'lose'}${fx.game ? ' game' : ''}`;
  fxEl.innerHTML = `<div class="big"></div><div class="why"></div><div class="score"></div>`;
  fxEl.querySelector('.big').textContent = fx.headline;
  fxEl.querySelector('.why').textContent = fx.why;
  fxEl.querySelector('.score').textContent = fx.score;
  void fxEl.offsetWidth;
  fxEl.classList.add('go');
  clearTimeout(fxTimer);
  fxTimer = setTimeout(() => fxEl.classList.remove('go'), 2300);
}
// While a phone is missing, a QR code under the message opens the controller page.
const qrBox = document.getElementById('qrbox');
let qrKey = null;
function showQr(sessions) {
  const missing = sessions.findIndex((x) => x.status().paused && !x.status().connected);
  const need = !menu.state.open && missing >= 0;
  qrBox.style.display = need ? 'block' : 'none';
  // online: this page's own room; two players: the seat of the phone that is missing
  const key = online ? `room=${roomId}` : two ? `seat=${missing + 1}` : '';
  if (need && qrKey !== key) {
    qrKey = key;
    document.getElementById('qrimg').src = `/phone-qr.svg?${key}&_=${Date.now()}`;
    fetch(`/phone-url?${key}`).then((r) => r.text()).then((u) => { document.getElementById('qrurl').textContent = u; }).catch(() => {});
  }
}

const state0Over = () => core.state().matchOver;
// Online: tell the friend what the core just did (serves, shots, points, where the cat is) and draw the friend's cat smoothly.
function netPump(dt, hold) {
  if (hold || !peer.ready) return;
  for (const m of outbox.collect(core)) {
    sendPeer(m);
    if (m.k === 'pt' && onlineCfg.host) sendPeer({ k: 'score', r: m.score }); // the host's own ruling: the score to adopt
  }
  const t = performance.now();
  if (t - posSentAt >= 50) { posSentAt = t; sendPeer(outbox.pos(core)); } // 20 times a second is enough for a walking cat
  if (rtarget) {
    rcur = rcur ?? { ...rtarget };
    const k = Math.min(1, dt * 14);
    rcur.x += (rtarget.x - rcur.x) * k; rcur.z += (rtarget.z - rcur.z) * k;
    core.remotePos(rcur.x, rcur.z);
  }
}
// Whether this side is holding the match (shared with the friend online, so a pause or a missing phone stops both).
let heldSent = false;
function syncHold() {
  if (!online) return;
  const on = paused || menu.state.open || session.wouldPause() || document.hidden;
  if (on !== heldSent) { heldSent = on; peer.hold(on); }
}
const peerbar = document.getElementById('peerbar');
function drawPeerBar() {
  let t = '';
  if (online) {
    const ms = Math.round(peer.oneWay * 2000);
    if (!sock.open) t = 'Connection lost. Reconnecting...';
    else if (!peer.here) t = 'Your friend disconnected. Esc, then Main menu to leave';
    else if (peer.wantsAgain && !peer.peerWantsAgain) t = 'Waiting for your friend to accept the rematch...';
    else if (peer.peerWantsAgain && !peer.wantsAgain) t = 'Your friend wants a rematch. Press Rematch to accept';
    else if (peer.peerHolding) t = 'Your friend paused';
    else if (!intro && !peer.ready) t = 'Waiting for your friend...';
    else t = `Online \u00B7 ${ms < 80 ? '\u2582\u2584\u2586' : ms < 180 ? '\u2582\u2584\u2581' : '\u2582\u2581\u2581'} ${ms} ms`;
  }
  peerbar.style.display = t && !menu.state.open ? 'block' : 'none';
  if (peerbar.textContent !== t) peerbar.textContent = t;
}
// ---- extras: toasts, the close-call review, the stats screen, restart, daily challenge and tournament flows ----
function toast(title, small = '') {
  toastEl.innerHTML = '';
  const b = document.createElement('div'); b.textContent = title; toastEl.appendChild(b);
  if (small) { const sm = document.createElement('small'); sm.textContent = small; toastEl.appendChild(sm); }
  toastEl.classList.remove('go'); void toastEl.offsetWidth; toastEl.classList.add('go');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('go'), 3300);
}
const matchGamesToWin = () => (inStory ? storyStop().games : inTourney ? (tourneyMatch()?.games ?? 4) : (Number(q.get('games')) || 4));
function showHawk(call, mark, serve, note = '') {
  hawkEl.className = `go ${call.verdict === 'IN' ? 'in' : 'out'}`;
  hawkEl.innerHTML = hawkHtml(call, mark, { serve }) + (note ? `<small>${note}</small>` : '');
  clearTimeout(hawkTimer); hawkTimer = setTimeout(() => { hawkEl.className = ''; }, 2800);
}
/** C: look at the last landing mark again (three a match). The core's ruling is exact, so a review shows the call and never overturns it. */
function reviewLast() {
  if (menu.state.open || frozen() || !lastBounce || S.calls !== 0) return;
  const lb = lastBounce, call = closeCall(lb.mark, { serve: lb.serve, ruledIn: lb.ruledIn }) ?? { line: 'nearest line', dist: 0, verdict: (lb.ruledIn ?? true) ? 'IN' : 'OUT' };
  const spent = challenges.use(call);
  if (!spent) { toast('No reviews left', 'Three per match'); return; }
  showHawk(call, lb.mark, lb.serve, `Review: the call stands · ${challenges.left} left`);
}
function renderStats() {
  const names = NAMES;
  if (statsOpen === 'dailyintro') statsEl.innerHTML = `<div class="sttitle">${practiceOn ? 'Practice' : 'Daily Challenge'}</div><div class="stwho">${practiceOn ? `Best ${loadPractice(store)[dailyCh.def.id] ?? '-'}` : dailyCh.date}</div><div class="sttitle" style="font-size:clamp(24px,5vw,44px)">${dailyCh.def.name}</div><div class="stwho" style="letter-spacing:1px;max-width:46ch">${dailyCh.def.text}</div><div class="sthint">Enter: start &middot; Esc: back to the menu</div>`;
  else if (statsOpen === 'daily' && practiceOn) statsEl.innerHTML = practiceEndHtml(dailyRun.run, practiceResult);
  else if (statsOpen === 'daily') { const r = dailyRun.run, stars = starsFor(r), all = loadDaily(store); statsEl.innerHTML = dailyEndHtml(r, stars, { date: dailyCh.date, best: all[dailyCh.date] ?? 0, streak: progress.career.streak }); }
  else statsEl.innerHTML = statsHtml(stats.summary(), { names }) + '<div class="sthint">T / Esc / Enter: close</div>';
}
function openStats(kind = 'stats') { if (menu.state.open) return; statsOpen = kind; paused = true; replay = null; intro = null; renderStats(); syncOverlays(); syncHold(); }
function closeStats() { statsOpen = null; paused = false; syncOverlays(); syncHold(); }
function restartMatch() { if (online) return; statsOpen = null; paused = false; if (inDaily) { newMatch(); startIntro(); syncOverlays(); return; } newMatch(); startIntro(); syncOverlays(); }
function leaveDaily() { try { sessionStorage.removeItem('loxford.daily'); sessionStorage.removeItem('loxford.auto'); } catch { /* none */ } location.reload(); }
function leaveTourney() { try { sessionStorage.removeItem('loxford.tourneyHero'); sessionStorage.removeItem('loxford.auto'); } catch { /* none */ } location.reload(); }
function finishDaily() {
  dailyDone = true;
  if (practiceOn) { // a practice game keeps a best score and nothing else
    const r = dailyRun.run;
    if (!r.over) { r.over = true; r.won = true; r.note = `Best rally ${r.best} hits`; if (r.def.id === 'practice-rally') r.score = r.best; }
    practiceResult = savePractice(store, r.def.id, r.score);
    openStats('daily');
    return;
  }
  const r = dailyRun.run, stars = starsFor(r);
  if (state0Over() && !r.over) { r.over = true; r.won = false; r.note = 'The match ended first'; }
  saveDaily(store, dailyCh.date, stars);
  if (r.won) { const got = recordFeat(progress, 'daily', { date: dailyCh.date }); saveProgress(store, progress); if (got.length) setTimeout(() => toast(`Unlocked: ${got.map((g) => g.item.name).join(', ')}`, 'See the Wardrobe'), 600); }
  openStats('daily');
}
async function copyShare() { const r = dailyRun.run; const t = shareText(r.def, dailyCh.date, starsFor(r)); try { await navigator.clipboard.writeText(t); toast('Copied!', t); } catch { toast('Copy this', t); } }
// tournament: the bracket screen reuses the story screen
function showBracket({ note = '' } = {}) {
  menu.close(); paused = false; replay = null; intro = null; talk = null; tutorial = null; statsOpen = null;
  storyScreen = {};
  const m = tourneyMatch();
  const head = tourney.champion !== -1 ? (tourney.champion === tourneyHero ? 'You are the champion!' : `${ALL_CATS[tourney.champion].name} wins the tournament`) : `Next: ${m ? `${m.name} vs ${ALL_CATS[m.rival].name}` : 'the bracket'}`;
  const safe = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  storyEl.innerHTML = `<div class="storymap"><div class="shead"><h2>Tournament</h2></div><div class="steps">${safe(head)}</div>${bracketHtml(tourney, getStoryThumbs())}<div class="snote">${safe(note)}</div><div class="spanel go"><small>${m ? 'Enter or swing: play the next match' : 'Enter or swing: start a new tournament'} · Esc: leave</small></div></div>`;
  syncOverlays(); drawMenu();
}
function tourneyGo() {
  if (!tourneyMatch()) { tourney = newTournament(tourneyHero, (Math.random() * 1e9) >>> 0); saveTournament(store, tourney); showBracket(); return; }
  storyScreen = null; applyTourney();
  if (configKey() !== loadedKey) { try { sessionStorage.setItem('loxford.auto', 'tourneymatch'); } catch { /* then it shows the bracket again */ } location.reload(); return; }
  startMatch();
}
function tourneyContinue() {
  const won = core.state().matchWinner === 0, rival = ALL_CATS[tourneyMatch()?.rival ?? 0]?.name ?? '';
  const round = tourneyMatch()?.name ?? '';
  tourneyReport(tourney, won); saveTournament(store, tourney);
  let note = won ? `${round} won against ${rival}.` : `Knocked out by ${rival} in the ${round.toLowerCase()}.`;
  if (tourney.champion === tourneyHero) { const got = recordFeat(progress, 'tourney'); saveProgress(store, progress); addTitle(store, tourneyHero); note = 'You lifted the trophy!'; if (got.length) note += ` Unlocked: ${got.map((g) => g.item.name).join(', ')}.`; }
  showBracket({ note });
}
// ---- everything that watches the match as it is played ----
let lastHitter = -1, lastHitServe = false, fireWins = 0, trophyShown = false;
// Doubles: `hits` counts the whole near team, but the shot labels, effort grunts, stats and heat map describe the human's own hits.
const humanOnly = (s) => (doublesOn && s ? { ...s, hits: s.hits - s.partnerHits } : s);
function trackMatch(st, dt) {
  if (menu.state.open || frozen()) return;
  const now = performance.now() / 1000;
  if (!prevSt) { prevSt = st; fireWins = 0; trophyShown = false; lastHitter = -1; stats.push(humanOnly(st)); bounces.push(st); return; }
  const inPlay = [1, 2, 4, 5].includes(st.labState);
  if (st.hits > prevSt.hits) { rallyCount++; lastHitter = doublesOn && st.partnerHits > prevSt.partnerHits ? 2 : 0; lastHitServe = lastHitter === 0 && st.hitSide === 0 && rallyCount === 1; }
  if (st.cpuHits > prevSt.cpuHits) { rallyCount++; lastHitter = 1; lastHitServe = false; }
  if (S.impact === 0 && !emote) { const imp = impactOf(humanOnly(prevSt), humanOnly(st), { rally: rallyCount }); if (imp) world.impact(imp, { hold: holdFor(imp), punchDeg: punchFor(imp) }); }
  // where the ball landed: your shots go in the stats; a close call gets a second look
  const b = bounces.push(st);
  if (b) {
    if (lastHitter === 0 && b.z > 0) { stats.landed(b); dailyRun?.landed(b); }
    const call = S.calls === 0 ? closeCall(b, { serve: lastHitServe }) : null;
    lastBounce = { mark: b, serve: lastHitServe, call, t: now, ruledIn: undefined };
    if (call) pendingCall = lastBounce;
    if (dailyRun?.run.targets.length) world.setTargets(dailyRun.run.targets); // the rings turn green as they are hit
  }
  const pts = st.pointsHuman + st.pointsCpu, was = prevSt.pointsHuman + prevSt.pointsCpu;
  const faultNow = st.labState === 0 && prevSt.labState !== 0 && st.serveN === 2 && st.why === 5;
  let closeShown = false;
  if (lastBounce && lastBounce.ruledIn === undefined && (pts > was || faultNow)) lastBounce.ruledIn = !(st.why === 1 || (lastBounce.serve && st.why === 5));
  if (pendingCall && (pts > was || faultNow || now - pendingCall.t > 0.7)) {
    const ruledIn = pendingCall.ruledIn ?? true; pendingCall.ruledIn = ruledIn;
    const call = closeCall(pendingCall.mark, { serve: pendingCall.serve, ruledIn });
    if (call) { showHawk(call, pendingCall.mark, pendingCall.serve); lastCall = call; closeShown = true; }
    pendingCall = null;
  }
  stats.push(humanOnly(st));
  if (dailyRun && !dailyDone) { dailyRun.push(st); if (dailyRun.run.over || st.matchOver) finishDaily(); }
  // the crowd and the cats call out what happened
  audio.react(reactionsFor(humanOnly(prevSt), humanOnly(st), { rally: rallyCount, closeCall: closeShown, gamesToWin: matchGamesToWin() }), { cat: S.cat1, pan: st.playerX });
  audio.setRally(rallyCount, inPlay); world.setRally(inPlay ? rallyZoom(rallyCount) : 0);
  if (st.gamesH + st.gamesC > prevSt.gamesH + prevSt.gamesC) gameSwellUntil = now + 3.5;
  if (pts > was) {
    endedRally = rallyCount;
    if (st.pointsHuman > prevSt.pointsHuman && endedRally >= FIRE_FULL) fireWins++;
    if (!online && !two && S.autoreplay === 0 && (st.matchOver || endedRally >= FIRE_FULL)) autoReplayAt = now + 1.6; // match point, or a burning-ball rally: show it again
    rallyCount = 0; lastHitter = -1;
  }
  world.setDusk((st.gamesH + st.gamesC) / (2 * matchGamesToWin()));
  if (partyOn) { const g = st.gamesH + st.gamesC; if (g !== partyGame) { partyGame = g; partyMod = modFor(partySeed, g); applyShots(); world.setLook(lookOf(partyMod)); toast(partyMod.name, partyMod.text); } }
  if (st.matchOver && !matchRecorded) {
    matchRecorded = true; winnerSince = now; trophyShown = false;
    if (!two && !doublesOn) { // doubles does not count toward the career record
      const sum = stats.summary();
      const got = recordMatch(progress, { won: st.matchWinner === 0, aces: sum.aces, longest: sum.longest, winners: sum.winners, points: sum.pointsWon, fire: fireWins, mode: partyOn ? 'party' : inStory ? 'story' : inTourney ? 'tourney' : inDaily ? 'daily' : online ? 'online' : 'match', hero: S.cat1, rival: S.cat2, score: [st.gamesH, st.gamesC] });
      saveProgress(store, progress);
      if (got.length) setTimeout(() => toast(`Unlocked: ${got.map((g) => g.item.name).join(', ')}`, 'Equip it in More modes › Wardrobe'), 2500);
    }
  }
  prevSt = st;
}
const partySeed = (Math.random() * 1e9) >>> 0;
/** After the match: the winner dances with the trophy (the loser has the tantrum). */
function winnerPose() {
  const st = core.state(), now = performance.now() / 1000;
  if (!st.matchOver || winnerSince < 0 || two) return;
  const t = now - winnerSince, human = st.matchWinner === 0;
  const d = blendDance(danceFor(human ? S.cat1 : S.cat2, t), Math.min(1, t / 0.6), [0.866, -0.5, 0, 0]);
  if (t > 0.5) (human ? world.setEmote : world.setCpuEmote)(d);
  if (t > 1.2 && !trophyShown) { trophyShown = true; world.showTrophy(human ? 'human' : 'cpu'); }
}
/** Music plays on the menus, story screens, cut scenes and lessons, and (a calmer tune) while paused: never during live play. */
function musicPlan() {
  if (paused && !menu.state.open && !storyScreen && !talk && !lessons) return [true, 0.45, 'pause']; // a pause plays its own, calmer tune
  if (storyScreen || talk) return [true, 0.5, 'story'];
  if (menu.state.open && menu.state.screen === 'cats') return [true, 0.5, 'select'];
  return [!!(menu.state.open || lessons), 0.5, 'menu'];
}

let last = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.1, (nowMs - last) / 1000); // a hidden tab must not fast-forward a replay or intro
  last = nowMs;
  const sessions = two ? [session, session2] : [session];
  // a two-player match holds both players while either phone is missing; online, a pause, a lost phone or an unfinished intro on either side holds both
  syncHold();
  const hold = (two && sessions.some((x) => x.wouldPause())) || frozen() || (online && (peer.holding || session.wouldPause()));
  // one keyboard, two players: WASD moves player 1, the arrows move player 2
  sessions.forEach((x, i) => x.update(hold ? 0 : dt, two ? input.axes(i) : input.axes()));
  if (!frozen() && !(online && hold)) duel?.pump();
  if (online) netPump(dt, hold);
  sessions.forEach((x, i) => { // buzz the phone when its player's racket hits the ball
    const h = x.core.state().hits;
    if (h > lastHits[i]) haptic(i);
    lastHits[i] = h;
  });
  if (wardrobeStage && menu.state.open && menu.state.screen === 'wardrobe' && wardrobeCv.isConnected) { wardrobeStage.update(Math.min(dt, 0.05)); wardrobeStage.render(); }
  if (mapScene) { if (storyScreen && mapScene.canvas.isConnected) { mapScene.update(dt); mapScene.render(); } else stopMapScene(); }
  { const [on, lv, tune] = musicPlan(); music.setPlaying(on, lv, tune); }
  if (!hold && !menu.state.open) rec.push(dt, core.state(), two ? core2.state() : null, session.status(), session2?.status());
  if (tutorial && !menu.state.open && !frozen()) { // lesson text, and tell the core which balls to feed
    const v = tutorial.update(core.state());
    core.setTutorial(v.side);
    tutEl.style.display = 'block';
    tutEl.innerHTML = `<b>${v.label}</b>${v.text.replace(/</g, '&lt;')}`;
  } else tutEl.style.display = 'none';
  if (titleScene && titleEl.style.display !== 'none') { titleScene.update(Math.min(dt, 0.05)); titleScene.render(); }
  if (stage && stageEl.style.display !== 'none') { stage.update(Math.min(dt, 0.05)); stage.render(); }
  showPointFx(sessions);
  showQr(sessions);
  const swings = sessions.reduce((n, x) => n + x.status().swings, 0);
  if (swings !== swingsSeen) {
    swingsSeen = swings;
    if (menu.state.open) menuPress('enter'); else if (replay) endReplay(); else if (storyScreen) storyGo(); else if (talk) advanceTalk(); else if (lessons) { if (lessons.t > 1.2) stepLessons(1); } else if (emote) { if (emote.t > 1) endEmote(); } else if (intro) endIntro(); else if (!paused && core.state().matchOver && !rematchBtn()) matchOverNext(); // (a plain match ends on the Rematch button, not a swing)
  }
  if (!frozen()) { if (two) updateHud2(sessions, document); else if (online) updateHud(session, document, { names: ['YOU', 'FRIEND'], opponent: 'FRIEND', button: true }); else updateHud(session, document, { names: NAMES, button: rematchBtn() }); }
  syncRematch();
  drawPeerBar();
  if ((inStory || inTourney) && state0Over()) { const b = document.getElementById('banner'); if (b.textContent.includes('rematch')) b.textContent = b.textContent.replace('rematch', inTourney ? 'see the bracket' : core.state().matchWinner === 0 ? 'continue the story' : 'back to the map'); }
  if (lessons) { // the lesson: the cat acts out the example swing and the virtual phone turns with it
    const tPrev = lessons.t; lessons.t += dt;
    const l = LESSONS[lessons.i];
    if (l.kind === 'swing') {
      const f = lessonFrame(l, lessons.t);
      for (const id of contactsBetween(l, tPrev, lessons.t)) lessonStage?.launch(id); // the ball is struck: show the shot
      lessonStage?.setPose({ qR: demoQuat(f.id, f.u), phone: true });
      const chips = lessonChips(f.id), key = chips.join('|');
      if (lessons.chips !== key) { lessons.chips = key; lessonEl.querySelector('.lchips').innerHTML = chips.map((c) => `<b>${c.replace(/</g, '&lt;')}</b>`).join(''); }
    } else if (l.kind === 'emote') lessonStage?.setPose({ dance: danceFor(S.cat1, lessons.t), qR: null });
    if (lessonStage) { lessonStage.update(Math.min(dt, 0.05)); lessonStage.render(); }
  }
  if (talk) { // the cut scene: type the line in, move the cats, draw the 3D scene
    const sp = talk.lines[talk.i].mine ? 0 : 1;
    if (talk.chars < talk.full.length) talk.chars = Math.min(talk.full.length, talk.chars + dt * 48);
    const shown = Math.floor(talk.chars);
    if (talk.shown !== shown) { // a blip for each new letter as the line types in (none when a press finishes it at once)
      if (shown - (talk.blipped ?? 0) <= 4) for (let k = talk.blipped ?? 0; k < shown; k++) { const b = blipFor(sp, talk.full[k] ?? ' ', k, { boss: talkBoss() }); if (b) playCutSfx([b]); }
      talk.blipped = shown; talk.shown = shown; const p = talkEl.querySelector('p'); if (p) p.textContent = talk.full.slice(0, shown); } // also after a press finished the line
    talkStage?.setTalking(sp, talk.chars < talk.full.length);
    if (talkStage) { talkStage.update(Math.min(dt, 0.05)); talkStage.render(); }
  }
  const state = core.state();
  trackMatch(state, dt);
  winnerPose();
  if (autoReplayAt > 0 && performance.now() / 1000 >= autoReplayAt) { autoReplayAt = -1; if (!frozen() && !menu.state.open) startReplay(); }
  chalEl.classList.toggle('on', !!dailyRun && !dailyDone && !menu.state.open && !frozen());
  if (dailyRun) chalEl.innerHTML = `<b>${dailyCh.def.name}</b>${dailyRun.hud()}`;
  document.getElementById('sound').style.display = audio.unlocked() && music.unlocked() ? 'none' : 'block';
  if (!sessions.some((x) => x.status().paused) && !menu.state.open && !frozen()) audio.update(state, nowMs / 1000);
  // what the views draw: the live match, a recorded frame (replay, a touch slower) or the live match under the cut-scene camera
  let v = { st: state, st2: two ? core2.state() : null, p1: session.status(), p2: session2?.status(), dt };
  if (replay) {
    replay.t += dt * REPLAY_SPEED;
    const f = replay.clip[frameAt(replay.clip, replay.t)];
    v = { st: withReplayAngle(f.st, replayAngle), st2: withReplayAngle(f.st2, replayAngle), p1: f.status, p2: f.status2, dt: dt * REPLAY_SPEED };
    replayEl.querySelector('i').style.width = `${Math.min(100, (replay.t / replay.len) * 100)}%`;
    if (replay.t > replay.len + 0.8) endReplay();
  } else if (emote) {
    emote.t += dt;
    const ep = emote.pad, cat = ep === 1 ? S.cat2 : S.cat1, est = coreOf(ep).state();
    const dance = blendDance(danceFor(cat, emote.t), emoteWeight(emote.t), [0.866, -0.5, 0, 0]);
    worldOf(ep).setEmote(dance);
    if (two) (ep === 1 ? world : world2).setCpuEmote(dance); // the other player's view sees the dance too
    const c = emoteCam(emote.t, { x: est.playerX, z: est.playerZ });
    const cam = (st) => ({ ...st, camEX: c.ex, camEY: c.ey, camEZ: c.ez, camTX: c.tx, camTY: c.ty, camTZ: c.tz, camFov: c.fov });
    if (ep === 1) v.st2 = cam(v.st2 ?? est); else v.st = cam(v.st);
    if (emote.t >= EMOTE_TIME || (online && !canEmote(core.state()))) endEmote(); // online the match does not wait: the next serve ends the show
  } else if (intro) {
    intro.t += dt;
    if (!intro.cheered && intro.t >= 0.3) { intro.cheered = true; intro.crowd = audio.play('applause', { gain: 1 }); } // the crowd welcomes the cats in
    if (intro.t >= (intro.nextCheer ?? 0.3)) { intro.nextCheer = intro.t + 1.2; world.cheer(); world2?.cheer(); } // and keeps hopping until the match starts
    if (!intro.go && intro.t >= INTRO_TIME - 0.7) { intro.go = true; audio.play('whistle', { gain: 0.7 }); }
    const camOf = (st) => { const c = introCam(intro.t, { ex: st.camEX, ey: st.camEY, ez: st.camEZ, tx: st.camTX, ty: st.camTY, tz: st.camTZ, fov: st.camFov }); return { ...st, camEX: c.ex, camEY: c.ey, camEZ: c.ez, camTX: c.tx, camTY: c.ty, camTZ: c.tz, camFov: c.fov }; };
    v.st = camOf(v.st); if (v.st2) v.st2 = camOf(v.st2);
    const cap = introCaption(intro.t, [ALL_CATS[S.cat1 % ALL_CATS.length].name, ALL_CATS[S.cat2 % ALL_CATS.length].name]);
    if (introEl.dataset.phase !== cap.phase) {
      introEl.dataset.phase = cap.phase;
      introEl.innerHTML = `<div class="ibig"></div><div class="ismall"></div><div class="iskip">Enter / swing to skip</div>`;
      introEl.querySelector('.ibig').textContent = cap.big; introEl.querySelector('.ismall').textContent = cap.small;
    }
    if (intro.t >= INTRO_TIME) endIntro();
  }
  if (peerEmote) {
    peerEmote.t += dt;
    world.setCpuEmote(blendDance(danceFor(S.cat2, peerEmote.t), emoteWeight(peerEmote.t), [0.866, -0.5, 0, 0]));
    if (peerEmote.t >= EMOTE_TIME || [1, 2, 4, 5].includes(state.labState)) { peerEmote = null; world.setCpuEmote(null); } // until the next ball is in play
  }
  if (!paused || statsOpen) world.update(v.st, v.p1, statsOpen ? 0 : v.dt); // the stats card sits over a still picture of the court
  for (const e of world.events.splice(0)) audio.voice(e.type, { pan: e.pan, pitch: e.pitch });
  if (world2) world2.events.length = 0; // the first view makes the sound for both
  if (!paused) world2?.update(v.st2 ?? core2.state(), v.p2 ?? session2.status(), v.dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
