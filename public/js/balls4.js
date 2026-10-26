// Neue Bälle (Welle 3): Ozean-Box und Süßigkeiten-Box. Deterministisch wie balls2.js.
import { DT, dsin, dcos, len, hurt, stun, fx, rand, nearestEnemy, heal } from './core.js';
import { DEFS, BALL_IDS, newObj, aimVel, clampPt } from './balls.js';
import { shot, wave, tick } from './balls2.js';

// Kreis aus Geschossen um den Ball (Winkel im Bogenmaß)
function ring(sim, b, n, sp, off) {
  for (let i = 0; i < n; i++) {
    const a = off + i * 2 * Math.PI / n, vx = dcos(a) * sp.speed, vy = dsin(a) * sp.speed;
    newObj(sim, 'bullet', b, b.x, b.y, { vx, vy, r: sp.r, dmg: sp.dmg, life: sp.life || 1.4, proj: true, vis: sp.vis, speed: sp.speed });
  }
}

const N = {
  /* ================= Ozean ================= */
  krabbe: {
    name: 'Krabbenball', rarity: 'gewoehnlich', hp: 125, speed: 125, r: 19, dmg: 'Mittel',
    desc: 'Bei jeder Wandberührung zwickt er mit beiden Scheren: eine kleine Schockwelle um ihn herum.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    init(b) { b.st.nx = 0; },
    onWall(b, sim) {
      if (sim.t < b.st.nx) return;
      b.st.nx = sim.t + .7;
      wave(sim, b, b.x, b.y, { sp: 170, maxR: 58, dmg: 8 + sim.t * .09, push: 1, vis: 'shock' });
    }
  },
  qualle: {
    name: 'Quallenball', rarity: 'gewoehnlich', hp: 110, speed: 115, r: 17, dmg: 'Mittel',
    desc: 'Lässt beim Schweben brennende Nesselwolken zurück, die jeden verletzen, der hindurchrollt.',
    strong: 'Langsame Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1.1)) return;
      newObj(sim, 'puddle', b, b.x, b.y, { r: 26, life: 4, dps: 9 + sim.t * .1, vis: 'rain' });
    }
  },
  kugelfisch: {
    name: 'Kugelfischball', rarity: 'selten', hp: 100, speed: 130, r: 17, dmg: 'Mittel',
    desc: 'Wenn er getroffen wird, bläht er sich auf und schießt einen Kranz aus Stacheln in alle Richtungen.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    init(b) { b.st.nx = 0; },
    onHurt(t, amt, src, kind, sim) {
      if (kind === 'dot' || sim.t < t.st.nx) return;
      t.st.nx = sim.t + 1.6;
      ring(sim, t, 10, { speed: 230, r: 4.5, dmg: 9 + sim.t * .1, vis: 'shard' }, rand(sim) * .8);
      fx(sim, 'split', t.x, t.y, 22);
    }
  },
  seestern: {
    name: 'Seesternball', rarity: 'selten', hp: 110, speed: 125, r: 18, dmg: 'Hoch',
    desc: 'Wirft seine Arme wie Bumerangs: Sie fliegen zum Gegner und kommen zu ihm zurück.',
    strong: 'Langsame Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1.3; },
    update(b, sim) {
      if (!tick(b, Math.max(1.9, 2.8 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      const v = aimVel(b, e, 240, .4), l = len(v[0], v[1]) || 1;
      newObj(sim, 'boom', b, b.x, b.y, {
        vx: v[0], vy: v[1], speed: 240, r: 9, dmg: 9 + sim.t * .11, phase: 0, age: 0, rot: 0, vis: 'star',
        tx: clampPt(b.x + v[0] / l * 160), ty: clampPt(b.y + v[1] / l * 160), proj: true
      });
    }
  },
  hai: {
    name: 'Haiball', rarity: 'episch', hp: 125, speed: 145, r: 20, dmg: 'Sehr hoch',
    desc: 'Wittert Beute: Stürmt in kurzen Sprints auf den Gegner zu und heilt sich bei jedem Biss.',
    strong: 'Träge Gegner', weak: 'Eisball, Schildball',
    contact: (b, sim) => b.st.dash > 0 ? 23 + sim.t * .28 : 8 + sim.t * .1, contactCd: .5,
    init(b) { b.st.cd = 2; b.st.dash = 0; },
    update(b, sim) {
      const s = b.st;
      if (s.dash > 0) {
        s.dash -= DT;
        if (s.dash <= 0) { b.speed = DEFS.hai.speed; }
        return;
      }
      if (!tick(b, Math.max(2.4, 3.4 - sim.t * .02))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      s.dash = .55; b.speed = 330;
      const d = len(e.x - b.x, e.y - b.y) || 1;
      b.vx = (e.x - b.x) / d * b.speed; b.vy = (e.y - b.y) / d * b.speed;
      fx(sim, 'dash', b.x, b.y, 0);
    },
    onContact(b, o, sim, d) { if (d > 0) heal(sim, b, d * .3); }
  },
  krake: {
    name: 'Krakenball', rarity: 'legendaer', hp: 150, speed: 125, r: 22, dmg: 'Sehr hoch',
    desc: 'Schlägt mit seinen Armen eine Schockwelle um sich herum und spuckt dem Gegner dunkle Tinte vor die Füße.',
    strong: 'Fast alles', weak: 'Flinke Fernkämpfer',
    init(b) { b.st.cd = 1.2; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(1.9, 2.7 - sim.t * .014))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      newObj(sim, 'puddle', b, clampPt(e.x + e.vx * .5), clampPt(e.y + e.vy * .5), { r: 34, life: 5, dps: 7 + sim.t * .09, vis: 'dust' });
      if (b.st.n++ % 2 === 1) { wave(sim, b, b.x, b.y, { sp: 190, maxR: 105, dmg: 15 + sim.t * .2, push: 1, stun: .5, vis: 'shock' }); }
    }
  },

  /* ================= Süßigkeiten ================= */
  lolli: {
    name: 'Lollyball', rarity: 'gewoehnlich', hp: 100, speed: 140, r: 17, dmg: 'Mittel',
    desc: 'Schleudert klebrige Bonbons auf den Gegner.',
    strong: 'Langsame Gegner', weak: 'Schildball',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1.6)) return;
      const e = nearestEnemy(sim, b);
      if (e) shot(sim, b, e, { speed: 240, r: 4.4, dmg: 5.5 + sim.t * .07, vis: 'candy', lead: .45 });
    }
  },
  gummi: {
    name: 'Gummibärball', rarity: 'gewoehnlich', hp: 130, speed: 120, r: 19, dmg: 'Mittel',
    desc: 'Federt Schläge ab und erholt sich ein wenig bei jeder Wandberührung.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 9 + sim.t * .1,
    takes: (t, sim, kind) => kind === 'contact' ? .75 : 1,
    init(b) { b.st.nx = 0; },
    onWall(b, sim) {
      if (sim.t < b.st.nx) return;
      b.st.nx = sim.t + .8;
      heal(sim, b, 3 + sim.t * .04);
    }
  },
  donut: {
    name: 'Donutball', rarity: 'selten', hp: 105, speed: 130, r: 18, dmg: 'Mittel',
    desc: 'Streut Zuckerperlen in einem Kranz um sich und hinterlässt klebrige Glasur auf dem Boden.',
    strong: 'Nahkämpfer', weak: 'Flächenschaden',
    init(b) { b.st.cd = 1.2; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, 1.9)) return;
      ring(sim, b, 8, { speed: 210, r: 4.5, dmg: 8 + sim.t * .1, vis: 'gold' }, b.st.n++ % 2 * .4);
      newObj(sim, 'puddle', b, b.x, b.y, { r: 24, life: 4, dps: 8 + sim.t * .09, vis: 'platte' });
    }
  },
  zuckerwatte: {
    name: 'Zuckerwatteball', rarity: 'selten', hp: 90, speed: 135, r: 17, dmg: 'Mittel',
    desc: 'Klebt am Gegner: Jede Berührung kann ihn kurz festhalten und betäuben.',
    strong: 'Schnelle Gegner', weak: 'Fernkämpfer',
    contact: (b, sim) => 12 + sim.t * .14, contactCd: .5,
    onContact(b, o, sim, d) { if (d > 0 && rand(sim) < .5) stun(sim, o, .8); }
  },
  torte: {
    name: 'Tortenball', rarity: 'episch', hp: 120, speed: 120, r: 21, dmg: 'Hoch',
    desc: 'Wirft drei Tortenstücke im Fächer. Die Kerze auf ihm brennt und verletzt Gegner, die zu nah kommen.',
    strong: 'Gegner am Rand', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1.3; },
    update(b, sim) {
      const e = nearestEnemy(sim, b);
      if (e && len(e.x - b.x, e.y - b.y) < b.r + e.r + 34) hurt(sim, e, (6 + sim.t * .08) * DT, b, 'dot');
      if (!tick(b, Math.max(1.9, 2.7 - sim.t * .016))) return;
      if (!e) return;
      for (let i = -1; i <= 1; i++) shot(sim, b, e, { speed: 235, r: 6, dmg: 7.5 + sim.t * .1, vis: 'slice', lead: .4 }, i * .38);
    }
  },
  zuckerkoenig: {
    name: 'Zuckerkönig', rarity: 'legendaer', hp: 140, speed: 130, r: 20, dmg: 'Sehr hoch',
    desc: 'Lässt Zuckerhagel auf den Gegner regnen und heilt sich mit jeder süßen Schockwelle.',
    strong: 'Fast alles', weak: 'Eisball',
    init(b) { b.st.cd = 1.4; b.st.n = 0; },
    update(b, sim) {
      if (!tick(b, Math.max(2, 2.8 - sim.t * .014))) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      for (let i = 0; i < 3; i++) {
        const x = clampPt(e.x + e.vx * .5 + (i - 1) * 46), y = clampPt(e.y + e.vy * .5 + (i === 1 ? 0 : 20));
        newObj(sim, 'meteor', b, x, y, { fuse: .55 + i * .12, r: 30, dmg: 9 + sim.t * .12, vis: 'star', fxk: 'boom' });
      }
      if (b.st.n++ % 2 === 1) { wave(sim, b, b.x, b.y, { sp: 190, maxR: 100, dmg: 7 + sim.t * .09, vis: 'nova' }); heal(sim, b, 6 + sim.t * .07); }
    }
  }
};

// Schadensfaktoren aus dem Balance-Lauf (siehe tools/balance.js)
const DM4 = { krabbe: 2.15, qualle: 2.35, kugelfisch: 2.1, seestern: 1.8, hai: .93, krake: 1.09, lolli: 2.09, gummi: 1.49, donut: 1.35, zuckerwatte: 2.19, torte: 1.04, zuckerkoenig: .58 };
const BOX_OF = {
  ozean: ['krabbe', 'qualle', 'kugelfisch', 'seestern', 'hai', 'krake'],
  suess: ['lolli', 'gummi', 'donut', 'zuckerwatte', 'torte', 'zuckerkoenig']
};
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  N[id].box = box;
  N[id].dm = DM4[id];
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
