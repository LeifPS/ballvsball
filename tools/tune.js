// Auto-Tuner: passt den Schaden (Faktor dm) jedes Balls an, bis die Siegquoten zur Seltenheit passen
// und die Kämpfe im Mittel ca. 22-28 s dauern. Ergebnis -> public/js/tuning.js
import fs from 'node:fs';
import { runFight, BALL_IDS, DEFS } from '../public/js/engine.js';

const TARGET = { gewoehnlich: .43, selten: .48, episch: .56, legendaer: .66 };
const ITER = Number(process.argv[2] || 14), N = Number(process.argv[3] || 10);
const DMIN = .3, DMAX = 3;
for (const id of BALL_IDS) DEFS[id].dm = DEFS[id].dm || 1;

function measure() {
  const win = {}, games = {}, dur = {};
  for (const a of BALL_IDS) { win[a] = 0; games[a] = 0; }
  const all = [];
  for (const a of BALL_IDS) for (const b of BALL_IDS) for (let s = 0; s < N; s++) {
    const seed = 5000 + s * 7919 + BALL_IDS.indexOf(a) * 131 + BALL_IDS.indexOf(b) * 17;
    const r = runFight({ seed, balls: [{ type: a, team: 0, deg: (s * 47 + 13) % 360 }, { type: b, team: 1, deg: (s * 91 + 200) % 360 }] });
    games[a]++; games[b]++; all.push(r.t);
    if (r.winner === 0) win[a]++; else win[b]++;
  }
  all.sort((x, y) => x - y);
  return { wr: Object.fromEntries(BALL_IDS.map(a => [a, win[a] / games[a]])), med: all[all.length >> 1] };
}
for (let it = 0; it < ITER; it++) {
  const { wr, med } = measure();
  let err = 0;
  for (const id of BALL_IDS) {
    const tgt = TARGET[DEFS[id].rarity];
    err += Math.abs(wr[id] - tgt);
    let f = 1 + (tgt - wr[id]) * 0.9;
    f = Math.max(.88, Math.min(1.12, f));
    DEFS[id].dm = Math.max(DMIN, Math.min(DMAX, DEFS[id].dm * f));
  }
  // globale Dauer ca. 25 s
  const g = Math.max(.9, Math.min(1.1, Math.pow(med / 26, .5)));
  for (const id of BALL_IDS) DEFS[id].dm = Math.max(DMIN, Math.min(DMAX, DEFS[id].dm * g));
  console.log('Runde', it + 1, 'Fehler', (err / BALL_IDS.length * 100).toFixed(1) + '%', 'Median', med.toFixed(1));
}
const dm = {};
for (const id of BALL_IDS) dm[id] = Number(DEFS[id].dm.toFixed(3));
fs.writeFileSync('public/js/tuning.js', '// Automatisch erzeugt von tools/tune.js (Schadensfaktoren je Ball)\nexport const DM = ' + JSON.stringify(dm) + ';\n');
console.log(JSON.stringify(dm));
