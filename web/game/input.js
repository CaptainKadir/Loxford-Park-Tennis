// Keyboard movement override (the phone cannot steer the cat).
// One player: WASD or the arrows. Two players on one keyboard: WASD is player 1, the arrows are player 2.
const SEATS = [
  { right: ['KeyD'], left: ['KeyA'], up: ['KeyW'], down: ['KeyS'] },
  { right: ['ArrowRight'], left: ['ArrowLeft'], up: ['ArrowUp'], down: ['ArrowDown'] },
];
const BOTH = {
  right: [...SEATS[0].right, ...SEATS[1].right], left: [...SEATS[0].left, ...SEATS[1].left],
  up: [...SEATS[0].up, ...SEATS[1].up], down: [...SEATS[0].down, ...SEATS[1].down],
};
const any = (keys, list) => list.some((k) => keys.has(k));

/** seat: -1 = either key set (one player), 0 = WASD, 1 = arrows. */
export function axesFromKeys(keys, seat = -1) {
  const k = seat < 0 ? BOTH : SEATS[seat];
  return {
    right: (any(keys, k.right) ? 1 : 0) - (any(keys, k.left) ? 1 : 0),
    fwd: (any(keys, k.up) ? 1 : 0) - (any(keys, k.down) ? 1 : 0),
  };
}

export function createInput(target = globalThis) {
  const keys = new Set();
  target.addEventListener('keydown', (e) => keys.add(e.code));
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());
  return { axes: (seat = -1) => axesFromKeys(keys, seat) };
}
