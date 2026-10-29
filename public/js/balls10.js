// Bossbälle: nur für das Bossrennen im Einzelspieler. Nicht in BALL_IDS, in keiner Box, nicht im Index, nicht handelbar.
import { DT, fx, nearestEnemy } from './core.js';
import { DEFS, newObj, clampPt } from './balls.js';
import { shot, wave, tick } from './balls2.js';

const B = {
  steinriese: {
    name: 'Steinriese', rarity: 'mythisch', hp: 100, speed: 85, r: 27, dmg: 'Sehr hoch', boss: true, bossHp: 1.5,
    desc: 'Ein riesiger Felsbrocken. Stampft Druckwellen in den Boden und lässt Brocken vom Himmel fallen.',
    strong: 'Kleine Gegner', weak: 'Fernkämpfer',
    contact: (b, sim) => 12 + sim.t * .1, contactCd: .6,
    init(b) { b.st.cd = 2; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, 2.8)) return;
      const e = nearestEnemy(sim, b); if (!e) return;
      if (b.st.n++ % 2) for (const dd of [-1, 0, 1]) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45 + dd * 55), clampPt(e.y + e.vy * .45 + dd * 20), { fuse: .6, r: 30, dmg: 12 + sim.t * .15, stun: .3, vis: 'blitz' });
      else wave(sim, b, b.x, b.y, { sp: 200, maxR: 130, dmg: 12 + sim.t * .14, push: 1, stun: .45, vis: 'nova' });
    }
  },
  glutdrache: {
    name: 'Glutdrache', rarity: 'mythisch', hp: 100, speed: 115, r: 24, dmg: 'Sehr hoch', boss: true, bossHp: 1.1,
    desc: 'Speit Feuerbälle im Fächer und hinterlässt eine brennende Spur.',
    strong: 'Langsame Gegner', weak: 'Wasserbälle',
    contact: (b, sim) => 10 + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.4; b.st.tr = 0; },
    update(b, sim) {
      b.st.tr -= DT; if (b.st.tr <= 0) { b.st.tr = .35; newObj(sim, 'fire', b, b.x, b.y, { r: 11, life: 2.4, dps: 5 + sim.t * .06 }); }
      if (!tick(b, 2.2)) return;
      const e = nearestEnemy(sim, b);
      if (e) for (const a of [-.5, -.25, 0, .25, .5]) shot(sim, b, e, { speed: 230, r: 6, dmg: 6 + sim.t * .08, vis: 'chili', burnS: 3.2, burnD: 5 + sim.t * .07, lead: .4, life: 2.8 }, a);
    }
  },
  dornenkoenig: {
    name: 'Dornenkönig', rarity: 'mythisch', hp: 100, speed: 100, r: 25, dmg: 'Sehr hoch', boss: true, bossHp: 2.0,
    desc: 'Schießt Dornenringe in alle Richtungen und vergiftet den Boden um sich herum.',
    strong: 'Rammbälle', weak: 'Schnelle Gegner',
    contact: (b, sim) => 11 + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.6; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, 2.6)) return;
      const e = nearestEnemy(sim, b); if (!e) return;
      const off = (b.st.n++ % 2) * .39;
      for (let i = 0; i < 10; i++) shot(sim, b, e, { speed: 210, r: 5, dmg: 7 + sim.t * .08, vis: 'spike', life: 2.4, lead: 0 }, off + i * .6283);
      if (b.st.n % 2) newObj(sim, 'puddle', b, b.x, b.y, { r: 30, life: 5, dps: 5 + sim.t * .06, vis: 'brew' });
    }
  }
};
for (const id in B) { B[id].dm = 1; DEFS[id] = B[id]; }
export const BOSS_IDS = Object.keys(B);
