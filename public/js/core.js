// Deterministischer Kampfkern. Läuft identisch im Browser und im Worker.
// Regeln: nur + - * / Math.sqrt Math.imul. Keine Math.sin/cos/random/hypot.
export const DT = 1 / 60;
export const BOX = 300;
export const MAX_T = 90;
export const ENRAGE_T = 45;
export const PI = 3.141592653589793;
export const TAU = PI * 2;
export const STAR_BONUS = .08;   // je Stern +8 % Leben und Schaden
export const MAX_STARS = 5;

export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function wrapPi(x) {
  while (x > PI) x -= TAU;
  while (x < -PI) x += TAU;
  return x;
}
export function dsin(x) {
  x = wrapPi(x);
  if (x > PI / 2) x = PI - x; else if (x < -PI / 2) x = -PI - x;
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800)))))));
}
export function dcos(x) { return dsin(x + PI / 2); }
export function dirOf(deg) { const a = deg * PI / 180; return [dcos(a), dsin(a)]; }
export function len(x, y) { return Math.sqrt(x * x + y * y); }

// Abstand Punkt -> Strecke
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = ax + dx * t - px, cy = ay + dy * t - py;
  return len(cx, cy);
}

export function makeSim(cfg, DEFS, OBJS) {
  const sim = {
    cfg, DEFS, OBJS, t: 0, step: 0, rng: mulberry(cfg.seed >>> 0),
    balls: [], objs: [], byId: {}, fx: [], noFx: !!cfg.noFx,
    over: false, winner: -1, reason: '', nextId: 1, teamMax: {}, dealt: {}
  };
  const n = cfg.balls.length, total = cfg.total || n;   // total: Spielerzahl des Matches (auch wenn schon welche ausgeschieden sind)
  const POS = total <= 2 ? [[.22, .5], [.78, .5]] : total === 3 ? [[.5, .2], [.2, .76], [.8, .76]] : [[.25, .28], [.25, .72], [.75, .28], [.75, .72]];
  sim.elim = [];   // Reihenfolge, in der Teams komplett besiegt wurden: { team, step }
  cfg.balls.forEach((c, i) => {
    const slot = c.slot != null ? c.slot : i, p = POS[slot];
    const nb = addBall(sim, c.type, c.team, slot, p[0] * BOX, p[1] * BOX, c.deg || 0, { stars: Math.max(0, Math.min(MAX_STARS, c.stars | 0)) });
    // Einzelspieler-Bosse: mehr Leben (hpMul) und mitgebrachter Lebensanteil (hpFrac)
    if (c.hpMul > 0) { nb.maxHp *= c.hpMul; nb.hp = nb.maxHp; }
    if (c.hpFrac > 0 && c.hpFrac < 1) nb.hp = Math.max(1, nb.maxHp * c.hpFrac);
  });
  for (const b of sim.balls) sim.teamMax[b.team] = (sim.teamMax[b.team] || 0) + b.maxHp;
  return sim;
}

export function addBall(sim, type, team, slot, x, y, deg, opt) {
  const def = sim.DEFS[type];
  const d = dirOf(deg);
  const b = {
    id: sim.nextId++, type, def, team, slot, x, y, vx: 0, vy: 0, speed: def.speed, r: def.r,
    hp: def.hp, maxHp: def.hp, dead: false, stun: 0, stunImm: 0, flash: 0, hitCd: {}, st: {}, age: 0,
    lvl: 0, noMove: false, burn: 0, burnDps: 0, burnSrc: 0, stars: 0, pm: 1
  };
  const stars = (opt && opt.stars) || 0;
  if (stars) { b.stars = stars; const k = 1 + STAR_BONUS * stars; b.hp *= k; b.maxHp *= k; b.pm = k; }
  b.vx = d[0] * b.speed; b.vy = d[1] * b.speed;
  if (def.init) def.init(b, sim, opt || {});
  const l0 = len(b.vx, b.vy) || 1;
  b.vx *= b.speed / l0; b.vy *= b.speed / l0;
  sim.balls.push(b);
  sim.byId[b.id] = b;
  return b;
}

export function fx(sim, k, x, y, a, extra) {
  if (sim.noFx) return;
  if (sim.fx.length > 400) return;
  sim.fx.push({ k, x, y, a, e: extra });
}
export function spawn(sim, o) { sim.objs.push(o); return o; }
export function rand(sim) { return sim.rng(); }

export function setDir(b, dx, dy) {
  const l = len(dx, dy) || 1;
  b.vx = dx / l * b.speed; b.vy = dy / l * b.speed;
}
// Richtung um Winkel drehen, Tempo bleibt gleich
export function rotateVel(o, ang, speed) {
  const c = dcos(ang), s = dsin(ang);
  const nx = o.vx * c - o.vy * s, ny = o.vx * s + o.vy * c;
  const l = len(nx, ny) || 1, sp = speed || o.speed;
  o.vx = nx / l * sp; o.vy = ny / l * sp;
}
// zielsuchend: dreht Richtung Richtung (tx,ty)
export function steer(o, tx, ty, turnPerSec, speed) {
  const cross = o.vx * (ty - o.y) - o.vy * (tx - o.x);
  const a = turnPerSec * DT;
  rotateVel(o, cross > 0 ? a : -a, speed);
}

export function enemiesOf(sim, team) {
  const out = [];
  for (const b of sim.balls) if (!b.dead && b.team !== team) out.push(b);
  return out;
}
export function nearestEnemy(sim, b) {
  let best = null, bd = 1e18;
  for (const e of sim.balls) {
    if (e.dead || e.team === b.team) continue;
    const dx = e.x - b.x, dy = e.y - b.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function ownerOf(sim, o) { return sim.byId[o.owner]; }

// Schaden verursachen. kind: contact | proj | trap | area | dot | melee | reflect
export function hurt(sim, t, amt, src, kind) {
  if (t.dead || amt <= 0) return 0;
  const d = t.def;
  if (src && src.def.dm && kind !== 'reflect') amt *= src.def.dm * src.pm;
  // Anlaufphase: am Anfang wird weniger Schaden gemacht, damit kein Kampf unter ca. 8 s endet
  if (sim.t < 8 && kind !== 'reflect') amt *= .3 + .7 * (sim.t / 8);
  if (d.takes && !t.silenced) amt *= d.takes(t, sim, kind);
  t.hp -= amt;
  if (kind !== 'dot') t.flash = .12;
  if (src) sim.dealt[src.team] = (sim.dealt[src.team] || 0) + amt;
  if (kind !== 'dot') fx(sim, 'hit', t.x, t.y, amt);
  else {   // Dauerschaden (Feuerspur, Regen, Brennen ...): Ball blinkt rot und zeigt alle paar Zehntelsekunden die Summe
    t.dotT = .2; t.dotAcc = (t.dotAcc || 0) + amt;
    if (sim.t >= (t.dotNext || 0)) { fx(sim, 'tick', t.x, t.y, t.dotAcc); t.dotAcc = 0; t.dotNext = sim.t + .5; }
  }
  if (src && src.def.lifesteal && !src.dead && amt < 1e6) src.hp = Math.min(src.maxHp, src.hp + amt * src.def.lifesteal);   // Liebender Ball: heilt um den ausgeteilten Schaden
  if (d.onHurt && !t.silenced) d.onHurt(t, amt, src, kind, sim);
  return amt;
}
export function heal(sim, b, amt) {
  if (b.dead || amt <= 0) return;
  b.hp = Math.min(b.maxHp, b.hp + amt);
  fx(sim, 'heal', b.x, b.y, amt);
}
export function burn(sim, t, src, secs, dps) {
  if (t.dead) return;
  if (t.burn < secs) t.burn = secs;
  t.burnDps = dps; t.burnSrc = src ? src.id : 0;
}
export function stun(sim, t, secs) {
  if (t.dead || t.stunImm > 0 || t.stun > 0) return;
  t.stun = secs;
  fx(sim, 'stun', t.x, t.y, secs);
}

// Arena schrumpft in langen Kämpfen: nach ENRAGE_T rücken die Wände von allen Seiten zusammen (bis auf etwa die halbe Kantenlänge)
export function insetOf(sim) { return (sim.t > ENRAGE_T ? Math.min(75, (sim.t - ENRAGE_T) * 1.8) : 0) - (sim.grow || 0); }   // Kleiner Großer: sim.grow > 0 vergrößert die Arena (negativer Abstand)
function wallHit(sim, b, side) {
  if (b.stun > 0 || !b.def.onWall || b.silenced) return;
  let px, py;
  const ins = insetOf(sim);
  if (side === 'l') { px = ins; py = b.y; } else if (side === 'r') { px = BOX - ins; py = b.y; }
  else if (side === 't') { px = b.x; py = ins; } else { px = b.x; py = BOX - ins; }
  b.def.onWall(b, sim, side, px, py);
}
function moveBall(sim, b) {
  b.x += b.vx * DT; b.y += b.vy * DT;
  const ins = insetOf(sim), lo = b.r + ins, hi = BOX - b.r - ins;
  if (b.x < lo) { b.x = lo; if (b.vx < 0) b.vx = -b.vx; wallHit(sim, b, 'l'); }
  else if (b.x > hi) { b.x = hi; if (b.vx > 0) b.vx = -b.vx; wallHit(sim, b, 'r'); }
  if (b.y < lo) { b.y = lo; if (b.vy < 0) b.vy = -b.vy; wallHit(sim, b, 't'); }
  else if (b.y > hi) { b.y = hi; if (b.vy > 0) b.vy = -b.vy; wallHit(sim, b, 'b'); }
}
function clampBall(b, sim) {
  const ins = sim ? insetOf(sim) : 0, lo = b.r + ins, hi = BOX - b.r - ins;
  if (b.x < lo) b.x = lo; else if (b.x > hi) b.x = hi;
  if (b.y < lo) b.y = lo; else if (b.y > hi) b.y = hi;
}
function dealContact(sim, a, b) {
  if (a.stun > 0) return;
  const cd = a.hitCd[b.id] || 0;
  if (sim.t < cd) return;
  const dmg = a.def.contact ? a.def.contact(a, sim) : 0;
  if (dmg <= 0) return;
  a.hitCd[b.id] = sim.t + (a.def.contactCd || .5);
  const dealt = hurt(sim, b, dmg, a, 'contact');
  if (a.def.onContact && !a.silenced) a.def.onContact(a, b, sim, dealt);
}

function kill(sim, b) {
  if (b.def.onDeath && b.def.onDeath(b, sim) === true) return;
  b.dead = true; b.hp = 0;
  fx(sim, 'die', b.x, b.y, b.r, b.type);
}

export function stepSim(sim) {
  if (sim.over) return;
  sim.t += DT; sim.step++;
  const balls = sim.balls;
  if (sim.growTo !== undefined || sim.grow) { const gt = sim.t < (sim.growUntil || 0) ? (sim.growTo || 0) : 0; sim.grow = (sim.grow || 0) + (gt - (sim.grow || 0)) * .09; if (sim.grow < .05 && gt === 0) sim.grow = 0; }
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.dead) continue;
    b.age += DT;
    if (b.flash > 0) b.flash -= DT;
    if (b.dotT > 0) b.dotT -= DT;
    if (b.burn > 0) { b.burn -= DT; hurt(sim, b, b.burnDps * DT, sim.byId[b.burnSrc] || null, 'dot'); }
    if (b.stun > 0) { b.stun -= DT; if (b.stun <= 0) { b.stun = 0; b.stunImm = 1.5; } }
    else if (b.stunImm > 0) b.stunImm -= DT;
    b.noMove = false;
    if (b.hold > 0) { b.hold -= DT; b.noMove = true; }   // festgehalten (Rallaxa): bleibt stehen
    b.silenced = b.silNext; b.silNext = false;   // Neugieriger Ball: Fähigkeiten des Gegners aus (wirkt mit einem Schritt Verzögerung)
    if (b.stun <= 0 && b.def.update && !b.silenced) b.def.update(b, sim);
    if (!b.noMove) moveBall(sim, b);
  }
  // Ball gegen Ball: abprallen (Tempo bleibt), bei Gegnern Kontaktschaden
  const n = balls.length;
  for (let i = 0; i < n; i++) {
    const a = balls[i];
    if (a.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = balls[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rs = a.r + b.r;
      if (dx * dx + dy * dy >= rs * rs) continue;
      if (a.st.ghost || b.st.ghost) continue;
      const grabbed = (a.st.grab && a.st.grab.id === b.id) || (b.st.grab && b.st.grab.id === a.id);
      if (!grabbed) {
        const d = Math.sqrt(dx * dx + dy * dy) || .0001, nx = dx / d, ny = dy / d, over = (rs - d) / 2;
        a.x -= nx * over; a.y -= ny * over; b.x += nx * over; b.y += ny * over;
        const va = a.vx * nx + a.vy * ny;
        if (va > 0) { a.vx -= 2 * va * nx; a.vy -= 2 * va * ny; }
        const vb = b.vx * nx + b.vy * ny;
        if (vb < 0) { b.vx -= 2 * vb * nx; b.vy -= 2 * vb * ny; }
        clampBall(a, sim); clampBall(b, sim);
      }
      if (a.team !== b.team) { dealContact(sim, a, b); dealContact(sim, b, a); }
    }
  }
  // Objekte
  const objs = sim.objs;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (!o.dead) sim.OBJS[o.k].update(o, sim);
  }
  let j = 0;
  for (let i = 0; i < objs.length; i++) if (!objs[i].dead) objs[j++] = objs[i];
  objs.length = j;
  // Wut: nach ENRAGE_T verlieren alle Bälle zunehmend Leben, damit jeder Kampf endet
  if (sim.t > ENRAGE_T) {
    const k = .012 * (1 + (sim.t - ENRAGE_T) / 15) * DT;
    for (const b of balls) if (!b.dead) b.hp -= b.maxHp * k;
  }
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b.dead && b.hp <= 0) kill(sim, b);
  }
  // Minihelfer zählen nicht als Team-Mitglied: ist ihr Herr besiegt, verschwinden sie
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (!b.dead && b.def.minion) { const o = sim.byId[b.st.boss]; if (!o || o.dead) { b.dead = true; b.hp = 0; fx(sim, 'die', b.x, b.y, b.r, b.type); } }
  }
  // Sieger?
  const alive = {};
  let teams = 0;
  for (const b of balls) if (!b.dead && !b.def.minion && !alive[b.team]) { alive[b.team] = 1; teams++; }
  for (const tm of Object.keys(sim.teamMax)) if (!alive[tm] && !sim.elim.some(e => e.team === Number(tm))) sim.elim.push({ team: Number(tm), step: sim.step });
  if (teams <= 1) {
    sim.over = true;
    if (teams === 1) { sim.winner = Number(Object.keys(alive)[0]); sim.reason = 'ko'; }
    else { sim.winner = -1; sim.reason = 'doppel'; }   // beide gleichzeitig K.O.: Unentschieden, niemand verliert ein Leben
  } else if (sim.t >= MAX_T) {
    const sum = {};
    for (const b of balls) if (!b.dead) sum[b.team] = (sum[b.team] || 0) + b.hp;
    let best = -1, bf = -1;
    for (const tm of Object.keys(alive)) {
      const f = (sum[tm] || 0) / (sim.teamMax[tm] || 1);
      if (f > bf + 1e-9) { bf = f; best = Number(tm); }
      else if (Math.abs(f - bf) <= 1e-9 && sim.rng() < .5) best = Number(tm);
    }
    sim.over = true; sim.winner = best; sim.reason = 'zeit';
  }
}

export function runToEnd(sim) {
  let guard = Math.ceil(MAX_T / DT) + 10;
  while (!sim.over && guard-- > 0) stepSim(sim);
  // Anteil verbleibender Lebenspunkte je Team (für Mehrspieler-Kämpfe, die auf Zeit enden)
  const fr = {};
  for (const tm of Object.keys(sim.teamMax)) fr[tm] = 0;
  for (const b of sim.balls) if (!b.dead) fr[b.team] += b.hp / (sim.teamMax[b.team] || 1);
  return { winner: sim.winner, steps: sim.step, t: sim.t, reason: sim.reason, elim: sim.elim, frac: fr };
}
