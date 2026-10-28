// Kleinbox und Gefühlsbox (Ideen von Erik und Thore). Deterministisch wie balls2.js.
import { DT, hurt, fx, rand, nearestEnemy, steer, addBall, len, stun, segDist } from './core.js';
import { DEFS, BALL_IDS, RARITY, OBJS, newObj, clampPt } from './balls.js';
import { shot, tick } from './balls2.js';

export const TUNE = { expR: 48, expFuse: .9, expCd: .7, expT0: 3, expProt: .6, helpCap: 3, helpStep: 3, helpHp: .5 };   // Stellschrauben (werden beim Balancing verändert)
const weaker = (b, sim) => { const e = nearestEnemy(sim, b); return !!e && b.hp < e.hp; };
const fr = b => Math.max(0, Math.min(1, b.hp / b.maxHp));
const helpersOf = (sim, b) => { let n = 0; for (const x of sim.balls) if (!x.dead && x.st.boss === b.id) n++; return n; };
// Neuen Ball ins Team des Besitzers setzen (Helfer): Lebenspunkte zählen für die Zeit-Wertung mit
function addHelper(sim, owner, type) {
  const h = addBall(sim, type, owner.team, owner.slot, owner.x, owner.y, rand(sim) * 360, {});
  h.st.boss = owner.id;
  if (owner.def.id === 'herrscher' || owner.type === 'herrscher') { h.hp = h.maxHp = h.maxHp * TUNE.helpHp; }
  sim.teamMax[owner.team] = (sim.teamMax[owner.team] || 0) + h.maxHp;
  fx(sim, 'helper', owner.x, owner.y, 0);
  return h;
}

/* ---------- Gefühle (gemeinsam für die Einzelbälle und den Gefühlsball) ---------- */
const FEEL = {
  froh: { contact: (b, sim) => (14 + sim.t * .15) * (weaker(b, sim) ? .5 : 1), tick: (b, sim) => { b.st.weak = weaker(b, sim); } },
  wuet: { contact: (b, sim) => (14 + sim.t * .15) * (weaker(b, sim) ? 2 : 1), tick: (b, sim) => { b.st.weak = weaker(b, sim); } },
  angst: {
    contact: (b, sim) => (15 + sim.t * .15) * (.3 + .7 * fr(b)),
    tick: (b) => { b.r = b.def.r * (.45 + .55 * fr(b)); }
  }
};

const N = {
  /* ================= Kleinbox ================= */
  kleinstachel: {
    name: 'Kleiner Stachel', rarity: 'selten', hp: 30, speed: 150, r: 12, dmg: 'Sehr hoch',
    desc: 'Winzig und zerbrechlich, aber jeder dritte Treffer macht doppelten Schaden.',
    strong: 'Zähe Gegner mit wenig Schaden', weak: 'Alles, was ihn trifft',
    contact: (b, sim) => (15 + sim.t * .15) * (b.st.n % 3 === 2 ? 2 : 1), contactCd: .5,
    init(b) { b.st.n = 0; },
    onContact(b) { b.st.n++; }
  },
  kleinerhelfer: {
    name: 'Kleiner Helfer', rarity: 'episch', hp: 50, speed: 130, r: 14, dmg: 'Keiner',
    desc: 'Macht selbst keinen Schaden. Prallt er gegen die Wand, zaubert er einen kleinen grünen Minihelfer. Ist er selbst besiegt, ist der Kampf verloren.',
    strong: 'Lange Kämpfe', weak: 'Flächenschaden, Bomben',
    contact: () => 0,
    onWall(b, sim) {
      if (sim.t < (b.st.wc || 0)) return;   // pro Wandberührung nur ein Helfer (Ecken lösen sonst zwei Treffer aus)
      b.st.wc = sim.t + .4;
      let n = 0; for (const x of sim.balls) if (!x.dead && x.st.boss === b.id) n++;
      if (n >= 6) return;
      addHelper(sim, b, 'minihelfer');
    }
  },
  minihelfer: {
    name: 'Minihelfer', minion: true, rarity: 'selten', hp: 14, speed: 150, r: 8, dmg: 'Niedrig', dm: 2.22,
    desc: 'Ein kleiner grüner Helfer.', strong: '-', weak: '-',
    contact: (b, sim) => 7 + sim.t * .1, contactCd: .5
  },
  kleinexplus: {
    name: 'Kleiner Explus', rarity: 'episch', hp: 1, speed: 160, r: 6, dmg: 'Tödlich',
    desc: 'Ein winziger Punkt mit einem Leben, am Anfang durch eine Schutzblase geschützt. Prallt er gegen die Wand, wirft er eine Bombe dorthin, wo der Gegner gleich ist. Sie schaltet ihn sofort aus.',
    strong: 'Gegner in der Ecke', weak: 'Jede Berührung',
    contact: () => 0,
    takes: (b, sim) => sim.t < TUNE.expT0 + TUNE.expProt ? 0 : 1,   // Anlaufschutz: eine Schutzblase hält ihn in den ersten Sekunden unverwundbar
    init(b) { b.st.nx = 0; },
    update(b, sim) { const sh = sim.t < TUNE.expT0 + TUNE.expProt; if (b.st.shield && !sh) fx(sim, 'shield', b.x, b.y, b.r); b.st.shield = sh; },
    onWall(b, sim) {
      if (sim.t < b.st.nx || sim.t < TUNE.expT0) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      let n = 0; for (const o of sim.objs) if (o.k === 'bomb' && o.owner === b.id && !o.dead) n++;
      if (n >= 3) return;
      b.st.nx = sim.t + TUNE.expCd;
      // Die Bombe landet dort, wo der Gegner gleich sein wird (Warnring zeigt es an)
      fx(sim, 'bombdrop', b.x, b.y, 0);
      newObj(sim, 'bomb', b, clampPt(e.x + e.vx * .55), clampPt(e.y + e.vy * .55), { r: TUNE.expR, fuse: TUNE.expFuse, dmg: 1e9, fxk: 'boom' });
    }
  },
  kleinergross: {
    name: 'Kleiner Großer', rarity: 'mythisch', hp: 200, speed: 135, r: 20, dmg: 'Sehr hoch',
    desc: 'Stark und zäh. Wenn er gegen die Wand prallt, wird die Arena kurz größer.',
    strong: 'Fast alles', weak: 'Bomben',
    contact: (b, sim) => 22 + sim.t * .25, contactCd: .5,
    onWall(b, sim) { if (sim.t >= (sim.growUntil || 0)) fx(sim, 'grow', b.x, b.y, 60); sim.growTo = 40; sim.growUntil = sim.t + 3; }
  },

  /* ================= Gefühlsbox ================= */
  froh: {
    name: 'Fröhlicher Ball', rarity: 'gewoehnlich', hp: 80, speed: 140, r: 17, dmg: 'Mittel',
    desc: 'Hat er gerade weniger Leben als der Gegner, macht er nur halb so viel Schaden.',
    strong: 'Gegner mit wenig Leben', weak: 'Starke Gegner',
    contact: (b, sim) => FEEL.froh.contact(b, sim), contactCd: .5,
    update(b, sim) { FEEL.froh.tick(b, sim); }
  },
  wuet: {
    name: 'Wütender Ball', rarity: 'gewoehnlich', hp: 80, speed: 140, r: 17, dmg: 'Hoch',
    desc: 'Hat er gerade weniger Leben als der Gegner, macht er doppelten Schaden.',
    strong: 'Gleichstarke Gegner', weak: 'Schnelle Treffer',
    contact: (b, sim) => FEEL.wuet.contact(b, sim), contactCd: .5,
    update(b, sim) { FEEL.wuet.tick(b, sim); }
  },
  gelassen: {
    name: 'Gelassener Ball', rarity: 'gewoehnlich', hp: 150, speed: 125, r: 20, dmg: 'Niedrig',
    desc: 'Okay, wie es ist: zäh und ohne Besonderheiten.',
    strong: 'Kurze Angriffe', weak: 'Dauerschaden',
    contact: (b, sim) => 16 + sim.t * .2, contactCd: .55
  },
  verlegen: {
    name: 'Verlegener Ball', rarity: 'selten', hp: 90, speed: 150, r: 16, dmg: 'Niedrig',
    desc: 'Läuft vor dem Gegner davon und wirft ihm peinliche Gesichter hinterher.',
    strong: 'Langsame Gegner', weak: 'Schnelle Gegner, Ecken',
    contact: (b, sim) => 4 + sim.t * .05, contactCd: .5,
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      const e = nearestEnemy(sim, b);
      if (!e) return;
      steer(b, 2 * b.x - e.x, 2 * b.y - e.y, 3.4, b.speed);
      if (tick(b, 1.3)) shot(sim, b, e, { speed: 210, r: 6, dmg: 10 + sim.t * .12, vis: 'peinlich', life: 3, lead: .3 });
    }
  },
  aengstlich: {
    name: 'Ängstlicher Ball', rarity: 'selten', hp: 200, speed: 120, r: 22, dmg: 'Mittel',
    desc: 'Je mehr Schaden er hat, desto kleiner wird er und desto weniger Schaden macht er.',
    strong: 'Kurze Kämpfe', weak: 'Lange Kämpfe',
    contact: (b, sim) => FEEL.angst.contact(b, sim), contactCd: .5,
    update(b, sim) { FEEL.angst.tick(b, sim); }
  },
  neugierig: {
    name: 'Neugieriger Ball', rarity: 'selten', hp: 50, speed: 215, r: 14, dmg: 'Niedrig',
    desc: 'Schnüffelt am Gegner: Der kann nur noch durch Berührung Schaden machen, alle Fähigkeiten sind aus.',
    strong: 'Fähigkeits-Bälle', weak: 'Reine Nahkämpfer',
    contact: (b, sim) => 8 + sim.t * .1, contactCd: .45,
    update(b, sim) {
      b.st.mt = (b.st.mt || 0) - DT;
      for (const e of sim.balls) if (!e.dead && e.team !== b.team) { if (!e.silNext && !e.silenced && b.st.mt <= 0) { fx(sim, 'mute', e.x, e.y, e.r); b.st.mt = 4; } e.silNext = true; }
    }
  },
  stolz: {
    name: 'Stolzer Ball', rarity: 'episch', hp: 80, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Hat er mehr Leben als der Gegner, heilt er sich schnell, sogar über sein Maximum bis auf das Doppelte (gelber Teil der Leiste).',
    strong: 'Wer vorne liegt', weak: 'Rückstand',
    contact: (b, sim) => 14 + sim.t * .15, contactCd: .5,
    init(b) { b.barMax = b.maxHp * 2; },
    update(b, sim) {
      const e = nearestEnemy(sim, b);
      b.st.proud = !!e && b.hp > e.hp;
      if (b.st.proud) b.hp = Math.min(b.barMax, b.hp + 14 * DT);
    }
  },
  neid: {
    name: 'Neidischer Ball', rarity: 'episch', hp: 70, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Je seltener der Gegner, desto mehr Leben und Schaden hat er (von 95 Leben bis 235).',
    strong: 'Seltene Gegner', weak: 'Gewöhnliche Gegner',
    contact: (b, sim) => (14 + sim.t * .15) * (b.st.dm || 1), contactCd: .5,
    update(b, sim) {
      if (b.st.set) return;
      b.st.set = 1;
      let o = 0;
      for (const e of sim.balls) if (e.team !== b.team) o = Math.max(o, RARITY[e.def.rarity].order);
      const hp = (95 + 35 * o) * b.pm;
      sim.teamMax[b.team] += hp - b.maxHp;
      b.hp = b.maxHp = hp; b.st.dm = 1 + .15 * o; b.st.o = o;
    }
  },
  gefuehl: {
    name: 'Gefühlsball', rarity: 'legendaer', hp: 80, speed: 145, r: 18, dmg: 'Hoch',
    desc: 'Drei Gefühle nacheinander, in einer geheimnisvollen Rauchwolke: erst Fröhlich, nach der Niederlage Wütend, dann Ängstlich. Jedes hat die Fähigkeit des gleichnamigen Balls und ein eigenes Leben.',
    strong: 'Lange Kämpfe', weak: 'Flächenschaden',
    contact: (b, sim) => (b.st.mode === 0 ? FEEL.froh : b.st.mode === 1 ? FEEL.wuet : FEEL.angst).contact(b, sim), contactCd: .5,
    takes: (b, sim) => (b.st.inv > 0 ? 0 : 1),   // kurze Schutzzeit nach dem Wechsel des Gefühls
    init(b) { b.st.mode = 0; b.st.inv = 0; },
    update(b, sim) {
      if (b.st.inv > 0) b.st.inv -= DT;
      if (b.st.mode === 2) FEEL.angst.tick(b); else { b.r = b.def.r; FEEL.froh.tick(b, sim); }
    },
    // Wird ein Gefühl besiegt, folgt das nächste mit vollen Lebenspunkten (Fröhlich 80, Wütend 80, Ängstlich 200)
    onDeath(b, sim) {
      if (b.st.mode >= 2) return false;
      b.st.mode++;
      const hp = (b.st.mode === 1 ? 80 : 200) * b.pm;
      sim.teamMax[b.team] += hp - b.maxHp;
      b.hp = b.maxHp = hp; b.r = b.def.r; b.st.inv = .7; b.stun = 0; b.burn = 0;
      fx(sim, 'mood', b.x, b.y, b.st.mode);
      return true;
    }
  },
  herrscher: {
    name: 'Gefühlsherrscher', rarity: 'mythisch', hp: 50, speed: 140, r: 18, dmg: 'Keiner',
    desc: 'Ruft bei Wandtreffern Helfer aus der Gefühlsbox (den ersten sofort, weitere nach immer mehr Treffern, höchstens drei gleichzeitig). Solange ein Helfer lebt, ist er unverwundbar und macht keinen Schaden.',
    strong: 'Lange Kämpfe', weak: 'Neugieriger Ball, Bomben',
    contact: (b, sim) => helpersOf(sim, b) ? 0 : 5 + sim.t * .05, contactCd: .5,
    takes: (b, sim) => helpersOf(sim, b) ? 0 : 1,
    init(b) { b.st.walls = 0; b.st.made = 0; },
    update(b, sim) { b.st.shield = helpersOf(sim, b) > 0; },
    onWall(b, sim) {
      b.st.walls++;
      const need = 1 + Math.ceil(((b.st.made + 1) * (b.st.made + 2) / 2 - 1) * TUNE.helpStep);   // 1, dann je nach Stellschraube später   // 1, 3, 6, 10 ...
      if (b.st.walls < need || helpersOf(sim, b) >= TUNE.helpCap) return;
      b.st.made++;
      const ids = ['froh', 'wuet', 'gelassen', 'verlegen', 'aengstlich', 'neugierig', 'stolz', 'neid', 'liebend', 'gefuehl'];
      const per = {}; for (const id of ids) per[DEFS[id].rarity] = (per[DEFS[id].rarity] || 0) + 1;
      const w = ids.map(id => RARITY[DEFS[id].rarity].weight / per[DEFS[id].rarity]);
      let sum = 0; for (const x of w) sum += x;
      let r = rand(sim) * sum, pick = ids[0];
      for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r < 0) { pick = ids[i]; break; } }
      addHelper(sim, b, pick);
    }
  }
};
/* ================= Kleinbox ================= */
// Mauer (Allesherr): hält gegnerische Bälle und Schüsse auf, seine eigenen Magnet-Schüsse fliegen darüber
OBJS.mauer = {
  update(o, sim) {
    o.life -= DT;
    if (o.life <= 0) { o.dead = true; return; }
    for (const p of sim.objs) {
      if (p.dead || !p.proj || p.over || p.team === o.team) continue;
      if (segDist(p.x, p.y, o.x1, o.y1, o.x2, o.y2) < (p.r || 4) + 3) { p.dead = true; fx(sim, 'block', p.x, p.y, 0); }
    }
    for (const b of sim.balls) {
      if (b.dead || b.team === o.team) continue;
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1, l2 = dx * dx + dy * dy;
      let t = l2 ? ((b.x - o.x1) * dx + (b.y - o.y1) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = o.x1 + dx * t, cy = o.y1 + dy * t, ex = b.x - cx, ey = b.y - cy, d = len(ex, ey), rr = b.r + 4;
      if (d >= rr) continue;
      const nx = d > .001 ? ex / d : 0, ny = d > .001 ? ey / d : 1;
      b.x = cx + nx * rr; b.y = cy + ny * rr;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= 2 * vn * nx; b.vy -= 2 * vn * ny; }
    }
  }
};
const frag = (b, sim) => { let n = 0; for (const x of sim.balls) if (!x.dead && x.st.boss === b.id) n++; return n; };
Object.assign(N, {
  allesherr: {
    name: 'Allesherr', rarity: 'selten', hp: 105, speed: 130, r: 18, dmg: 'Mittel',
    desc: 'Baut kurze Mauern, die Gegner und deren Schüsse aufhalten. Nur er schießt über die Mauern: seine Magnete machen Schaden.',
    strong: 'Fernkämpfer-Gegner, Rammer', weak: 'Flinke Nahkämpfer',
    contact: (b, sim) => 5 + sim.t * .05, contactCd: .5,
    init(b) { b.st.cd = 1; b.st.wall = 2; },
    update(b, sim) {
      const e = nearestEnemy(sim, b);
      if (!e) return;
      b.st.wall -= DT;
      if (b.st.wall <= 0) {
        let n = 0; for (const o of sim.objs) if (o.k === 'mauer' && o.owner === b.id && !o.dead) n++;
        if (n < 2) {
          b.st.wall = 4.5;
          const dx = e.x - b.x, dy = e.y - b.y, l = len(dx, dy) || 1, ux = dx / l, uy = dy / l, cx = clampPt(b.x + ux * 52), cy = clampPt(b.y + uy * 52);
          newObj(sim, 'mauer', b, cx, cy, { x1: cx - uy * 24, y1: cy + ux * 24, x2: cx + uy * 24, y2: cy - ux * 24, life: 8 });
          fx(sim, 'wall', cx, cy, 0);
        } else b.st.wall = 1;
      }
      if (tick(b, 1.5)) shot(sim, b, e, { speed: 250, r: 5, dmg: 9 + sim.t * .1, vis: 'magnet', life: 3, lead: .35, over: true });
    }
  },
  rallaxa: {
    name: 'Rallaxa', rarity: 'episch', hp: 140, speed: 125, r: 20, dmg: 'Hoch',
    desc: 'Ein schwarzer Magnet. Kommt ihr ein Gegner zu nah, hält sie ihn kurz fest. Danach muss sie sich aufladen.',
    strong: 'Nahkämpfer', weak: 'Fernkämpfer',
    contact: (b, sim) => 14 + sim.t * .15, contactCd: .5,
    init(b) { b.st.cd = 2; b.st.charge = 0; },
    update(b, sim) {
      if (b.st.cd > 0) { b.st.cd -= DT; b.st.charge = 1 - Math.max(0, b.st.cd) / 6; return; }
      b.st.charge = 1;
      for (const e of sim.balls) {
        if (e.dead || e.team === b.team || e.stun > 0 || e.stunImm > 0) continue;
        if (len(e.x - b.x, e.y - b.y) < b.r + e.r + 28) { e.hold = 1.5; stun(sim, e, 1.5); b.st.cd = 6; fx(sim, 'hold', e.x, e.y, e.r); break; }
      }
    }
  },
  frallas: {
    name: 'Frallas', rarity: 'legendaer', hp: 150, speed: 135, r: 19, dmg: 'Hoch',
    desc: 'Ein Fragezeichen ohne Gesicht. Wer ihm Kontaktschaden zufügt, bekommt einen kleinen ?-Ball auf den Hals (höchstens vier). Ist Frallas besiegt, ist der Kampf vorbei.',
    strong: 'Gegner mit wenig Schaden', weak: 'Flächenschaden',
    contact: (b, sim) => 15 + sim.t * .15, contactCd: .5,
    init(b) { b.st.nx = 0; },
    onHurt(t, amt, src, kind, sim) {
      if (kind !== 'contact' || t.dead || sim.t < t.st.nx || frag(t, sim) >= 4) return;
      t.st.nx = sim.t + 1;
      addHelper(sim, t, 'framini');
    }
  },
  framini: {
    name: '?-Ball', minion: true, rarity: 'selten', hp: 22, speed: 150, r: 9, dmg: 'Niedrig', dm: 1.2,
    desc: 'Ein kleiner Fragezeichen-Ball.', strong: '-', weak: '-',
    contact: (b, sim) => 8 + sim.t * .1, contactCd: .5
  },
  blauast: {
    name: 'Blauast', rarity: 'legendaer', hp: 160, speed: 130, r: 19, dmg: 'Hoch',
    desc: 'Dreht sich mit roten Augen. Startet mit einem Helfer, der genauso stark ist: Solange der Helfer lebt, kann Blauast keinen Schaden nehmen.',
    strong: 'Lange Kämpfe', weak: 'Flächenschaden',
    contact: (b, sim) => 15 + sim.t * .15, contactCd: .5,
    takes: (b, sim) => (frag(b, sim) ? 0 : 1),
    init(b, sim) {
      const h = addBall(sim, 'blauhelfer', b.team, b.slot, b.x + (b.x < 150 ? 34 : -34), b.y, b.x < 150 ? 0 : 180, {});
      h.st.boss = b.id; b.st.shield = 1;
    },
    update(b, sim) { b.st.shield = frag(b, sim) > 0; }
  },
  blauhelfer: {
    name: 'Blau-Helfer', rarity: 'legendaer', hp: 160, speed: 130, r: 19, dmg: 'Hoch',
    desc: 'Der Helfer von Blauast.', strong: '-', weak: '-',
    contact: (b, sim) => 15 + sim.t * .15, contactCd: .5
  },
  kobra: {
    name: 'Kobra', rarity: 'mythisch', hp: 440, speed: 140, r: 22, dmg: 'Extrem',
    desc: 'Eine Schlange im Inneren und keine besonderen Fähigkeiten: Einfach sehr viel Leben und sehr viel Schaden.',
    strong: 'Fast alles', weak: 'Bomben',
    contact: (b, sim) => 30 + sim.t * .3, contactCd: .5
  },
  bladro: {
    name: 'Bladro', rarity: 'gewoehnlich', hp: 90, speed: 145, r: 16, dmg: 'Mittel',
    desc: 'Ein Blatt im Inneren. Schickt Blätter los, die in Schlangenlinie zum Gegner segeln.',
    strong: 'Langsame Gegner', weak: 'Schnelle Gegner',
    contact: (b, sim) => 6 + sim.t * .06, contactCd: .5,
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      if (!tick(b, 1.7)) return;
      const e = nearestEnemy(sim, b);
      if (e) { shot(sim, b, e, { speed: 190, r: 5, dmg: 7 + sim.t * .08, vis: 'blatt', turn: 1.3, life: 3.4, lead: 0 }); shot(sim, b, e, { speed: 170, r: 5, dmg: 7 + sim.t * .08, vis: 'blatt', turn: 1.3, life: 3.4, lead: 0 }, .5); }
    }
  }
});
// Liebender Ball: wie der Vampirball (klammert sich fest und saugt), heilt aber zusätzlich um den ausgeteilten Schaden
N.liebend = Object.assign({}, DEFS.vampir, {
  name: 'Liebender Ball', rarity: 'legendaer', hp: 125, speed: 145, r: 18, dmg: 'Hoch', lifesteal: .5,
  desc: 'Klammert sich wie der Vampirball fest und saugt Leben. Zusätzlich heilt er sich um die Hälfte jedes Schadens, den er austeilt.',
  strong: 'Einzelgegner', weak: 'Stacheln und Fallen'
});

// Schadensfaktoren aus dem Balance-Lauf (siehe tools/balance.js)
const DM7 = { kleinstachel: 6.14, kleinerhelfer: 1, kleinexplus: 1, kleinergross: 2.15, froh: 4.28, wuet: 1.23, gelassen: 1.15, verlegen: .92, aengstlich: 1.55, neugierig: .51, stolz: 2.29, neid: 1.6, liebend: .95, gefuehl: 0.86, herrscher: 1, allesherr: 1.15, rallaxa: 1.55, frallas: 1.65, blauast: 0.49, kobra: 0.73, bladro: 1.4 };
const BOX_OF = {
  alles: ['kleinstachel', 'kleinerhelfer', 'kleinexplus', 'kleinergross'],
  klein: ['allesherr', 'rallaxa', 'frallas', 'blauast', 'kobra', 'bladro'],
  gefuehl: ['froh', 'wuet', 'gelassen', 'verlegen', 'aengstlich', 'neugierig', 'stolz', 'neid', 'liebend', 'gefuehl', 'herrscher']
};
for (const box in BOX_OF) for (const id of BOX_OF[box]) {
  N[id].box = box;
  N[id].dm = DM7[id];
  DEFS[id] = N[id];
  BALL_IDS.push(id);
}
DEFS.minihelfer = N.minihelfer;   // Helfer: nicht in Boxen und nicht in der Sammlung
DEFS.framini = N.framini; DEFS.blauhelfer = N.blauhelfer;
Object.defineProperty(N.blauhelfer, 'dm', { get() { return N.blauast.dm; } });   // der Helfer ist genauso stark wie Blauast
