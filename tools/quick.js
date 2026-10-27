// Schneller Balance-Test: ein Ball gegen eine feste Stichprobe von Gegnern.  node tools/quick.js ball [Stichproben=10]
import { runFight, BALL_IDS, DEFS } from '../public/js/engine.js';
import { TUNE } from '../public/js/balls7.js';
if (process.env.TUNE) Object.assign(TUNE, JSON.parse(process.env.TUNE));
const id = process.argv[2], N = Number(process.argv[3] || 10);
if (process.argv[4]) DEFS[id].dm = Number(process.argv[4]);
const ORDER = { gewoehnlich: 0, selten: 1, episch: 2, legendaer: 3, mythisch: 4 };
const opp = [];
for (const r of Object.keys(ORDER)) {
  const list = BALL_IDS.filter(b => DEFS[b].rarity === r && b !== id);
  const take = r === 'mythisch' ? list : list.filter((_, i) => i % Math.ceil(list.length / (r === 'legendaer' ? 10 : 12)) === 0);
  for (const b of take) opp.push(b);
}
let w = 0, g = 0, dur = 0;
const byR = {};
for (const o of opp) for (let s = 0; s < N; s++) {
  const cfg = { seed: 5000 + s * 7919 + BALL_IDS.indexOf(o) * 131, balls: [{ type: id, team: 0, deg: (s * 47 + 13) % 360 }, { type: o, team: 1, deg: (s * 91 + 200) % 360 }] };
  const r = runFight(cfg); g++; dur += r.t; if (r.winner === 0) { w++; (byR[DEFS[o].rarity] = byR[DEFS[o].rarity] || [0, 0])[0]++; }
  (byR[DEFS[o].rarity] = byR[DEFS[o].rarity] || [0, 0])[1]++;
}
console.log(id.padEnd(14), 'dm', String(DEFS[id].dm).padEnd(5), DEFS[id].rarity.padEnd(11), 'Sieg%', String(Math.round(w / g * 100)).padStart(3), ' Dauer', (dur / g).toFixed(1), ' ', Object.entries(byR).map(([k, v]) => k.slice(0, 3) + ':' + Math.round(v[0] / v[1] * 100)).join(' '));
