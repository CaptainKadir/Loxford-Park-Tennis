// The "how to play" lessons shown first in the tutorial: your cat acts out example swings next to a virtual phone
// that moves exactly like the phone should. Pure data and timing (no DOM, no three.js), so it can be tested.
import { DEMOS } from './demo.js';
import { shotDuration } from './lessonshots.js';

export const SLOWMO = 2.4;  // the example swings play this much slower than a real one, so the movement can be followed
const READY = 0.7;          // s the cat and phone rest at the start of each swing
const HOLD = 0.7;           // s they stay at the end (at least: the example shot has to land too)
/** After the swing: long enough for the example shot to fly, land and be looked at. */
const holdFor = (id) => { const d = DEMOS[id]; return Math.max(HOLD, shotDuration(id) - (1 - d.hit) * d.secs * SLOWMO); };

/**
 * kind: 'setup' (no swing), 'swing' (the demos play, one after another, on repeat), 'serve' (the cat's serve),
 * 'emote' (the cat dances). tip: an optional hint shown under the lesson.
 */
export const LESSONS = [
  { id: 'setup', kind: 'setup', title: 'Before you play', line: 'Phone ready?', icons: [['silent', 'Silent off'], ['volume', 'Volume up'], ['flat', 'Calibrate flat']], tip: 'If racket is laggy... refresh page on your phone' },
  { id: 'grip', kind: 'swing', demos: ['fh-drive'], title: 'Phone = racket', line: 'Top is the head. Screen is the strings.', arrow: 'across' },
  { id: 'forehand', kind: 'swing', demos: ['fh-drive'], title: 'Forehand', line: 'Back on your right, swing across.', arrow: 'across', tip: 'Delay your swing for better contact with the ball' },
  { id: 'backhand', kind: 'swing', demos: ['bh-drive'], title: 'Backhand', line: 'Back on your left, swing across.', arrow: 'across-back' },
  { id: 'topspin', kind: 'swing', demos: ['fh-topspin', 'bh-topspin'], title: 'Topspin', line: 'Low to high. Fast.', arrow: 'up' },
  { id: 'slice', kind: 'swing', demos: ['fh-slice', 'bh-slice'], title: 'Slice', line: 'High to low. Slower.', arrow: 'down' },
  { id: 'drop', kind: 'swing', demos: ['drop'], title: 'Drop shot', line: 'Soft touch. Screen up.', arrow: 'soft' },
  { id: 'lob', kind: 'swing', demos: ['lob'], title: 'Lob', line: 'Scoop up. Screen up.', arrow: 'scoop' },
  { id: 'serve', kind: 'serve', title: 'Serve', line: 'Swing when the ball is high.', arrow: 'up' },
  { id: 'emote', kind: 'emote', title: 'Emote', line: 'Tap between points.' },
];

export const LESSON_COUNT = LESSONS.length;

/** How long one pass of a lesson's swings takes, in seconds (the demos in turn, each with a rest and a hold). */
export function lessonCycle(lesson) {
  if (lesson.kind !== 'swing') return 1;
  return lesson.demos.reduce((n, id) => n + READY + DEMOS[id].secs * SLOWMO + holdFor(id), 0);
}

/**
 * What the cat and phone are doing at t seconds into a swing lesson:
 * { id: which demo, u: how far through the swing (0..1), n: which demo of the lesson, phase: 'ready' | 'swing' | 'hold' }.
 */
export function lessonFrame(lesson, t) {
  if (lesson.kind !== 'swing') return { id: null, u: 0, n: 0, phase: 'ready' };
  let x = ((t % lessonCycle(lesson)) + lessonCycle(lesson)) % lessonCycle(lesson);
  for (let n = 0; n < lesson.demos.length; n++) {
    const id = lesson.demos[n], dur = DEMOS[id].secs * SLOWMO;
    if (x < READY) return { id, u: 0, n, phase: 'ready' };
    x -= READY;
    if (x < dur) return { id, u: x / dur, n, phase: 'swing' };
    x -= dur;
    if (x < holdFor(id)) return { id, u: 1, n, phase: 'hold' };
    x -= holdFor(id);
  }
  return { id: lesson.demos[0], u: 0, n: 0, phase: 'ready' };
}

const NAMES = { 'fh-drive': 'Forehand', 'bh-drive': 'Backhand', 'fh-topspin': 'Forehand', 'bh-topspin': 'Backhand',
  'fh-slice': 'Forehand', 'bh-slice': 'Backhand', drop: 'Drop shot', lob: 'Lob' };
/** The chips under a swing, from the example's own numbers: which stroke, how fast, which way the screen faces. */
export function lessonChips(id) {
  const d = DEMOS[id];
  return [NAMES[id] || id, `${d.speed} swing`, `screen ${d.face}`];
}

/** The demos whose contact with the ball falls in the time window (t0, t1], so the example shot can be launched then. */
export function contactsBetween(lesson, t0, t1) {
  if (lesson.kind !== 'swing' || t1 <= t0) return [];
  const cyc = lessonCycle(lesson), out = [];
  // contact times within one cycle
  const at = []; let base = 0;
  for (const id of lesson.demos) { const dur = DEMOS[id].secs * SLOWMO; at.push([id, base + READY + DEMOS[id].hit * dur]); base += READY + dur + holdFor(id); }
  for (let c = Math.floor(t0 / cyc); c <= Math.floor(t1 / cyc); c++) for (const [id, a] of at) { const t = c * cyc + a; if (t > t0 && t <= t1) out.push(id); }
  return out;
}

/** The lesson index after a step (no wrapping: -1 or LESSON_COUNT means leaving the lessons). */
export const stepLesson = (i, dir) => Math.max(-1, Math.min(LESSON_COUNT, i + dir));
