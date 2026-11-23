// Sound effects: Kenney "Impact Sounds" plus real tennis and crowd recordings from Openverse (all CC0: see docs/CREDITS.md). Browsers only start audio after a
// click or key press, so sounds are silent until the page has had one.
import { surfaceFor, racketLayers, catPitch, crowdBed } from './feel.js';
const range = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}_${String(i).padStart(2, '0')}`);
const BANKS = {
  hitLight: range('oc_hit', 6),
  hitHard: ['oc_smash', ...range('oc_hit', 3)],
  serve: [...range('oc_serve1', 4), ...range('oc_serve2', 4)],
  bounce: range('oc_bounce', 5),
  net: ['oc_net'],
  step: ['footstep_grass_000', 'footstep_grass_001', 'footstep_grass_002', 'footstep_grass_003', 'footstep_grass_004'],
  applause: ['oc_applause'],
  whistle: ['oc_whistle'],
  catAngry: range('oc_cat', 5),
  owl: range('oc_owl', 7),
  fault: ['impactWood_medium_000', 'impactWood_medium_001'],
  lost: ['impactGeneric_light_000', 'impactGeneric_light_001'],
};

// Voices for the cat tantrum and the umpire owl.
// pitch: [start, peak, end] Hz of the voice, f1: [start, peak, end] Hz of the "mouth" resonance.
// Real recordings are used when they have loaded (bank below); the synthesized voices are the fallback.
const VOICE_BANK = { angryMeow: 'catAngry', hoot: 'owl' };
export const VOICES = {
  angryMeow: { len: 0.75, pitch: [430, 640, 250], f1: [650, 1150, 520], growl: 0.5, vibrato: 38 },
  hoot: { len: 0.42, pitch: [360, 340, 285], growl: 0, vibrato: 0 },
  effort: { len: 0.2, pitch: [520, 640, 420], f1: [800, 1100, 700], growl: 0.15, vibrato: 0 }, // a short "hnh!" on a big swing; each cat pitches it differently
};

/** Grunts for a hard shot or a backhand: different shapes (clipped "hnh", rising "hyah!", low "ngh", breathy "hah", a
 * wobbling "yah-ah"...). `power` ones are for the hardest hits, `back` ones lean lower and grittier. Same fields as VOICES. */
export const EFFORTS = [
  { id: 'hnh', len: 0.18, pitch: [520, 640, 420], f1: [800, 1100, 700], growl: 0.15, vibrato: 0 },
  { id: 'hah', len: 0.24, pitch: [470, 560, 380], f1: [900, 1300, 800], growl: 0.35, vibrato: 0 },
  { id: 'hyah', len: 0.3, pitch: [420, 760, 560], f1: [700, 1500, 1000], growl: 0.12, vibrato: 0, power: true },
  { id: 'ngh', len: 0.22, pitch: [380, 430, 300], f1: [600, 800, 550], growl: 0.4, vibrato: 0, back: true },
  { id: 'huh', len: 0.15, pitch: [560, 520, 450], f1: [1000, 1000, 850], growl: 0.1, vibrato: 0 },
  { id: 'yah', len: 0.34, pitch: [450, 700, 380], f1: [750, 1400, 650], growl: 0.2, vibrato: 14, power: true },
  { id: 'urgh', len: 0.28, pitch: [340, 400, 260], f1: [550, 850, 500], growl: 0.55, vibrato: 9, back: true },
  { id: 'hii', len: 0.2, pitch: [600, 820, 640], f1: [1100, 1700, 1300], growl: 0.08, vibrato: 0, power: true },
  { id: 'oof', len: 0.26, pitch: [400, 380, 280], f1: [650, 700, 500], growl: 0.45, vibrato: 0, back: true },
];

/** Pick a grunt for this shot, never the same one twice in a row. rnd: () => [0,1). Pure, so it can be tested. */
export function pickEffort({ side = 1, speed = 15 } = {}, last = '', rnd = Math.random) {
  const strong = speed >= 20, back = side === 2;
  const fits = EFFORTS.filter((e) => e.id !== last && (e.power ? strong : true) && (e.back ? back || strong : true));
  const pool = fits.length ? fits : EFFORTS;
  // prefer the ones suited to the shot: backhands lean on the low ones, big hits on the loud ones
  const weighted = pool.flatMap((e) => Array((back && e.back ? 3 : 1) * (strong && e.power ? 3 : 1)).fill(e));
  const e = weighted[Math.floor(rnd() * weighted.length)];
  const j = () => 0.94 + rnd() * 0.12; // each one slightly different again
  return { ...e, len: e.len * j(), pitch: e.pitch.map((x) => x * j()) };
}

/** Which sound a change in game state calls for. Pure, so it can be tested. prev/cur are core states. */
export function soundsFor(prev, cur, ctx = {}) {
  const out = [];
  if (!prev) return out;
  if (cur.hits > prev.hits) {
    const serve = cur.hitSide === 0;
    out.push({ bank: serve ? 'serve' : cur.hitSpeed >= 10 ? 'hitHard' : 'hitLight', pan: cur.playerX, gain: serve ? 1 : 0.9 });
  }
  if (cur.cpuHits > prev.cpuHits) out.push({ bank: 'hitLight', pan: cur.cpuX, gain: 0.6 });
  // a bounce: the ball was falling and now rises, near the ground
  if (prev.ballVY < -0.5 && cur.ballVY > 0 && cur.ballY < 0.3 && cur.labState !== 5) {
    out.push({ bank: 'bounce', pan: cur.ballX, gain: Math.min(1, 0.35 + Math.abs(prev.ballVY) * 0.05) });
  }
  // the net: the ball's forward speed flips sign right at the net, well off the ground
  if (Math.abs(cur.ballZ) < 0.4 && prev.ballVZ * cur.ballVZ < 0 && cur.ballY < 1.2 && cur.labState === 2) {
    out.push({ bank: 'net', pan: cur.ballX, gain: 0.8 });
  }
  if (cur.pointsHuman + cur.pointsCpu > prev.pointsHuman + prev.pointsCpu) {
    if (cur.pointsHuman <= prev.pointsHuman) out.push({ bank: 'lost', pan: 0, gain: 0.5 }); // no cheering: just a soft thud when the CPU scores
  }
  if ((cur.gamesH ?? 0) + (cur.gamesC ?? 0) > (prev.gamesH ?? 0) + (prev.gamesC ?? 0)) out.push({ bank: 'applause', pan: 0, gain: 0.8 });
  if (cur.matchOver && !prev.matchOver) out.push({ bank: 'whistle', pan: 0, gain: 0.8 });
  if (cur.labState === 0 && prev.labState !== 0 && cur.serveN === 2 && cur.why === 5) out.push({ bank: 'fault', pan: 0, gain: 0.8 });
  // footsteps while the player runs
  const speed = Math.hypot(cur.playerVX, cur.playerVZ);
  if (speed > 1.5 && ctx.stepDue) out.push({ bank: 'step', pan: cur.playerX, gain: Math.min(0.5, 0.15 + speed * 0.04) });
  return out.filter(Boolean);
}

export function createAudio({ base = '/assets/sounds/', AC = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  if (!AC) return { unlocked: () => false, play() { return null; }, voice() {}, update() {}, layers() {}, react() {}, noise() {}, tone() {}, setVolume() {}, setSurface() {}, setWeather() {}, setRally() {}, duck() {} };
  const ctx = new AC();
  // Every sound goes through one master gain (the sound-effects volume), so the setting and the music ducking reach all of them.
  const sfx = ctx.createGain();
  sfx.connect(ctx.destination);
  let volume = 1, duckUntil = 0, surface = surfaceFor('hard'), crowdLevel = 0;
  sfx.gain.value = volume;
  const buffers = {}; // bank -> AudioBuffer[]
  let loaded = false, nextStep = 0;
  const unlock = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });

  (async () => {
    for (const [bank, names] of Object.entries(BANKS)) {
      buffers[bank] = (await Promise.all(names.map(async (n) => {
        try {
          const r = await fetch(`${base}${n}.wav`);
          return await ctx.decodeAudioData(await r.arrayBuffer());
        } catch { return null; }
      }))).filter(Boolean);
    }
    loaded = true;
  })();

  // one voice: a harsh buzzy tone with a sweeping resonance (meow), or a soft low tone (owl hoot)
  function voice(name, { pan = 0, gain = 1, pitch = 1, spec = null } = {}) {
    const v = spec ?? VOICES[name];
    if (!v || ctx.state !== 'running') return;
    if (loaded && buffers[VOICE_BANK[name]]?.length) return play(VOICE_BANK[name], { pan, gain: gain * (name === 'hoot' ? 0.9 : 1), pitch });
    const t0 = ctx.currentTime + 0.01, len = v.len;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.9 * gain, t0 + 0.06);
    out.gain.setValueAtTime(0.9 * gain, t0 + len * 0.55);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    let node = out;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, -pan / 6)); out.connect(p); node = p; }
    node.connect(sfx);
    const osc = ctx.createOscillator();
    osc.type = name === 'hoot' ? 'triangle' : 'sawtooth';
    const [a, b, c] = v.pitch;
    osc.frequency.setValueAtTime(a * pitch, t0);
    osc.frequency.linearRampToValueAtTime(b * pitch, t0 + len * 0.35);
    osc.frequency.linearRampToValueAtTime(c * pitch, t0 + len);
    if (v.vibrato) { // a shaky, snarling edge
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = v.vibrato; depth.gain.value = 28 * pitch;
      lfo.connect(depth); depth.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + len);
    }
    if (v.f1) {
      const f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), mix = ctx.createGain();
      f.type = f2.type = 'bandpass'; f.Q.value = 5; f2.Q.value = 6; mix.gain.value = 1.4;
      f.frequency.setValueAtTime(v.f1[0], t0);
      f.frequency.linearRampToValueAtTime(v.f1[1], t0 + len * 0.35);
      f.frequency.linearRampToValueAtTime(v.f1[2], t0 + len);
      f2.frequency.setValueAtTime(2200, t0);
      f2.frequency.linearRampToValueAtTime(2600, t0 + len * 0.4);
      osc.connect(f); osc.connect(f2); f.connect(mix); f2.connect(mix); mix.connect(out);
    } else {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      osc.connect(lp); lp.connect(out);
    }
    if (v.growl) { // rough breath underneath
      const n = ctx.createBufferSource(), nb = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = nb;
      const lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'bandpass'; lp.frequency.value = 900; lp.Q.value = 1.2; g.gain.value = v.growl * 0.5;
      n.connect(lp); lp.connect(g); g.connect(out); n.start(t0);
    }
    osc.start(t0); osc.stop(t0 + len + 0.05);
  }

  function play(bank, { pan = 0, gain = 1, pitch = 1 } = {}) {
    const list = buffers[bank];
    if (!loaded || ctx.state !== 'running' || !list || !list.length) return null;
    const src = ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = (0.94 + Math.random() * 0.12) * pitch; // a little variety
    const g = ctx.createGain();
    const surf = bank === 'bounce' ? surface.bounceGain : bank === 'step' ? surface.stepGain : 1; // clay is softer than hard court
    g.gain.value = gain * 0.8 * surf;
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, -pan / 6)); // core +x is the player's left
      g.connect(p);
      node = p;
    }
    if (bank === 'bounce' || bank === 'step') { // a soft court takes the sharp top off the sound
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = bank === 'bounce' ? surface.bounceHz : surface.stepHz;
      src.connect(lp); lp.connect(g);
    } else src.connect(g);
    node.connect(sfx);
    src.start();
    return { fadeOut(s = 0.25) { g.gain.setTargetAtTime(0, ctx.currentTime, s / 3); src.stop(ctx.currentTime + s * 2); } }; // lets a long sound be cut short
  }

  // ---- synthesized extras: no files, so there is nothing to ship ----
  const noiseBuf = (() => { const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const runs = () => ctx.state === 'running';
  /** A burst of filtered noise that swells and fades: crowd gasps, groans and cheers, wood knocks, rain ticks. */
  function noise({ at = 0, len = 0.3, gain = 0.3, type = 'bandpass', hz = [1200, 1200], q = 1, attack = 0.02, pan = 0 } = {}) {
    if (!runs()) return;
    const t0 = ctx.currentTime + at;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loopStart = 0; s.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(hz[0], t0); f.frequency.linearRampToValueAtTime(hz[1], t0 + len);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, -pan / 6)); g.connect(p); node = p; }
    s.connect(f); f.connect(g); node.connect(sfx);
    s.start(t0, Math.random()); s.stop(t0 + len + 0.05);
  }
  function tone({ at = 0, len = 0.1, gain = 0.3, hz = [200, 100], type = 'sine', pan = 0 } = {}) {
    if (!runs()) return;
    const t0 = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(hz[0], t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, hz[1]), t0 + len);
    g.gain.setValueAtTime(Math.max(0.0002, gain), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    let node = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, -pan / 6)); g.connect(p); node = p; }
    o.connect(g); node.connect(sfx);
    o.start(t0); o.stop(t0 + len + 0.03);
  }
  /** The racket's layers on top of the recorded hit: a body thump, a bright crack, a wood knock on a mis-hit. */
  function layers(speed, { pan = 0, serve = false } = {}) {
    const L = racketLayers(speed, { serve });
    tone({ len: L.thump.len, gain: L.thump.gain * 0.5, hz: [L.thump.hz * 1.6, L.thump.hz * 0.6], pan });
    noise({ len: L.crack.len, gain: L.crack.gain * 0.5, type: 'highpass', hz: [L.crack.hz, L.crack.hz], q: 0.7, attack: 0.003, pan });
    if (L.knock.gain > 0) tone({ len: L.knock.len, gain: L.knock.gain, hz: [L.knock.hz, L.knock.hz * 0.7], type: 'triangle', pan });
  }
  const REACT = {
    gasp: (g) => noise({ len: 0.55, gain: 0.5 * g, hz: [700, 2200], q: 0.9, attack: 0.18 }),
    groan: (g) => noise({ len: 0.9, gain: 0.45 * g, type: 'lowpass', hz: [900, 260], q: 0.8, attack: 0.15 }),
    ooh: (g) => noise({ len: 0.7, gain: 0.3 * g, hz: [600, 900], q: 1.2, attack: 0.25 }),
    cheer: (g) => { play('applause', { gain: 0.7 * g }); noise({ len: 1.2, gain: 0.35 * g, hz: [1500, 2300], q: 0.6, attack: 0.25 }); },
    stinger: (g) => { for (const [i, hz] of [392, 523, 659, 784].entries()) tone({ at: i * 0.09, len: 0.32, gain: 0.16 * g, hz: [hz, hz * 0.995], type: 'square' }); },
  };
  /** Crowd and cat calls from feel.reactionsFor. cat: the player's cat, whose voice the grunts use. */
  let lastEffort = '';
  function react(list, { cat = 0, pan = 0 } = {}) {
    for (const r of list) {
      if (r.sound === 'effort') { const spec = pickEffort(r, lastEffort); lastEffort = spec.id; voice('effort', { gain: r.gain, pitch: catPitch(cat) * (0.95 + Math.random() * 0.1), pan, spec }); }
      else REACT[r.sound]?.(r.gain);
    }
  }

  // ---- beds: the crowd murmur (louder as a rally goes on) and the weather ----
  const bed = (hz, q = 0.5, type = 'bandpass') => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = hz; f.Q.value = q; g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfx);
    let on = false;
    return { g, start() { if (!on && runs()) { s.start(); on = true; } return on; }, set(v) { if (this.start()) g.gain.setTargetAtTime(v, ctx.currentTime, 0.4); } };
  };
  const crowd = bed(420, 0.4, 'lowpass'), rain = bed(5200, 0.4), wind = bed(380, 0.7);
  let weatherKind = 0;
  const WEATHER_BED = [() => { rain.set(0); wind.set(0); }, () => { rain.set(0.16); wind.set(0.02); }, () => { rain.set(0); wind.set(0.13); }];

  let prev = null;
  return {
    unlocked: () => ctx.state === 'running',
    play,
    voice,
    layers, react, noise, tone,
    probe: () => ({ ctx, sfx }), // for debugging: lets a test tap the effects output
    /** Sound-effects volume, 0..1. */
    setVolume(v) { volume = Math.max(0, Math.min(1.5, v)); sfx.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); },
    /** The court surface (a courts.js id) decides how a bounce and a footstep sound. */
    setSurface(id) { surface = surfaceFor(id); },
    /** 0 clear, 1 rain, 2 wind. */
    setWeather(k) { weatherKind = k | 0; WEATHER_BED[weatherKind]?.(); },
    /** The crowd murmur follows the rally: hits in the point, and whether the ball is in play. */
    setRally(hits, inPlay) { const lv = crowdBed(hits, inPlay); if (Math.abs(lv - crowdLevel) > 0.01) { crowdLevel = lv; crowd.set(lv * 0.25); } },
    /** Quieten the effects for a moment (a stinger, a cut scene). */
    duck(amount = 0.5, secs = 1) { const t = ctx.currentTime; sfx.gain.cancelScheduledValues(t); sfx.gain.setTargetAtTime(volume * (1 - amount), t, 0.05); sfx.gain.setTargetAtTime(volume, t + secs, 0.3); },
    /** Call once per frame with the core state and the time in seconds. */
    update(cur, now) {
      const stepDue = now >= nextStep;
      const sounds = soundsFor(prev, cur, { stepDue });
      if (sounds.some((s) => s.bank === 'step')) nextStep = now + 0.3;
      for (const s of sounds) {
        play(s.bank, s);
        if (s.bank === 'serve' || s.bank === 'hitLight' || s.bank === 'hitHard') { if (s.gain > 0.7) layers(cur.hitSpeed ?? 10, { pan: s.pan, serve: s.bank === 'serve' }); }
      }
      prev = { ...cur };
    },
  };
}
