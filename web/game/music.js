// Main-menu music: a short chiptune loop made with Web Audio (square, triangle and noise voices),
// so there is no audio file to ship. 120 bpm, eight bars, A minor / C major feel.
export const STEP = 0.125;      // seconds per sixteenth note
export const BARS = 8, STEPS = BARS * 16;
const CHORDS = [[48, 0, 4, 7], [45, 0, 3, 7], [41, 0, 4, 7], [43, 0, 4, 7]]; // root midi, then triad offsets
export const chordAt = (bar) => CHORDS[bar % 4];

// [step in bar, midi note, length in steps] for each bar's melody
const MELODY = [
  [[0, 76, 4], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
  [[0, 72, 4], [4, 76, 4], [8, 81, 4], [12, 79, 4]],
  [[0, 81, 4], [4, 77, 2], [6, 81, 2], [8, 79, 4], [12, 77, 4]],
  [[0, 74, 4], [4, 79, 4], [8, 83, 6], [14, 79, 2]],
  [[0, 76, 4], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
  [[0, 72, 2], [2, 74, 2], [4, 76, 4], [8, 72, 8]],
  [[0, 77, 4], [4, 81, 4], [8, 84, 4], [12, 81, 4]],
  [[0, 83, 2], [2, 81, 2], [4, 79, 4], [8, 74, 8]],
];

// The pause tune: slower and softer than the menu loop (90 bpm, F major, no drums) so a pause sounds like a breather.
export const PAUSE_STEP = 60 / 90 / 4;
const PAUSE_CHORDS = [[53, 0, 4, 7], [55, 0, 4, 7], [52, 0, 3, 7], [57, 0, 3, 7]]; // F, G, Em, Am
const PAUSE_MELODY = [
  [[0, 77, 6], [8, 81, 4], [12, 79, 4]],
  [[0, 79, 6], [8, 83, 4], [12, 81, 4]],
  [[0, 76, 6], [8, 79, 4], [12, 76, 4]],
  [[0, 72, 4], [4, 76, 4], [8, 81, 8]],
  [[0, 77, 6], [8, 84, 4], [12, 81, 4]],
  [[0, 79, 6], [8, 83, 4], [12, 79, 4]],
  [[0, 76, 4], [4, 79, 4], [8, 83, 4], [12, 79, 4]],
  [[0, 81, 8], [8, 77, 8]],
];

// Story tune: 96 bpm, D minor, a steady walking-pace march with a flute lead.
const STORY_STEP = 60 / 96 / 4;
const STORY_CHORDS = [[50, 0, 3, 7], [46, 0, 4, 7], [53, 0, 4, 7], [48, 0, 4, 7]]; // Dm, Bb, F, C
const STORY_MELODY = [
  [[0, 74, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]], [[0, 77, 4], [4, 74, 4], [8, 70, 4], [12, 74, 4]],
  [[0, 72, 4], [4, 77, 4], [8, 81, 4], [12, 84, 4]], [[0, 79, 6], [8, 76, 4], [12, 72, 4]],
  [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 82, 6], [14, 81, 2]], [[0, 79, 4], [4, 77, 4], [8, 74, 8]],
  [[0, 77, 4], [4, 81, 4], [8, 84, 4], [12, 81, 4]], [[0, 79, 4], [4, 76, 4], [8, 74, 8]],
];
// Select tune: 138 bpm, C major, bouncy, for choosing your cat.
const SELECT_STEP = 60 / 138 / 4;
const SELECT_CHORDS = [[48, 0, 4, 7], [43, 0, 4, 7], [45, 0, 3, 7], [41, 0, 4, 7]]; // C, G, Am, F
const SELECT_MELODY = [
  [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 79, 2], [12, 76, 4]], [[0, 74, 2], [2, 79, 2], [4, 83, 4], [8, 86, 4], [12, 83, 4]],
  [[0, 81, 2], [2, 84, 2], [4, 81, 4], [8, 76, 4], [12, 79, 4]], [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 4], [12, 77, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 79, 2], [12, 76, 4]], [[0, 74, 4], [4, 79, 4], [8, 83, 8]],
  [[0, 84, 4], [4, 81, 4], [8, 76, 4], [12, 81, 4]], [[0, 77, 4], [4, 79, 4], [8, 72, 8]],
];
// Loudness trim per tune so they all sit at the same level (measured as the RMS of the master output at the same setting:
// menu .045, pause .043, story .049, select .049), then nudged to match the menu tune.
export const TUNE_TRIM = { menu: 1, pause: 1.05, story: 0.93, select: 0.93 };
export const stepLen = (tune) => (tune === 'pause' ? PAUSE_STEP : tune === 'story' ? STORY_STEP : tune === 'select' ? SELECT_STEP : STEP);

export const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Every sound that starts on a given step (0..STEPS-1) of the loop. */
export function eventsAt(step, tune = 'menu') {
  if (tune === 'pause') return pauseEventsAt(step);
  if (tune === 'story') return storyEventsAt(step);
  if (tune === 'select') return selectEventsAt(step);
  const bar = Math.floor(step / 16), s = step % 16;
  const [root, ...triad] = chordAt(bar);
  const out = [];
  if (s % 4 === 0) out.push({ voice: 'bass', midi: root, len: 3 });
  else if (s === 6 || s === 14) out.push({ voice: 'bass', midi: root + 7, len: 1.5 });
  out.push({ voice: 'arp', midi: root + 24 + triad[[0, 1, 2, 1][s % 4]], len: 1 });
  for (const [at, midi, len] of MELODY[bar]) if (at === s) out.push({ voice: 'lead', midi, len });
  if (s === 0 || s === 8) out.push({ voice: 'kick' });
  if (s === 4 || s === 12) out.push({ voice: 'snare' });
  if (s % 2 === 0 && s !== 0) out.push({ voice: 'hat' });
  return out;
}

function pauseEventsAt(step) {
  const bar = Math.floor(step / 16) % BARS, s = step % 16;
  const [root, ...triad] = PAUSE_CHORDS[bar % 4];
  const out = [];
  if (s === 0) { out.push({ voice: 'bass', midi: root - 12, len: 7 }); for (const t of triad) out.push({ voice: 'pad', midi: root + 12 + t, len: 15 }); }
  if (s === 8) out.push({ voice: 'bass', midi: root - 5, len: 6 });
  if (s % 4 === 2) out.push({ voice: 'pluck', midi: root + 24 + triad[(s / 4 | 0) % 3], len: 2 });
  for (const [at, midi, len] of PAUSE_MELODY[bar]) if (at === s) out.push({ voice: 'bell', midi, len });
  if (s === 4 || s === 12) out.push({ voice: 'hat' });
  return out;
}

function storyEventsAt(step) {
  const bar = Math.floor(step / 16) % BARS, s = step % 16;
  const [root, ...triad] = STORY_CHORDS[bar % 4];
  const out = [];
  if (s === 0 || s === 8) out.push({ voice: 'bass', midi: root - 12, len: 6 });
  if (s === 4 || s === 12) out.push({ voice: 'bass', midi: root - 5, len: 3 });
  if (s % 2 === 0) out.push({ voice: 'pluck', midi: root + 12 + triad[[0, 1, 2, 1, 2, 1, 0, 1][(s / 2) | 0]], len: 1.5 });
  for (const [at, midi, len] of STORY_MELODY[bar]) if (at === s) out.push({ voice: 'flute', midi, len });
  if (s === 0) out.push({ voice: 'kick' });
  if (s === 8) out.push({ voice: 'snare' });
  if (s % 4 === 2) out.push({ voice: 'hat' });
  return out;
}
function selectEventsAt(step) {
  const bar = Math.floor(step / 16) % BARS, s = step % 16;
  const [root, ...triad] = SELECT_CHORDS[bar % 4];
  const out = [];
  if (s % 2 === 0) out.push({ voice: 'bass', midi: root + (s % 4 === 2 ? 12 : 0), len: 1.5 });
  out.push({ voice: 'arp', midi: root + 24 + triad[[0, 2, 1, 2][s % 4]], len: 1 });
  for (const [at, midi, len] of SELECT_MELODY[bar]) if (at === s) out.push({ voice: 'lead', midi, len });
  if (s % 4 === 0) out.push({ voice: 'kick' });
  if (s === 4 || s === 12) out.push({ voice: 'snare' });
  if (s % 2 === 1) out.push({ voice: 'hat' });
  return out;
}

export function createMusic({ AC = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!AC || typeof window === 'undefined') return { setPlaying() {}, setVolume() {}, unlocked: () => false };
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const tone = (type, freq, t, len, gain) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + len + 0.02);
  };
  const burst = (t, len, gain, hp) => {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + len);
  };
  const play = (e, t) => {
    const len = (e.len ?? 1) * stepLen(tune);
    if (e.voice === 'bass') tone('triangle', hz(e.midi), t, len, 0.5);
    else if (e.voice === 'arp') tone('square', hz(e.midi), t, len, 0.05);
    else if (e.voice === 'lead') tone('square', hz(e.midi), t, len * 0.95, 0.11);
    else if (e.voice === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
    } else if (e.voice === 'snare') burst(t, 0.12, 0.18, 1500);
    else if (e.voice === 'hat') burst(t, 0.04, tune === 'pause' ? 0.025 : tune === 'story' ? 0.035 : 0.07, 6000);
    else if (e.voice === 'flute') { tone('triangle', hz(e.midi), t, len * 0.95, 0.16); tone('sine', hz(e.midi) * 2, t, len * 0.6, 0.03); }
    else if (e.voice === 'pad') tone('sine', hz(e.midi), t, len, 0.07);
    else if (e.voice === 'pluck') tone('triangle', hz(e.midi), t, len, 0.09);
    else if (e.voice === 'bell') { tone('sine', hz(e.midi), t, len, 0.13); tone('sine', hz(e.midi) * 2, t, len * 0.5, 0.03); }
  };

  let playing = false, tune = 'menu', want = 'menu', swapTimer = null, timer = null, step = 0, nextT = 0, volume = 1, level = 0.5;
  const target = () => level * volume * (TUNE_TRIM[tune] ?? 1);
  const tick = () => {
    if (ctx.state !== 'running') return;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.3) {
      for (const e of eventsAt(step, tune)) play(e, nextT);
      step = (step + 1) % STEPS;
      nextT += stepLen(tune);
    }
  };
  // Start the moment the browser allows it. Browsers only let a page make sound after the visitor has interacted with
  // it (Chrome sometimes allows it earlier for sites you use a lot; Safari never does), so ask right away, keep asking
  // while the menu is up, and also try on any key, click, touch or mouse move.
  const unlock = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
  unlock();
  const retry = setInterval(() => { if (ctx.state === 'running') clearInterval(retry); else unlock(); }, 400);
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'mousedown', 'click', 'touchstart', 'touchend']) window.addEventListener(ev, unlock, { passive: true });

  return {
    unlocked: () => ctx.state === 'running',
    probe: () => ({ ctx, master }),
    /** Music volume, 0..1 (the settings slider). */
    setVolume(v) { volume = Math.max(0, Math.min(2, v)); if (playing) { const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(target(), now, 0.1); } },
    /** Fade the loop in or out, to `lv` of full (0.5 is the menu level; a match plays it quietly between points, and ducks it to nothing in a rally). Safe to call every frame. */
    setPlaying(on, lv = 0.5, which = 'menu') {
      if (on === playing && (!on || (lv === level && which === want))) return;
      const wasOn = playing;
      if (on && wasOn && which !== want) { // another tune while one plays: fade the old one out, then bring the new one in from its start
        want = which; level = lv;
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + 0.25);
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => { if (!playing) return; tune = want; step = 0; nextT = 0; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(target(), t + 0.45); }, 270);
        return;
      }
      if (on && wasOn && tune !== want) { level = lv; return; } // a swap is already under way: it picks up the new level
      if (on) { clearTimeout(swapTimer); tune = want = which; if (!wasOn) { step = 0; nextT = 0; } }
      playing = on; if (on) level = lv;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(on ? target() : 0, now + (on ? (wasOn ? 0.35 : 0.6) : 0.5));
      if (on && !timer) { step = 0; nextT = 0; timer = setInterval(tick, 80); }
      if (!on && timer) setTimeout(() => { if (!playing && timer) { clearInterval(timer); timer = null; } }, 700);
    },
  };
}
