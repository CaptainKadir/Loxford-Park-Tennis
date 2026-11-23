// Sound effects for the story cut scenes: a typewriter blip for each spoken letter (a different pitch for each speaker),
// a pop and a mood sound as each line appears, a sting as the scene opens and closes, and chimes, footsteps and a fanfare on the map.
// Everything here only decides WHAT plays (plain event lists); game.js hands them to the audio engine. So it is tested without a browser.
import { moodOf } from './render/talkshots.js';

// event kinds: { tone: {hz:[a,b], len, gain, type, at} } | { noise: {...} } | { voice: 'hoot' | 'angryMeow', gain } | { bank: 'step' | ..., gain, after }
const tone = (hz, len, gain, type = 'square', at = 0) => ({ tone: { hz, len, gain, type, at } });

/** One blip for letter `ch` (index i) of a line, or null for spaces, punctuation and every other letter. speaker: 0 the hero, 1 the rival. */
export function blipFor(speaker, ch, i, { boss = false } = {}) {
  if (!/[a-z0-9]/i.test(ch) || i % 2) return null;
  const base = speaker === 0 ? 560 : boss ? 190 : 360;
  const hz = base * (1 + ((ch.toLowerCase().charCodeAt(0) % 7) - 3) * 0.04);
  return tone([hz, hz * 0.96], 0.05, speaker === 0 ? 0.05 : boss ? 0.12 : 0.09, speaker === 0 ? 'square' : 'triangle');
}

/** The sounds as a new line appears: a speech-bubble pop, then something for the mood (grumble, chirp, question, the boss's hoot). */
export function lineSounds(text, speaker, { boss = false } = {}) {
  const out = [tone([300, 520], 0.08, 0.08, 'sine')];
  const mood = moodOf(text);
  if (boss && speaker === 1) out.push({ voice: 'hoot', gain: 0.5 });
  else if (mood < 0) out.push({ voice: 'angryMeow', gain: 0.22 });
  else if (mood > 0) out.push(tone([660, 740], 0.07, 0.07, 'triangle', 0.1), tone([880, 990], 0.09, 0.07, 'triangle', 0.18));
  if (/\?/.test(text)) out.push(tone([420, 640], 0.16, 0.06, 'triangle', 0.12));
  return out;
}

/** The scene opens (the two cats square up) or closes (on to the match). */
export const sceneOpen = () => [{ noise: { len: 0.5, gain: 0.12, hz: [300, 2600], q: 0.7, attack: 0.25 } }, tone([196, 294], 0.35, 0.09, 'triangle'), tone([294, 392], 0.4, 0.09, 'triangle', 0.18)];
export const sceneClose = () => [{ noise: { len: 0.4, gain: 0.14, hz: [2400, 500], q: 0.7, attack: 0.05 } }, tone([392, 392], 0.12, 0.08, 'square'), tone([523, 523], 0.12, 0.08, 'square', 0.12), tone([659, 659], 0.22, 0.08, 'square', 0.24)];

/** The map appears. `walked`: the cat just won a stop and walks to the next one. `lost`: back after a defeat. `finished`: the whole story is done. */
export function mapSounds({ walked = false, lost = false, finished = false } = {}) {
  const out = [tone([784, 784], 0.25, 0.07, 'sine'), tone([988, 988], 0.35, 0.07, 'sine', 0.14)];
  if (lost) out.push({ bank: 'lost', gain: 0.6, after: 0.1 });
  if (walked) {
    for (let i = 0; i < 4; i++) out.push({ bank: 'step', gain: 0.5, after: 0.25 + i * 0.28 });
    out.push(tone([880, 880], 0.5, 0.1, 'sine', 1.35), tone([1320, 1320], 0.6, 0.07, 'sine', 1.35));
  }
  if (finished) {
    [523, 659, 784, 1047].forEach((hz, i) => out.push(tone([hz, hz * 0.998], i === 3 ? 0.7 : 0.18, 0.1, 'square', 0.5 + i * 0.16)));
    out.push({ bank: 'applause', gain: 0.7, after: 1.1 });
  }
  return out;
}

/** The owl's entrance: a low drone and rumble, then his hoot as the eyes open and a sting as the name appears. */
export const bossIntroSounds = () => [
  tone([55, 48], 3.4, 0.1, 'sawtooth'), tone([82, 70], 3.0, 0.05, 'triangle', 0.3),
  { noise: { len: 1.6, gain: 0.1, hz: [120, 400], q: 0.6, attack: 0.9 } },
  { bank: 'owl', gain: 0.8, after: 1.1 },
  tone([196, 196], 0.5, 0.1, 'triangle', 1.7), tone([294, 294], 0.7, 0.1, 'triangle', 1.85),
];
