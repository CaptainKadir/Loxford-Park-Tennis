// Maps the phone's clock onto the lab (game) clock. Delivery delay only ever adds
// latency, so the smallest (labNow - phoneT) seen recently is the best offset.
export function createClockSync({ windowS = 3 } = {}) {
  const seen = []; // {labNow, est}
  let last = -Infinity;
  return {
    map(phoneT, labNow) {
      seen.push({ labNow, est: labNow - phoneT });
      while (seen.length && seen[0].labNow < labNow - windowS) seen.shift();
      let offset = Infinity;
      for (const s of seen) if (s.est < offset) offset = s.est;
      last = Math.max(phoneT + offset, last + 1e-6);
      return last;
    },
  };
}
