// A short tutorial: serve, forehand, backhand, then win a point. Pure state machine over the core state,
// so it can be tested without a browser. `side` is what to tell the core to feed (see lab.h tutorial_side).
export const STEPS = [
  { id: 'serve', side: 0, need: 1, title: 'Serve',
    text: 'The ball is tossed up.\nSwing the phone when it is high.' },
  { id: 'forehand', side: 1, need: 3, title: 'Forehand',
    text: 'Balls come to your right.\nSwing like a forehand, screen facing forward.' },
  { id: 'backhand', side: 2, need: 3, title: 'Backhand',
    text: 'Balls come to your left.\nTurn the phone to your left and swing across.' },
  { id: 'rally', side: 3, need: 1, title: 'Rally',
    text: 'Now a real rally.\nWin one point against the CPU.' },
];

export function createTutorial() {
  let step = 0, count = 0, last = null, doneAt = null;
  const view = () => {
    if (step >= STEPS.length) return { done: true, side: 0, label: 'TUTORIAL COMPLETE', text: 'Nice! Press Esc, then M for the menu and play a real match.\nBetween points, tap the emote button on your phone (or press E).', step: STEPS.length, total: STEPS.length };
    const s = STEPS[step];
    return { done: false, side: s.side, label: `TUTORIAL ${step + 1}/${STEPS.length}: ${s.title.toUpperCase()}`, text: `${s.text}\n(${count}/${s.need})`, step, total: STEPS.length };
  };
  return {
    /** Feed the latest core state; returns what to show and which feeds the core should use. */
    update(st) {
      if (last && step < STEPS.length) {
        const s = STEPS[step];
        let hit = false;
        if (s.id === 'serve') hit = st.hits > last.hits && st.hitSide === 0;
        else if (s.id === 'forehand') hit = st.hits > last.hits && st.hitSide === 1;
        else if (s.id === 'backhand') hit = st.hits > last.hits && st.hitSide === 2;
        else if (s.id === 'rally') hit = st.pointsHuman > last.pointsHuman;
        if (hit) count++;
        if (count >= s.need) { step++; count = 0; }
      }
      last = { hits: st.hits, pointsHuman: st.pointsHuman };
      return view();
    },
    skip() { if (step < STEPS.length) { step++; count = 0; } return view(); },
    view,
  };
}
