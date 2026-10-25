// Zweite Fähigkeit der epischen und legendären Bälle: je seltener, desto stärker und vielschichtiger.
// Jede Erweiterung läuft zusätzlich zur bisherigen Fähigkeit (siehe balls.js / balls2.js). Deterministisch.
import { DT, PI, dsin, dcos, len, hurt, stun, fx, rand, setDir, nearestEnemy, heal, burn } from './core.js';
import { DEFS, newObj, clampPt, foes } from './balls.js';
import { shot, wave } from './balls2.js';

// Zeitgeber für die zweite Fähigkeit
const xt = (b, next) => { b.st.x2 -= DT; if (b.st.x2 > 0) return false; b.st.x2 = next; return true; };
function chain(orig, extra) { return orig ? function () { const r = orig.apply(this, arguments); extra.apply(this, arguments); return r; } : extra; }
function aug(id, desc, ex) {
  const d = DEFS[id];
  d.desc = desc;
  d.init = chain(d.init, function (b, sim) { b.st.x2 = ex.first || 3; if (ex.init) ex.init(b, sim); });
  if (ex.update) d.update = chain(d.update, ex.update);
  if (ex.onContact) d.onContact = chain(d.onContact, ex.onContact);
  if (ex.onHurt) d.onHurt = chain(d.onHurt, ex.onHurt);
}
const ring = (sim, b, n, mk) => { const base = Math.floor(rand(sim) * 40); for (let i = 0; i < n; i++) { const a = (base + i * 360 / n) * PI / 180; mk(dcos(a), dsin(a), i); } };
const around = (sim, b, r, f) => { for (const e of foes(sim, b.team)) if (len(e.x - b.x, e.y - b.y) < r + e.r) f(e); };

/* ================= Episch ================= */
aug('vampir', 'Klammert sich 3 Sekunden an den Gegner und saugt Leben. Beim Loslassen entlädt sich eine Blutwelle, die schleudert und betäubt.', {
  update(b, sim) {
    if (b.st.xg && !b.st.grab) { fx(sim, 'nova', b.x, b.y, 70); wave(sim, b, b.x, b.y, { vis: 'phase', sp: 220, maxR: 85, dmg: 9 + sim.t * .1, push: 1, stun: .4 }); }
    b.st.xg = !!b.st.grab;
  }
});
aug('riese', 'Riesig, langsam und zäh. Er wächst weiter und stampft alle paar Sekunden: eine Erdbebenwelle schleudert und betäubt.', {
  first: 3, update(b, sim) { if (!xt(b, 4.5)) return; fx(sim, 'boom', b.x, b.y, b.r * 2); wave(sim, b, b.x, b.y, { vis: 'quake', sp: 190, maxR: 120, dmg: 12 + sim.t * .15, push: 1, stun: .5 }); }
});
aug('saege', 'Schleudert Sägeblätter, die oft abprallen. Alle paar Sekunden gibt es zusätzlich einen Fächer aus fünf Blättern auf den Gegner.', {
  first: 4, update(b, sim) {
    if (!xt(b, 5)) return; const e = nearestEnemy(sim, b); if (!e) return;
    const dx = e.x - b.x, dy = e.y - b.y, l = len(dx, dy) || 1;
    for (let i = -2; i <= 2; i++) {
      const c = dcos(i * .26), s = dsin(i * .26), vx = (dx / l * c - dy / l * s) * 185, vy = (dx / l * s + dy / l * c) * 185;
      newObj(sim, 'saw', b, b.x, b.y, { vx, vy, r: 9, dmg: 7 + sim.t * .1, bounces: 5, rot: 0 });
    }
  }
});
aug('schwarm', 'Bienen verfolgen den Gegner. Alle paar Sekunden ruft die Königin einen Ring aus acht Bienen.', {
  first: 4, update(b, sim) { if (!xt(b, 6)) return; ring(sim, b, 8, (cx, cy) => newObj(sim, 'bee', b, b.x, b.y, { vx: cx * 110, vy: cy * 110, speed: 110, r: 4.5, dmg: 3 + sim.t * .05, life: 6, proj: true })); }
});
aug('eis', 'Frostgeschosse frieren den Gegner ein. Zusätzlich sendet er eine Frostwelle, die in der Nähe alles kurz einfriert.', {
  first: 4, update(b, sim) { if (!xt(b, 6)) return; fx(sim, 'split', b.x, b.y, b.r); wave(sim, b, b.x, b.y, { vis: 'shock', sp: 170, maxR: 105, dmg: 4, stun: .8 }); }
});
aug('meteor', 'Ruft Meteore auf die Stelle, an der der Gegner gleich ist. Alle paar Sekunden regnet ein ganzer Meteorschauer.', {
  first: 5, update(b, sim) {
    if (!xt(b, 7)) return; const e = nearestEnemy(sim, b); if (!e) return;
    for (let i = 0; i < 4; i++) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .9 + (rand(sim) - .5) * 110), clampPt(e.y + e.vy * .9 + (rand(sim) - .5) * 110), { fuse: .9 + i * .2, r: 40, dmg: 13 + sim.t * .18 });
  }
});
aug('spiegel', 'Wirft Kontakt-, Fallen-, Flächen- und jetzt auch Geschossschaden zurück. Alle paar Sekunden stößt ein Spiegelpuls Gegner weg.', {
  first: 5, update(b, sim) { if (!xt(b, 8)) return; fx(sim, 'block', b.x, b.y, 0); wave(sim, b, b.x, b.y, { vis: 'shock', sp: 200, maxR: 100, dmg: 9, push: 1 }); },
  onHurt(t, amt, src, kind, sim) { if (src && !src.dead && kind === 'proj') hurt(sim, src, amt * .4, t, 'reflect'); }
});
aug('wuchs', 'Heilt sich dauernd. Alle paar Sekunden blüht er auf: Er heilt zusätzlich und eine Wurzelwelle schleudert Gegner weg.', {
  first: 5, update(b, sim) { if (!xt(b, 6)) return; heal(sim, b, 10 + sim.t * .1); fx(sim, 'rise', b.x, b.y, 0); wave(sim, b, b.x, b.y, { vis: 'quake', sp: 170, maxR: 90, dmg: 8, push: 1 }); }
});
aug('magier', 'Drei Zauberblitze folgen dem Gegner. Alle paar Sekunden zeichnet er ein Siegel: eine Welle, die betäubt.', {
  first: 5, update(b, sim) { if (!xt(b, 8)) return; fx(sim, 'nova', b.x, b.y, 80); wave(sim, b, b.x, b.y, { vis: 'phase', sp: 230, maxR: 125, dmg: 12 + sim.t * .1, stun: .8, push: 1 }); }
});
aug('schwarzloch', 'Saugt Gegner und Geschosse an und zerreibt sie. Alle paar Sekunden zieht er alle Gegner in der Nähe zu sich.', {
  first: 5, update(b, sim) { if (!xt(b, 8)) return; fx(sim, 'grab', b.x, b.y, 0); around(sim, b, 170, e => { setDir(e, b.x - e.x, b.y - e.y); hurt(sim, e, 9 + sim.t * .1, b, 'area'); }); }
});
aug('chili', 'Scharfe Chilis setzen Gegner in Brand. Alle paar Sekunden schießt er einen Ring aus Chilis in alle Richtungen.', {
  first: 4, update(b, sim) { if (!xt(b, 5.5)) return; ring(sim, b, 6, (cx, cy) => newObj(sim, 'bullet', b, b.x, b.y, { vx: cx * 230, vy: cy * 230, r: 5, dmg: 4 + sim.t * .05, life: 1.8, proj: true, vis: 'chili', burnS: 3, burnD: 5 + sim.t * .06 })); }
});
aug('mixer', 'Rotierende Quirle zerschneiden alles in Reichweite. Alle paar Sekunden schleudert er vier Klingen weg.', {
  first: 4, update(b, sim) { if (!xt(b, 5)) return; ring(sim, b, 4, (cx, cy) => newObj(sim, 'saw', b, b.x, b.y, { vx: cx * 190, vy: cy * 190, r: 8, dmg: 7 + sim.t * .1, bounces: 4, rot: 0 })); }
});
aug('teddy', 'Weich, zäh und heilt sich langsam. Bei Berührung umarmt er: Der Gegner ist kurz betäubt und Teddy heilt sich.', {
  first: 0, init(b) { b.st.hug = 0; },
  onContact(b, o, sim) { if (sim.t < b.st.hug || o.dead) return; b.st.hug = sim.t + 4; stun(sim, o, .7); heal(sim, b, 9); }
});
aug('lego', 'Lässt Bausteine liegen. Alle paar Sekunden baut er eine Mauer aus drei Sprengsteinen vor sich.', {
  first: 4, update(b, sim) {
    if (!xt(b, 6)) return; const e = nearestEnemy(sim, b); if (!e) return;
    const dx = e.x - b.x, dy = e.y - b.y, l = len(dx, dy) || 1, px = -dy / l, py = dx / l;
    for (let i = -1; i <= 1; i++) newObj(sim, 'mine', b, clampPt(b.x + dx / l * 40 + px * i * 26), clampPt(b.y + dy / l * 40 + py * i * 26), { r: 7, arm: .3, life: 10, trig: 14, er: 30, dmg: 14 + sim.t * .2, vis: 'brick', fxk: 'brickboom' });
  }
});
aug('lava', 'Zieht eine Lavaspur, in der Gegner brennen. Alle paar Sekunden bricht er aus: eine Feuerwelle setzt alles in Brand.', {
  first: 4, update(b, sim) { if (!xt(b, 6)) return; fx(sim, 'boom', b.x, b.y, 40); wave(sim, b, b.x, b.y, { vis: 'flame', sp: 190, maxR: 110, dmg: 8, burnS: 3, burnD: 5 + sim.t * .05 }); }
});
aug('kristall', 'Schleudert Splitter in alle Richtungen und zerspringt beim Tod. Alle paar Sekunden feuert er ein Prisma: drei durchbohrende Strahlen.', {
  first: 3, update(b, sim) { if (!xt(b, 4.5)) return; const e = nearestEnemy(sim, b); if (!e) return; for (let i = -1; i <= 1; i++) shot(sim, b, e, { speed: 280, r: 5, dmg: 7 + sim.t * .08, vis: 'shard', pierce: 1, pcd: .5, life: 2.2, lead: .4 }, i * .2); }
});
aug('hexe', 'Braut Tränke und Kessel. Alle paar Sekunden verhext sie den Gegner: betäubt und vergiftet.', {
  first: 5, update(b, sim) { if (!xt(b, 9)) return; const e = nearestEnemy(sim, b); if (!e) return; stun(sim, e, .9); burn(sim, e, b, 4, 5 + sim.t * .05); fx(sim, 'split', e.x, e.y, 20); }
});

/* ================= Legendär (mehrschichtig) ================= */
aug('drache', 'Speit Feuerstrahlen und hinterlässt Flammen. Alle paar Sekunden stürzt er sich als Feuersturm auf den Gegner: drei Meteore.', {
  first: 5, update(b, sim) {
    if (!xt(b, 8)) return; const e = nearestEnemy(sim, b); if (!e) return;
    for (let i = 0; i < 3; i++) newObj(sim, 'meteor', b, clampPt(e.x + e.vx * .8 + (rand(sim) - .5) * 80), clampPt(e.y + e.vy * .8 + (rand(sim) - .5) * 80), { fuse: .8 + i * .25, r: 44, dmg: 16 + sim.t * .2, fxk: 'boom' });
  }
});
aug('phoenix', 'Lässt Glut zurück und kehrt einmal aus dem Tod zurück. Alle paar Sekunden brennt eine Feuerwelle und heilt ihn.', {
  first: 4, update(b, sim) { if (!xt(b, 6)) return; fx(sim, 'boom', b.x, b.y, 45); wave(sim, b, b.x, b.y, { vis: 'flame', sp: 210, maxR: 125, dmg: 7, burnS: 3, burnD: 5 + sim.t * .06 }); heal(sim, b, 7); }
});
aug('supernova', 'Lädt sich auf und explodiert in einer Druckwelle. Dazwischen schleudert er Sternensplitter in acht Richtungen.', {
  first: 4, update(b, sim) { if (!xt(b, 5)) return; ring(sim, b, 8, (cx, cy) => newObj(sim, 'bullet', b, b.x, b.y, { vx: cx * 240, vy: cy * 240, r: 4.5, dmg: 6 + sim.t * .08, life: 1.7, proj: true, vis: 'gold', pierce: 1, pcd: .5 })); }
});
aug('herd', 'Hinterlässt glühende Herdplatten und flambiert in Wellen. Alle paar Sekunden gibt es ein Festmahl: Flammen um den Gegner und Heilung.', {
  first: 5, update(b, sim) {
    if (!xt(b, 7)) return; const e = nearestEnemy(sim, b); if (!e) return;
    for (let i = 0; i < 4; i++) newObj(sim, 'fire', b, clampPt(e.x + (rand(sim) - .5) * 90), clampPt(e.y + (rand(sim) - .5) * 90), { r: 15, life: 3.5, dps: 6 + sim.t * .06 });
    heal(sim, b, 8); fx(sim, 'rise', b.x, b.y, 0);
  }
});
aug('pokal', 'Feuert goldene Strahlen, die ihm Leben geben. Alle paar Sekunden folgt der Siegerkranz: acht Strahlen rundherum.', {
  first: 5, update(b, sim) { if (!xt(b, 6)) return; ring(sim, b, 8, (cx, cy) => newObj(sim, 'bullet', b, b.x, b.y, { vx: cx * 270, vy: cy * 270, r: 5, dmg: 6 + sim.t * .08, life: 2, proj: true, vis: 'gold', pierce: 1, pcd: .5, leech: .6 })); }
});
aug('regenbogen', 'Wirkt Feuer, Frost, Blitz und Heilung. Alle paar Sekunden schießt er einen Farbfächer mit sieben Strahlen: betäubend, brennend oder heilend.', {
  first: 5, update(b, sim) {
    if (!xt(b, 6)) return; const e = nearestEnemy(sim, b); if (!e) return;
    for (let i = -3; i <= 3; i++) { const k = (i + 3) % 3; shot(sim, b, e, { speed: 270, r: 5, dmg: 5 + sim.t * .07, vis: 'gold', life: 2.2, lead: .4, stun: k === 0 ? .7 : 0, burnS: k === 1 ? 3 : 0, burnD: 5, leech: k === 2 ? .8 : 0 }, i * .17); }
  }
});
aug('sensenmann', 'Schleudert seine Sense, die bei fast Besiegten doppelt trifft. Alle paar Sekunden erntet er Seelen: je weniger Leben ein Gegner hat, desto mehr Schaden, und er heilt sich.', {
  first: 5, update(b, sim) {
    if (!xt(b, 6)) return; let tot = 0;
    around(sim, b, 140, e => { tot += hurt(sim, e, 8 + 24 * (1 - Math.max(0, e.hp) / e.maxHp), b, 'area'); });
    if (tot > 0) { heal(sim, b, tot * .4); fx(sim, 'boom', b.x, b.y, 70); }
  }
});
