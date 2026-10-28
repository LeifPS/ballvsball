// Ereignisboxen im Herbst: Herbstbox (Laub, Pilz, Igel, Eichhörnchen, Drachen, Vogelscheuche) und Sturmbox (Wind, Nebel, Gewitter, Schirm, Leuchtturm, Kapitän). Deterministisch wie balls2.js.
import { DT, hurt, stun, fx, rand, nearestEnemy, heal } from './core.js';
import { DEFS, BALL_IDS, newObj, clampPt } from './balls.js';
import { shot, wave, tick } from './balls2.js';
import { sprint, sprintEnd } from './balls5.js';

const N = {
  /* ================= Herbstbox ================= */
  laub: {
    name: 'Laubball', rarity: 'gewoehnlich', hp: 100, speed: 140, r: 16, dmg: 'Mittel',
    desc: 'Ein Wirbel aus bunten Blättern. Schleudert Blätter im Fächer auf den Gegner.',
    strong: 'Große Gegner', weak: 'Schnelle Gegner',
    contact: (b, sim) => 6 + sim.t * .07, contactCd: .5,
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1.8)) return;
      const e = nearestEnemy(sim, b);
      if (e) for (const a of [-.3, 0, .3]) shot(sim, b, e, { speed: 200, r: 5, dmg: 6 + sim.t * .07, vis: 'blatt', life: 2.6, lead: .3 }, a);
    }
  },
  pilz: {
    name: 'Pilzball', rarity: 'gewoehnlich', hp: 110, speed: 125, r: 17, dmg: 'Mittel',
    desc: 'Streut giftige Sporen, die als Wolke liegen bleiben und alles darin vergiften.',
    strong: 'Langsame Gegner', weak: 'Schnelle Gegner',
    contact: (b, sim) => 6 + sim.t * .06, contactCd: .5,
    init(b) { b.st.cd = 1.5; },
    update(b, sim) { if (tick(b, 3.2)) newObj(sim, 'puddle', b, b.x, b.y, { r: 24, life: 5, dps: 4 + sim.t * .05, vis: 'brew' }); }
  },
  igel: {
    name: 'Igelball', rarity: 'selten', hp: 110, speed: 125, r: 17, dmg: 'Hoch',
    desc: 'Stachelig und wehrhaft: Wer ihn rammt, bekommt die Hälfte zurück, und er schießt Stacheln in alle Richtungen.',
    strong: 'Rammbälle', weak: 'Feuerbälle',
    contact: (b, sim) => 8 + sim.t * .08, contactCd: .5,
    onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'contact') hurt(sim, src, amt * .5, t, 'reflect'); },
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      if (!tick(b, 2.6)) return;
      const e = nearestEnemy(sim, b);
      if (e) for (const a of [-.5, 0, .5]) shot(sim, b, e, { speed: 230, r: 4, dmg: 7 + sim.t * .08, vis: 'spike', life: 2.2, lead: .3 }, a);
    }
  },
  eichhoernchen: {
    name: 'Eichhörnchenball', rarity: 'selten', hp: 80, speed: 150, r: 14, dmg: 'Hoch',
    desc: 'Pfeilschnell. Wirft ununterbrochen Nüsse und sprintet ab und zu auf den Gegner zu.',
    strong: 'Träge Gegner', weak: 'Rammbälle',
    contact: (b, sim) => (b.st.dash > 0 ? 14 : 4) + sim.t * .05, contactCd: .5,
    init(b) { b.st.cd = .8; b.st.sp = 3; b.st.dash = 0; },
    update(b, sim) {
      if (sprintEnd(b, 'eichhoernchen')) return;
      b.st.sp -= DT; if (b.st.sp <= 0) { b.st.sp = 4; sprint(b, sim, 'eichhoernchen', .6, 300); return; }
      if (!tick(b, .9)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 280, r: 3.8, dmg: 5 + sim.t * .06, vis: 'kern', life: 2, lead: .4 });
    }
  },
  drachen: {
    name: 'Drachenball', rarity: 'episch', hp: 120, speed: 135, r: 17, dmg: 'Hoch',
    desc: 'Ein Papierdrache im Herbstwind. Segelt in Sprints heran und bläst bei jeder Landung alles weg.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => (b.st.dash > 0 ? 18 : 8) + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.8; b.st.dash = 0; },
    update(b, sim) {
      if (sprintEnd(b, 'drachen')) { return; }
      if (tick(b, 3.6)) { sprint(b, sim, 'drachen', .7, 320); wave(sim, b, b.x, b.y, { sp: 170, maxR: 85, dmg: 12 + sim.t * .14, push: 1, vis: 'shock' }); }
    }
  },
  vogelscheuche: {
    name: 'Vogelscheuche', rarity: 'legendaer', hp: 230, speed: 120, r: 21, dmg: 'Hoch',
    desc: 'Auf dem Feld vergessen. Schickt Krähenschwärme los, die den Gegner verfolgen.',
    strong: 'Einzelne Gegner', weak: 'Flächenschaden',
    contact: (b, sim) => 11 + sim.t * .14, contactCd: .5,
    init(b) { b.st.cd = 2; },
    update(b, sim) {
      if (!tick(b, 4.5)) return;
      const e = nearestEnemy(sim, b);
      if (e) for (const a of [-.7, -.35, 0, .35, .7]) shot(sim, b, e, { speed: 210, r: 5, dmg: 7 + sim.t * .09, vis: 'bat', turn: 1.6, life: 3.2, lead: 0 }, a);
    }
  },
  /* ================= Sturmbox ================= */
  wind: {
    name: 'Windball', rarity: 'gewoehnlich', hp: 95, speed: 150, r: 15, dmg: 'Niedrig',
    desc: 'Bläst alles weg, was ihm zu nahe kommt, und richtet dabei etwas Schaden an.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 5 + sim.t * .05, contactCd: .5,
    init(b) { b.st.cd = 1.2; },
    update(b, sim) { if (tick(b, 2.4)) wave(sim, b, b.x, b.y, { sp: 160, maxR: 80, dmg: 8 + sim.t * .1, push: 1, vis: 'shock' }); }
  },
  nebel: {
    name: 'Nebelball', rarity: 'gewoehnlich', hp: 120, speed: 125, r: 18, dmg: 'Mittel',
    desc: 'Hüllt die Arena in Nebel. Wer sich darin aufhält, wird langsam zersetzt.',
    strong: 'Langsame Gegner', weak: 'Schnelle Gegner',
    contact: (b, sim) => 6 + sim.t * .06, contactCd: .5,
    init(b) { b.st.cd = 1.5; },
    update(b, sim) { if (tick(b, 3)) newObj(sim, 'puddle', b, b.x, b.y, { r: 30, life: 5, dps: 3.4 + sim.t * .04, vis: 'dust' }); }
  },
  gewitter: {
    name: 'Gewitterwolke', rarity: 'selten', hp: 100, speed: 130, r: 17, dmg: 'Hoch',
    desc: 'Dunkle Wolke mit Blitzen: Schlägt kurz nach dem Zielen am Gegner ein und betäubt ihn kurz.',
    strong: 'Langsame Gegner', weak: 'Schnelle Gegner',
    contact: (b, sim) => 6 + sim.t * .06, contactCd: .5,
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      if (!tick(b, 2.4)) return;
      const e = nearestEnemy(sim, b);
      if (e) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45), clampPt(e.y + e.vy * .45), { fuse: .55, r: 30, dmg: 13 + sim.t * .18, stun: .35, vis: 'blitz', fxk: 'zap' });
    }
  },
  schirm: {
    name: 'Regenschirmball', rarity: 'selten', hp: 130, speed: 120, r: 18, dmg: 'Mittel',
    desc: 'Hält Schüsse zum großen Teil ab und wirft bei jedem Wechsel der Windrichtung Tropfen zurück.',
    strong: 'Fernkämpfer', weak: 'Nahkämpfer',
    contact: (b, sim) => 8 + sim.t * .09, contactCd: .5,
    takes: (b, sim, kind) => kind === 'proj' ? .3 : 1,
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      if (!tick(b, 2.2)) return;
      const e = nearestEnemy(sim, b);
      if (e) for (const a of [-.25, .25]) shot(sim, b, e, { speed: 220, r: 4, dmg: 6 + sim.t * .08, vis: 'bullet', life: 2.4, lead: .3 }, a);
    }
  },
  leuchtturm: {
    name: 'Leuchtturm', rarity: 'episch', hp: 150, speed: 110, r: 20, dmg: 'Hoch',
    desc: 'Sein Lichtstrahl durchschlägt alles und trifft mehrmals.',
    strong: 'Gegner in Reihe', weak: 'Schnelle Gegner',
    contact: (b, sim) => 8 + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      if (!tick(b, 1.5)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 320, r: 5, dmg: 9 + sim.t * .1, vis: 'laser', pierce: 1, pcd: .5, life: 1.8, lead: .5 });
    }
  },
  kapitaen: {
    name: 'Sturmkapitän', rarity: 'legendaer', hp: 240, speed: 125, r: 21, dmg: 'Sehr hoch',
    desc: 'Trotzt jedem Unwetter: ruft Blitze, Wellen und Wind zugleich.',
    strong: 'Fast alles', weak: 'Bomben',
    contact: (b, sim) => 12 + sim.t * .15, contactCd: .5,
    init(b) { b.st.cd = 2; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, 3.6)) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const k = b.st.n++ % 2;
      if (k) wave(sim, b, b.x, b.y, { sp: 220, maxR: 120, dmg: 14 + sim.t * .16, push: 1, stun: .5, vis: 'nova' });
      else for (const dd of [-.4, .4]) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45 + dd * 60), clampPt(e.y + e.vy * .45), { fuse: .55, r: 30, dmg: 14 + sim.t * .18, stun: .35, vis: 'blitz', fxk: 'zap' });
    }
  }
};
const DM8 = { laub: 1.05, pilz: 4, igel: 1.1, eichhoernchen: 1.6, drachen: 2, vogelscheuche: 0.87, wind: 3, nebel: 3.3, gewitter: 0.8, schirm: 0.85, leuchtturm: 0.75, kapitaen: 0.5 };
const BOX_OF = {
  herbst: ['laub', 'pilz', 'igel', 'eichhoernchen', 'drachen', 'vogelscheuche'],
  sturm: ['wind', 'nebel', 'gewitter', 'schirm', 'leuchtturm', 'kapitaen']
};
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  N[id].box = box;
  N[id].dm = DM8[id];
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
