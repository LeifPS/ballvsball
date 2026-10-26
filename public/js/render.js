// Arena und Ballbox-Minispiel zeichnen.
import { BOX } from './engine.js';
import { SEGS, PEGS, BW, BH, BR, EXIT_Y } from './boxsim.js';
import { DEFS, RARITY } from './engine.js';
import { INK, DPR, mkSprite, sketchCtx, strSeed } from './sk.js';
import { bodySprite, drawBall, drawObj, drawFx, addFx, drawHpBar, ringJ, star, fxState, GROUND } from './art.js';
import { R0 } from './ballart.js';

export const TEAM_COL = ['#2b6fd0', '#d33a3a'];

/* ---------- Arena ---------- */
const AR = new Map();
function arenaSprite(AS) {
  AS = Math.round(AS);
  let sp = AR.get(AS);
  if (sp) return sp;
  const pad = 14, side = AS + pad * 2, fr = [], sc = Math.min(2, DPR);
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(side * sc);
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(pad, pad);
    x.lineJoin = x.lineCap = 'round';
    // Boden
    const sk = sketchCtx(x, 3.3 + f * 1.7, AS * .35); x.strokeStyle = INK; x.lineWidth = 4; sk.lineWidth = 4;
    x.fillStyle = '#efe3bf'; x.fillRect(0, 0, AS, AS);
    // Papierkörnung und Tupfen (fest, nur leicht verschoben)
    let seed = 99; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(160,125,60,' + (.06 + R() * .1) + ')'; const rr = 1 + R() * 2.4; x.beginPath(); x.arc(R() * AS, R() * AS, rr, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(29,39,66,.14)'; x.lineWidth = 1.6;
    for (let i = 0; i < 14; i++) { const px = R() * (AS - 30) + 15, py = R() * (AS - 30) + 15; x.beginPath(); x.moveTo(px - 4, py + 2); x.lineTo(px, py - 5); x.lineTo(px + 4, py + 2); x.stroke(); }
    // Mittellinie
    x.setLineDash([8, 10]); x.strokeStyle = 'rgba(29,39,66,.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(AS / 2, 6); x.lineTo(AS / 2, AS - 6); x.stroke(); x.setLineDash([]);
    // Rand
    x.strokeStyle = INK; x.lineWidth = 4.2; sk.beginPath(); sk.rect(0, 0, AS, AS); sk.stroke();
    x.lineWidth = 2; x.globalAlpha = .6; const sk2 = sketchCtx(x, 8.1 + f * 2.3, AS * .35); sk2.lineWidth = 2; sk2.beginPath(); sk2.rect(-4, -4, AS + 8, AS + 8); sk2.stroke(); x.globalAlpha = 1;
    fr.push(cv);
  }
  sp = { fr, pad, side };
  AR.set(AS, sp);
  return sp;
}
export function drawArenaFrame(g, ax, ay, AS, tf) {
  const sp = arenaSprite(AS);
  g.drawImage(sp.fr[((tf % 3) + 3) % 3], ax - sp.pad, ay - sp.pad, sp.side, sp.side);
}
let shk = 0;
// Arena an (ax, ay) mit Kantenlänge AS. over = {noFxAdvance}
export function drawArena(g, ax, ay, AS, sim, tf, tm, dt, mySlot, players, opt) {
  opt = opt || {};
  drawArenaFrame(g, ax, ay, AS, tf);
  g.save();
  g.beginPath(); g.rect(ax + 2, ay + 2, AS - 4, AS - 4); g.clip();
  // Wackeln
  if (fxState.shake > .05) { g.translate((Math.random() - .5) * fxState.shake * 1.6, (Math.random() - .5) * fxState.shake * 1.6); fxState.shake *= Math.pow(.02, dt); }
  g.translate(ax, ay); const k = AS / BOX; g.scale(k, k);
  for (const e of sim.fx) addFx(e);
  sim.fx.length = 0;
  const objs = sim.objs, myTeam = players && mySlot >= 0 && players[mySlot] ? players[mySlot].team : 0;
  for (let i = 0; i < objs.length; i++) if (GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  for (const b of sim.balls) {
    if (b.dead) continue;
    const col = b.team === myTeam ? TEAM_COL[0] : TEAM_COL[1];
    g.save(); g.globalAlpha = .9; ringJ(g, b.x, b.y + 1, b.r + 4, 2.6, col, tf, b.id); g.restore();
  }
  for (const b of sim.balls) if (!b.dead) drawBall(g, b, sim, tf, tm, opt.tint && opt.tint[b.id]);
  for (let i = 0; i < objs.length; i++) if (!GROUND[objs[i].k]) drawObj(g, objs[i], sim, tf, tm);
  for (const b of sim.balls) if (!b.dead && !opt.noBars) drawHpBar(g, b, myTeam, '#4f90e8', '#e4574a');
  drawFx(g, dt, tf);
  g.restore();
}

/* ---------- Ballbox ---------- */
const BOARD = {};
export const BOX_H = BH + 40;
function boardSprite(col) {
  if (BOARD[col]) return BOARD[col];
  const sc = Math.min(2, DPR), W = BW + 40, H = BH + 110, fr = [];
  for (let f = 0; f < 3; f++) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(W * sc); cv.height = Math.ceil(H * sc);
    const x = cv.getContext('2d'); x.scale(sc, sc); x.translate(20, 70);
    x.lineJoin = x.lineCap = 'round';
    const sk = sketchCtx(x, strSeed(col) + f * 1.9, 120); x.strokeStyle = INK; x.lineWidth = 3.6; sk.lineWidth = 3.6;
    // Hintergrund in Boxfarbe, begrenzt durch Wände
    x.save(); x.beginPath(); x.moveTo(0, -60); x.lineTo(BW, -60); x.lineTo(BW, 175); x.lineTo(BW - 135, 372); x.lineTo(BW - 135, 392); x.lineTo(135, 392); x.lineTo(135, 372); x.lineTo(0, 175); x.closePath(); x.clip();
    x.fillStyle = '#f6efd9'; x.fillRect(-20, -70, W, H);
    x.globalAlpha = .22; x.fillStyle = col; x.fillRect(-20, -70, W, H); x.globalAlpha = 1;
    x.strokeStyle = 'rgba(29,39,66,.08)'; x.lineWidth = 1.5; for (let i = -70; i < 420; i += 22) { x.beginPath(); x.moveTo(-20, i); x.lineTo(BW + 20, i + 10); x.stroke(); }
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 3.6;
    sk.beginPath(); sk.moveTo(0, -60); sk.lineTo(0, 175); sk.lineTo(135, 372); sk.lineTo(135, 392); sk.stroke();
    sk.beginPath(); sk.moveTo(BW, -60); sk.lineTo(BW, 175); sk.lineTo(BW - 135, 372); sk.lineTo(BW - 135, 392); sk.stroke();
    PEGS.forEach(p => { x.beginPath(); x.arc(p[0], p[1], p[2], 0, 7); x.fillStyle = '#d9c9a0'; x.fill(); sk.beginPath(); sk.arc(p[0], p[1], p[2], 0, 7); sk.lineWidth = 2.4; sk.stroke(); });
    fr.push(cv);
  }
  return (BOARD[col] = { fr, W, H });
}
export function drawBox(g, W, s, cands, tm, tf, hi, col) {
  const k = W / BW;
  g.save(); g.scale(k, k); g.translate(0, 40);
  const B = boardSprite(col || '#d9a441');
  g.drawImage(B.fr[((tf % 3) + 3) % 3], -20, -70, B.W, B.H);
  // Öffnung markieren
  for (let i = 0; i < 3; i++) star(g, BW / 2 + (i - 1) * 18, EXIT_Y + 18 + ((tf + i) % 2) * 2, 5, '#ffd45a', tm * 2 + i);
  s.balls.forEach((b, i) => {
    const type = cands[i], rar = RARITY[DEFS[type].rarity], sp = bodySprite(type);
    g.save(); g.translate(b.x, b.y); g.rotate(b.rot * .6);
    const w = BR * 2 * 3.1, f = (tf + i) % 3;
    g.drawImage(sp.fr[f], -w / 2, -w / 2, w, w); g.restore();
    ringJ(g, b.x, b.y, BR + 1.5, 2.2, rar.color, tf, i + 3);
    if (hi === i) { star(g, b.x, b.y - BR - 9, 6, '#ffd45a', tm * 3); ringJ(g, b.x, b.y, BR + 5, 2.6, '#e0a800', tf, i); }
  });
  g.restore();
}
