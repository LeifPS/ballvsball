// Alle 25 Bälle: Werte und Fähigkeiten. Deterministisch (siehe core.js).
import { DM } from './tuning.js';
import {
  DT, BOX, PI, TAU, dsin, dcos, len, segDist, hurt, stun, spawn, fx, rand, setDir, rotateVel, steer,
  nearestEnemy, addBall, heal, burn
} from './core.js';

export const RARITY = {
  gewoehnlich: { name: 'Gewöhnlich', color: '#8d8d8d', weight: 60, order: 0 },
  selten: { name: 'Selten', color: '#3b7fd4', weight: 28, order: 1 },
  episch: { name: 'Episch', color: '#8b4fc9', weight: 10, order: 2 },
  legendaer: { name: 'Legendär', color: '#e0a800', weight: 2, order: 3 }
};

export function postHit(sim, o, e, d, ow) {
  if (o.stun) stun(sim, e, o.stun);
  if (o.burnS) burn(sim, e, ow, o.burnS, o.burnD);
  if (o.leech && ow && !ow.dead) heal(sim, ow, d * o.leech);
}
export function ready(o, e, sim, cd) {
  const k = o.cd;
  if (sim.t < (k[e.id] || 0)) return false;
  k[e.id] = sim.t + cd;
  return true;
}
export function clampPt(v) { return v < 6 ? 6 : v > BOX - 6 ? BOX - 6 : v; }
// Richtung mit teilweisem Vorhalt
export function aimVel(b, e, speed, lead) {
  const d = len(e.x - b.x, e.y - b.y), tt = d / speed * lead;
  const tx = clampPt(e.x + e.vx * tt), ty = clampPt(e.y + e.vy * tt);
  const dx = tx - b.x, dy = ty - b.y, l = len(dx, dy) || 1;
  return [dx / l * speed, dy / l * speed];
}
export function foes(sim, team) {
  const out = [];
  for (const b of sim.balls) if (!b.dead && b.team !== team) out.push(b);
  return out;
}
export function own(sim, o) { return sim.byId[o.owner]; }

/* ================= Objekte ================= */
export const OBJS = {
  spike: {
    update(o, sim) {
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        // Treffer entlang des ganzen Stachels (von der Wand bis zur Spitze, 24 lang), passend zur doppelten Größe
        if (segDist(e.x, e.y, o.x, o.y, o.x + o.nx * 24, o.y + o.ny * 24) < e.r + 4 && ready(o, e, sim, .7)) hurt(sim, e, 5 + sim.t * .06, ow, 'trap');
      }
    }
  },
  bullet: {
    update(o, sim) {
      o.x += o.vx * DT; o.y += o.vy * DT; o.life -= DT;
      if (o.life <= 0 || o.x < -8 || o.x > BOX + 8 || o.y < -8 || o.y > BOX + 8) { o.dead = true; return; }
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr) {
          const ow = own(sim, o);
          if (o.pierce) { if (ready(o, e, sim, o.pcd || .4)) { const d = hurt(sim, e, o.dmg, ow, 'proj'); postHit(sim, o, e, d, ow); } }
          else { const d = hurt(sim, e, o.dmg, ow, 'proj'); postHit(sim, o, e, d, ow); o.dead = true; return; }
        }
      }
    }
  },
  fire: {
    update(o, sim) {
      o.life -= DT;
      if (o.life <= 0) { o.dead = true; return; }
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr) hurt(sim, e, o.dps * DT, ow, 'dot');
      }
    }
  },
  puddle: {
    update(o, sim) {
      o.life -= DT;
      if (o.life <= 0) { o.dead = true; return; }
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r * .8;
        if (dx * dx + dy * dy < rr * rr) hurt(sim, e, o.dps * DT, ow, 'dot');
      }
    }
  },
  boom: {
    update(o, sim) {
      const ow = own(sim, o);
      o.age += DT; o.rot += 14 * DT;
      if (o.phase === 0) {
        if (o.age > 1.05 || len(o.tx - o.x, o.ty - o.y) < 10) o.phase = 1;
      } else {
        if (!ow || ow.dead) { o.dead = true; return; }
        const dx = ow.x - o.x, dy = ow.y - o.y, l = len(dx, dy) || 1;
        o.vx = dx / l * o.speed * 1.15; o.vy = dy / l * o.speed * 1.15;
        if (l < ow.r + 8) { o.dead = true; return; }
      }
      o.x += o.vx * DT; o.y += o.vy * DT;
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr && ready(o, e, sim, .5)) { const d = hurt(sim, e, o.dmg * (o.exec && e.hp < e.maxHp * .3 ? 2 : 1), ow, 'proj'); postHit(sim, o, e, d, ow); }
      }
    }
  },
  bomb: {
    update(o, sim) {
      o.fuse -= DT;
      if (o.fuse > 0) return;
      o.dead = true;
      fx(sim, o.fxk || 'boom', o.x, o.y, o.r);
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        if (len(e.x - o.x, e.y - o.y) < o.r + e.r) { const d = hurt(sim, e, o.dmg, ow, 'area'); postHit(sim, o, e, d, ow); }
      }
    }
  },
  meteor: {
    update(o, sim) {
      o.fuse -= DT;
      if (o.fuse > 0) return;
      o.dead = true;
      fx(sim, o.fxk || 'boom', o.x, o.y, o.r);
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        if (len(e.x - o.x, e.y - o.y) < o.r + e.r) { const d = hurt(sim, e, o.dmg, ow, 'area'); postHit(sim, o, e, d, ow); }
      }
    }
  },
  saw: {
    update(o, sim) {
      o.x += o.vx * DT; o.y += o.vy * DT; o.rot += 18 * DT;
      let bounced = false;
      if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); bounced = true; }
      else if (o.x > BOX - o.r) { o.x = BOX - o.r; o.vx = -Math.abs(o.vx); bounced = true; }
      if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy); bounced = true; }
      else if (o.y > BOX - o.r) { o.y = BOX - o.r; o.vy = -Math.abs(o.vy); bounced = true; }
      if (bounced && --o.bounces < 0) { o.dead = true; return; }
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr && ready(o, e, sim, .6)) { const d = hurt(sim, e, o.dmg, ow, 'proj'); postHit(sim, o, e, d, ow); }
      }
    }
  },
  bee: {
    update(o, sim) {
      o.life -= DT;
      if (o.life <= 0) { o.dead = true; return; }
      let best = null, bd = 1e18;
      for (const e of foes(sim, o.team)) {
        const d = (e.x - o.x) * (e.x - o.x) + (e.y - o.y) * (e.y - o.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) steer(o, best.x, best.y, o.turn || 3.4, o.speed);
      o.x += o.vx * DT; o.y += o.vy * DT;
      if (o.x < 0) { o.x = 0; o.vx = Math.abs(o.vx); } else if (o.x > BOX) { o.x = BOX; o.vx = -Math.abs(o.vx); }
      if (o.y < 0) { o.y = 0; o.vy = Math.abs(o.vy); } else if (o.y > BOX) { o.y = BOX; o.vy = -Math.abs(o.vy); }
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr) {
          const ow = own(sim, o);
          if (o.pierce) { if (ready(o, e, sim, o.pcd || .35)) { const d = hurt(sim, e, o.dmg, ow, 'proj'); postHit(sim, o, e, d, ow); } }
          else { const d = hurt(sim, e, o.dmg, ow, 'proj'); postHit(sim, o, e, d, ow); o.dead = true; return; }
        }
      }
    }
  },
  wave: {
    update(o, sim) {
      o.rad += o.sp * DT;
      if (o.rad >= o.maxR) { o.dead = true; return; }
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        if (o.hit[e.id]) continue;
        const d = len(e.x - o.x, e.y - o.y);
        if (Math.abs(d - o.rad) < e.r + 5) {
          o.hit[e.id] = 1;
          const dd = hurt(sim, e, o.dmg, ow, 'area'); postHit(sim, o, e, dd, ow);
          if (o.push) setDir(e, e.x - o.x, e.y - o.y);
        }
      }
    }
  },
  mine: {
    update(o, sim) {
      o.age = (o.age || 0) + DT; o.life -= DT;
      if (o.life <= 0) { o.dead = true; return; }
      if (o.age < o.arm) return;
      const ow = own(sim, o);
      for (const e of foes(sim, o.team)) {
        if (len(e.x - o.x, e.y - o.y) < o.trig + e.r) {
          o.dead = true;
          fx(sim, o.fxk || 'boom', o.x, o.y, o.er);
          for (const f of foes(sim, o.team)) {
            if (len(f.x - o.x, f.y - o.y) < o.er + f.r) { const d = hurt(sim, f, o.dmg, ow, 'area'); postHit(sim, o, f, d, ow); }
          }
          return;
        }
      }
    }
  },
  frost: {
    update(o, sim) {
      o.x += o.vx * DT; o.y += o.vy * DT; o.life -= DT;
      if (o.life <= 0 || o.x < -8 || o.x > BOX + 8 || o.y < -8 || o.y > BOX + 8) { o.dead = true; return; }
      for (const e of foes(sim, o.team)) {
        const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
        if (dx * dx + dy * dy < rr * rr) {
          hurt(sim, e, o.dmg, own(sim, o), 'proj');
          stun(sim, e, o.stun);
          o.dead = true; return;
        }
      }
    }
  }
};

export function newObj(sim, k, b, x, y, extra) {
  const o = { k, team: b.team, owner: b.id, x, y, vx: 0, vy: 0, cd: {}, dead: false };
  for (const key in extra) o[key] = extra[key];
  return spawn(sim, o);
}

/* ================= Bälle ================= */
export const DEFS = {
  /* ---------- Gewöhnlich ---------- */
  stachel: {
    name: 'Stachelball', rarity: 'gewoehnlich', hp: 100, speed: 150, r: 18, dmg: 'Mittel',
    desc: 'Bei jeder Wandberührung wächst dort ein Stachel, der Gegner verletzt. Mit der Zeit wird die Box zur Falle.',
    strong: 'Lange Kämpfe, Gegner ohne Fernangriff', weak: 'Schnelle Kämpfe, Spiegelball',
    contact: () => 9,
    onWall(b, sim, side, x, y) {
      for (const o of sim.objs) {
        if (o.k === 'spike' && o.owner === b.id) {
          const dx = o.x - x, dy = o.y - y;
          if (dx * dx + dy * dy < 196) return;
        }
      }
      const nx = side === 'l' ? 1 : side === 'r' ? -1 : 0, ny = side === 't' ? 1 : side === 'b' ? -1 : 0;
      newObj(sim, 'spike', b, x, y, { nx, ny, tx: x + nx * 9, ty: y + ny * 9, r: 7 });
    }
  },
  turret: {
    name: 'Turretball', rarity: 'gewoehnlich', hp: 90, speed: 120, r: 18, dmg: 'Niedrig',
    desc: 'Schießt ununterbrochen Kugeln auf den Gegner. Viele Treffer, wenig Schaden pro Kugel.',
    strong: 'Große, langsame Gegner', weak: 'Schildball, Spiegelball nicht',
    init(b) { b.st.cd = .5; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      b.st.cd = Math.max(.17, .4 - sim.t * .004);
      const v = aimVel(b, e, 250, .35);
      newObj(sim, 'bullet', b, b.x, b.y, { vx: v[0], vy: v[1], r: 3.2, dmg: 1.6 + sim.t * .015, life: 3, proj: true });
    }
  },
  ramm: {
    name: 'Rammball', rarity: 'gewoehnlich', hp: 150, speed: 135, r: 22, dmg: 'Hoch',
    desc: 'Dick, zäh und schlägt hart zu. Sein Kontaktschaden steigt mit der Zeit.',
    strong: 'Glasball, Turretball', weak: 'Spiegelball, Stacheln',
    contact: (b, sim) => 24 + sim.t * .3, contactCd: .6
  },
  glas: {
    name: 'Glasball', rarity: 'gewoehnlich', hp: 45, speed: 195, r: 13, dmg: 'Sehr hoch',
    desc: 'Winzig, blitzschnell und mit sehr hohem Schaden, aber zerbricht schnell.',
    strong: 'Kurze Kämpfe, träge Gegner', weak: 'Alles mit Fernangriff',
    contact: (b, sim) => 40 + sim.t * .4, contactCd: .5
  },
  feuer: {
    name: 'Feuerball', rarity: 'gewoehnlich', hp: 90, speed: 150, r: 17, dmg: 'Mittel',
    desc: 'Zieht eine Feuerspur hinter sich her. Wer hineingerät, brennt.',
    strong: 'Große Gegner', weak: 'Schnelle Gegner, Wuchsball',
    contact: () => 4,
    onContact(b, o, sim, d) { if (d > 0) burn(sim, o, b, 3, 4 + sim.t * .05); },
    init(b) { b.st.cd = 0; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = .12;
      newObj(sim, 'fire', b, b.x, b.y, { r: 9, life: 2.2 + sim.t * .03, dps: 4 + sim.t * .05 });
    }
  },
  bumerang: {
    name: 'Bumerangball', rarity: 'gewoehnlich', hp: 95, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Wirft Bumerangs auf den Gegner, die zurückfliegen. Je länger der Kampf, desto öfter.',
    strong: 'Gegner mit gerader Bahn', weak: 'Schildball',
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      b.st.cd = Math.max(1.3, 2.7 - sim.t * .03);
      const v = aimVel(b, e, 230, .5), l = len(v[0], v[1]) || 1;
      newObj(sim, 'boom', b, b.x, b.y, {
        vx: v[0], vy: v[1], speed: 230, r: 8, dmg: 8 + sim.t * .08, phase: 0, age: 0, rot: 0,
        tx: clampPt(b.x + v[0] / l * 150), ty: clampPt(b.y + v[1] / l * 150), proj: true
      });
    }
  },
  magnet: {
    name: 'Magnetball', rarity: 'gewoehnlich', hp: 105, speed: 130, r: 18, dmg: 'Mittel',
    desc: 'Zieht die Flugbahn naher Gegner zu sich heran und schlägt dann zu.',
    strong: 'Gegner, die auf Nahkampf setzen', weak: 'Fernkämpfer',
    contact: (b, sim) => 14 + sim.t * .2, contactCd: .45,
    update(b, sim) {
      const turn = 1.8 + sim.t * .02;
      for (const e of foes(sim, b.team)) {
        if (len(e.x - b.x, e.y - b.y) < 190) steer(e, b.x, b.y, turn, e.speed);
      }
    }
  },

  /* ---------- Selten ---------- */
  schwert: {
    name: 'Schwertball', rarity: 'selten', hp: 100, speed: 140, r: 18, dmg: 'Mittel',
    desc: 'Ein Dolch kreist um ihn. Im Kampf kommen bis zu 5 dazu und sie drehen sich immer schneller.',
    strong: 'Gegner im Nahkampf', weak: 'Fernkämpfer',
    init(b) { b.st.ang = 0; },
    update(b, sim) {
      const n = Math.min(5, 1 + Math.floor(sim.t / 7));
      b.st.n = n;
      b.st.ang += (2.6 + sim.t * .1) * DT;
      for (const e of foes(sim, b.team)) {
        for (let i = 0; i < n; i++) {
          const a = b.st.ang + i * TAU / n, c = dcos(a), s = dsin(a);
          const d = segDist(e.x, e.y, b.x + c * (b.r + 4), b.y + s * (b.r + 4), b.x + c * (b.r + 25), b.y + s * (b.r + 25));
          if (d < e.r + 3) {
            const k = e.id * 8 + i;
            if (sim.t >= (b.hitCd['d' + k] || 0)) { b.hitCd['d' + k] = sim.t + .4; hurt(sim, e, 7, b, 'melee'); }
          }
        }
      }
    }
  },
  zelle: {
    name: 'Zellball', rarity: 'selten', hp: 60, speed: 120, r: 20, dmg: 'Mittel',
    desc: 'Startet als große Zelle (Stufe 4). Stirbt sie, teilt sie sich in zwei kleinere. Stufe 1 stirbt endgültig.',
    strong: 'Einzelziel-Angriffe', weak: 'Flächenschaden',
    contact: b => 5 + b.lvl * 3,
    init(b, sim, opt) {
      const lvl = opt.lvl || 4;
      const T = { 4: [50, 20, 120], 3: [26, 16, 135], 2: [14, 13, 150], 1: [8, 10, 165] }[lvl];
      b.lvl = lvl; b.hp = b.maxHp = T[0] * (DEFS.zelle.k || 1); b.r = T[1]; b.speed = T[2];
    },
    onDeath(b, sim) {
      if (b.lvl > 1) {
        for (let i = 0; i < 2; i++) {
          const deg = Math.floor(rand(sim) * 360);
          addBall(sim, 'zelle', b.team, b.slot, b.x, b.y, deg, { lvl: b.lvl - 1 });
        }
        fx(sim, 'split', b.x, b.y, b.r);
      }
      return false;
    }
  },
  spinne: {
    name: 'Spinnenball', rarity: 'selten', hp: 95, speed: 135, r: 18, dmg: 'Hoch',
    desc: 'Bei jeder Wandberührung spinnt er einen Faden zwischen dem Punkt und sich selbst. Die Fäden folgen ihm.',
    strong: 'Lange Kämpfe', weak: 'Kurze Kämpfe, Glasball',
    contact: () => 4,
    init(b) { b.st.th = []; },
    onWall(b, sim, side, x, y) { b.st.th.push({ x, y }); },
    update(b, sim) {
      for (const e of foes(sim, b.team)) {
        if (len(e.x - b.x, e.y - b.y) < b.r + e.r + 4) continue;
        const th = b.st.th;
        for (let i = 0; i < th.length; i++) {
          const d = segDist(e.x, e.y, th[i].x, th[i].y, b.x, b.y);
          if (d < e.r + 1.5) {
            const k = 't' + e.id * 100000 + i;
            if (sim.t >= (b.hitCd[k] || 0)) { b.hitCd[k] = sim.t + .6; hurt(sim, e, 2 + sim.t * .02, b, 'proj'); }
          }
        }
      }
    }
  },
  schmied: {
    name: 'Schmiedball', rarity: 'selten', hp: 115, speed: 135, r: 19, dmg: 'Steigend',
    desc: 'Bei jeder Berührung mit dem Gegner hat er 20 % Chance aufzuleveln und beim nächsten Mal mehr Schaden zu machen.',
    strong: 'Lange Kämpfe', weak: 'Kurze Kämpfe',
    contact: b => 12 + 5 * b.st.lv, contactCd: .55,
    init(b) { b.st.lv = 0; },
    onContact(b, o, sim, dealt) {
      if (dealt > 0 && rand(sim) < .2) { b.st.lv++; fx(sim, 'levelup', b.x, b.y, b.st.lv); }
    }
  },
  bombe: {
    name: 'Bombenball', rarity: 'selten', hp: 100, speed: 135, r: 18, dmg: 'Hoch',
    desc: 'Legt Bomben ab, die kurz darauf in einem großen Radius explodieren.',
    strong: 'Gegner mit festen Wegen', weak: 'Spiegelball',
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = Math.max(.9, 3 - sim.t * .03);
      newObj(sim, 'bomb', b, b.x, b.y, { fuse: 1.8, r: 62, dmg: 30 + sim.t * .3 });
    }
  },
  schild: {
    name: 'Schildball', rarity: 'selten', hp: 125, speed: 130, r: 19, dmg: 'Mittel',
    desc: 'Ein drehendes Schild blockt Geschosse und wirft sie zurück. Das Schild selbst verletzt Gegner.',
    strong: 'Turret, Bumerang, Schwarm, Säge', weak: 'Rammball, Stacheln',
    contact: () => 12,
    init(b) { b.st.ang = 0; },
    update(b, sim) {
      b.st.ang += (1.8 + sim.t * .02) * DT;
      const sc = dcos(b.st.ang), ss = dsin(b.st.ang);
      for (const o of sim.objs) {
        if (!o.proj || o.team === b.team || o.dead) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d = len(dx, dy);
        if (d > b.r + 14 || d < b.r - 2) continue;
        if ((dx * sc + dy * ss) / (d || 1) > .55) {
          o.team = b.team; o.owner = b.id; o.vx = -o.vx; o.vy = -o.vy;
          if (o.k === 'boom') { o.phase = 0; o.age = 0; }
          fx(sim, 'block', o.x, o.y, 0);
        }
      }
      for (const e of foes(sim, b.team)) {
        for (let k = -2; k <= 2; k++) {
          const a = b.st.ang + k * .4;
          const px = b.x + dcos(a) * (b.r + 8), py = b.y + dsin(a) * (b.r + 8);
          if (len(e.x - px, e.y - py) < e.r + 4) {
            if (sim.t >= (b.hitCd['s' + e.id] || 0)) { b.hitCd['s' + e.id] = sim.t + .5; hurt(sim, e, 7, b, 'melee'); }
            break;
          }
        }
      }
    }
  },
  echo: {
    name: 'Echoball', rarity: 'selten', hp: 90, speed: 145, r: 17, dmg: 'Mittel',
    desc: 'Hinter ihm läuft sein Echo auf seiner alten Bahn und verletzt ebenfalls. Später kommen weitere Echos dazu.',
    strong: 'Gegner, die ihn jagen', weak: 'Schwarm, Spiegelball',
    init(b) { b.st.h = []; },
    update(b, sim) {
      const h = b.st.h;
      h.push(b.x, b.y);
      if (h.length > 420) h.splice(0, 2);
      const n = sim.t > 40 ? 3 : sim.t > 20 ? 2 : 1;
      b.st.ghosts = [];
      for (let g = 1; g <= n; g++) {
        const idx = h.length - 2 - g * 100;
        if (idx < 0) continue;
        const gx = h[idx], gy = h[idx + 1];
        b.st.ghosts.push([gx, gy]);
        for (const e of foes(sim, b.team)) {
          if (len(e.x - gx, e.y - gy) < e.r + 14) {
            const k = 'g' + g + '_' + e.id;
            if (sim.t >= (b.hitCd[k] || 0)) { b.hitCd[k] = sim.t + .5; hurt(sim, e, 9, b, 'melee'); }
          }
        }
      }
    }
  },
  gift: {
    name: 'Giftball', rarity: 'selten', hp: 105, speed: 135, r: 18, dmg: 'Mittel',
    desc: 'Hinterlässt giftige Pfützen, die Gegner dauerhaft schwächen. Es werden immer mehr.',
    strong: 'Langsame, große Gegner', weak: 'Schnelle Gegner',
    init(b) { b.st.cd = .6; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = Math.max(.4, 1.1 - sim.t * .01);
      newObj(sim, 'puddle', b, b.x, b.y, { r: 25, life: 8 + sim.t * .06, dps: 3.2 + sim.t * .04 });
    }
  },

  /* ---------- Episch ---------- */
  vampir: {
    name: 'Vampirball', rarity: 'episch', hp: 120, speed: 145, r: 18, dmg: 'Hoch',
    desc: 'Klammert sich bei Berührung 3 Sekunden an den Gegner und saugt alle 0,5 Sekunden Leben.',
    strong: 'Einzelgegner', weak: 'Stacheln und Fallen',
    contact: () => 3,
    init(b) { b.st.grab = null; b.st.next = 0; },
    onContact(b, o, sim) {
      if (b.st.grab || sim.t < b.st.next || o.dead) return;
      const dx = b.x - o.x, dy = b.y - o.y, l = len(dx, dy) || 1;
      b.st.grab = { id: o.id, end: sim.t + 3, tick: .25, ux: dx / l, uy: dy / l };
      fx(sim, 'grab', o.x, o.y, 0);
    },
    update(b, sim) {
      const g = b.st.grab;
      if (!g) return;
      const e = sim.byId[g.id];
      if (!e || e.dead || sim.t >= g.end) {
        b.st.grab = null; b.st.next = sim.t + 1.2;
        if (e && !e.dead) setDir(b, b.x - e.x, b.y - e.y);
        return;
      }
      const dd = e.r + b.r - 2;
      b.x = e.x + g.ux * dd; b.y = e.y + g.uy * dd;
      b.vx = e.vx; b.vy = e.vy; b.noMove = true;
      if (b.x < b.r) b.x = b.r; else if (b.x > BOX - b.r) b.x = BOX - b.r;
      if (b.y < b.r) b.y = b.r; else if (b.y > BOX - b.r) b.y = BOX - b.r;
      g.tick -= DT;
      if (g.tick <= 0) {
        g.tick += .5;
        const d = hurt(sim, e, 5 + sim.t * .05, b, 'melee');
        b.hp = Math.min(b.maxHp, b.hp + d * .6);
      }
    }
  },
  riese: {
    name: 'Riesenball', rarity: 'episch', hp: 270, speed: 105, r: 30, dmg: 'Hoch',
    desc: 'Riesig, langsam und enorm zäh. Er wächst im Lauf des Kampfes weiter.',
    strong: 'Kurze Angriffe, Glasball', weak: 'Flächenschaden, Bomben, Meteore',
    contact: (b, sim) => 20 + sim.t * .25, contactCd: .6,
    update(b, sim) { b.r = Math.min(46, 30 + sim.t * .3); }
  },
  saege: {
    name: 'Sägeball', rarity: 'episch', hp: 100, speed: 140, r: 18, dmg: 'Hoch',
    desc: 'Schleudert Sägeblätter, die viele Male von den Wänden abprallen. Je länger, desto mehr Blätter.',
    strong: 'Große Gegner, lange Kämpfe', weak: 'Schildball',
    init(b) { b.st.cd = 1.5; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = Math.max(1.2, 3.6 - sim.t * .05);
      const deg = Math.floor(rand(sim) * 360), a = deg * PI / 180;
      newObj(sim, 'saw', b, b.x, b.y, {
        vx: dcos(a) * 175, vy: dsin(a) * 175, r: 9, dmg: 7 + sim.t * .1, bounces: 7 + Math.floor(sim.t / 10), rot: 0
      });
    }
  },
  schwarm: {
    name: 'Schwarmball', rarity: 'episch', hp: 90, speed: 140, r: 17, dmg: 'Mittel',
    desc: 'Schickt Bienen los, die den Gegner verfolgen. Der Schwarm wird immer dichter.',
    strong: 'Wendige Gegner', weak: 'Schildball, Flächenschaden',
    init(b) { b.st.cd = 1; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = Math.max(.5, 1.6 - sim.t * .02);
      for (let i = 0; i < 2; i++) {
        const deg = Math.floor(rand(sim) * 360), a = deg * PI / 180;
        newObj(sim, 'bee', b, b.x, b.y, { vx: dcos(a) * 110, vy: dsin(a) * 110, speed: 110, r: 4.5, dmg: 3 + sim.t * .05, life: 7, proj: true });
      }
    }
  },
  eis: {
    name: 'Eisball', rarity: 'episch', hp: 105, speed: 135, r: 18, dmg: 'Niedrig',
    desc: 'Frostgeschosse frieren den Gegner ein: Er kann dann keine Fähigkeiten nutzen und macht keinen Schaden.',
    strong: 'Fähigkeits-Bälle wie Schwert und Bomben', weak: 'Rammball, Stacheln',
    init(b) { b.st.cd = 1.2; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      b.st.cd = Math.max(1.8, 3.4 - sim.t * .03);
      const v = aimVel(b, e, 215, .7);
      newObj(sim, 'frost', b, b.x, b.y, { vx: v[0], vy: v[1], r: 5, dmg: 5, stun: 1.1 + Math.min(1, sim.t * .01), life: 3, proj: true });
    }
  },
  meteor: {
    name: 'Meteorball', rarity: 'episch', hp: 100, speed: 135, r: 18, dmg: 'Hoch',
    desc: 'Ruft Meteore auf die Stelle, an der der Gegner gleich sein wird.',
    strong: 'Träge Gegner', weak: 'Flinke Gegner',
    init(b) { b.st.cd = 1.8; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      const e = nearestEnemy(sim, b);
      if (!e) return;
      b.st.cd = Math.max(1, 3 - sim.t * .03);
      const ox = (rand(sim) - .5) * 50, oy = (rand(sim) - .5) * 50;
      newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .9 + ox), clampPt(e.y + e.vy * .9 + oy), { fuse: 1, r: 44, dmg: 15 + sim.t * .2 });
    }
  },
  spiegel: {
    name: 'Spiegelball', rarity: 'episch', hp: 140, speed: 130, r: 19, dmg: 'Mittel',
    desc: 'Wirft einen Teil von Kontakt-, Fallen- und Flächenschaden auf den Verursacher zurück.',
    strong: 'Rammball, Stachelball, Bombenball', weak: 'Geschosse, Gift, Feuer',
    contact: () => 14,
    onHurt(t, amt, src, kind, sim) {
      if (src && !src.dead && (kind === 'contact' || kind === 'trap' || kind === 'area' || kind === 'melee')) {
        hurt(sim, src, amt * .45, t, 'reflect');
      }
    }
  },
  wuchs: {
    name: 'Wuchsball', rarity: 'episch', hp: 120, speed: 125, r: 18, dmg: 'Mittel',
    desc: 'Heilt sich dauernd selbst, und die Heilung wird stärker. Sein Schaden wächst langsam.',
    strong: 'Kleinschaden wie Turret und Feuer', weak: 'Eisball, Schaden auf einen Schlag',
    contact: (b, sim) => 12 + sim.t * .2,
    update(b, sim) { b.hp = Math.min(b.maxHp, b.hp + (1 + sim.t * .06) * DT); }
  },

  /* ---------- Legendär ---------- */
  drache: {
    name: 'Drachenball', rarity: 'legendaer', hp: 135, speed: 140, r: 20, dmg: 'Sehr hoch',
    desc: 'Speit alle paar Sekunden einen Feuerstrahl auf den Gegner und hinterlässt Flammen.',
    strong: 'Fast alles', weak: 'Eisball',
    contact: () => 7,
    init(b) { b.st.cd = 1.2; b.st.breath = 0; b.st.ax = 1; b.st.ay = 0; b.st.aim = { x: 0, y: 0, vx: 1, vy: 0, speed: 1 }; },
    update(b, sim) {
      const s = b.st;
      if (s.breath > 0) {
        s.breath -= DT;
        const e = nearestEnemy(sim, b);
        if (e) { s.aim.x = b.x; s.aim.y = b.y; steer(s.aim, e.x, e.y, 1.2, 1); s.ax = s.aim.vx; s.ay = s.aim.vy; }
        const range = 150;
        for (const f of foes(sim, b.team)) {
          const dx = f.x - b.x, dy = f.y - b.y, d = len(dx, dy);
          if (d <= range + f.r && (dx * s.ax + dy * s.ay) / (d || 1) > .9) hurt(sim, f, (13 + sim.t * .25) * DT, b, 'dot');
        }
        s.ft -= DT;
        if (s.ft <= 0) {
          s.ft = .14;
          const dist = 40 + rand(sim) * 110;
          newObj(sim, 'fire', b, b.x + s.ax * dist, b.y + s.ay * dist, { r: 9, life: 1.2, dps: 3 });
        }
      } else {
        s.cd -= DT;
        if (s.cd <= 0) {
          const e = nearestEnemy(sim, b);
          if (!e) return;
          const dx = e.x - b.x, dy = e.y - b.y, l = len(dx, dy) || 1;
          s.aim.vx = dx / l; s.aim.vy = dy / l; s.ax = s.aim.vx; s.ay = s.aim.vy;
          s.breath = 1.4; s.ft = 0; s.cd = Math.max(2.2, 4 - sim.t * .03);
          fx(sim, 'breath', b.x, b.y, 0);
        }
      }
    }
  },
  phoenix: {
    name: 'Phönixball', rarity: 'legendaer', hp: 125, speed: 150, r: 19, dmg: 'Hoch',
    desc: 'Lässt Glut zurück und kehrt einmal mit einer Feuerwelle aus dem Tod zurück, stärker und schneller.',
    strong: 'Lange Kämpfe', weak: 'Eisball',
    contact: (b, sim) => (8 + sim.t * .05) * (b.st.rage ? 1.5 : 1),
    init(b) { b.st.cd = 0; b.st.rev = 0; b.st.rage = 0; },
    update(b, sim) {
      b.st.cd -= DT;
      if (b.st.cd > 0) return;
      b.st.cd = .25;
      newObj(sim, 'fire', b, b.x, b.y, { r: 7, life: 1.8, dps: 3 + (b.st.rage ? 2 : 0) });
    },
    onDeath(b, sim) {
      if (b.st.rev) return false;
      b.st.rev = 1; b.st.rage = 1; b.hp = b.maxHp * .7;
      b.speed = 168; setDir(b, b.vx, b.vy);
      fx(sim, 'boom', b.x, b.y, 130);
      for (const e of foes(sim, b.team)) {
        if (len(e.x - b.x, e.y - b.y) < 130 + e.r) { hurt(sim, e, 30, b, 'area'); stun(sim, e, .8); }
      }
      return true;
    }
  }
};

for (const id in DEFS) DEFS[id].box = 'standard';
export const BALL_IDS = Object.keys(DEFS);
export function ballsByRarity(r) { return BALL_IDS.filter(id => DEFS[id].rarity === r); }

for (const id of BALL_IDS) DEFS[id].dm = DM[id] || 1;
