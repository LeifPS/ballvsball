import { simBox, LAYOUTS } from '../public/js/boxsim.js';
for (const id of Object.keys(LAYOUTS)) {
  const L = LAYOUTS[id]; let ok = 0, rs = 0, tsum = 0, tmax = 0, slow = 0; const win = new Array(10).fill(0); const N = 200;
  for (let seed = 1; seed <= N; seed++) {
    const r = simBox(seed * 7919, 10, L); rs += r.reached;
    if (r.reached > 0) { ok++; tsum += r.times[0]; tmax = Math.max(tmax, r.times[0]); if (r.times[0] > 14) slow++; win[r.order[0]]++; }
  }
  console.log(id.padEnd(9), 'mind. einer unten:', ok + '/' + N, ' Ø unten angekommen', (rs / N).toFixed(1), ' Ø erste Ankunft', (tsum / Math.max(1, ok)).toFixed(1), 's max', tmax.toFixed(1), ' langsam(>14s)', slow, ' Sieger', win.join(','));
}
