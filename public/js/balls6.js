// Dino-Box: acht Urzeit-Bälle. Deterministisch wie balls2.js.
import { DT, hurt, stun, fx, rand, nearestEnemy, heal } from './core.js';
import { DEFS, BALL_IDS } from './balls.js';
import { shot, wave, tick } from './balls2.js';
import { sprint, sprintEnd } from './balls5.js';

const N = {
  raptor: {
    name: 'Raptorball', rarity: 'gewoehnlich', hp: 100, speed: 165, r: 16, dmg: 'Mittel',
    desc: 'Flink und angriffslustig. Stürmt in kurzen Sprints auf den Gegner zu und beißt dabei doppelt so fest.',
    strong: 'Träge Gegner', weak: 'Schildball',
    contact: (b, sim) => (b.st.dash > 0 ? 18 : 8) + sim.t * .1, contactCd: .5,
    init(b) { b.st.dash = 0; b.st.sp = 2.4; },
    update(b, sim) {
      if (sprintEnd(b, 'raptor')) return;
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(2.4, 3.1 - sim.t * .015); sprint(b, sim, 'raptor', .45, 320); }
    }
  },
  fossil: {
    name: 'Fossilball', rarity: 'gewoehnlich', hp: 135, speed: 110, r: 19, dmg: 'Mittel',
    desc: 'Hart wie Stein. Steckt Treffer besser weg und gibt beim Rammen einen Teil des Schadens zurück.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    takes: () => .8,
    onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'contact') hurt(sim, src, amt * .3, t, 'reflect'); }
  },
  trike: {
    name: 'Triceratopsball', rarity: 'gewoehnlich', hp: 120, speed: 130, r: 19, dmg: 'Mittel',
    desc: 'Senkt die Hörner und stürmt los. Der Angriff mit dem Nackenschild trifft mehr als doppelt so hart.',
    strong: 'Gegner ohne Schutz', weak: 'Flinke Gegner',
    contact: (b, sim) => (b.st.dash > 0 ? 21 : 8) + sim.t * .1, contactCd: .55,
    init(b) { b.st.dash = 0; b.st.sp = 3; },
    update(b, sim) {
      if (sprintEnd(b, 'trike')) return;
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(3, 3.8 - sim.t * .02); sprint(b, sim, 'trike', .6, 290); }
    }
  },
  ptero: {
    name: 'Pterodaktylusball', rarity: 'selten', hp: 90, speed: 150, r: 17, dmg: 'Hoch',
    desc: 'Segelt umher und schießt Federpfeile im Fächer, die durchschlagen.',
    strong: 'Langsame Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.7, 2.3 - sim.t * .012))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      for (let i = -1; i <= 1; i++) shot(sim, b, e, { speed: 290, r: 4, dmg: 5.5 + sim.t * .07, vis: 'pfeil', pierce: 1, pcd: .5, life: 2.4, lead: .5 }, i * .22);
    }
  },
  stego: {
    name: 'Stegoball', rarity: 'selten', hp: 125, speed: 125, r: 19, dmg: 'Hoch',
    desc: 'Die Rückenplatten schützen ihn: Rammen tut dem Gegner weh. Mit dem Schwanz schlägt er in einem Kreis um sich.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'contact') hurt(sim, src, amt * .45, t, 'reflect'); },
    init(b) { b.st.cd = 1.8; },
    update(b, sim) {
      if (!tick(b, Math.max(2.4, 3.2 - sim.t * .015))) return;
      wave(sim, b, b.x, b.y, { sp: 190, maxR: 80, dmg: 11 + sim.t * .13, push: 1, vis: 'quake' });
    }
  },
  anky: {
    name: 'Ankyloball', rarity: 'episch', hp: 140, speed: 115, r: 20, dmg: 'Hoch',
    desc: 'Gepanzert von Kopf bis Schwanz. Verträgt Treffer von Geschossen kaum, und mit der Schwanzkeule betäubt er Gegner in der Nähe.',
    strong: 'Fernkämpfer', weak: 'Flächenschaden',
    contact: (b, sim) => 9 + sim.t * .1,
    takes: (t, sim, kind) => kind === 'proj' ? .55 : .85,
    init(b) { b.st.cd = 2; },
    update(b, sim) {
      if (!tick(b, Math.max(3, 3.8 - sim.t * .016))) return;
      wave(sim, b, b.x, b.y, { sp: 200, maxR: 100, dmg: 13 + sim.t * .15, stun: .85, vis: 'quake' });
    }
  },
  brachio: {
    name: 'Brachioball', rarity: 'episch', hp: 150, speed: 105, r: 24, dmg: 'Hoch',
    desc: 'Der Riese. Jeder Schritt lässt den Boden beben und stärkt ihn mit frischem Grün.',
    strong: 'Alles Kleine', weak: 'Flinke Gegner',
    contact: (b, sim) => 10 + sim.t * .1,
    init(b) { b.st.cd = 1.6; },
    update(b, sim) {
      if (!tick(b, Math.max(2.2, 2.8 - sim.t * .014))) return;
      wave(sim, b, b.x, b.y, { sp: 200, maxR: 125, dmg: 12 + sim.t * .15, push: 1, vis: 'quake' });
      heal(sim, b, 4 + sim.t * .05);
    }
  },
  trex: {
    name: 'T-Rexball', rarity: 'legendaer', hp: 140, speed: 150, r: 22, dmg: 'Sehr hoch',
    desc: 'Der König der Urzeit. Brüllt Gegner in der Nähe in Schreckstarre und beißt im Sprint zu, wovon er Leben zurückbekommt.',
    strong: 'Fast alles', weak: 'Eisball',
    contact: (b, sim) => (b.st.dash > 0 ? 26 : 9) + sim.t * .12, contactCd: .5,
    onContact(b, o, sim, d) { if (d > 0 && b.st.dash > 0) heal(sim, b, d * .3); },
    init(b) { b.st.cd = 2; b.st.dash = 0; b.st.sp = 3; },
    update(b, sim) {
      if (sprintEnd(b, 'trex')) return;
      if (tick(b, Math.max(4, 5 - sim.t * .02))) wave(sim, b, b.x, b.y, { sp: 200, maxR: 130, dmg: 10 + sim.t * .12, stun: .7, vis: 'nova' });
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(3, 3.8 - sim.t * .02); sprint(b, sim, 'trex', .55, 330); }
    }
  }
};

// Schadensfaktoren aus dem Balance-Lauf (siehe tools/balance.js)
const DM6 = { raptor: 1.66, fossil: 1.8, trike: 1.45, ptero: 1.13, stego: 1.4, anky: .91, brachio: .71, trex: .88 };
const BOX_OF = { dino: ['raptor', 'fossil', 'trike', 'ptero', 'stego', 'anky', 'brachio', 'trex'] };
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  N[id].box = box;
  N[id].dm = DM6[id];
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
