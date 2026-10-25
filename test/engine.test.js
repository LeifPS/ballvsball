import assert from 'node:assert';
import { createSim, stepSim, runFight, BALL_IDS, DEFS } from '../public/js/engine.js';

// 1) Determinismus: gleicher Seed -> identisches Ergebnis
let checked = 0;
for (const a of BALL_IDS) {
  const cfg = { seed: 4242, balls: [{ type: a, team: 0, deg: 33 }, { type: 'ramm', team: 1, deg: 200 }] };
  const r1 = runFight(cfg), r2 = runFight(cfg);
  assert.deepStrictEqual(r1, r2, 'nicht deterministisch: ' + a);
  assert.ok(r1.steps > 0 && r1.t <= 90.1, 'Dauer ' + a + ' ' + r1.t);
  checked++;
}
// 2) Tempo bleibt konstant (ohne Phoenix/Vampir/Zelle-Besonderheiten)
for (const a of ['stachel', 'ramm', 'glas', 'magnet', 'schwert']) {
  const sim = createSim({ seed: 1, balls: [{ type: a, team: 0, deg: 10 }, { type: 'turret', team: 1, deg: 190 }] });
  const sp0 = sim.balls.map(b => Math.hypot(b.vx, b.vy));
  for (let i = 0; i < 1200 && !sim.over; i++) {
    stepSim(sim);
    sim.balls.forEach((b, k) => {
      if (b.dead) return;
      const sp = Math.hypot(b.vx, b.vy);
      assert.ok(Math.abs(sp - sp0[k]) < 1e-6, 'Tempo ändert sich: ' + a + ' ' + sp + ' vs ' + sp0[k]);
    });
  }
}
// 3) 2 gegen 2
const r4 = runFight({ seed: 9, balls: [{ type: 'stachel', team: 0, deg: 10 }, { type: 'turret', team: 0, deg: 80 }, { type: 'riese', team: 1, deg: 190 }, { type: 'drache', team: 1, deg: 260 }] });
assert.ok(r4.winner === 0 || r4.winner === 1);
console.log('engine ok,', checked, 'Bälle,', BALL_IDS.length, 'definiert; 2v2 Ergebnis:', JSON.stringify(r4));

// Seltenheits-Fähigkeiten und Sterne
{
  const { createSim, stepSim, runFight, DEFS } = await import('../public/js/engine.js');
  const mk = (a, b, stars) => createSim({ seed: 7, balls: [{ type: a, team: 0, deg: 10, stars: stars || 0 }, { type: b, team: 1, deg: 200 }] });
  const se = Object.keys(DEFS).find(k => DEFS[k].rarity === 'selten');
  const s1 = mk(se, 'stachel');   // selten bekommt Schild
  if (!(s1.balls[0].shield > 0)) throw new Error('Schild fehlt');
  const s2 = mk('stachel', 'stachel', 3);
  if (Math.abs(s2.balls[0].maxHp / s2.balls[1].maxHp - 1.24) > 1e-9) throw new Error('Sterne wirken nicht auf Leben');
  const ep = Object.keys(DEFS).find(k => DEFS[k].rarity === 'episch'), lg = Object.keys(DEFS).find(k => DEFS[k].rarity === 'legendaer');
  for (const [id, key] of [[ep, 'phase'], [lg, 'ult']]) {
    const s = mk(id, 'ramm'); s.balls[0].hp = s.balls[0].maxHp * .3; stepSim(s);
    if (!s.balls[0].phase) throw new Error(key + ' wurde nicht ausgelöst');
  }
  const a = runFight({ seed: 5, balls: [{ type: lg, team: 0, deg: 1, stars: 2 }, { type: ep, team: 1, deg: 190 }] });
  const b = runFight({ seed: 5, balls: [{ type: lg, team: 0, deg: 1, stars: 2 }, { type: ep, team: 1, deg: 190 }] });
  if (a.steps !== b.steps || a.winner !== b.winner) throw new Error('nicht deterministisch mit Sternen');
  console.log('Seltenheits-Fähigkeiten und Sterne ok');
}
