// Balance-Simulator: jeder Ball gegen jeden, viele Startrichtungen.
// Aufruf: node tools/balance.js [Stichproben=8] [nur-ball]
import { runFight, BALL_IDS, DEFS, RARITY } from '../public/js/engine.js';

const N = Number(process.argv[2] || 8);
const only = process.argv[3];
const win = {}, games = {}, dur = {}, short = {}, long = {}, mat = {};
for (const a of BALL_IDS) { win[a] = 0; games[a] = 0; dur[a] = 0; short[a] = 0; long[a] = 0; mat[a] = {}; }
const allDur = [];
const t0 = Date.now();
for (const a of BALL_IDS) {
  for (const b of BALL_IDS) {
    let wa = 0, ga = 0;
    for (let s = 0; s < N; s++) {
      const seed = 1000 + s * 7919 + BALL_IDS.indexOf(a) * 131 + BALL_IDS.indexOf(b) * 17;
      const cfg = { seed, balls: [{ type: a, team: 0, deg: (s * 47 + 13) % 360 }, { type: b, team: 1, deg: (s * 91 + 200) % 360 }] };
      const r = runFight(cfg);
      ga++; if (r.winner === 0) wa++;
      dur[a] += r.t; dur[b] += r.t; games[a]++; games[b]++;
      allDur.push(r.t);
      if (r.t < 8) { short[a]++; short[b]++; }
      if (r.t >= 89.9) { long[a]++; long[b]++; }
      if (r.winner === 0) win[a]++; else win[b]++;
    }
    mat[a][b] = wa / ga;
  }
}
const pct = x => (x * 100).toFixed(0).padStart(3);
const rows = BALL_IDS.map(id => ({
  id, rar: DEFS[id].rarity, wr: win[id] / games[id], dur: dur[id] / games[id], sh: short[id] / games[id], lo: long[id] / games[id]
}));
console.log('Ball          Selt.  Sieg%  Dauer  <8s%  Zeit%');
for (const r of rows.sort((x, y) => RARITY[x.rar].order - RARITY[y.rar].order || y.wr - x.wr)) {
  if (only && r.id !== only) continue;
  console.log(r.id.padEnd(13), r.rar.slice(0, 5).padEnd(6), pct(r.wr), '  ', r.dur.toFixed(1).padStart(5), '  ', pct(r.sh), '  ', pct(r.lo));
}
for (const rar of Object.keys(RARITY)) {
  const g = rows.filter(r => r.rar === rar);
  console.log(rar.padEnd(12), 'Mittel Sieg%', pct(g.reduce((s, r) => s + r.wr, 0) / g.length));
}
allDur.sort((x, y) => x - y);
console.log('Dauer Median', allDur[allDur.length >> 1].toFixed(1), 'P10', allDur[Math.floor(allDur.length * .1)].toFixed(1), 'P90', allDur[Math.floor(allDur.length * .9)].toFixed(1), 'Zeit', ((Date.now() - t0) / 1000).toFixed(1) + 's');
if (process.argv.includes('--matrix')) {
  console.log('\nExtreme Duelle (Sieg% von Zeile gegen Spalte < 15 oder > 85):');
  for (const a of BALL_IDS) for (const b of BALL_IDS) if (a < b && (mat[a][b] > .85 || mat[a][b] < .15) && mat[b][a] === 1 - mat[a][b] + 0) console.log(a, 'vs', b, pct(mat[a][b]));
}
