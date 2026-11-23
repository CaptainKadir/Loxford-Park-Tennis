// Convert a controller recording (.jsonl of wire samples) to the swing-log CSV
// that build/host/replay_swing reads.  usage: node jsonl-to-csv.mjs in.jsonl > out.csv
import fs from 'node:fs';

export function sampleToCsv(s) {
  const f = (v, d) => v.toFixed(d);
  return ['P', f(s.t, 4), ...s.q.map((v) => f(v, 5)), ...s.r.map((v) => f(v, 4)), ...s.a.map((v) => f(v, 4))].join(',');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
  console.log('# loxford phone log v1');
  const t0 = JSON.parse(lines[0]).t;
  for (const l of lines) {
    const s = JSON.parse(l);
    console.log(sampleToCsv({ ...s, t: s.t - t0 }));
  }
}
