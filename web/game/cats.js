// The cats you can pick. Colours only, so the menu and tests need no 3D library.
export const CATS = [
  { name: 'Otis', tag: 'The Hobo', fur: 0xf29a3a, stripe: 0xb8641c, belly: 0xfff0d9 },
  { name: 'Minu', tag: 'The Grumpy', fur: 0x9a6a46, stripe: 0x66402a, belly: 0xe6cdb0 },
  { name: 'Bombay', tag: 'Night-court ninja', fur: 0x3a3a46, stripe: 0x22222c, belly: 0x8a8a99 },
  { name: 'Bella', tag: 'The Pigeon Whisperer', fur: 0x5f3b27, stripe: 0x3b2316, belly: 0xffffff },
  { name: 'Snowy', tag: 'Fluffy as a cloud', fur: 0xf4f4f8, stripe: 0xc9ccd8, belly: 0xffffff },
  { name: 'Biscuit', tag: 'The Terrorist', fur: 0xe8742a, stripe: 0xa8461a, belly: 0xffe3c4 },
];
// The story-mode boss. Not pickable: it only appears as the last opponent, so it is not in CATS (the menus list CATS).
export const OWL = { name: 'Professor Hoot', tag: 'The Midnight Owl', kind: 'owl', fur: 0x8a6a4a, stripe: 0x4a3626, belly: 0xf1e4cc };
export const ALL_CATS = [...CATS, OWL];
export const BOSS_INDEX = CATS.length; // OWL's index when used as an opponent (cat2)
export const SHIRTS = [0, 1]; // player slots; cats wear no shirt, so these are only slot ids

/** A full look for a player slot (0 or 1): the chosen cat; the "shirt" is just its own fur. */
export const lookFor = (catIndex, slot) => { const c = ALL_CATS[catIndex % ALL_CATS.length]; return { ...c, shirt: c.fur }; };
