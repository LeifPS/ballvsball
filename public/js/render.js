// Zeichnen der Kampf-Arena und des Ballbox-Minispiels.
import { BOX } from './engine.js';
import { SEGS, PEGS, BW, BH, BR, EXIT_Y } from './boxsim.js';
import { DEFS, RARITY } from './balls.js';
import { INK, g, setTarget, mkSprite, spr, frameSet, line, poly, ring, lopsided, circPoly, wash, hatchPoly, drawText, T, Zmk, curve } from './pen.js';
import { drawBall, drawObj, drawFx, addFx, bodySprite, liveRing, STAR, SPARK, HEART, HEART0, R0 } from './art.js';

const GROUND = { puddle: 1, fire: 1, spike: 1, bomb: 1, meteor: 1 };
export const TEAM_COL = ['#3b7fd4', '#d33a3a'];

export function drawFrame(ctx, fs, x, y, f) {
  ctx.drawImage(fs.fr[((f % 3) + 3) % 3], x - fs.M, y - fs.M, fs.w, fs.h);
}

// Arena auf ctx an Position (ax, ay) mit Kantenlänge AS
export function drawArena(ctx, ax, ay, AS, sim, tf, tm, dt, mySlot, players) {
  const old = setTarget(ctx);
  T.f = tf;
  const fs = frameSet('arena', AS, AS, '#fffdf6', null, 3.4);
  drawFrame(ctx, fs, ax, ay, tf);
  ctx.save();
  ctx.beginPath(); ctx.rect(ax + 2, ay + 2, AS - 4, AS - 4); ctx.clip();
  ctx.translate(ax, ay); const k = AS / BOX; ctx.scale(k, k);
  for (const e of sim.fx) addFx(e);
  sim.fx.length = 0;
  const objs = sim.objs;
  for (let i = 0; i < objs.length; i++) if (GROUND[objs[i].k]) drawObj(objs[i], sim, tf, tm);
  const myTeam = players && mySlot >= 0 ? players[mySlot].team : 0;
  for (const b of sim.balls) {
    if (b.dead) continue;
    const mine = b.team === myTeam;
    liveRing(b.x, b.y, b.r + 3.5, 2.2, mine ? TEAM_COL[0] : TEAM_COL[1], tf, b.id);
    drawBall(b, sim, tf, tm);
  }
  for (let i = 0; i < objs.length; i++) if (!GROUND[objs[i].k]) drawObj(objs[i], sim, tf, tm);
  drawFx(dt, tf);
  ctx.restore();
  setTarget(old);
}

// HP-Balken unter der Arena; gibt die verbrauchte Höhe zurück
export function drawHud(ctx, x, y, W, sim, players, mySlot, tf) {
  const old = setTarget(ctx);
  T.f = tf;
  const n = players.length, cols = 2, rows = Math.ceil(n / cols), cw = (W - 12) / cols, rh = 50;
  const myTeam = players[mySlot] ? players[mySlot].team : 0;
  // Reihenfolge: eigenes Team links
  const order = players.slice().sort((a, b) => (a.team === myTeam ? 0 : 1) - (b.team === myTeam ? 0 : 1) || a.slot - b.slot);
  order.forEach((p, i) => {
    const col = n === 2 ? i : (p.team === myTeam ? 0 : 1), row = n === 2 ? 0 : (i % 2);
    const px = x + col * (cw + 12), py = y + row * rh;
    let hp = 0, mx = 0, any = false;
    for (const b of sim.balls) if (b.slot === p.slot) { mx += b.maxHp; if (!b.dead) { hp += Math.max(0, b.hp); any = true; } }
    const base = sim.slotMax && sim.slotMax[p.slot] || mx || 1;
    const frac = Math.max(0, Math.min(1, hp / base));
    const first = sim.balls.find(b => b.slot === p.slot);
    const nm = (p.slot === mySlot ? 'Du' : p.name) + ' - ' + (first ? DEFS[first.type].name : '');
    drawText(nm, px + 2, py + 8, 13, p.team === myTeam ? TEAM_COL[0] : TEAM_COL[1], 'left', cw - 4);
    const bw = cw - 8;
    const fs = frameSet('barx', bw, 14, null, null, 2.3);
    ctx.save();
    ctx.beginPath(); ctx.rect(px + 3, py + 19, Math.max(0, (bw - 6) * frac), 12); ctx.clip();
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(px + 3, py + 19, bw - 6, 12);
    ctx.fillStyle = p.team === myTeam ? '#8fbdf2' : '#f2a49c'; ctx.fillRect(px + 3, py + 19, (bw - 6) * frac, 12);
    ctx.fillStyle = 'rgba(43,33,24,.12)';
    for (let hx = 0; hx < bw; hx += 6) { ctx.fillRect(px + 3 + hx, py + 19, 1.4, 12); }
    ctx.restore();
    drawFrame(ctx, fs, px + 2, py + 17, tf);
    if (!any) drawText('weg', px + bw / 2, py + 25, 12, INK, 'center');
  });
  setTarget(old);
  return rows * rh;
}

/* ---------- Ballbox ---------- */
let boardSprite = null;
function board() {
  if (boardSprite) return boardSprite;
  boardSprite = mkSprite(900, BW + 30, BH + 30, 15, 15, Z => {
    const top = -40;
    SEGS.forEach(s => line(Z, s[0], Math.max(s[1], top), s[2], s[3], 3.4, INK, { over: 3, bow: .01 }));
    line(Z, 126, 372, 126, 392, 3, INK, { over: 0, bow: 0 }); line(Z, BW - 126, 372, BW - 126, 392, 3, INK, { over: 0, bow: 0 });
    PEGS.forEach(p => { const rf = lopsided(Z, p[2], 1.2); wash(Z, circPoly(rf, p[0], p[1], 12), '#e0d4bc', 1); ring(Z, rf, p[0], p[1], 2.2, INK); });
  });
  return boardSprite;
}
export const BOX_H = BH + 40;
export function drawBox(ctx, W, s, cands, tm, tf, hi) {
  const old = setTarget(ctx);
  T.f = tf;
  const k = W / BW;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(0, 40);
  // Hintergrundfläche
  ctx.fillStyle = 'rgba(255,253,246,.9)'; ctx.fillRect(0, -40, BW, BH + 40);
  const B = board();
  ctx.drawImage(B.fr[tf % 3], -B.ox, -B.oy, B.w, B.h);
  // Öffnung markieren
  for (let i = 0; i < 3; i++) spr(STAR(), BW / 2 + (i - 1) * 16, EXIT_Y + 16 + (tf + i) % 2 * 2, tf + i, .6);
  s.balls.forEach((b, i) => {
    const type = cands[i], rar = RARITY[DEFS[type].rarity];
    const first = s.order[0] === i;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    spr(bodySprite(type), 0, 0, tf + i, BR / R0 * 1.05);
    ctx.restore();
    liveRing(b.x, b.y, BR + 1.5, 2, rar.color, tf, i + 3);
    if (hi === i) { spr(STAR(), b.x, b.y - BR - 8, tf, .9); liveRing(b.x, b.y, BR + 5, 2.4, '#e0a800', tf, i); }
  });
  ctx.restore();
  setTarget(old);
}
