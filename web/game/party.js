// Party mode: every game of the match changes the rules a little. Gameplay modifiers use the core's own switches (easy returns,
// strong aim, all shots); the rest only change how the match looks, so the physics stays honest in every mode.
import { rng, hashOf } from './challenge.js';

/** kind: 'rule' changes how you play, 'look' only how it looks. */
export const MODS = [
  { id: 'blaze', name: 'Blazing Ball', text: 'The ball is on fire from the first hit.', kind: 'look' },
  { id: 'giant', name: 'Giant Ball', text: 'A huge ball. Same physics, easier to see.', kind: 'look' },
  { id: 'tiny', name: 'Tiny Ball', text: 'A tiny ball. Same physics, harder to follow.', kind: 'look' },
  { id: 'disco', name: 'Disco Court', text: 'The lights go wild.', kind: 'look' },
  { id: 'confetti', name: 'Confetti Storm', text: 'It rains confetti.', kind: 'look' },
  { id: 'easy', name: 'Gentle Swings', text: 'A wider timing window and longer reach for you.', kind: 'rule', easy: true },
  { id: 'aim', name: 'Steady Aim', text: 'Your shots are nudged harder toward the court.', kind: 'rule', aim: true },
  { id: 'allshots', name: 'Trick Shots', text: 'Topspin, slice and drop shots are all on.', kind: 'rule', shots: true },
];

/** The modifier for each game of a match (deterministic from the seed, never the same twice running). */
export function modFor(seed, game) {
  const r = rng(hashOf(`party-${seed}`));
  let id = -1;
  for (let g = 0; g <= Math.max(0, game | 0); g++) { let n; do { n = Math.floor(r() * MODS.length); } while (n === id); id = n; }
  return MODS[id];
}

/** The core switches for a modifier on top of the player's own settings: { easy, aim, shots } booleans. */
export function rulesWith(base, mod) {
  return { easy: !!(base.easy || mod?.easy), aim: !!(base.aim || mod?.aim), shots: !!(base.shots || mod?.shots) };
}

/** How the ball and lights look for a modifier. */
export function lookOf(mod) {
  return { burn: mod?.id === 'blaze' ? 1 : 0, ballScale: mod?.id === 'giant' ? 2.2 : mod?.id === 'tiny' ? 0.6 : 1, disco: mod?.id === 'disco', confetti: mod?.id === 'confetti' };
}
