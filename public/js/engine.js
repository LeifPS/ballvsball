// Öffentliche Schnittstelle der Kampf-Engine (Browser und Worker)
import { makeSim, stepSim, runToEnd, DT, BOX, MAX_T, ENRAGE_T } from './core.js';
import { DEFS, OBJS, BALL_IDS, RARITY, ballsByRarity } from './balls.js';

export { DT, BOX, MAX_T, ENRAGE_T, DEFS, OBJS, BALL_IDS, RARITY, ballsByRarity, stepSim };

// cfg: { seed, balls: [{type, team, deg}], noFx? }
export function createSim(cfg) { return makeSim(cfg, DEFS, OBJS); }
export function runFight(cfg) {
  const sim = createSim(Object.assign({}, cfg, { noFx: true }));
  const res = runToEnd(sim);
  res.dealt = sim.dealt;
  return res;
}
