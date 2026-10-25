// Öffentliche Schnittstelle der Kampf-Engine (Browser und Worker)
import { makeSim, stepSim, runToEnd, DT, BOX, MAX_T, ENRAGE_T, STAR_BONUS, MAX_STARS } from './core.js';
import { DEFS, OBJS, BALL_IDS, RARITY, ballsByRarity, perkStep } from './balls.js';
import { BOX_IDS, ballsInBox } from './balls2.js';

export { STAR_BONUS, MAX_STARS, DT, BOX, MAX_T, ENRAGE_T, DEFS, OBJS, BALL_IDS, RARITY, ballsByRarity, stepSim, BOX_IDS, ballsInBox };

// cfg: { seed, balls: [{type, team, deg}], noFx? }
export function createSim(cfg) { const sim = makeSim(cfg, DEFS, OBJS); sim.perk = perkStep; return sim; }
export function runFight(cfg) {
  const sim = createSim(Object.assign({}, cfg, { noFx: true }));
  const res = runToEnd(sim);
  res.dealt = sim.dealt;
  return res;
}
