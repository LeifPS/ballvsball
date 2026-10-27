// Familien-Box: die Familie als Bälle (Menschen legendär, Tiere gewöhnlich bis episch). Deterministisch wie balls2.js.
import { DT, hurt, stun, fx, rand, setDir, nearestEnemy, heal } from './core.js';
import { DEFS, BALL_IDS, newObj, aimVel, clampPt } from './balls.js';
import { shot, wave, tick } from './balls2.js';

function nobj(sim, b, k) { let n = 0; for (const o of sim.objs) if (o.k === k && o.owner === b.id && !o.dead) n++; return n; }
// Sprint: kurz schneller in Richtung Gegner; danach wieder normale Geschwindigkeit
export function sprint(b, sim, id, secs, speed) {
  const e = nearestEnemy(sim, b);
  if (!e) return false;
  b.st.dash = secs; b.speed = speed;
  const d = Math.hypot(e.x - b.x, e.y - b.y) || 1;
  b.vx = (e.x - b.x) / d * speed; b.vy = (e.y - b.y) / d * speed;
  fx(sim, 'dash', b.x, b.y, 0);
  return true;
}
export function sprintEnd(b, id) {
  if (b.st.dash > 0) { b.st.dash -= DT; if (b.st.dash <= 0) { const d = Math.hypot(b.vx, b.vy) || 1; b.speed = DEFS[id].speed; b.vx = b.vx / d * b.speed; b.vy = b.vy / d * b.speed; } return true; }
  return false;
}

// Eriks Stimmung: 0 wütend, 1 fröhlich, 2 traurig, 3 ängstlich (ändert Tempo)
function erikMood(b, emo) {
  b.st.emo = emo;
  const sp = [175, 150, 105, 235][emo], d = Math.hypot(b.vx, b.vy) || 1;
  b.speed = sp; b.vx = b.vx / d * sp; b.vy = b.vy / d * sp;
}
function tick2(b, key, next) { b.st[key] = (b.st[key] || 0) - DT; if (b.st[key] > 0) return false; b.st[key] = next; return true; }

const N = {
  thore: {
    name: 'Thore', rarity: 'legendaer', hp: 125, speed: 170, r: 15, dmg: 'Sehr hoch',
    desc: 'Thore (6): der Kleinste, aber überall gleichzeitig. Lässt Bausteine liegen und dreht regelmäßig im Sprint auf.',
    strong: 'Träge Gegner', weak: 'Flächenschaden',
    contact: (b, sim) => (b.st.dash > 0 ? 16 : 8) + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = .8; b.st.dash = 0; b.st.sp = 3.5; },
    update(b, sim) {
      if (sprintEnd(b, 'thore')) return;
      if (tick(b, 1.1) && nobj(sim, b, 'mine') < 7) newObj(sim, 'mine', b, b.x, b.y, { r: 7, arm: .3, life: 12, trig: 14, er: 28, dmg: 12 + sim.t * .17, vis: 'brick', fxk: 'brickboom' });
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(3.8, 5 - sim.t * .02); sprint(b, sim, 'thore', .55, 300); }
    }
  },
  erik: {
    name: 'Erik', rarity: 'legendaer', hp: 135, speed: 150, r: 18, dmg: 'Sehr hoch',
    desc: 'Erik (10): hat Launen, die alle paar Sekunden wechseln. Wütend: Schussfächer und Kracher. Fröhlich: heilt sich und wirft Partybälle. Traurig: weint Pfützen. Ängstlich: rennt und schreit Gegner nieder.',
    strong: 'Gegner in der Ecke', weak: 'Schildball',
    contact: (b, sim) => (b.st.emo === 0 ? 11 : b.st.emo === 2 ? 4 : 7) + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1; b.st.n = 0; b.st.emo = 1; b.st.mood = 4.5; erikMood(b, 1); },
    update(b, sim) {
      b.st.mood -= DT;
      if (b.st.mood <= 0) { b.st.mood = 5; erikMood(b, (b.st.emo + 1) % 4); fx(sim, 'dash', b.x, b.y, 0); b.st.cd = Math.min(b.st.cd, .5); }
      const emo = b.st.emo;
      if (emo === 1) heal(sim, b, 2.6 * DT);
      if (emo === 2) { if (tick2(b, 'tc', .85)) newObj(sim, 'puddle', b, b.x, b.y, { r: 25, life: 4, dps: 8 + sim.t * .09, vis: 'rain' }); return; }
      if (!tick(b, emo === 0 ? Math.max(1.2, 1.7 - sim.t * .01) : emo === 1 ? 1.9 : 1.6)) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      if (emo === 0) {
        for (let i = -1; i <= 1; i++) shot(sim, b, e, { speed: 270, r: 6, dmg: 6 + sim.t * .08, vis: 'tennis', lead: .4, pierce: 1, pcd: .5 }, i * .2);
        if (b.st.n++ % 3 === 2) wave(sim, b, b.x, b.y, { sp: 200, maxR: 105, dmg: 11 + sim.t * .14, push: 1, vis: 'shock' });
      } else if (emo === 1) {
        for (let i = -1; i <= 1; i += 2) shot(sim, b, e, { speed: 200, r: 7, dmg: 4 + sim.t * .06, vis: 'gold', lead: .3, pierce: 1, pcd: .5, life: 4 }, i * .35);
      } else {
        wave(sim, b, b.x, b.y, { sp: 230, maxR: 95, dmg: 6 + sim.t * .09, stun: .6, vis: 'phase' });
      }
    }
  },
  ida: {
    name: 'Ida', rarity: 'legendaer', hp: 130, speed: 140, r: 18, dmg: 'Sehr hoch',
    desc: 'Ida (13): ihr Lied bleibt im Ohr. Gegner in der Nähe werden kurz betäubt, und ihre langen Haare treffen hart.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 11 + sim.t * .12, contactCd: .5,
    init(b) { b.st.cd = 1.4; },
    update(b, sim) {
      if (!tick(b, Math.max(2.8, 3.6 - sim.t * .015))) return;
      wave(sim, b, b.x, b.y, { sp: 190, maxR: 115, dmg: 8 + sim.t * .1, stun: .75, vis: 'phase' });
    }
  },
  leif: {
    name: 'Leif', rarity: 'legendaer', hp: 120, speed: 150, r: 18, dmg: 'Sehr hoch',
    desc: 'Leif (15): zockt. Schickt verfolgende Energiekugeln los und löst ab und zu einen Lag-Blitz aus.',
    strong: 'Langsame Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(1.6, 2.1 - sim.t * .01))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      shot(sim, b, e, { k: 'bee', speed: 215, r: 5, dmg: 7 + sim.t * .09, vis: 'bolt', turn: 2.4, life: 4, lead: 0 });
      if (b.st.n++ % 3 === 2) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45), clampPt(e.y + e.vy * .45), { fuse: .5, r: 34, dmg: 15 + sim.t * .2, stun: .5, vis: 'blitz', fxk: 'zap' });
    }
  },
  sandra: {
    name: 'Sandra', rarity: 'legendaer', hp: 150, speed: 125, r: 20, dmg: 'Hoch',
    desc: 'Sandra (42): sorgt für alle. Heilt sich regelmäßig und stoppt mit dem Mutterblick den nächsten Gegner.',
    strong: 'Lange Kämpfe', weak: 'Kurze Kämpfe',
    contact: (b, sim) => 8 + sim.t * .1,
    init(b) { b.st.cd = 2; b.st.look = 5; },
    update(b, sim) {
      if (tick(b, 3)) { heal(sim, b, 10 + sim.t * .12); wave(sim, b, b.x, b.y, { sp: 150, maxR: 85, dmg: 6 + sim.t * .08, push: 1, vis: 'nova' }); }
      b.st.look -= DT;
      if (b.st.look <= 0) {
        b.st.look = 6;
        const e = nearestEnemy(sim, b);
        if (e && Math.hypot(e.x - b.x, e.y - b.y) < 170) { stun(sim, e, 1); hurt(sim, e, 9 + sim.t * .1, b, 'area'); }
      }
    }
  },
  alexander: {
    name: 'Alexander', rarity: 'legendaer', hp: 165, speed: 120, r: 21, dmg: 'Hoch',
    desc: 'Alexander (46): der Grillmeister. Gibt Rammschaden zurück und wirft glühende Würstchen, die Gegner anbrennen.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'contact') hurt(sim, src, amt * .4, t, 'reflect'); },
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      if (!tick(b, Math.max(1.9, 2.6 - sim.t * .014))) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 240, r: 6, dmg: 6 + sim.t * .08, vis: 'chili', burnS: 3.2, burnD: 5 + sim.t * .07, lead: .5 });
    }
  },
  lilli: {
    name: 'Lilli', rarity: 'episch', hp: 115, speed: 160, r: 18, dmg: 'Hoch',
    desc: 'Lilli (Hund): holt den Knochen. Wirft ihn auf den Gegner, er kommt zu ihr zurück, und sie beißt in kurzen Sprints zu.',
    strong: 'Träge Gegner', weak: 'Schildball',
    contact: (b, sim) => (b.st.dash > 0 ? 18 : 9) + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.2; b.st.dash = 0; b.st.sp = 4; },
    update(b, sim) {
      if (sprintEnd(b, 'lilli')) return;
      if (tick(b, Math.max(2, 2.8 - sim.t * .014))) {
        const e = nearestEnemy(sim, b);
        if (e) {
          const v = aimVel(b, e, 240, .4), l = Math.hypot(v[0], v[1]) || 1;
          newObj(sim, 'boom', b, b.x, b.y, { vx: v[0], vy: v[1], speed: 240, r: 8, dmg: 8 + sim.t * .1, phase: 0, age: 0, rot: 0, vis: 'bone', tx: clampPt(b.x + v[0] / l * 160), ty: clampPt(b.y + v[1] / l * 160), proj: true });
        }
      }
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(3.5, 4.5 - sim.t * .02); sprint(b, sim, 'lilli', .5, 290); }
    }
  },
  lexi: {
    name: 'Lexi', rarity: 'selten', hp: 95, speed: 165, r: 16, dmg: 'Mittel',
    desc: 'Lexi (graue Katze): flink und schwer zu fassen. Weicht jedem vierten Treffer aus und kratzt ordentlich.',
    strong: 'Langsame Gegner', weak: 'Flächenschaden',
    contact: (b, sim) => 10 + sim.t * .12, contactCd: .45,
    takes: (t, sim, kind) => kind !== 'dot' && rand(sim) < .25 ? 0 : 1
  },
  finni: {
    name: 'Finni', rarity: 'gewoehnlich', hp: 100, speed: 140, r: 17, dmg: 'Mittel',
    desc: 'Finni (weiße Katze): spielt mit Wollknäueln und wirft sie dem Gegner nach. Die Knäuel folgen ihm ein Stück.',
    strong: 'Gegner mit festen Wegen', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1.8)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { k: 'bee', speed: 190, r: 5.5, dmg: 6 + sim.t * .08, vis: 'yoyo', turn: 1.4, life: 3.5, lead: 0 });
    }
  },
  ursel: {
    name: 'Ursel', rarity: 'gewoehnlich', hp: 105, speed: 140, r: 17, dmg: 'Hoch',
    desc: 'Ursel (schwarz-braune Katze): schleicht und springt dann los. Der Sprung trifft doppelt.',
    strong: 'Träge Gegner', weak: 'Schildball',
    contact: (b, sim) => (b.st.dash > 0 ? 21 : 7) + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 1.5; b.st.dash = 0; b.st.sp = 2.8; },
    update(b, sim) {
      if (sprintEnd(b, 'ursel')) return;
      b.st.sp -= DT;
      if (b.st.sp <= 0) { b.st.sp = Math.max(2.8, 3.6 - sim.t * .02); sprint(b, sim, 'ursel', .55, 320); }
    }
  }
};

// Schadensfaktoren aus dem Balance-Lauf (siehe tools/balance.js)
const DM5 = { thore: .72, erik: .86, ida: 1.45, leif: .78, sandra: .6, alexander: .55, lilli: 1.3, lexi: 2.24, finni: 1.31, ursel: 1.51 };
const BOX_OF = { familie: ['thore', 'erik', 'ida', 'leif', 'sandra', 'alexander', 'lilli', 'lexi', 'finni', 'ursel'] };
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  N[id].box = box;
  N[id].dm = DM5[id];
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
