import assert from 'node:assert';
import { simBox, createBox, stepBox } from '../public/js/boxsim.js';
let fails = 0, tmax = 0, tsum = 0, winners = new Array(10).fill(0);
const N = 300;
for (let seed = 1; seed <= N; seed++) {
  const r = simBox(seed, 10);
  assert.strictEqual(r.order.length, 10);
  assert.strictEqual(new Set(r.order).size, 10);
  const first = r.times[0];
  if (first >= 17.9) fails++;
  tmax = Math.max(tmax, first); tsum += first;
  winners[r.order[0]]++;
}
// Determinismus: vollständiger Lauf == Kurzlauf (erste 3)
const a = simBox(77, 10);
const s = createBox(77, 10); while (!s.done) stepBox(s);
assert.deepStrictEqual(a.order.slice(0, 3), s.order.slice(0, 3));
// Suche nach einem Seed, bei dem Ball 4 gewinnt und Ball 7 Zweiter wird
let tries = 0, found = -1;
for (let sd = 1; sd < 3000; sd++) { tries++; const r = simBox(sd, 10); if (r.order[0] === 4 && r.order[1] === 7) { found = sd; break; } }
console.log('boxsim ok. Nie fertig:', fails, '/', N, ' Ø erste Ankunft', (tsum / N).toFixed(1), 's, max', tmax.toFixed(1), 's; Gewinner-Verteilung', winners.join(','), '; Seed für 4>7 nach', tries, 'Versuchen');
assert.ok(found > 0);
