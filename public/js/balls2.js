// Neue Bälle (Welle 2): Theme-Boxen und Halloween. Deterministisch wie balls.js.
import { DM } from './tuning.js';
import { DT, BOX, PI, dsin, dcos, len, hurt, stun, fx, rand, setDir, rotateVel, steer, nearestEnemy, heal, burn } from './core.js';
import { DEFS, OBJS, BALL_IDS, newObj, aimVel, clampPt, foes, own, ready, postHit } from './balls.js';

export function rot2(v, ang) {
  const c = dcos(ang), s = dsin(ang);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}
// Standard-Geschoss
export function shot(sim, b, e, sp, ang) {
  let v = aimVel(b, e, sp.speed, sp.lead == null ? .4 : sp.lead);
  if (ang) v = rot2(v, ang);
  return newObj(sim, sp.k || 'bullet', b, b.x, b.y, {
    vx: v[0], vy: v[1], r: sp.r, dmg: sp.dmg, life: sp.life || 3, proj: true, vis: sp.vis, pierce: sp.pierce, pcd: sp.pcd,
    stun: sp.stun, burnS: sp.burnS, burnD: sp.burnD, leech: sp.leech, speed: sp.speed, turn: sp.turn, over: sp.over
  });
}
// Zeitgeber: gibt true zurück, wenn ausgelöst wird
export function tick(b, next) { b.st.cd -= DT; if (b.st.cd > 0) return false; b.st.cd = next; return true; }
export function wave(sim, b, x, y, ex) {
  return newObj(sim, 'wave', b, x, y, Object.assign({ rad: 2, hit: {}, sp: 150, maxR: 90, dmg: 10, r: 2 }, ex));
}
function nobj(sim, b, k) { let n = 0; for (const o of sim.objs) if (o.k === k && o.owner === b.id && !o.dead) n++; return n; }

const N = {
  /* ================= Standard +5 ================= */
  kaktus: {
    name: 'Kaktusball', rarity: 'gewoehnlich', hp: 115, speed: 130, r: 19, dmg: 'Mittel',
    desc: 'Stachelig und zäh. Wer ihn rammt, bekommt einen Teil des Schadens zurück.',
    strong: 'Rammball, Glasball', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'contact') hurt(sim, src, amt * .35, t, 'reflect'); }
  },
  pfeil: {
    name: 'Pfeilball', rarity: 'gewoehnlich', hp: 90, speed: 150, r: 17, dmg: 'Mittel',
    desc: 'Bei jeder Wandberührung schießt er einen durchbohrenden Pfeil auf den Gegner.',
    strong: 'Langsame Gegner', weak: 'Schildball',
    init(b) { b.st.nx = 0; },
    onWall(b, sim) {
      if (sim.t < b.st.nx) return;
      b.st.nx = sim.t + .6;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 310, r: 4, dmg: 6 + sim.t * .08, vis: 'pfeil', pierce: 1, pcd: .5, life: 2.4, lead: .5 });
    }
  },
  rakete: {
    name: 'Raketenball', rarity: 'selten', hp: 100, speed: 125, r: 17, dmg: 'Hoch',
    desc: 'Zündet regelmäßig den Antrieb und rast auf den Gegner zu. Nur im Flug macht er Schaden.',
    strong: 'Träge Gegner', weak: 'Eisball, Schildball',
    contact: (b, sim) => b.st.dash > 0 ? 24 + sim.t * .3 : 0, contactCd: .5,
    init(b) { b.st.cd = 1.8; b.st.dash = 0; },
    update(b, sim) {
      const s = b.st;
      if (s.dash > 0) {
        s.dash -= DT;
        if (s.dash <= 0) { b.speed = DEFS.rakete.speed; setDir(b, b.vx, b.vy); }
        return;
      }
      if (!tick(b, Math.max(2.2, 3.4 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      s.dash = .6; b.speed = 340; setDir(b, e.x - b.x, e.y - b.y);
      fx(sim, 'dash', b.x, b.y, 0);
    }
  },
  wirbel: {
    name: 'Wirbelball', rarity: 'selten', hp: 105, speed: 130, r: 18, dmg: 'Mittel',
    desc: 'Sendet Schockwellen aus, die Gegner wegschleudern und verletzen.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    init(b) { b.st.cd = 1.6; },
    update(b, sim) {
      if (!tick(b, Math.max(1.8, 3 - sim.t * .02))) return;
      wave(sim, b, b.x, b.y, { sp: 160, maxR: 95, dmg: 11 + sim.t * .12, push: 1, vis: 'shock' });
    }
  },
  magier: {
    name: 'Magierball', rarity: 'episch', hp: 100, speed: 135, r: 18, dmg: 'Hoch',
    desc: 'Schießt drei Zauberblitze, die dem Gegner folgen, durchbohren und ihn aussaugen.',
    strong: 'Wendige Gegner', weak: 'Schildball, Spiegelball',
    init(b) { b.st.cd = 1.4; },
    update(b, sim) {
      if (!tick(b, Math.max(1.6, 2.6 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      for (let i = -1; i <= 1; i++) {
        shot(sim, b, e, { k: 'bee', speed: 150, r: 5, dmg: 4.5 + sim.t * .06, vis: 'bolt', pierce: 1, pcd: .4, life: 4, leech: .35, turn: 2.2, lead: 0 }, i * 18);
      }
    }
  },

  /* ================= Weltraum ================= */
  mond: {
    name: 'Mondball', rarity: 'gewoehnlich', hp: 110, speed: 125, r: 19, dmg: 'Mittel',
    desc: 'Ein kleiner Mond kreist um ihn und rammt alles, was ihm in die Bahn kommt.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    init(b) { b.st.ang = 0; },
    update(b, sim) {
      b.st.ang += (2.2 + sim.t * .03) * DT;
      const sx = b.x + dcos(b.st.ang) * (b.r + 20), sy = b.y + dsin(b.st.ang) * (b.r + 20);
      b.st.sat = [sx, sy];
      for (const e of foes(sim, b.team)) {
        if (len(e.x - sx, e.y - sy) < e.r + 9 && ready({ cd: b.hitCd }, e, sim, .5)) hurt(sim, e, 9 + sim.t * .1, b, 'melee');
      }
    }
  },
  komet: {
    name: 'Kometball', rarity: 'gewoehnlich', hp: 85, speed: 175, r: 15, dmg: 'Hoch',
    desc: 'Rast mit einem glühenden Schweif durch die Box. Der Aufprall tut weh.',
    strong: 'Träge Gegner', weak: 'Fernkämpfer',
    contact: (b, sim) => 15 + sim.t * .2, contactCd: .5,
    init(b) { b.st.cd = 0; },
    update(b, sim) {
      if (tick(b, .1)) newObj(sim, 'fire', b, b.x, b.y, { r: 7, life: 1.2, dps: 3 + sim.t * .04, vis: 'dust' });
    }
  },
  astronaut: {
    name: 'Astronautball', rarity: 'gewoehnlich', hp: 105, speed: 120, r: 18, dmg: 'Niedrig',
    desc: 'Feuert Laserschüsse und atmet in seinem Anzug langsam Leben nach.',
    strong: 'Lange Kämpfe', weak: 'Schnelle Gegner',
    init(b) { b.st.cd = .9; },
    update(b, sim) {
      b.hp = Math.min(b.maxHp, b.hp + 1.2 * DT);
      if (!tick(b, 1.05)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 290, r: 3.5, dmg: 7 + sim.t * .09, vis: 'laser', lead: .5 });
    }
  },
  ufo: {
    name: 'Ufoball', rarity: 'selten', hp: 95, speed: 130, r: 18, dmg: 'Hoch',
    desc: 'Lässt unsichtbare Minen fallen, die bei Annäherung explodieren und kurz betäuben.',
    strong: 'Gegner mit festen Wegen', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      if (!tick(b, Math.max(1.5, 2.6 - sim.t * .02))) return;
      if (nobj(sim, b, 'mine') >= 6) return;
      newObj(sim, 'mine', b, b.x, b.y, { r: 7, arm: .5, life: 14, trig: 20, er: 44, dmg: 18 + sim.t * .25, stun: .5, vis: 'ufomine' });
    }
  },
  saturn: {
    name: 'Saturnball', rarity: 'selten', hp: 115, speed: 120, r: 17, dmg: 'Mittel',
    desc: 'Sein breiter Ring verletzt alles, was ihn berührt.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    update(b, sim) {
      const R = b.r + 24;
      for (const e of foes(sim, b.team)) {
        const d = len(e.x - b.x, e.y - b.y);
        if (Math.abs(d - R) < e.r + 4 && ready({ cd: b.hitCd }, e, sim, .5)) hurt(sim, e, 8 + sim.t * .1, b, 'melee');
      }
    }
  },
  alien: {
    name: 'Alienball', rarity: 'selten', hp: 90, speed: 140, r: 17, dmg: 'Mittel',
    desc: 'Verschießt Schleimkugeln, die dem Gegner folgen und ihm Leben stehlen.',
    strong: 'Große Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      if (!tick(b, Math.max(1.3, 2 - sim.t * .015))) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { k: 'bee', speed: 120, r: 6, dmg: 6 + sim.t * .08, vis: 'slime', leech: .6, turn: 1.6, life: 5, lead: 0 });
    }
  },
  schwarzloch: {
    name: 'Schwarzlochball', rarity: 'episch', hp: 120, speed: 110, r: 17, dmg: 'Hoch',
    desc: 'Saugt Gegner und Geschosse an. Wer ihm zu nahe kommt, wird zerrieben.',
    strong: 'Fernkämpfer, Geschossbälle', weak: 'Flinke Gegner mit viel Leben',
    update(b, sim) {
      const turn = 2.6 + sim.t * .03;
      for (const e of foes(sim, b.team)) {
        const d = len(e.x - b.x, e.y - b.y);
        if (d < 170) steer(e, b.x, b.y, turn, e.speed);
        if (d < b.r + e.r + 34) hurt(sim, e, (7 + sim.t * .1) * DT, b, 'dot');
      }
      for (const o of sim.objs) {
        if (!o.proj || o.team === b.team || o.dead) continue;
        if (len(o.x - b.x, o.y - b.y) < b.r + 55) { o.dead = true; fx(sim, 'block', o.x, o.y, 0); }
      }
    }
  },
  supernova: {
    name: 'Supernovaball', rarity: 'legendaer', hp: 130, speed: 135, r: 19, dmg: 'Sehr hoch',
    desc: 'Lädt sich auf und explodiert in einer gewaltigen Druckwelle, die schleudert und betäubt.',
    strong: 'Fast alles', weak: 'Eisball',
    contact: () => 6,
    init(b) { b.st.cd = 4.5; b.st.ch = 0; b.st.per = 5; },
    update(b, sim) {
      b.st.ch = 1 - Math.max(0, b.st.cd) / b.st.per;
      if (!tick(b, 0)) return;
      b.st.per = Math.max(3.2, b.st.per - .35); b.st.cd = b.st.per;
      wave(sim, b, b.x, b.y, { sp: 260, maxR: 185, dmg: 30 + sim.t * .35, push: 1, stun: .9, vis: 'nova' });
      fx(sim, 'nova', b.x, b.y, 185);
    }
  },

  /* ================= Küche ================= */
  pizza: {
    name: 'Pizzaball', rarity: 'gewoehnlich', hp: 100, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Schleudert drei Pizzastücke, die mehrfach von den Wänden abprallen.',
    strong: 'Große Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1.4; },
    update(b, sim) {
      if (!tick(b, Math.max(2.2, 3.6 - sim.t * .03))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 190, .3);
      for (let i = -1; i <= 1; i++) {
        const w = rot2(v, i * 22);
        newObj(sim, 'saw', b, b.x, b.y, { vx: w[0], vy: w[1], r: 7, dmg: 5 + sim.t * .07, bounces: 3, rot: 0, vis: 'slice', proj: true });
      }
    }
  },
  ei: {
    name: 'Eiball', rarity: 'gewoehnlich', hp: 55, speed: 160, r: 14, dmg: 'Hoch',
    desc: 'Zerbrechlich und schnell. Wenn er platzt, brät er als heißes Spiegelei weiter.',
    strong: 'Träge Gegner', weak: 'Alles mit Fernangriff',
    contact: (b, sim) => 14 + sim.t * .15, contactCd: .5,
    onDeath(b, sim) {
      if (b.st.fried) return false;
      b.st.fried = 1;
      newObj(sim, 'fire', b, b.x, b.y, { r: 26, life: 5, dps: 9, vis: 'egg' });
      return false;
    }
  },
  toast: {
    name: 'Toastball', rarity: 'gewoehnlich', hp: 100, speed: 135, r: 18, dmg: 'Mittel',
    desc: 'Der Toaster spuckt knusprige Scheiben, die Gegner durchschlagen.',
    strong: 'Mittelgroße Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      if (!tick(b, Math.max(1.5, 2.3 - sim.t * .015))) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 200, r: 7, dmg: 7 + sim.t * .09, vis: 'toast', pierce: 1, pcd: .5, life: 3.2, lead: .5 });
    }
  },
  messer: {
    name: 'Messerball', rarity: 'selten', hp: 95, speed: 150, r: 16, dmg: 'Hoch',
    desc: 'Wirft blitzschnell Messer, die durch den Gegner hindurchfliegen.',
    strong: 'Langsame Gegner', weak: 'Schildball, Pfannenball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.1, 1.7 - sim.t * .01))) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 340, r: 4, dmg: 7 + sim.t * .1, vis: 'messer', pierce: 1, pcd: .5, life: 2.2, lead: .6 });
    }
  },
  pfanne: {
    name: 'Pfannenball', rarity: 'selten', hp: 130, speed: 125, r: 20, dmg: 'Mittel',
    desc: 'Die Pfanne fängt Geschosse einfach ab und lässt Gegner mit einem Klonk kurz benommen zurück.',
    strong: 'Geschossbälle', weak: 'Rammball, Stacheln',
    init(b) { b.st.ang = 0; },
    update(b, sim) {
      b.st.ang += (1.6 + sim.t * .02) * DT;
      const sc = dcos(b.st.ang), ss = dsin(b.st.ang);
      for (const o of sim.objs) {
        if (!o.proj || o.team === b.team || o.dead) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d = len(dx, dy);
        if (d > b.r + 20 || d < b.r - 2) continue;
        if ((dx * sc + dy * ss) / (d || 1) > .45) { o.dead = true; fx(sim, 'block', o.x, o.y, 0); }
      }
      for (const e of foes(sim, b.team)) {
        const px = b.x + sc * (b.r + 14), py = b.y + ss * (b.r + 14);
        if (len(e.x - px, e.y - py) < e.r + 12 && ready({ cd: b.hitCd }, e, sim, 1.1)) {
          hurt(sim, e, 11 + sim.t * .12, b, 'melee'); stun(sim, e, .45);
        }
      }
    }
  },
  chili: {
    name: 'Chiliball', rarity: 'episch', hp: 110, speed: 150, r: 17, dmg: 'Hoch',
    desc: 'Feuert scharfe Chilis, die Gegner in Brand setzen. Auch der Aufprall brennt.',
    strong: 'Zähe Gegner', weak: 'Eisball',
    contact: () => 4,
    onContact(b, o, sim, d) { if (d > 0) burn(sim, o, b, 3, 5 + sim.t * .06); },
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.3, 2 - sim.t * .015))) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 250, r: 5, dmg: 4 + sim.t * .05, vis: 'chili', burnS: 3.2, burnD: 5 + sim.t * .07, lead: .5 });
    }
  },
  mixer: {
    name: 'Mixerball', rarity: 'episch', hp: 125, speed: 115, r: 20, dmg: 'Hoch',
    desc: 'Rotierende Quirle um ihn herum zerschneiden alles in Reichweite.',
    strong: 'Nahkämpfer, Schwarm', weak: 'Fernkämpfer',
    update(b, sim) {
      b.st.ang = (b.st.ang || 0) + 9 * DT;
      for (const e of foes(sim, b.team)) {
        if (len(e.x - b.x, e.y - b.y) < b.r + e.r + 12 && ready({ cd: b.hitCd }, e, sim, .22)) hurt(sim, e, 3.2 + sim.t * .04, b, 'melee');
      }
    }
  },
  herd: {
    name: 'Herdball', rarity: 'legendaer', hp: 140, speed: 125, r: 21, dmg: 'Sehr hoch',
    desc: 'Hinterlässt glühende Herdplatten und flambiert alles in der Nähe in regelmäßigen Wellen.',
    strong: 'Fast alles', weak: 'Eisball',
    contact: () => 7,
    init(b) { b.st.cd = 1; b.st.fl = 4; },
    update(b, sim) {
      if (tick(b, 2.3)) newObj(sim, 'fire', b, b.x, b.y, { r: 26, life: 5.5, dps: 8 + sim.t * .1, vis: 'platte' });
      b.st.fl -= DT;
      if (b.st.fl <= 0) {
        b.st.fl = 6.5;
        wave(sim, b, b.x, b.y, { sp: 190, maxR: 130, dmg: 14 + sim.t * .2, burnS: 3, burnD: 6, vis: 'flame' });
      }
    }
  },

  /* ================= Sport und Spielzeug ================= */
  basket: {
    name: 'Basketball', rarity: 'gewoehnlich', hp: 105, speed: 140, r: 18, dmg: 'Steigend',
    desc: 'Jeder Aufprall an der Wand lädt den nächsten Treffer auf, bis zu fünfmal.',
    strong: 'Lange Kämpfe', weak: 'Kurze Kämpfe',
    contact: (b, sim) => 8 + 5 * b.st.n + sim.t * .1, contactCd: .5,
    init(b) { b.st.n = 0; },
    onWall(b) { if (b.st.n < 5) b.st.n++; },
    onContact(b, o, sim, d) { if (d > 0) b.st.n = 0; }
  },
  tennis: {
    name: 'Tennisball', rarity: 'gewoehnlich', hp: 90, speed: 140, r: 16, dmg: 'Niedrig',
    desc: 'Schlägt Filzbälle, die viermal von den Wänden abprallen.',
    strong: 'Große Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.3, 2 - sim.t * .015))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 240, .5);
      newObj(sim, 'saw', b, b.x, b.y, { vx: v[0], vy: v[1], r: 6, dmg: 7 + sim.t * .09, bounces: 4, rot: 0, vis: 'tennis', proj: true });
    }
  },
  bowling: {
    name: 'Bowlingball', rarity: 'gewoehnlich', hp: 170, speed: 95, r: 24, dmg: 'Hoch',
    desc: 'Schwer und langsam. Jeder Treffer schleudert den Gegner davon.',
    strong: 'Glasball, Turret', weak: 'Fernkämpfer',
    contact: (b, sim) => 18 + sim.t * .22, contactCd: .8,
    onContact(b, o, sim, d) { if (d > 0) setDir(o, o.x - b.x, o.y - b.y); }
  },
  jojo: {
    name: 'Jo-Jo-Ball', rarity: 'selten', hp: 100, speed: 135, r: 18, dmg: 'Mittel',
    desc: 'Wirft ein Jo-Jo kurz auf den Gegner, das rasch zurückschnellt und alles auf dem Weg trifft.',
    strong: 'Nahkämpfer', weak: 'Schildball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.4, 2 - sim.t * .012))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 300, .3), l = len(v[0], v[1]) || 1;
      newObj(sim, 'boom', b, b.x, b.y, {
        vx: v[0], vy: v[1], speed: 300, r: 8, dmg: 9 + sim.t * .1, phase: 0, age: 0, rot: 0, vis: 'yoyo',
        tx: clampPt(b.x + v[0] / l * 115), ty: clampPt(b.y + v[1] / l * 115), proj: true
      });
    }
  },
  kreisel: {
    name: 'Kreiselball', rarity: 'selten', hp: 110, speed: 125, r: 18, dmg: 'Hoch',
    desc: 'Dreht sich in Schüben wie ein Kreisel. Währenddessen verletzt er alles um sich herum.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    init(b) { b.st.cd = 2.5; b.st.spin = 0; },
    update(b, sim) {
      const s = b.st;
      if (s.spin > 0) {
        s.spin -= DT; s.ang = (s.ang || 0) + 14 * DT;
        for (const e of foes(sim, b.team)) {
          if (len(e.x - b.x, e.y - b.y) < b.r + e.r + 14 && ready({ cd: b.hitCd }, e, sim, .25)) hurt(sim, e, 6 + sim.t * .08, b, 'melee');
        }
        return;
      }
      if (tick(b, 3.4)) s.spin = 2;
    }
  },
  teddy: {
    name: 'Teddyball', rarity: 'episch', hp: 150, speed: 105, r: 22, dmg: 'Mittel',
    desc: 'Weich und gemütlich. Steckt Schaden besser weg und kuschelt sich langsam gesund.',
    strong: 'Kleinschaden wie Turret', weak: 'Flächenschaden, Eisball',
    contact: (b, sim) => 11 + sim.t * .15, contactCd: .55,
    takes: () => .75,
    update(b, sim) { b.hp = Math.min(b.maxHp, b.hp + (1.6 + sim.t * .03) * DT); }
  },
  lego: {
    name: 'Legoball', rarity: 'episch', hp: 105, speed: 135, r: 18, dmg: 'Hoch',
    desc: 'Lässt Bausteine liegen. Wer barfuß drauftritt, merkt das.',
    strong: 'Gegner mit festen Wegen', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1)) return;
      if (nobj(sim, b, 'mine') >= 8) return;
      newObj(sim, 'mine', b, b.x, b.y, { r: 7, arm: .3, life: 12, trig: 14, er: 28, dmg: 14 + sim.t * .2, vis: 'brick', fxk: 'brickboom' });
    }
  },
  pokal: {
    name: 'Pokalball', rarity: 'legendaer', hp: 135, speed: 140, r: 19, dmg: 'Sehr hoch',
    desc: 'Feuert goldene Strahlen, die durchschlagen und ihm Leben zurückgeben. Der Sieger bekommt alles.',
    strong: 'Fast alles', weak: 'Eisball',
    contact: () => 7,
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.7, 2.4 - sim.t * .012))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      for (let i = -1; i <= 1; i++) shot(sim, b, e, { speed: 300, r: 5, dmg: 7 + sim.t * .09, vis: 'gold', pierce: 1, pcd: .5, leech: .5, life: 2.4, lead: .4 }, i * 14);
    }
  },

  /* ================= Elemente und Wetter ================= */
  wolke: {
    name: 'Wolkenball', rarity: 'gewoehnlich', hp: 100, speed: 125, r: 19, dmg: 'Niedrig',
    desc: 'Lässt es dort regnen, wo der Gegner gleich sein wird.',
    strong: 'Langsame Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1, 1.5 - sim.t * .008))) return;
      const e = nearestEnemy(sim, b);
      if (e) newObj(sim, 'puddle', b, clampPt(e.x + e.vx * .5), clampPt(e.y + e.vy * .5), { r: 30, life: 3.5, dps: 5.5 + sim.t * .06, vis: 'rain' });
    }
  },
  schnee: {
    name: 'Schneeball', rarity: 'gewoehnlich', hp: 85, speed: 135, r: 14, dmg: 'Steigend',
    desc: 'Rollt durch die Box und wird dabei immer größer und stärker.',
    strong: 'Lange Kämpfe', weak: 'Kurze Kämpfe',
    contact: (b) => 5 + b.r * .45, contactCd: .5,
    update(b, sim) { b.r = Math.min(34, 14 + sim.t * .5); }
  },
  blitz: {
    name: 'Blitzball', rarity: 'selten', hp: 90, speed: 150, r: 16, dmg: 'Hoch',
    desc: 'Lässt Blitze auf die Stelle einschlagen, wo der Gegner steht, und betäubt ihn kurz.',
    strong: 'Träge Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1.4; },
    update(b, sim) {
      if (!tick(b, Math.max(1.6, 2.6 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (e) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45), clampPt(e.y + e.vy * .45), { fuse: .55, r: 30, dmg: 13 + sim.t * .2, stun: .45, vis: 'blitz', fxk: 'zap' });
    }
  },
  tornado: {
    name: 'Tornadoball', rarity: 'selten', hp: 115, speed: 125, r: 19, dmg: 'Mittel',
    desc: 'Wirbelt Gegner in der Nähe durcheinander, sodass sie die Richtung verlieren.',
    strong: 'Gegner mit festen Wegen', weak: 'Fernkämpfer',
    init(b) { b.st.cd = .5; },
    update(b, sim) {
      const go = tick(b, .45);
      for (const e of foes(sim, b.team)) {
        const d = len(e.x - b.x, e.y - b.y);
        if (d < 130 && go) rotateVel(e, (rand(sim) - .5) * 1.5, e.speed);
        if (d < b.r + e.r + 26 && ready({ cd: b.hitCd }, e, sim, .5)) hurt(sim, e, 5 + sim.t * .07, b, 'melee');
      }
    }
  },
  erde: {
    name: 'Erdball', rarity: 'selten', hp: 160, speed: 100, r: 23, dmg: 'Mittel',
    desc: 'Beim Aufprall an der Wand bebt der Boden. Die Welle verletzt und betäubt.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 13 + sim.t * .15, contactCd: .6,
    init(b) { b.st.nx = 0; },
    onWall(b, sim, side, x, y) {
      if (sim.t < b.st.nx) return;
      b.st.nx = sim.t + .8;
      wave(sim, b, b.x, b.y, { sp: 190, maxR: 105, dmg: 10 + sim.t * .14, stun: .35, vis: 'quake' });
    }
  },
  lava: {
    name: 'Lavaball', rarity: 'episch', hp: 120, speed: 130, r: 19, dmg: 'Hoch',
    desc: 'Zieht eine Spur aus Lava. Wer hineintritt oder ihn berührt, brennt.',
    strong: 'Zähe Gegner', weak: 'Eisball',
    contact: () => 5,
    onContact(b, o, sim, d) { if (d > 0) burn(sim, o, b, 3.5, 6 + sim.t * .07); },
    init(b) { b.st.cd = 0; },
    update(b, sim) {
      if (tick(b, .28)) newObj(sim, 'puddle', b, b.x, b.y, { r: 17, life: 4.5, dps: 5.5 + sim.t * .07, vis: 'lava' });
    }
  },
  kristall: {
    name: 'Kristallball', rarity: 'episch', hp: 110, speed: 130, r: 18, dmg: 'Hoch',
    desc: 'Schleudert Splitter in alle Richtungen und zerspringt beim Tod in einem Splittersturm.',
    strong: 'Große Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      if (!tick(b, Math.max(2, 3.2 - sim.t * .02))) return;
      const base = Math.floor(rand(sim) * 60);
      for (let i = 0; i < 6; i++) {
        const a = (base + i * 60) * PI / 180;
        newObj(sim, 'bullet', b, b.x, b.y, { vx: dcos(a) * 220, vy: dsin(a) * 220, r: 4, dmg: 5 + sim.t * .07, life: 1.6, proj: true, vis: 'shard', pierce: 1, pcd: .5 });
      }
    },
    onDeath(b, sim) {
      if (b.st.burst) return false;
      b.st.burst = 1;
      for (let i = 0; i < 10; i++) {
        const a = (i * 36) * PI / 180;
        newObj(sim, 'bullet', b, b.x, b.y, { vx: dcos(a) * 240, vy: dsin(a) * 240, r: 4, dmg: 8, life: 1.4, proj: true, vis: 'shard' });
      }
      return false;
    }
  },
  regenbogen: {
    name: 'Regenbogenball', rarity: 'legendaer', hp: 130, speed: 140, r: 19, dmg: 'Sehr hoch',
    desc: 'Wirkt der Reihe nach Feuer, Frost, Blitz und Heilung. Jeder Zauber hat eine andere Wirkung.',
    strong: 'Fast alles', weak: 'Schildball',
    contact: () => 6,
    init(b) { b.st.cd = 1.2; b.st.k = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(1.6, 2.2 - sim.t * .01))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const k = b.st.k++ % 4;
      b.st.last = k;
      if (k === 0) wave(sim, b, b.x, b.y, { sp: 200, maxR: 120, dmg: 12 + sim.t * .18, burnS: 3, burnD: 6, vis: 'flame' });
      else if (k === 1) shot(sim, b, e, { k: 'frost', speed: 230, r: 6, dmg: 6, stun: 1.2, vis: 'frost2', lead: .6 });
      else if (k === 2) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .45), clampPt(e.y + e.vy * .45), { fuse: .5, r: 34, dmg: 20 + sim.t * .25, stun: .5, vis: 'blitz', fxk: 'zap' });
      else heal(sim, b, 14 + sim.t * .15);
    }
  },

  /* ================= Halloween ================= */
  kuerbis: {
    name: 'Kürbisball', rarity: 'gewoehnlich', hp: 120, speed: 120, r: 21, dmg: 'Mittel',
    desc: 'Spuckt Kerne und explodiert beim Tod in einer fauligen Kürbisbombe.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1, contactCd: .55,
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      if (!tick(b, 1.7)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 240, r: 3.6, dmg: 4 + sim.t * .05, vis: 'kern', lead: .4 });
    },
    onDeath(b, sim) {
      if (b.st.pop) return false;
      b.st.pop = 1;
      newObj(sim, 'bomb', b, b.x, b.y, { fuse: .35, r: 58, dmg: 24, fxk: 'kuerbisboom' });
      return false;
    }
  },
  fledermaus: {
    name: 'Fledermausball', rarity: 'gewoehnlich', hp: 80, speed: 165, r: 14, dmg: 'Mittel',
    desc: 'Schickt zwei Fledermäuse los, die den Gegner verfolgen, durchfliegen und Leben saugen.',
    strong: 'Träge Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, Math.max(1.8, 2.5 - sim.t * .012))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      for (let i = -1; i <= 1; i += 2) shot(sim, b, e, { k: 'bee', speed: 170, r: 5, dmg: 3.5 + sim.t * .05, vis: 'bat', pierce: 1, pcd: .45, leech: .5, turn: 3.6, life: 5, lead: 0 }, i * 40);
    }
  },
  geist: {
    name: 'Geistball', rarity: 'selten', hp: 95, speed: 130, r: 17, dmg: 'Mittel',
    desc: 'Wird regelmäßig durchsichtig: Dann fliegt er durch Bälle hindurch und steckt kaum Schaden ein. Schickt Irrlichter los.',
    strong: 'Nahkämpfer', weak: 'Flächenschaden',
    takes: (t) => t.st.ghost > 0 ? .25 : 1,
    init(b) { b.st.cd = 1.4; b.st.ghost = 0; b.st.gc = 4; },
    update(b, sim) {
      const s = b.st;
      if (s.ghost > 0) s.ghost -= DT;
      else { s.gc -= DT; if (s.gc <= 0) { s.ghost = 2; s.gc = 6; } }
      if (!tick(b, 1.9)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { k: 'bee', speed: 130, r: 5, dmg: 6 + sim.t * .08, vis: 'wisp', turn: 1.8, life: 4.5, lead: 0 });
    }
  },
  skelett: {
    name: 'Skelettball', rarity: 'selten', hp: 85, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Wirft Knochen wie Bumerangs und steht einmal mit der Hälfte seines Lebens wieder auf.',
    strong: 'Lange Kämpfe', weak: 'Schildball',
    init(b) { b.st.cd = 1.2; b.st.rev = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(1.8, 2.8 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 230, .4), l = len(v[0], v[1]) || 1;
      newObj(sim, 'boom', b, b.x, b.y, {
        vx: v[0], vy: v[1], speed: 230, r: 7, dmg: 8 + sim.t * .1, phase: 0, age: 0, rot: 0, vis: 'bone',
        tx: clampPt(b.x + v[0] / l * 150), ty: clampPt(b.y + v[1] / l * 150), proj: true
      });
    },
    onDeath(b, sim) {
      if (b.st.rev) return false;
      b.st.rev = 1; b.hp = b.maxHp * .5; b.flash = .4;
      fx(sim, 'rise', b.x, b.y, 0);
      return true;
    }
  },
  hexe: {
    name: 'Hexenball', rarity: 'episch', hp: 105, speed: 130, r: 18, dmg: 'Hoch',
    desc: 'Braut Tränke: Wo der Gegner steht, blubbert ein Kessel, und ab und zu platzt eine Giftbombe.',
    strong: 'Langsame Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1.2; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(1.9, 2.7 - sim.t * .015))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const x = clampPt(e.x + e.vx * .6), y = clampPt(e.y + e.vy * .6);
      newObj(sim, 'puddle', b, x, y, { r: 32, life: 5, dps: 6 + sim.t * .08, vis: 'brew' });
      if (b.st.n++ % 2 === 1) newObj(sim, 'meteor', b, x, y, { fuse: .8, r: 36, dmg: 14 + sim.t * .2, vis: 'potion', fxk: 'splash' });
    }
  },
  sensenmann: {
    name: 'Sensenmann', rarity: 'legendaer', hp: 140, speed: 135, r: 20, dmg: 'Sehr hoch',
    desc: 'Schleudert seine Sense, die doppelt so stark trifft, wenn der Gegner fast am Ende ist.',
    strong: 'Fast alles', weak: 'Eisball',
    init(b) { b.st.cd = 1.4; },
    update(b, sim) {
      if (!tick(b, Math.max(1.9, 2.6 - sim.t * .012))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 250, .4), l = len(v[0], v[1]) || 1;
      newObj(sim, 'boom', b, b.x, b.y, {
        vx: v[0], vy: v[1], speed: 250, r: 13, dmg: 15 + sim.t * .2, phase: 0, age: 0, rot: 0, vis: 'sense', exec: 1,
        tx: clampPt(b.x + v[0] / l * 175), ty: clampPt(b.y + v[1] / l * 175), proj: true
      });
    }
  }
};

const BOX_OF = {
  standard: ['kaktus', 'pfeil', 'rakete', 'wirbel', 'magier'],
  weltraum: ['mond', 'komet', 'astronaut', 'ufo', 'saturn', 'alien', 'schwarzloch', 'supernova'],
  kueche: ['pizza', 'ei', 'toast', 'messer', 'pfanne', 'chili', 'mixer', 'herd'],
  sport: ['basket', 'tennis', 'bowling', 'jojo', 'kreisel', 'teddy', 'lego', 'pokal'],
  elemente: ['wolke', 'schnee', 'blitz', 'tornado', 'erde', 'lava', 'kristall', 'regenbogen'],
  halloween: ['kuerbis', 'fledermaus', 'geist', 'skelett', 'hexe', 'sensenmann']
};
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  if (!N[id]) throw new Error('Ball fehlt: ' + id);
  N[id].box = box;
  N[id].dm = DM[id] || 1;
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
export const BOXES = BOX_OF;
export const BOX_IDS = ['standard', 'weltraum', 'kueche', 'sport', 'elemente', 'ozean', 'suess', 'familie', 'dino', 'alles', 'klein', 'gefuehl', 'halloween'];
export function ballsInBox(box) { return BALL_IDS.filter(id => DEFS[id].box === box); }
