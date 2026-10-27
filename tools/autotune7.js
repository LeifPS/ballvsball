// Sucht per Halbierung den dm-Faktor, bei dem ein Ball die Zielsiegquote seiner Seltenheit erreicht.  node tools/autotune7.js ball [ziel%] [N]
import { runFight, BALL_IDS, DEFS } from '../public/js/engine.js';
const id = process.argv[2], N = Number(process.argv[4] || 6);
const TARGET = { gewoehnlich: 39, selten: 46, episch: 58, legendaer: 72, mythisch: 90 };
const target = Number(process.argv[3] || TARGET[DEFS[id].rarity]);
const ORDER = ['gewoehnlich', 'selten', 'episch', 'legendaer', 'mythisch'];
const opp = [];
for (const r of ORDER) {
  const list = BALL_IDS.filter(b => DEFS[b].rarity === r && b !== id);
  const take = r === 'mythisch' ? list : list.filter((_, i) => i % Math.ceil(list.length / (r === 'legendaer' ? 10 : 12)) === 0);
  for (const b of take) opp.push(b);
}
const sub = id === 'kleinerhelfer' ? DEFS.minihelfer : DEFS[id];   // beim Helfer zählt der Schaden der Minihelfer
function rate(dm) {
  sub.dm = dm; let w = 0, g = 0;
  for (const o of opp) for (let s = 0; s < N; s++) {
    const cfg = { seed: 9000 + s * 7919 + BALL_IDS.indexOf(o) * 131, balls: [{ type: id, team: 0, deg: (s * 47 + 13) % 360 }, { type: o, team: 1, deg: (s * 91 + 200) % 360 }] };
    const r = runFight(cfg); g++; if (r.winner === 0) w++;
  }
  return w / g * 100;
}
let lo = Math.log(.3), hi = Math.log(20), best = 1, bd = 1e9, bw = 0;
for (let i = 0; i < 7; i++) {
  const mid = (lo + hi) / 2, dm = Math.exp(mid), w = rate(dm);
  if (Math.abs(w - target) < bd) { bd = Math.abs(w - target); best = dm; bw = w; }
  if (w < target) lo = mid; else hi = mid;
}
console.log(JSON.stringify({ id, dm: Math.round(best * 100) / 100, win: Math.round(bw), target }));
