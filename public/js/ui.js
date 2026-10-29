// Oberfläche: Anmeldung, Startseite, Sammlung, Ballboxen, Markt, Handel, Freunde und Kampfablauf.
import { DEFS, BALL_IDS, RARITY, DT, BOX, MAX_STARS, STAR_BONUS, createSim, stepSim, ballsInBox } from './engine.js';
import { createBox, stepBox, BW, layoutOf } from './boxsim.js';
import { BOX_LIST, BOX_BY_ID, BOX_RARITY, boxActive, UP_COST } from './boxes.js';
import { DPR, INK, gi, mkSprite, spr } from './sk.js';
import { boxArt } from './boxart.js';
import { drawBallIn, clearFx, fxState, burst, star } from './art.js';
import { drawArena, drawBox, BOX_H, TEAM_COL, PLAYER_COL } from './render.js';
import { unlock, sfx, getMode, setMode, setScene } from './audio.js';

const $ = s => document.querySelector(s);
const SCREEN = $('#screen'), OVER = $('#overlay'), TOAST = $('#toast');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  token: null, me: null, ws: null, wsOK: false, screen: '', match: null, view: null, skew: 0,
  col: { q: '', rar: 'all', box: 'all', sort: 'rar', own: false },
  mk: { tab: 'buy', rarity: '', q: '', sort: 'low', page: 0, items: [], total: 0 },
  tr: { tab: 'in' }, tnew: { name: '', player: null, give: new Set(), want: new Set() }, room: null, timers: [], kicked: false
};
let store = null;
try { store = window.localStorage; } catch (e) { store = null; }
const mem = {};
const lget = k => { try { return store ? store.getItem(k) : mem[k]; } catch (e) { return mem[k]; } };
const lset = (k, v) => { try { if (store) store.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } };

const ERR = {
  net: 'Keine Verbindung zum Server.', auth: 'Anmeldung fehlgeschlagen.', need_name: 'Bitte wähle einen Namen.',
  name_invalid: 'Name: 3 bis 16 Zeichen, nur Buchstaben, Zahlen, Leerzeichen, - und _.', name_taken: 'Dieser Name ist schon vergeben.',
  code_bad: 'Der Code stimmt nicht oder ist abgelaufen.', has_progress: 'Dieses Gerät hat schon einen Spielstand mit Kämpfen. Lösche zuerst dort das Konto.',
  maintenance: 'Mehrspieler ist wegen Wartungsarbeiten gerade gesperrt.', boss_done: 'Starte einen neuen Versuch.', boss_used: 'Diesen Ball hast du schon benutzt.', rule: 'Dieser Ball erfüllt die Regel nicht.', daily_taken: 'Heute schon abgeholt.', no_coins: 'Nicht genug Münzen.', tutorial_box: 'Öffne zuerst deine Standard-Box.', no_tokens: 'Nicht genug Halloween-Marken.', box_over: 'Diese Box gibt es nicht mehr.',
  price_invalid: 'Der Preis muss zwischen 10 und 100000 Münzen liegen.',
  not_yours: 'Das gehört dir nicht (mehr).', locked: 'Dieser Ball ist gerade gesperrt.', min_balls: 'Du musst mindestens 3 verschiedene freie Bälle behalten.',
  gone: 'Das gibt es nicht mehr.', own: 'Das ist dein eigener Ball.', no_player: 'Spieler nicht gefunden.', self: 'Das bist du selbst.',
  empty: 'Das Angebot ist leer.', not_theirs: 'Der Ball gehört dem anderen nicht mehr.', too_many: 'Zu viele offene Angebote.',
  their_coins: 'Der andere hat nicht genug Münzen.', their_min: 'Der andere hätte danach zu wenige verschiedene Bälle.',
  max_stars: 'Schon auf der höchsten Stufe.', need_dupes: 'Dafür fehlen gleiche Bälle.', room_unknown: 'Raum nicht gefunden.', room_full: 'Raum ist voll.', box_unknown: 'Unbekannte Box.', bad: 'Ungültige Anfrage.'
};
const errText = c => ERR[c] || 'Etwas ist schiefgegangen (' + c + ').';
const now = () => Date.now() + S.skew;
const eventLive = () => !!S.me && now() < S.me.eventEnd;

/* ================= Zeichen-Infrastruktur ================= */
const BALLS = new Set();
const coinHTML = n => '<span style="white-space:nowrap"><b>' + n + '</b> ' + gi('coin', 22) + '</span>';
const tokHTML = n => '<span style="white-space:nowrap"><b>' + n + '</b> ' + gi('token', 22) + '</span>';
const priceHTML = b => b.cur === 'tokens' ? tokHTML(b.price) : coinHTML(b.price);
const rarHTML = r => '<span class="rar' + (r === 'mythisch' ? ' myth' : '') + '" style="color:' + RARITY[r].color + '">' + RARITY[r].name + '</span>';
const ball = (type, size, fit, extra) => '<canvas class="ball" data-ball="' + type + '" data-size="' + size + '" data-fit="' + (fit || .62) + '" ' + (extra || '') + '></canvas>';

const starsHTML = (n, size) => n ? '<span class="stars" style="white-space:nowrap">' + Array.from({ length: n }, () => gi('star', size || 15, '#ffd45a')).join('') + '</span>' : '';
function decorate(root) {
  root.querySelectorAll('canvas.ball').forEach(cv => {
    if (cv._init) return; cv._init = 1;
    const s = +cv.dataset.size || 80; cv.width = Math.round(s * DPR); cv.height = Math.round(s * DPR); cv.style.width = s + 'px'; cv.style.height = s + 'px';
    BALLS.add(cv);
  });
  paintBalls(performance.now() / 1000, Math.floor(performance.now() / 143) % 3);
}
function paintBalls(tm, tf) {
  for (const cv of BALLS) {
    if (!cv.isConnected) { BALLS.delete(cv); continue; }
    const ctx = cv.getContext('2d'), s = +cv.dataset.size || 80;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
    drawBallIn(ctx, cv.dataset.ball, s, tm, tf, (+cv.dataset.fit || .62) * 1.28, cv.dataset.dark === '1');
  }
}
let lastTf = -1, lastT = 0;
function loop(ms) {
  requestAnimationFrame(loop);
  const tm = ms / 1000, dt = Math.min(.1, tm - lastT || .016); lastT = tm;
  const tf = Math.floor(tm * 7) % 3;
  if (tf !== lastTf) { lastTf = tf; paintBalls(tm, tf); }
  if (S.view && S.view.frame) S.view.frame(tm, dt, tf);
}

/* ================= Hilfen ================= */
function show(html) {
  clearTimers(); SCREEN.innerHTML = html; window.scrollTo(0, 0); decorate(SCREEN);
  SCREEN.classList.remove('sin'); void SCREEN.offsetWidth; SCREEN.classList.add('sin');   // sanftes Einblenden
}
function setView(v) { if (S.view && S.view.stop) S.view.stop(); S.view = v; }
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }
function every(fn, ms) { const id = setInterval(fn, ms); S.timers.push(id); return id; }
function overlay(html) { OVER.innerHTML = '<div>' + html + '</div>'; OVER.hidden = false; OVER.scrollTop = 0; decorate(OVER); }
function closeOverlay() { OVER.hidden = true; OVER.innerHTML = ''; }
let toastT = 0;
function toast(msg) { TOAST.textContent = msg; TOAST.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { TOAST.hidden = true; }, 2800); }
async function api(path, body) {
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);   // hängende Anfrage gibt nach 20 s auf, damit der Knopf nicht ewig gesperrt bleibt
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-token': S.token }, body: JSON.stringify(body || {}), signal: ac.signal });
    const j = await r.json(); clearTimeout(to);
    if (j.me) setMe(j.me);
    return j;
  } catch (e) { return { err: 'net' }; }
}
function setMe(me) { S.me = me; if (me.now) S.skew = me.now - Date.now(); }
const ballName = t => DEFS[t] ? DEFS[t].name : '?';
const SORT = ['gewoehnlich', 'selten', 'episch', 'legendaer', 'mythisch'];
function typeCounts() {
  const c = {};
  for (const b of S.me.balls) { c[b.type] = c[b.type] || { n: 0, free: 0, list: [] }; c[b.type].n++; if (!b.lock) c[b.type].free++; c[b.type].list.push(b); }
  return c;
}
function topType() {
  let best = null, bo = -1;
  for (const b of S.me.balls) { const o = RARITY[DEFS[b.type].rarity].order; if (o > bo) { bo = o; best = b.type; } }
  return best || 'stachel';
}
function wallet() {
  if (!S.me) return '';   // Gast (geteilte Wiederholung)
  return '<div class="row gap6">' + (eventLive() ? '<div class="pill" title="Kürbisse">' + tokHTML(S.me.tokens) + '</div>' : '') + '<div class="pill">' + coinHTML(S.me.coins) + '</div></div>';
}
function backBar(title, to) {
  return '<div class="row" style="padding-right:50px"><button class="btn sm" style="min-height:44px;padding:2px 14px" data-act="' + (to || 'home') + '">' + gi('arrow', 26) + '</button><h2 class="grow jit">' + esc(title) + '</h2></div><div class="row" style="justify-content:flex-end;margin-top:-4px">' + wallet() + '</div>';
}
function btn(label, act, extra, kind) {
  return '<button class="btn ' + (kind || '') + '" data-act="' + act + '" ' + (extra || '') + '>' + label + '</button>';
}
function timeLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d >= 1 ? 'noch ' + d + (d === 1 ? ' Tag' : ' Tage') + (h ? ' und ' + h + ' Std.' : '') : h >= 1 ? 'noch ' + h + ' Std. ' + (m % 60) + ' Min.' : 'noch ' + m + ' Min.';
}
// Konfetti: Canvas mit Physik (Schwerkraft, Luftwiderstand, Flattern). Stücke sind wie gemalt: wackelige Streifen, Sterne, Kringel, Punkte mit Tuschekante.
const CF = { cv: null, g: null, parts: [], run: false, last: 0 };
function confetti(n) {
  n = Math.round((n || 40) * 1.6);
  if (!CF.cv) {
    CF.cv = document.createElement('canvas'); CF.cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:40;pointer-events:none';
    document.body.appendChild(CF.cv); CF.g = CF.cv.getContext('2d');
  }
  const W = window.innerWidth, H = window.innerHeight, cols = ['#f4c942', '#e0533a', '#4fa3e8', '#5cc45a', '#c06af0', '#ff8aa0', '#ff9a3c'];
  CF.cv.width = Math.round(W * DPR); CF.cv.height = Math.round(H * DPR);
  // Kanonen aus beiden unteren Ecken, stark genug, dass die Stücke bis ganz nach oben fliegen
  const vTop = Math.sqrt(2 * 620 * H);
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0, a = (left ? -66 : -114) * Math.PI / 180 + (Math.random() - .5) * .55, v = vTop * (1.45 + Math.random() * .5);
    CF.parts.push(mkConf(left ? -8 : W + 8, H + 8, Math.cos(a) * v, Math.sin(a) * v, cols, Math.random() * .25));
  }
  if (!CF.run) { CF.run = true; CF.last = performance.now(); requestAnimationFrame(confTick); }
}
// Konfetti-Stücke im Tonlinge-Stil: wacklige Kontur, versetzte Füllung, Buntstift-Schraffur
const CF_SP = {};
function confSprite(kind, col) {
  const key = kind + col;
  return CF_SP[key] || (CF_SP[key] = mkSprite('cf' + key, 36, 22, (c, s) => {
    c.lineWidth = 2.6; c.strokeStyle = INK; c.fillStyle = col;
    const hatch = (x0, y0, x1, y1) => { c.save(); c.lineWidth = 1.3; c.strokeStyle = 'rgba(255,255,255,.65)'; for (let i = 0; i < 4; i++) { const t = i / 3; c.beginPath(); c.moveTo(x0 + (x1 - x0) * t - 3, y1); c.lineTo(x0 + (x1 - x0) * t + 3, y0); c.stroke(); } c.restore(); };
    if (kind === 'strip') { c.beginPath(); c.moveTo(-14, -6); c.lineTo(14, -7); c.lineTo(13, 7); c.lineTo(-15, 6); c.closePath(); c.fill(); c.stroke(); hatch(-10, -4, 10, 4); }
    else if (kind === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); }
    else if (kind === 'dot') { c.beginPath(); c.ellipse(0, 0, 9, 8, .3, 0, 7); c.fill(); c.stroke(); hatch(-5, -4, 5, 4); }
    else { c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.moveTo(-15, 2); c.quadraticCurveTo(-8, -12, 0, 0); c.quadraticCurveTo(8, 12, 15, -2); c.stroke(); c.lineWidth = 3; c.strokeStyle = col; c.stroke(); }
  }, 2));
}
function mkConf(x, y, vx, vy, cols, delay) {
  const kind = ['strip', 'strip', 'star', 'squig', 'dot'][Math.floor(Math.random() * 5)], sz = 10 + Math.random() * 9;
  return { x, y, vx, vy, delay, kind, sz, col: cols[Math.floor(Math.random() * cols.length)], rot: Math.random() * 6.28, vr: (Math.random() - .5) * 12, ph: Math.random() * 6.28, fl: 4 + Math.random() * 5, age: 0, life: 3.2 + Math.random() * 1.6, w: [1, 1, 1, 1, 1, 1, 1, 1].map(() => (Math.random() - .5) * .35) };
}
function confTick(now) {
  const dt = Math.min(.05, (now - CF.last) / 1000); CF.last = now;
  const g = CF.g, W = window.innerWidth, H = window.innerHeight;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CF.cv.width, CF.cv.height); g.scale(DPR, DPR);
  g.lineJoin = g.lineCap = 'round';
  CF.parts = CF.parts.filter(p => {
    if (p.delay > 0) { p.delay -= dt; return true; }
    p.age += dt; if (p.age > p.life || p.y > H + 40) return false;
    p.vy += 620 * dt; p.vx *= Math.pow(.18, dt); p.vy *= Math.pow(.55, dt); p.vy = Math.min(p.vy, 190 + p.sz * 4);   // Luftwiderstand, Fallgeschwindigkeit begrenzt
    p.x += (p.vx + Math.sin(p.age * 3 + p.ph) * 26) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const flip = Math.cos(p.age * p.fl + p.ph), a = Math.min(1, (p.life - p.age) * 2.2);
    g.save(); g.globalAlpha = a; g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, .25 + .75 * Math.abs(flip));
    const k = p.sz / 16;
    g.drawImage(confSprite(p.kind, p.col).fr[Math.floor(p.age * 7 + p.ph * 3) % 3], -18 * k, -18 * k, 36 * k, 36 * k);   // Zeichen-Frames wechseln wie bei den Bällen
    g.restore();
    return true;
  });
  if (CF.parts.length) requestAnimationFrame(confTick); else { CF.run = false; g.clearRect(0, 0, CF.cv.width, CF.cv.height); }
}
function sndIcon() {
  const m = getMode(); $('#snd').innerHTML = gi(m === 2 ? 'speaker' : m === 1 ? 'note0' : 'speaker0', 28);
}

/* ================= Anmeldung ================= */
async function boot() {
  try { await document.fonts.load('20px "Patrick Hand"'); await document.fonts.load('30px "Caveat Brush"'); } catch (e) { }
  requestAnimationFrame(loop);
  sndIcon();
  S.token = lget('bvb_token');
  if (!S.token) { S.token = crypto.randomUUID() + crypto.randomUUID(); lset('bvb_token', S.token); }
  const rp = location.hash.match(/^#replay=([a-z0-9]{6,20})$/);
  if (rp) {
    try { const g = await (await fetch('/api/replay?t=' + rp[1])).json(); if (g.rec) { S.guestRec = g.rec; return showRounds(g.rec, 'Geteilter Kampf', 'logexit', false); } } catch (e) { console.error('Wiederholung', e); }
    history.replaceState(null, '', location.pathname);
  }
  return boot2();
}
async function boot2() {
  const r = await api('/api/login', {});
  if (r.err === 'need_name') return nameScreen('');
  if (r.err) return netError(r.err);
  connectWS(); home();
}
function netError(c) {
  show('<div class="col center"><h1>Ball gegen Ball</h1><p>' + esc(errText(c)) + '</p>' + btn('Nochmal versuchen', 'reload') + '</div>');
}
function nameScreen(err) {
  show('<div class="col" style="margin-top:6vh"><h1 class="jit">Ball gegen Ball</h1><div class="hero bounce">' + ball('stachel', 150, .62) + '</div><div class="panel center"><p>Sammle Bälle und kämpfe gegen andere. Wie willst du heißen?</p></div>' +
    '<div class="inp"><input id="nm" maxlength="16" placeholder="Dein Name" autocomplete="off"></div><div class="err center" id="err">' + esc(err) + '</div>' +
    btn('Los geht\'s', 'register', '', 'pri big') + btn('Ich habe schon einen Spielstand', 'xferin') + '<p class="small center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Dein Gerät merkt sich dein Konto. 3 bis 16 Zeichen.</p></div>');
}

/* ================= Verbindung ================= */
function connectWS() {
  if (S.kicked) return;
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws';
  let ws;
  try { ws = new WebSocket(url); } catch (e) { setTimeout(connectWS, 3000); return; }
  S.ws = ws; S.wsOK = false;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token: S.token }));
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
  ws.onclose = () => { S.wsOK = false; if (S.ws === ws) { setTimeout(connectWS, 2000); if (['queue', 'room'].includes(S.screen)) { S.screen = ''; home(); toast('Verbindung verloren.'); } } };
  ws.onerror = () => { };
  clearInterval(S.pingT); S.pingT = setInterval(() => { if (S.wsOK) wsSend({ t: 'ping' }); }, 25000);
}
function wsSend(o) {
  if (S.wsOK && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o));
  else toast('Verbinde mit dem Server ...');
}
function onMsg(m) {
  switch (m.t) {
    case 'hello':
      if (m.ok) {
        S.wsOK = true;
        // Der Server kennt keinen Kampf mehr (Neustart, Abbruch): nicht ewig auf Kampfbildschirmen warten
        if (S.match && !S.match.replay && !m.inMatch) { S.match = null; toast('Der Kampf wurde beendet.'); home(); }
      } else toast('Server-Anmeldung fehlgeschlagen.');
      break;
    case 'kicked': S.kicked = true; show('<div class="col center"><h1>Ball gegen Ball</h1><div class="panel"><p>Dein Konto wurde auf einem anderen Gerät oder Tab geöffnet.</p></div>' + btn('Hier weiterspielen', 'reload') + '</div>'); break;
    case 'error': toast(errText(m.code)); break;
    case 'queued': if (S.screen !== 'queue') queueScreen(m); else queueUpdate(m); break;
    case 'unqueued': home(); break;
    case 'room': S.room = m; roomScreen(); break;
    case 'room_left': S.room = null; friends(); break;
    case 'match_start': S.match = { seen: '', players: m.players, you: m.you, n: m.n, mode: m.mode, ffa: !!m.ffa, lives: m.lives, friendly: m.friendly, round: 0 }; if (m.resume) toast('Wieder verbunden.'); else matchIntro(); break;
    case 'pick_phase': case 'reveal': case 'fight':
      // Wiederholte Meldungen (verspätete "Weiter"-Antworten) dürfen die laufende Phase nicht neu starten
      if (S.match && S.match.seen === m.t + m.round) break;
      if (S.match) S.match.seen = m.t + m.round;
      (m.t === 'pick_phase' ? pickScreen : m.t === 'reveal' ? dirScreen : fightScreen)(m); break;
    case 'match_end': matchEnd(m); break;
    case 'left': S.match = null; home(); break;
  }
}

/* ================= Startseite ================= */
function tutorial() {
  S.screen = 'tutorial'; setView(null); closeOverlay(); setScene('menu');
  const n = new Set(S.me.balls.map(b => b.type)).size, b = BOX_BY_ID.standard;
  show('<div class="col center" style="padding-top:2px"><div class="row" style="justify-content:flex-end;padding-right:50px">' + wallet() + '</div><h1 class="jit">Willkommen!</h1>' +
    '<div class="hero bounce">' + boxArt('standard', 160) + '</div>' +
    '<div class="panel"><p>Du brauchst drei verschiedene Bälle zum Kämpfen. Öffne drei Standard-Boxen, jede enthält einen neuen Ball.</p><p class="mt"><b>' + n + ' von 3</b> Bällen geöffnet</p></div>' +
    btn('Standard-Box öffnen (' + priceHTML(b) + ')', 'openbox', 'data-id="standard"', 'pri big') + '</div>');
}
function home() {
  if (new Set(S.me.balls.map(b => b.type)).size < 3) return tutorial();
  S.screen = 'home'; setView(null); closeOverlay(); setScene('menu');
  const me = S.me, types = new Set(me.balls.map(b => b.type)).size, ev = eventLive();
  const top3 = [...new Set(me.balls.map(b => b.type))].sort((x, y) => RARITY[DEFS[y].rarity].order - RARITY[DEFS[x].rarity].order).slice(0, 3);
  show('<div class="col" style="padding-top:2px"><div class="row sb" style="padding-right:50px"><div class="pill">' + esc(me.name) + '</div><button class="btn sm" style="min-height:40px;padding:4px 10px" data-act="settings" aria-label="Einstellungen">' + gi('gear', 26) + '</button></div><div class="row" style="justify-content:flex-end;margin-top:-6px">' + wallet() + '</div>' +
    '<h1 class="jit">Ball gegen Ball</h1>' +
    '<div class="hero bounce">' + ball(topType(), 170, .62) + '</div>' +
    '<div class="center small" style="color:#fff;text-shadow:1px 2px 0 var(--ink)">' + me.wins + ' Siege - ' + me.losses + ' Niederlagen - ' + types + ' von ' + BALL_IDS.length + ' Bällen</div>' +
    (() => { const evs = BOX_LIST.filter(b => b.until && boxActive(b.id, now())); if (!evs.length) return ''; return '<button class="panel" style="display:flex;align-items:center;gap:8px;width:100%;min-height:0;padding:4px 12px;background:#ffe3b0;text-align:left" data-act="limited">' + gi('token', 26) + '<span class="grow"><b>Zeitlich begrenzt</b> <span class="small">' + evs.length + ' Boxen</span></span>' + gi('arrow', 16).replace('<img', '<img style="transform:scaleX(-1)"') + '</button>'; })() +
    btn('<span class="fsw l">' + gi('sword', 58) + '</span><span class="ftx">Kampf!</span><span class="fsw r">' + gi('sword', 58) + '</span>', 'multi', '', 'fight') +
    '<div class="row gap6"><button class="htile" style="--tc:#cfe4ff" data-act="collection"><span class="hv fan">' + top3.map((t, i) => '<span style="--i:' + (i - 1) + '">' + ball(t, 62, .7) + '</span>').join('') + '</span><b>Sammlung</b><span class="small">' + types + ' von ' + BALL_IDS.length + ' Bällen</span></button>' +
    '<button class="htile" style="--tc:#ffe3a8" data-act="box"><span class="hv">' + boxArt('standard', 66) + '</span><b>Ballboxen</b><span class="small">' + me.boxes + ' geöffnet</span></button></div>' +
    '<div class="row gap6"><button class="htile" style="--tc:#cdeec4" data-act="handel"><span class="hv">' + gi('coin', 36) + '<span style="display:inline-flex;transform:scaleX(-1)">' + gi('arrow', 30) + '</span></span><b>Handel</b><span class="small">Markt und Tauschen</span></button>' +
      '<button class="htile" style="--tc:#e3dcf7" data-act="log"><span class="hv">' + gi('sword', 36) + '</span><b>Kampflog</b><span class="small">Wiederholen und teilen</span></button></div>' +
    (me.dailyReady ? '<button class="htile daily" data-act="daily"><span class="hv">' + gi('star', 44, '#ffd45a') + '</span><span class="grow"><b>Tagesbelohnung abholen</b><span class="small">' + (ev ? 'Münzen und +5 Kürbisse' : 'Münzen für heute') + '</span></span></button>' : '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Tagesbelohnung schon geholt. Morgen gibt es mehr.</p>') +
    (/[?&]test=1/.test(location.search) ? btn('TEST: unendlich Münzen und Marken', 'testcoins', '', 'red') : '') + '</div>');
}

/* ================= Handel und zeitlich begrenzte Boxen ================= */
function handelScreen() {
  S.screen = 'handel'; setView(null); closeOverlay(); setScene('menu');
  show('<div class="col">' + backBar('Handel') +
    '<button class="htile mode" style="--tc:#cdeec4" data-act="market"><span class="mart"><span class="hv">' + gi('coin', 44) + gi('coin', 32) + '</span></span><span class="grow"><b>Markt</b><span class="small">Bälle kaufen und verkaufen</span></span></button>' +
    '<button class="htile mode" style="--tc:#f3d6f0" data-act="trades"><span class="mart"><span class="hv">' + gi('arrow', 40) + '<span style="display:inline-flex;transform:scaleX(-1)">' + gi('arrow', 40) + '</span></span></span><span class="grow"><b>Tauschen</b><span class="small">Bälle mit anderen Spielern tauschen</span></span></button></div>');
}
function limitedScreen() {
  S.screen = 'limited'; setView(null); closeOverlay(); setScene('menu');
  const evs = BOX_LIST.filter(b => b.until && boxActive(b.id, now())).sort((a, z) => a.until - z.until);
  show('<div class="col">' + backBar('Zeitlich begrenzt') + '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Diese Boxen verschwinden bald. Die Bälle behältst du für immer.</p>' +
    '<div class="boxgrid">' + evs.map(b => '<button class="boxtile" data-act="boxdetail" data-id="' + b.id + '"><div class="boxin">' + boxArt(b.id, 150) + '<div class="nm">' + esc(b.name) + '</div><span class="small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">' + timeLeft(b.until - now()) + '</span></div></button>').join('') + '</div></div>');
}
/* ================= Einzelspieler ================= */
async function soloScreen() {
  S.screen = 'solo'; setView(null); closeOverlay(); setScene('menu');
  show('<div class="col">' + backBar('Einzelspieler', 'multi') + '<p class="center" style="color:#fff">Lade ...</p></div>');
  const r = await api('/api/solo'); if (r.err) { toast(errText(r.err)); return home(); }
  S.solo = r;
  const d = r.daily, b = r.boss, pct = Math.round(b.frac * 100);
  const dailyBtn = d.claimed ? '<p class="center small mute">Heute geschafft! Du kannst trotzdem weiter üben.</p>' : '';
  show('<div class="col">' + backBar('Einzelspieler', 'multi') +
    '<div class="panel"><h3>Tägliche Herausforderung</h3><div class="row gap6" style="align-items:center;margin:6px 0">' + ball(d.opp, 80, .7) + '<div class="grow"><b>' + esc(ballName(d.opp)) + '</b> ' + starsHTML(d.oppStars, 14) + '<div class="small mute">Regel: ' + esc(d.rule.text) + '</div></div></div>' +
    '<p class="small">Belohnung: ' + coinHTML(100) + ' und 1 Gratis-Standard-Box (einmal pro Tag)</p>' + dailyBtn + btn(d.claimed ? 'Nochmal kämpfen' : 'Kämpfen', 'solopick', 'data-k="daily"', 'pri') + '</div>' +
    '<div class="panel"><h3>Bossrennen</h3><div class="row gap6" style="align-items:center;margin:6px 0">' + ball(b.type, 90, .7) + '<div class="grow"><b>' + esc(ballName(b.type)) + '</b> (Boss)<div class="small mute">Du hast 3 verschiedene Bälle. Das Leben des Bosses bleibt zwischen den Kämpfen.</div>' +
    '<div style="height:12px;border:2px solid var(--ink);border-radius:8px;background:#fff;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:' + pct + '%;background:#d9534f"></i></div><div class="small">Boss-Leben: ' + pct + ' % - Bälle benutzt: ' + b.used.length + ' von 3</div></div></div>' +
    '<p class="small">Belohnung: ' + coinHTML(150) + ' und 1 Gratis-Standard-Box (einmal pro Tag)</p>' + (b.claimed ? '<p class="center small mute">Heute besiegt! Du kannst weiter üben.</p>' : '') +
    (b.used.length >= 3 || b.frac <= 0 ? btn('Neuer Versuch', 'bossreset', '', 'pri') : btn(b.used.length ? 'Nächster Ball' : 'Kämpfen', 'solopick', 'data-k="boss"', 'pri')) + '</div>' +
    '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Die Aufgaben wechseln jeden Tag um Mitternacht (UTC).</p></div>');
}
function soloPick(kind) {
  const r = S.solo, usedTypes = new Set((r.boss.used || []).map(u => { const bb = S.me.balls.find(x => x.uid === u); return bb && bb.type; }));
  const seen = new Set(), list = [];
  for (const b of S.me.balls) {
    if (b.lock || seen.has(b.type)) continue;
    const rar = DEFS[b.type].rarity;
    if (kind === 'daily' && r.daily.rule.id === 'low' && !['gewoehnlich', 'selten'].includes(rar)) continue;
    if (kind === 'daily' && r.daily.rule.id === 'nostar' && b.stars > 0) continue;
    if (kind === 'boss' && (r.boss.used.includes(b.uid) || usedTypes.has(b.type))) continue;
    seen.add(b.type); list.push(b);
  }
  list.sort((a, z) => RARITY[DEFS[z.type].rarity].order - RARITY[DEFS[a.type].rarity].order);
  overlay('<div class="col"><div class="row sb"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Wähle deinen Ball</h2><button class="btn sm" data-act="closeov">' + gi('cross', 24) + '</button></div>' +
    (list.length ? '<div class="grid3" style="grid-template-columns:repeat(3,1fr);gap:6px">' + list.map(b => '<button class="card cell" style="min-height:0;padding:8px 4px" data-act="solofight" data-k="' + kind + '" data-uid="' + b.uid + '">' + ball(b.type, 70, .66) + '<div class="small">' + esc(ballName(b.type)) + '</div>' + starsHTML(b.stars, 12) + '</button>').join('') + '</div>' : '<div class="panel center"><p>Du hast keinen passenden Ball.</p></div>') + '</div>');
}
async function soloFight(kind, uid) {
  const r = await api(kind === 'daily' ? '/api/solo/daily' : '/api/solo/boss', { uid: Number(uid) });
  if (r.err) { toast(r.err === 'rule' ? 'Dieser Ball erfüllt die Regel nicht.' : errText(r.err)); return; }
  closeOverlay();
  const title = kind === 'boss' ? 'Bossrennen' : 'Tägliche Herausforderung', oppName = kind === 'boss' ? 'Boss' : 'Herausforderer';
  S.match = { replay: true, solo: true, title, rec: { rounds: [1] }, idx: 0, players: [{ slot: 0, team: 0, name: 'Du' }, { slot: 1, team: 1, name: oppName }], you: 0, n: 2, ffa: false, lives: [0, 0], friendly: true, round: 1, back: () => soloResult(r, kind) };
  fightScreen({ t: 'fight', cfg: r.cfg, steps: r.steps, winner: r.winner, losers: [], lives: [0, 0], over: false, round: 1, replay: true });
}
function soloResult(r, kind) {
  S.screen = 'soloend'; setView(null); setScene('menu'); S.match = null; clearFx();
  const win = r.winner === 0, st = r.state;
  show('<div class="col center res"><h1 class="jit pop" style="color:' + (win ? '#fff' : '#ffd0c8') + ';text-shadow:3px 4px 0 var(--ink)">' + (win ? 'Geschafft!' : 'Verloren') + '</h1>' +
    (r.reward ? '<div class="panel pop"><p>Belohnung</p><div class="big">' + coinHTML('+' + r.reward.coins) + '</div><p>und 1 Gratis-Standard-Box</p></div>' : win ? '<div class="panel"><p>Die Belohnung für heute hast du schon bekommen.</p></div>' : '<div class="panel"><p>' + (kind === 'boss' ? 'Das Leben des Bosses bleibt für den nächsten Ball erhalten.' : 'Versuche es mit einem anderen Ball.') + '</p></div>') +
    btn('Weiter', 'solo', '', 'pri') + btn('Zur Startseite', 'home') + '</div>');
  if (win) { confetti(50); sfx('win'); } else sfx('lose');
}

/* ================= Kampflog ================= */
const MODE_NAME = it => (it.n === 2 ? '1 gegen 1' : it.ffa ? (it.n === 3 ? 'Zu dritt' : 'Zu viert') : '2 gegen 2') + (it.friendly ? ' (Freunde)' : '');
function ago(ts) {
  const d = (Date.now() + (S.skew || 0) - ts) / 1000;
  if (d < 90) return 'gerade eben'; if (d < 3600) return 'vor ' + Math.round(d / 60) + ' Min.'; if (d < 86400) return 'vor ' + Math.round(d / 3600) + ' Std.';
  const n = Math.round(d / 86400); return n === 1 ? 'gestern' : 'vor ' + n + ' Tagen';
}
const RES_COL = { 1: '#4fb25a', 0: '#e0b020', '-1': '#d9534f' };
function resPill(it) {
  const t = it.ffa ? (it.win ? 'Platz 1' : 'Platz ' + it.place) : it.win ? 'Sieg' : 'Niederlage';
  return '<span class="rarpill" style="background:' + (it.win ? '#4fb25a' : '#d9534f') + ';color:#fff">' + t + '</span>';
}
function dots(it) { return '<span class="row gap6" style="gap:3px">' + it.res.map(r => '<i style="display:inline-block;width:11px;height:11px;border-radius:50%;border:2px solid var(--ink);background:' + RES_COL[r] + '"></i>').join('') + '</span>'; }
async function logScreen(tab) {
  S.screen = 'log'; setView(null); closeOverlay(); setScene('menu'); tab = tab || S.logTab || 'list'; S.logTab = tab;
  if (!S.logItems) { show('<div class="col">' + backBar('Kampflog') + '<p class="center" style="color:#fff">Lade ...</p></div>'); const r = await api('/api/log'); if (r.err) { toast(errText(r.err)); return home(); } S.logItems = r.items; }
  const it = S.logItems, tabs = '<div class="row gap6">' + [['list', 'Kämpfe'], ['stats', 'Statistik']].map(([k, n]) => '<button class="btn sm' + (tab === k ? ' pri' : '') + '" data-act="logtab" data-t="' + k + '">' + n + '</button>').join('') + '</div>';
  if (!it.length) return show('<div class="col">' + backBar('Kampflog') + '<div class="panel center"><p>Noch keine Kämpfe. Nach deinem ersten Kampf erscheint er hier.</p></div></div>');
  if (tab === 'stats') {
    const real = it.filter(x => !x.friendly), wins = real.filter(x => x.win).length, rounds = [].concat(...it.map(x => x.res.map((r, i) => ({ r, t: x.mine[i] })))), rw = rounds.filter(x => x.r === 1).length;
    const per = {}; for (const x of rounds) { if (!x.t) continue; const o = per[x.t] || (per[x.t] = { n: 0, w: 0 }); o.n++; if (x.r === 1) o.w++; }
    const top = Object.entries(per).sort((a, b) => b[1].n - a[1].n).slice(0, 8);
    const opp = {}; for (const x of it) for (const n of x.opp) if (!/\(Bot\)$/.test(n)) opp[n] = (opp[n] || 0) + 1;
    const oppTop = Object.entries(opp).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let streak = 0, best = 0; for (const x of it.slice().reverse()) { if (x.win) { streak++; best = Math.max(best, streak); } else streak = 0; }
    return show('<div class="col">' + backBar('Kampflog') + tabs +
      '<div class="panel"><p><b>' + it.length + '</b> Kämpfe gespeichert - <b>' + wins + '</b> Siege bei <b>' + real.length + '</b> gewerteten Kämpfen' + (real.length ? ' (' + Math.round(wins / real.length * 100) + ' %)' : '') + '</p>' +
      '<p class="small mute">Gewonnene Runden: ' + rw + ' von ' + rounds.length + (rounds.length ? ' (' + Math.round(rw / rounds.length * 100) + ' %)' : '') + ' - längste Siegesserie: ' + best + '</p></div>' +
      '<div class="panel"><p><b>Deine Bälle</b></p>' + top.map(([t, o]) => '<div class="row gap6" style="align-items:center;margin:4px 0">' + ball(t, 40, .7) + '<div class="grow"><div class="small"><b>' + esc(ballName(t)) + '</b> - ' + o.n + ' Runden, ' + Math.round(o.w / o.n * 100) + ' % gewonnen</div><div style="height:8px;border:2px solid var(--ink);border-radius:6px;background:#fff;overflow:hidden"><i style="display:block;height:100%;width:' + Math.round(o.w / o.n * 100) + '%;background:#4fb25a"></i></div></div></div>').join('') + '</div>' +
      (oppTop.length ? '<div class="panel"><p><b>Häufigste Gegner</b></p>' + oppTop.map(([n, c]) => '<p class="small">' + esc(n) + ' - ' + c + 'x</p>').join('') + '</div>' : '') + '</div>');
  }
  show('<div class="col">' + backBar('Kampflog') + tabs + it.map(x => '<button class="card cell" style="min-height:0;padding:10px 12px;text-align:left" data-act="logopen" data-id="' + x.id + '"><div class="row sb" style="align-items:center"><b>' + MODE_NAME(x) + '</b>' + resPill(x) + '</div>' +
    '<div class="row sb small mute" style="align-items:center;margin-top:4px"><span>' + (x.opp.length ? 'gegen ' + esc(x.opp.slice(0, 3).join(', ')) : '') + '</span><span>' + ago(x.ts) + '</span></div>' +
    '<div class="row sb" style="align-items:center;margin-top:6px"><span class="row gap6" style="gap:2px">' + x.mine.slice(0, 6).map(t => t ? ball(t, 32, .7) : '').join('') + '</span>' + dots(x) + '</div></button>').join('') + '</div>');
}
async function logDetail(id) {
  S.screen = 'logd'; setView(null); closeOverlay();
  const r = await api('/api/log/get', { id }); if (r.err) { toast(errText(r.err)); return logScreen(); }
  const rec = r.rec; S.logRec = { id, rec };
  showRounds(rec, 'Kampf vom ' + new Date(rec.ts).toLocaleDateString('de-DE') + ' - ' + MODE_NAME(rec), 'logback', true);
}
function showRounds(rec, title, back, mine) {
  S.screen = 'logd'; setView(null); setScene('menu');
  const me = rec.players.find(p => p.slot === rec.you), mt = me ? me.team : 0;
  const nm = p => esc(p.slot === rec.you && mine ? 'Du' : p.name + (p.bot ? ' (Bot)' : ''));
  show('<div class="col">' + backBar(title, back) +
    '<div class="panel center"><p><b>' + (rec.ffa ? (rec.win ? 'Platz 1' : 'Platz ' + rec.place) : rec.win ? 'Sieg' : 'Niederlage') + '</b> - ' + rec.rounds.length + ' Runden</p><p class="small mute">' + rec.players.map(nm).join(', ') + '</p></div>' +
    rec.rounds.map((r, i) => {
      const win = rec.ffa ? ((r.losers || []).length ? !(r.losers || []).includes(mt) : null) : r.winner < 0 ? null : r.winner === mt;
      const row = r.cfg.balls.map(b => '<span style="text-align:center">' + ball(b.type, 40, .7) + '<div class="small" style="max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + nm(rec.players.find(p => p.slot === b.slot) || { name: '?', slot: -1 }) + '</div></span>').join('');
      return '<div class="panel"><div class="row sb" style="align-items:center"><b>Runde ' + (i + 1) + '</b><span class="rarpill" style="background:' + (win === null ? '#e0b020' : win ? '#4fb25a' : '#d9534f') + ';color:#fff">' + (win === null ? 'Unentschieden' : win ? 'Gewonnen' : 'Verloren') + '</span></div>' +
        '<div class="row gap6" style="flex-wrap:wrap;justify-content:center;margin:6px 0">' + row + '</div>' + btn('Ansehen', 'replay', 'data-i="' + i + '"', 'sm') + '</div>';
    }).join('') + (mine ? btn('Link zum Teilen kopieren', 'logshare', 'data-id="' + S.logRec.id + '"', 'pri') : btn('Selbst spielen', 'logexit', '', 'pri')) + '</div>');
}
function replayRound(rec, idx, back) {
  const r = rec.rounds[idx];
  S.match = { replay: true, rec, idx, back, players: rec.players, you: rec.you, n: rec.n, mode: rec.mode, ffa: rec.ffa, lives: r.lives, friendly: true, round: idx + 1 };
  fightScreen({ t: 'fight', cfg: r.cfg, steps: r.steps, winner: r.winner, losers: r.losers || [], lives: r.lives, over: false, round: idx + 1, replay: true });
}

/* ================= Sammlung ================= */
function sortedIds() {
  const c = typeCounts(), f = S.col, q = f.q.trim().toLowerCase();
  let ids = BALL_IDS.filter(id => {
    const d = DEFS[id];
    if (f.rar !== 'all' && d.rarity !== f.rar) return false;
    if (f.box !== 'all' && d.box !== f.box) return false;
    if (f.own && !c[id]) return false;
    if (q && !d.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const ro = id => RARITY[DEFS[id].rarity].order;
  if (f.sort === 'name') ids.sort((a, b) => DEFS[a].name.localeCompare(DEFS[b].name, 'de'));
  else if (f.sort === 'own') ids.sort((a, b) => ((c[b] ? c[b].n : 0) - (c[a] ? c[a].n : 0)) || ro(b) - ro(a));
  else ids.sort((a, b) => ro(b) - ro(a) || DEFS[a].name.localeCompare(DEFS[b].name, 'de'));
  return ids;
}
function colGrid() {
  const c = typeCounts(), ids = sortedIds();
  if (!ids.length) return '<p class="center" style="grid-column:1/-1;color:#fff;text-shadow:1px 1px 0 var(--ink)">Nichts gefunden.</p>';
  return ids.map(id => {
    const d = DEFS[id], o = c[id];
    const best = o ? Math.max(...o.list.map(x => x.stars)) : 0;
    return '<button class="card cell rbar r-' + d.rarity + (o ? '' : ' locked') + '" style="--rc:' + RARITY[d.rarity].color + '" data-act="detail" data-t="' + id + '">' +
      (o && o.n > 1 ? '<span class="badge">x' + o.n + '</span>' : '') +
      ball(id, 84, .62, o ? '' : 'data-dark="1"') + '<div class="nm">' + (o ? d.name : '???') + '</div>' + (best ? '<div style="line-height:0">' + starsHTML(best, 13) + '</div>' : '') + '</button>';
  }).join('');
}
// Vorschau für "Alles verbessern": wie viele Stufen mit den freien Duplikaten möglich sind (gleiche Regel wie auf dem Server)
function upAllPlan() {
  let steps = 0, used = 0;
  const c = typeCounts();
  for (const type in c) {
    const free = c[type].list.filter(b => !b.lock).length;
    if (!free || DEFS[type].base) continue;
    let stars = Math.max(...c[type].list.map(b => b.stars)), avail = free - 1;
    while (stars < MAX_STARS && avail >= UP_COST[DEFS[type].rarity][stars]) { const k = UP_COST[DEFS[type].rarity][stars]; avail -= k; used += k; stars++; steps++; }
  }
  return { steps, used };
}
function collection(keep) {
  S.screen = 'collection'; setView(null);
  const c = typeCounts(), have = Object.keys(c).length, f = S.col;
  const tabs = [['all', 'Alle']].concat(SORT.map(r => [r, RARITY[r].name]));
  const boxes = [['all', 'Alle Boxen']].concat(BOX_LIST.map(b => [b.id, b.name.replace('-Box', '')]));
  show('<div class="col">' + backBar('Sammlung') +
    '<div class="panel" style="padding:8px 12px"><div class="row sb small"><span>' + have + ' von ' + BALL_IDS.length + ' Bällen</span><span>' + S.me.balls.length + ' insgesamt</span></div><div class="progress mt"><i style="width:' + Math.round(have / BALL_IDS.length * 100) + '%"></i></div></div>' +
    (upAllPlan().steps ? btn(gi('star', 24, '#ffd45a') + ' Alles maximal verbessern', 'upall', '', 'green') : '') +
    '<div class="row gap6"><div class="inp grow row" style="padding-left:8px">' + gi('search', 24) + '<input id="cq" placeholder="Ball suchen" value="' + esc(f.q) + '" autocomplete="off"></div></div>' +
    '<div class="tabs">' + tabs.map(t => '<button class="tab' + (f.rar === t[0] ? ' on' : '') + '" data-act="cfilter" data-k="rar" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
    '<div class="tabs">' + boxes.map(t => '<button class="tab' + (f.box === t[0] ? ' on' : '') + '" data-act="cfilter" data-k="box" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
    '<div class="tabs"><button class="tab' + (f.sort === 'rar' ? ' on' : '') + '" data-act="cfilter" data-k="sort" data-v="rar">Nach Seltenheit</button><button class="tab' + (f.sort === 'name' ? ' on' : '') + '" data-act="cfilter" data-k="sort" data-v="name">A bis Z</button><button class="tab' + (f.sort === 'own' ? ' on' : '') + '" data-act="cfilter" data-k="sort" data-v="own">Meiste</button><button class="tab' + (f.own ? ' on' : '') + '" data-act="cown">Nur meine</button></div>' +
    '<div class="grid3" id="cgrid">' + colGrid() + '</div></div>');
  const q = $('#cq'); if (q) q.oninput = () => { S.col.q = q.value; const g = $('#cgrid'); if (g) { g.innerHTML = colGrid(); decorate(g); } };
}
function detail(type) {
  const d = DEFS[type], c = typeCounts()[type], box = BOX_BY_ID[d.box];
  const sugg = { gewoehnlich: 40, selten: 100, episch: 250, legendaer: 700, mythisch: 3000 }[d.rarity];
  let own = '';
  if (c) {
    const lvl = Math.max(...c.list.map(x => x.stars)), free = c.list.filter(x => !x.lock);
    let up = '';
    if (free.length && d.base) up = '<div class="small center">Skin von ' + esc(DEFS[d.base].name) + ' - hat dessen Sterne.</div>';
    else if (free.length) {
      if (lvl >= MAX_STARS) up = '<div class="small center">Höchste Stufe erreicht!</div>';
      else {
        const cost = UP_COST[d.rarity][lvl], have = free.length - 1, ok = have >= cost;
        up = '<button class="btn sm ' + (ok ? 'green' : '') + '" style="width:100%" data-act="upgrade" data-uid="' + free[0].uid + '" ' + (ok ? '' : 'disabled') + '>' + gi('star', 20, '#ffd45a') + ' Verbessern auf ' + (lvl + 1) + ' (' + Math.min(have, cost) + ' von ' + cost + ' Duplikaten)</button>';
      }
    }
    own = '<h3>Du besitzt ' + c.n + 'x</h3><div class="card col" style="gap:6px"><div class="small">Stufe: ' + (lvl ? starsHTML(lvl, 17) : '<span class="mute">keine Sterne</span>') + '</div>' + up + '</div>' +
      c.list.slice().sort((a, z) => a.uid - z.uid).map(b => {
      let r;
      if (b.lock === 1) r = '<span class="small">Auf dem Markt für ' + coinHTML(b.price) + '</span><button class="btn sm" data-act="mkcancel" data-uid="' + b.uid + '">Zurückziehen</button>';
      else if (b.lock === 2) r = '<span class="small">' + gi('lock', 20) + ' Im Tausch</span>';
      else r = '<div class="inp" style="width:90px"><input type="number" inputmode="numeric" min="10" id="pr' + b.uid + '" value="' + sugg + '"></div><button class="btn sm pri" data-act="mklist" data-uid="' + b.uid + '">Verkaufen</button>';
      return '<div class="card col" style="gap:6px"><div class="listrow" style="padding:0"><span class="small grow">Exemplar Nr. ' + b.uid + '</span>' + r + '</div></div>';
    }).join('') + '<p class="small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Jeder Stern gibt +' + Math.round(STAR_BONUS * 100) + ' % Leben und Schaden und gilt für die ganze Sorte, egal wie viele Exemplare du hast. Zum Verbessern werden gleiche Bälle verbraucht. Drei verschiedene freie Bälle musst du immer behalten.</p>';
  } else own = '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Diesen Ball hast du noch nicht. Öffne Ballboxen oder kaufe ihn auf dem Markt.</p>';
  const known = !!c;
  overlay('<div class="col"><div class="row sb"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">' + (known ? esc(d.name) : '???') + '</h2><button class="btn sm" data-act="closeov">' + gi('cross', 24) + '</button></div>' +
    '<div class="hero pop">' + ball(type, 230, .66, known ? '' : 'data-dark="1"') + '</div>' +
    '<div class="panel"><div class="row sb wrap">' + rarHTML(d.rarity) + (known ? '<span>' + gi('heart', 22) + ' <b>' + d.hp + '</b> Leben</span><span>' + gi('sword', 22) + ' Schaden: <b>' + d.dmg + '</b></span>' : '') + '</div>' + (known ? '<p class="mt">' + esc(d.desc) + '</p>' : '<p class="mt mute">Noch nicht entdeckt. Finde diesen Ball, um mehr zu erfahren.</p>') +
    (box ? '<p class="small mt mute">Aus der ' + esc(box.name) + (d.box === 'halloween' ? ' (nur zu Halloween)' : '') + '</p>' : '') + '</div>' +
    (known ? '<div class="panel"><p><b>Stark gegen:</b> ' + esc(d.strong) + '</p><p class="mt"><b>Schwach gegen:</b> ' + esc(d.weak) + '</p></div>' : '') + own + '</div>');
}

/* ================= Ballboxen ================= */
function boxStats(id) {
  const ids = ballsInBox(id), c = typeCounts();
  return { n: ids.length, own: ids.filter(t => c[t]).length, ids };
}
function boxScreen() {
  S.screen = 'box'; setView(null);
  const list = BOX_LIST.filter(b => boxActive(b.id, now()));
  const tile = b => '<button class="boxtile' + (b.id.startsWith('skin') ? ' skin' : '') + '" data-act="boxdetail" data-id="' + b.id + '"><div class="boxin">' + boxArt(b.id, 150) + '<div class="nm">' + esc(b.name) + '</div>' + (b.id.startsWith('skin') ? '<span class="small" style="color:#fff2a0;text-shadow:1px 1px 0 var(--ink)">nur Aussehen</span>' : '') + '</div>' + (b.until ? '<span class="tag">Begrenzt</span>' : '') + '</button>';
  const balls = list.filter(b => !b.id.startsWith('skin')), skins = list.filter(b => b.id.startsWith('skin'));
  show('<div class="col">' + backBar('Boxen') +
    '<h3 style="color:#fff;text-shadow:2px 2px 0 var(--ink);margin:6px 2px 0">Ballboxen</h3><p class="small" style="color:#fff;text-shadow:1px 1px 0 var(--ink);margin:0 2px">Neue Bälle zum Kämpfen</p><div class="boxgrid">' + balls.map(tile).join('') + '</div>' +
    (skins.length ? '<h3 style="color:#ffe27a;text-shadow:2px 2px 0 var(--ink);margin:16px 2px 0">Skin-Truhen</h3><p class="small" style="color:#fff;text-shadow:1px 1px 0 var(--ink);margin:0 2px">Neues Aussehen für Bälle. Gleiche Werte, gleiche Fähigkeiten.</p><div class="boxgrid">' + skins.map(tile).join('') + '</div>' : '') + '</div>');
}
function boxDetail(id) {
  const b = BOX_BY_ID[id];
  if (!b || !boxActive(id, now())) { toast('Diese Box gibt es nicht mehr.'); return boxScreen(); }
  S.screen = 'boxdetail'; setView(null); S.curBox = id;
  const free = id === 'standard' && S.me.freeBoxes > 0, st = boxStats(id), c = typeCounts(), have = b.cur === 'tokens' ? S.me.tokens : S.me.coins, ok = free || have >= b.price;
  const byR = SORT.map(r => [r, st.ids.filter(t => DEFS[t].rarity === r).length]).filter(x => x[1]);
  show('<div class="col">' + backBar(b.name, 'box') +
    '<div class="hero bounce" style="margin-top:6px">' + boxArt(b.id, 170) + '</div>' +
    '<div class="panel"><h3>' + esc(b.name) + '</h3><p class="mt">' + esc(b.desc) + '</p><div class="row sb wrap mt"><span>Kosten: ' + priceHTML(b) + '</span><span>' + st.own + ' von ' + st.n + (id.startsWith('skin') ? ' Skins' : '') + ' gesammelt</span></div><div class="progress thin"><i style="width:' + Math.round(st.own / st.n * 100) + '%;background:' + b.col + '"></i></div></div>' +
    (b.until ? '<div class="panel center" style="background:#ffd9a0">' + gi('token', 30) + ' <b>Nur kurze Zeit!</b> Die Box verschwindet am ' + new Date(b.until - 1).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' }) + '. ' + timeLeft(b.until - now()) + '.<div class="small mt">Kürbisse bekommst du für Kämpfe (Sieg 3, Niederlage 1) und die Tagesbelohnung (5). Übrige Kürbisse verfallen. Die Bälle behältst du für immer.</div></div>' : '') +
    '<div class="panel"><h3>' + (id.startsWith('skin') ? 'Diese Skins sind drin' : 'Das kann drin sein') + '</h3><div class="grid3" style="margin-top:6px;grid-template-columns:repeat(4,1fr);gap:6px">' +
    st.ids.sort((a, z) => RARITY[DEFS[z].rarity].order - RARITY[DEFS[a].rarity].order).map(t => '<button data-act="detail" data-t="' + t + '" style="position:relative;text-align:center">' + ball(t, 66, .64, c[t] ? '' : 'data-dark="1"') + '<div class="small" style="font-size:13px;line-height:1;margin-top:-6px;color:' + RARITY[DEFS[t].rarity].color + '">' + (c[t] ? esc(DEFS[t].name.replace('ball', '')) : '???') + '</div></button>').join('') +
    '</div></div>' +
    '<div class="panel"><h3>Chancen</h3>' + byR.map(r => '<div class="row sb"><span>' + rarHTML(r[0]) + ' <span class="small mute">(' + r[1] + ' Bälle)</span></span><span>' + ((BOX_RARITY[id] || {})[r[0]] ?? RARITY[r[0]].weight) + ' %</span></div>').join('') + '</div>' +
    btn(free ? 'Gratis öffnen (' + S.me.freeBoxes + ' übrig)' : 'Öffnen für ' + priceHTML(b), 'openbox', (ok ? '' : 'disabled') + ' data-id="' + id + '"', 'pri big') +
    (ok ? '' : '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">' + (b.cur === 'tokens' ? 'Dir fehlen Marken. Gewinne Kämpfe oder hole die Tagesbelohnung.' : 'Dir fehlen Münzen. Gewinne Kämpfe oder hole die Tagesbelohnung.') + '</p>') + '</div>');
}
async function openBox(id) {
  const b = BOX_BY_ID[id || S.curBox];
  const before = new Set(S.me.balls.map(x => x.type));
  const r = await api('/api/box', { box: b.id });
  if (r.err) { toast(errText(r.err)); return; }
  S.screen = 'boxplay'; sfx('open');
  const W = Math.min(window.innerWidth - 28, 300), H = Math.round(W / (BW + 16) * BOX_H);
  show('<div class="col"><h2 class="center jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Los geht\'s!</h2><canvas id="bc" class="view"></canvas><p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Der erste Ball durch die Öffnung unten gehört dir.<br>Tippen zum Überspringen.</p></div>');
  const cv = $('#bc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const s = createBox(r.seed, 10, layoutOf(b.id)); s.ev = [] /* Ereignisse (Flummi, Kanone, Gitter, Korb) für die Geräusche */; let acc = 0, fin = 0, shown = false, lastN = 0, flash = 0, skip = false;
  SCREEN.onpointerdown = () => { if (S.screen === 'boxplay') skip = true; };
  setView({
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      // Spannung: kurz vor der Öffnung läuft alles in Zeitlupe
      let near = false;
      for (const x of s.balls) if (!x.done && x.y > 300) near = true;
      const rate = s.order.length ? 1 : near ? .45 : 1;
      if (skip && !shown) { let g = 20000; while (!s.done && s.order.length < 1 && g-- > 0) stepBox(s); }
      acc += dt * 120 * rate;
      while (acc >= 1 && !s.done && s.order.length < 3 && !(fin && tm - fin > .8)) { stepBox(s); acc--; }   // nach dem ersten Ball nur noch kurz weiterlaufen
      if (skip) s.ev.length = 0; else while (s.ev.length) sfx(s.ev.shift(), .8);
      if (s.order.length > lastN) { if (lastN === 0) { flash = 1; sfx('pop'); } lastN = s.order.length; }
      flash = Math.max(0, flash - dt * 2.5);
      if (s.order.length >= 1 || s.done) { if (!fin) fin = tm; }
      drawBox(ctx, W, s, r.cands, tm, tf, s.order.length ? s.order[0] : -1, b.col, b.id);
      if (flash > 0) { ctx.fillStyle = 'rgba(255,250,200,' + flash * .5 + ')'; ctx.fillRect(0, 0, W, H); }
      if (fin && (tm - fin > 1.5 || skip) && !shown) { shown = true; boxResult(r, s, before, b); }
    }
  });
}
function boxResult(r, s, before, b) {
  S.screen = 'boxres'; setView(null); SCREEN.onpointerdown = null;
  const d = DEFS[r.ball.type], isNew = !before.has(r.ball.type), rar = d.rarity;
  const near = s.order.slice(1, 3).map(i => r.cands[i]).filter(t => RARITY[DEFS[t].rarity].order > RARITY[rar].order);
  const have = b.cur === 'tokens' ? S.me.tokens : S.me.coins, ok = (b.id === 'standard' && S.me.freeBoxes > 0 || have >= b.price) && boxActive(b.id, now());
  const big = rar === 'episch' || rar === 'legendaer' || rar === 'mythisch';
  show('<div class="col res"><h1 class="jit pop" style="color:#fff;text-shadow:3px 4px 0 var(--ink)">' + esc(d.name) + '!</h1><div>' + '<span class="rarpill">' + rarHTML(rar) + '</span>' + '</div>' +
    '<div class="hero sheet-ball" style="min-height:250px;align-items:center">' + (big ? '<div class="rays"></div>' : '') + '<div class="pop" style="position:relative">' + ball(r.ball.type, 240, .66) + '</div></div>' +
    (isNew ? '<div class="center"><span class="tag" style="font-size:24px;padding:2px 14px">Neu in deiner Sammlung!</span></div>' : '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Du hast ihn schon (Duplikat). Verkaufe oder tausche ihn.</p>') +
    '<div class="panel" style="text-align:left"><div class="row sb wrap"><span>' + gi('heart', 22) + ' <b>' + d.hp + '</b> Leben</span><span>' + gi('sword', 22) + ' Schaden: <b>' + d.dmg + '</b></span></div><p class="mt">' + esc(d.desc) + '</p></div>' +
    (near.length ? '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Knapp daneben: ' + near.map(t => '<b style="color:' + RARITY[DEFS[t].rarity].color + ';background:var(--paper);padding:0 6px;border-radius:6px">' + esc(ballName(t)) + '</b>').join(' und ') + ' lag auch vorn!</p>' : '') +
    (new Set(S.me.balls.map(x => x.type)).size < 3 ? btn('Weiter', 'home', '', 'pri big') : btn('Noch eine Box (' + priceHTML(b) + ')', 'openbox', (ok ? '' : 'disabled') + ' data-id="' + b.id + '"', 'pri') + btn('Zu den Boxen', 'box')) + '</div>');
  sfx(rar === 'mythisch' ? 'mythic' : rar === 'legendaer' ? 'legend' : big ? 'rare' : 'coin');
  if (big) confetti(rar === 'mythisch' ? 110 : rar === 'legendaer' ? 70 : 40);
}

/* ================= Markt ================= */
async function market(resetPage) {
  S.screen = 'market'; setView(null);
  const mk = S.mk;
  if (resetPage) mk.page = 0;
  let body = '';
  if (mk.tab === 'buy') {
    const r = await api('/api/market/browse', { rarity: mk.rarity, q: mk.q, sort: mk.sort, page: mk.page });
    if (r.err) { toast(errText(r.err)); return; }
    mk.items = r.items; mk.total = r.total;
    body = '<div class="tabs">' + [['', 'Alle']].concat(SORT.map(x => [x, RARITY[x].name])).map(t => '<button class="tab' + (mk.rarity === t[0] ? ' on' : '') + '" data-act="mkrar" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div class="row gap6"><div class="inp grow row" style="padding-left:8px">' + gi('search', 24) + '<input id="mkq" placeholder="Ball suchen" value="' + esc(mk.q) + '"></div><button class="btn sm pri" data-act="mksearch">Suchen</button></div>' +
      '<div class="tabs">' + [['low', 'Billigste'], ['high', 'Teuerste'], ['new', 'Neueste']].map(t => '<button class="tab' + (mk.sort === t[0] ? ' on' : '') + '" data-act="mksort" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      (mk.items.length ? mk.items.map(it => {
        const d = DEFS[it.type];
        return '<div class="listrow card rbar" style="--rc:' + RARITY[d.rarity].color + '">' + ball(it.type, 58, .7) + '<div class="grow"><b>' + esc(d.name) + '</b> ' + starsHTML(it.stars, 14) + '<br><span class="small mute">von ' + esc(it.seller) + '</span></div>' +
          (it.mine ? '<span class="small">dein Angebot</span>' : '<button class="btn sm pri" data-act="mkbuy" data-uid="' + it.uid + '">' + coinHTML(it.price) + '</button>') + '</div>';
      }).join('') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Gerade keine Angebote.</p>') +
      '<div class="row sb">' + (mk.page > 0 ? '<button class="btn sm" data-act="mkprev">Zurück</button>' : '<span></span>') + (mk.total > (mk.page + 1) * 40 ? '<button class="btn sm" data-act="mknext">Weiter</button>' : '<span></span>') + '</div>';
  } else {
    const mine = S.me.balls.filter(b => b.lock === 1);
    body = mine.length ? mine.map(b => {
      const d = DEFS[b.type];
      return '<div class="listrow card rbar" style="--rc:' + RARITY[d.rarity].color + '">' + ball(b.type, 58, .7) + '<div class="grow"><b>' + esc(d.name) + '</b> ' + starsHTML(b.stars, 14) + '<br>' + coinHTML(b.price) + '</div><button class="btn sm" data-act="mkcancel" data-uid="' + b.uid + '" data-back="market">Zurückziehen</button></div>';
    }).join('') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Du hast nichts zum Verkauf angeboten. Öffne in der Sammlung einen Ball, den du doppelt hast, und lege einen Preis fest.</p>';
  }
  show('<div class="col">' + backBar('Markt', 'handel') + '<div class="tabs"><button class="tab' + (mk.tab === 'buy' ? ' on' : '') + '" data-act="mktab" data-v="buy">Kaufen</button><button class="tab' + (mk.tab === 'mine' ? ' on' : '') + '" data-act="mktab" data-v="mine">Meine Angebote</button></div>' + body + '<p class="small center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Beim Verkauf werden 5 % Gebühr abgezogen.</p></div>');
}

/* ================= Tauschen ================= */
// Ball-Kachel im Tausch: unbekannte Sorten (hast du selbst nicht) erscheinen als Silhouette mit ???
function tball(b, o) {
  o = o || {};
  const hid = !b.type, d = hid ? null : DEFS[b.type];
  return '<' + (o.act ? 'button' : 'div') + ' class="ttile' + (o.on ? ' on' : '') + (hid ? ' hid' : '') + '"' + (o.act ? ' data-act="' + o.act + '" data-uid="' + b.uid + '"' : '') + (d ? ' style="--rc:' + RARITY[d.rarity].color + '"' : '') + '>' +
    ball(hid ? 'stachel' : b.type, 58, .72, hid ? 'data-dark="1"' : '') + '<span class="tn">' + (hid ? '???' : esc(d.name)) + '</span>' + (b.stars ? '<span class="ts">' + starsHTML(b.stars, 12) + '</span>' : '') + (o.on ? '<span class="tck">' + gi('check', 20) + '</span>' : '') + '</' + (o.act ? 'button' : 'div') + '>';
}
const tside = (list, coins) => '<div class="tcol">' + (list.length ? list.map(b => tball(b)).join('') : '') + (coins ? '<div class="tcoin">' + coinHTML(coins) + '</div>' : '') + (!list.length && !coins ? '<span class="mute small">nichts</span>' : '') + '</div>';
async function trades() {
  S.screen = 'trades'; setView(null);
  const tab = S.tr.tab;
  let r;
  if (S.trSkip && S.trData) { r = S.trData; S.trSkip = false; } else { r = await api('/api/trades'); if (r.err) { toast(errText(r.err)); return; } S.trData = r; }
  let body = '';
  if (tab === 'new') {
    const t = S.tnew, myFree = S.me.balls.filter(b => !b.lock);
    const sumG = t.give.size, sumW = t.want.size;
    body = '<div class="panel"><p class="small mute" style="margin-bottom:6px">Mit wem willst du tauschen?</p><div class="row gap6"><div class="inp grow"><input id="tname" placeholder="Spielername" value="' + esc(t.name) + '"></div><button class="btn sm pri" data-act="tfind">Suchen</button></div><div class="err" id="err"></div></div>' +
      (t.player ? '<div class="panel tplayer"><b>' + esc(t.player.name) + '</b><span class="small mute">' + t.player.wins + ' Siege - ' + t.player.losses + ' Niederlagen</span></div>' +
        '<div class="panel"><h3>Du gibst</h3><div class="tgrid">' + (myFree.map(b => tball(b, { act: 'tgive', on: t.give.has(b.uid) })).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6 mt"><span>und</span><div class="inp" style="width:100px"><input id="cgive" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + gi('coin', 22) + '</div></div>' +
        '<div class="tarrow">' + '<span style="display:inline-flex;transform:rotate(-90deg)">' + gi('arrow', 28) + '</span>' + '</div>' +
        '<div class="panel"><h3>Du bekommst von ' + esc(t.player.name) + '</h3><p class="small mute">Bälle, die du noch nicht kennst, bleiben verdeckt.</p><div class="tgrid">' + (t.player.balls.map(b => tball(b, { act: 'twant', on: t.want.has(b.uid) })).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6 mt"><span>und</span><div class="inp" style="width:100px"><input id="cwant" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + gi('coin', 22) + '</div></div>' +
        '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Du gibst ' + sumG + ' Ball' + (sumG === 1 ? '' : 'e') + ' und bekommst ' + sumW + ' Ball' + (sumW === 1 ? '' : 'e') + '.</p>' +
        btn('Angebot senden', 'tsend', '', 'pri big') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Suche einen Spieler über seinen Namen.</p>');
  } else {
    const list = tab === 'in' ? r.incoming : tab === 'out' ? r.outgoing : r.history;
    const ST = { accepted: 'angenommen', declined: 'abgelehnt', cancelled: 'zurückgezogen', expired: 'abgelaufen' };
    body = list.length ? list.map(t => {
      const other = t.mine ? t.to : t.from;
      let acts = '';
      if (tab === 'in') acts = '<div class="row gap6"><div class="grow"><button class="btn sm green" style="width:100%" data-act="tans" data-id="' + t.id + '" data-a="accept">Annehmen</button></div><div class="grow"><button class="btn sm red" style="width:100%" data-act="tans" data-id="' + t.id + '" data-a="decline">Ablehnen</button></div></div>';
      else if (tab === 'out') acts = '<button class="btn sm" style="width:100%" data-act="tans" data-id="' + t.id + '" data-a="cancel">Zurückziehen</button>';
      const you = t.mine ? t.give : t.want, they = t.mine ? t.want : t.give, cy = t.mine ? t.coinsGive : t.coinsWant, ct = t.mine ? t.coinsWant : t.coinsGive;
      return '<div class="card tcard"><div class="row sb"><b style="font:400 24px var(--f-display)">' + esc(other) + '</b>' + (tab === 'hist' ? '<span class="small tst ' + t.status + '">' + (ST[t.status] || t.status) + '</span>' : '') + '</div>' +
        '<div class="tflow"><div class="tbox"><span class="small mute">Du gibst</span>' + tside(you, cy) + '</div><div class="tmid">' + '<span style="display:inline-flex;transform:scaleX(-1)">' + gi('arrow', 22) + '</span>' + gi('arrow', 22) + '</div><div class="tbox"><span class="small mute">Du bekommst</span>' + tside(they, ct) + '</div></div>' + acts + '</div>';
    }).join('') : '<div class="panel center"><p>Hier ist nichts.</p></div>';
  }
  const cnt = { in: r.incoming.length, out: r.outgoing.length };
  const tabs = [['in', 'Eingehend'], ['out', 'Ausgehend'], ['new', 'Neues Angebot'], ['hist', 'Verlauf']];
  show('<div class="col">' + backBar('Tauschen', 'handel') + '<div class="tabs ttabs">' + tabs.map(t => '<button class="tab' + (tab === t[0] ? ' on' : '') + '" data-act="ttab" data-v="' + t[0] + '">' + t[1] + (cnt[t[0]] ? '<i class="tbadge">' + cnt[t[0]] + '</i>' : '') + '</button>').join('') + '</div>' + body + '</div>');
}

/* ================= Mehrspieler ================= */
function multi() {
  S.screen = 'multi'; setView(null);
  const owned = [...new Set(S.me.balls.map(b => b.type))], pick = i => owned[(i * 7 + 3) % owned.length] || 'stachel';
  const grp = (n, act, title, sub, tc) => {
    const bs = []; for (let i = 0; i < n; i++) bs.push('<span class="mb">' + ball(pick(i + n), 66, .7, i % 2 ? 'data-dark="1"' : '') + '</span>');
    const arr = n === 2 ? bs[0] + '<span class="mvs jit">VS</span>' + bs[1] : n === 3 ? '<span class="mrow">' + bs[0] + '</span><span class="mrow">' + bs[1] + bs[2] + '</span>' : '<span class="mrow">' + bs[0] + bs[1] + '</span><span class="mrow">' + bs[2] + bs[3] + '</span>';
    const off = n > 3;   // Wartung (4 Spieler)
    return '<button class="htile mode' + (n === 2 ? ' two' : '') + (off ? ' off' : '') + '" style="--tc:' + tc + '"' + (off ? ' disabled' : ' data-act="' + act + '"') + '><span class="mart">' + arr + '</span><span class="grow"><b>' + title + '</b><span class="small">' + (off ? 'Gerade wegen Wartung gesperrt' : sub) + '</span></span></button>';
  };
  show('<div class="col">' + backBar('Kampf') +
    '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Wähle, wie viele Spieler kämpfen. Fehlende Spieler füllen Bots auf.</p>' +
    grp(2, 'queue1', '1 gegen 1', 'Der Klassiker: drei Leben', '#ffd9a0') +
    grp(3, 'queue3', 'Zu dritt', 'Jeder gegen jeden: drei Leben, nur der Beste verliert keins', '#d6ecff') +
    grp(4, 'queue4', 'Zu viert', 'Jeder gegen jeden: nur der Beste verliert kein Leben', '#dff3c8') +
    '<button class="htile mode" style="--tc:#ffe0f0" data-act="friends"><span class="mart"><span class="hv">' + gi('heart', 40, '#ff6f9a') + gi('heart', 30, '#ff9ac4') + '</span><span class="codebig jit" style="font-size:26px;letter-spacing:3px">ABCD</span></span><span class="grow"><b>Mit Freunden</b><span class="small">Raum mit Code, ohne Belohnung</span></span></button>' +
    '<button class="htile mode" style="--tc:#ffd9d0" data-act="solo"><span class="mart"><span class="hv">' + gi('star', 40, '#ff9a5a') + ball(topType(), 50, .7) + '</span></span><span class="grow"><b>Einzelspieler</b><span class="small">Tagesaufgabe und Boss' + (S.me.freeBoxes ? ' - ' + S.me.freeBoxes + ' Gratis-Box' : '') + '</span></span></button></div>');
}

/* ================= Freunde ================= */
function friends() {
  S.screen = 'friends'; setView(null);
  show('<div class="col">' + backBar('Mit Freunden', 'multi') +
    '<div class="panel"><p class="center">Erstelle einen Raum und gib deinen Freunden den Code. Leere Plätze füllen Bots auf. Es gibt keine Belohnung, aber auch keine Verluste.</p></div>' +
    btn('Raum erstellen: 1 gegen 1', 'room1', '', 'pri') + btn('Raum erstellen: 2 gegen 2', 'room2') +
    '<h3 class="center mt" style="color:#fff;text-shadow:2px 2px 0 var(--ink)">Einem Raum beitreten</h3><div class="inp"><input id="rc" maxlength="4" placeholder="CODE" style="text-transform:uppercase;text-align:center;font:400 34px var(--f-display)"></div>' + btn('Beitreten', 'roomjoin') + '</div>');
}
function roomScreen() {
  S.screen = 'room'; setView(null);
  const r = S.room, n = r.slots.length;
  const slot = i => {
    const nm = r.slots[i];
    return '<div class="listrow card"><span class="grow">' + (nm ? '<b>' + esc(nm) + '</b>' + (i === r.youSlot ? ' (du)' : '') : '<span class="mute">frei (Bot)</span>') + '</span>' + (!nm ? '<button class="btn sm" data-act="roomslot" data-s="' + i + '">Hierhin</button>' : '') + '</div>';
  };
  const teams = n > 2 && r.mode >= 3 ? [0, 1, 2, 3].slice(0, n).map(i => '<h3 style="color:' + PLAYER_COL[i] + ';text-shadow:1px 1px 0 var(--ink)">Spieler ' + (i + 1) + '</h3>' + slot(i)).join('') : n === 2 ? '<h3>Spieler 1</h3>' + slot(0) + '<h3>Spieler 2</h3>' + slot(1)
    : '<h3 style="color:#cfe4ff;text-shadow:1px 1px 0 var(--ink)">Team Blau</h3>' + slot(0) + slot(1) + '<h3 style="color:#ffd0c8;text-shadow:1px 1px 0 var(--ink)">Team Rot</h3>' + slot(2) + slot(3);
  show('<div class="col"><h2 class="center jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Raum</h2><p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Code für deine Freunde:</p><div class="panel codebig jit">' + esc(r.code) + '</div>' + teams +
    (r.youHost ? btn('Kampf starten', 'roomstart', '', 'pri') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Warte, bis ' + esc(r.host) + ' startet.</p>') + btn('Raum verlassen', 'roomleave') + '</div>');
}

/* ================= Warteschlange ================= */
const QTIPS = ['Tipp: Jeder Stern gibt +8 % Leben und Schaden.', 'Tipp: Starke Bälle haben oft eine klare Schwäche. Lies die Beschreibung.', 'Tipp: Wähle die Richtung so, dass du den Gegner schnell triffst.', 'Tipp: Doppelte Bälle kannst du verbessern oder auf dem Markt verkaufen.', 'Tipp: Nach 45 Sekunden rücken die Wände zusammen.', 'Tipp: Täglich gibt es eine Belohnung zum Abholen.'];
function queueScreen(m) {
  S.screen = 'queue'; setView(null);
  let t0 = Date.now(), wait = (m.wait || 15) * 1000;
  const mine = topType();
  S.qreset = mm => { t0 = Date.now(); wait = (mm.wait || 15) * 1000; };
  show('<div class="col center qwrap"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Suche Gegner<span id="qdots"></span></h2>' +
    '<div class="qstage"><div class="qside"><div class="qring"></div><div class="qball bounce">' + ball(mine, 120, .62) + '</div><div class="qname">' + esc(S.me.name) + '</div></div>' +
    '<div class="qvs jit">VS</div>' +
    '<div class="qside"><div class="qring r2"></div><div class="qball" id="qfoe"></div><div class="qname">???</div></div></div>' +
    '<div class="panel"><p>' + (m.mode === 2 ? 'Team-Kampf (2 gegen 2)' : m.mode === 3 ? 'Mehrspieler: zu dritt' : m.mode === 4 ? 'Mehrspieler: zu viert' : 'Kampf (1 gegen 1)') + '</p><p id="qc" class="small mute"></p>' +
    '<div class="progress mt"><i id="qbar" style="width:0%"></i></div><p class="small mt" id="qmsg">Warte auf einen Mitspieler ... <b id="qt">0</b> s</p></div>' +
    '<p class="small center" id="qtip" style="color:#fff;text-shadow:1px 1px 0 var(--ink);min-height:40px">' + QTIPS[Math.floor(Math.random() * QTIPS.length)] + '</p>' +
    btn('Abbrechen', 'unqueue') + '</div>');
  const foe = () => { const f = $('#qfoe'); if (!f) return; f.innerHTML = ball(BALL_IDS[Math.floor(Math.random() * BALL_IDS.length)], 120, .62, 'data-dark="1"'); decorate(f); };
  foe();
  every(() => {
    const el = (Date.now() - t0) / 1000, t = $('#qt'), bar = $('#qbar'), msg = $('#qmsg'), d = $('#qdots');
    if (t) t.textContent = Math.floor(el);
    if (bar) bar.style.width = Math.min(100, el * 1000 / wait * 100) + '%';
    if (d) d.textContent = '.'.repeat(Math.floor(el * 2) % 4);
    if (msg && el * 1000 >= wait) msg.textContent = 'Kein Spieler gefunden: Ein Bot springt ein ...';
  }, 250);
  every(foe, 900);
  let ti = 0; every(() => { const e = $('#qtip'); if (e) e.textContent = QTIPS[(ti = (ti + 1) % QTIPS.length)]; }, 4500);
  queueUpdate(m);
}
function queueUpdate(m) { const e = $('#qc'); if (e) e.textContent = m.count + (m.need ? ' von ' + m.need : '') + ' Spieler in der Warteschlange'; if (S.qreset) S.qreset(m); }

/* ================= Kampf ================= */
function livesHTML(count, max) { let h = ''; for (let i = 0; i < (max || 3); i++) h += gi(i < count ? 'heart' : 'heart0', 26); return '<span class="lives">' + h + '</span>'; }
function matchHeader() {
  const m0 = S.match;
  if (m0.solo) return '<div id="mh" class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink);padding-right:52px">' + esc(m0.title) + '</div>';
  if (m0.ffa) {
    const cell = p => { const l = m0.lives[p.team], out = l <= 0; return '<div style="text-align:center;opacity:' + (out ? .45 : 1) + '"><div class="small" style="color:' + PLAYER_COL[p.team] + ';font-weight:700;text-shadow:1px 1px 0 var(--ink);max-width:' + Math.floor(250 / m0.n) + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.slot === m0.you ? 'Du' : esc(p.name)) + '</div>' + livesHTML(l, m0.n === 3 ? 3 : 2) + '</div>'; };
    return '<div id="mh"><div class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink);padding-right:52px">' + (m0.replay ? 'Wiederholung - Runde ' + m0.round : m0.friendly ? 'Freundschaftsspiel' : 'Runde ' + m0.round) + '</div><div class="row sb gap6" style="padding-right:4px">' + m0.players.map(cell).join('') + '</div></div>';
  }
  const m = S.match, me = m.players[m.you], my = me.team, en = 1 - my;
  const nm = t => m.n === 2 ? esc(m.players.find(p => p.team === t).name) : (t === my ? 'Dein Team' : 'Gegner');
  return '<div class="row sb" id="mh" style="padding-right:52px"><div><div class="small" style="color:#cfe4ff;text-shadow:1px 1px 0 var(--ink)">' + (m.n === 2 ? 'Du' : 'Dein Team') + '</div>' + livesHTML(m.lives[my]) + '</div>' +
    '<div class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">' + (m.replay ? 'Wiederholung - Runde ' + m.round : m.friendly ? 'Freundschaftsspiel' : 'Runde ' + m.round) + '</div>' +
    '<div style="text-align:right"><div class="small" style="color:#ffd0c8;text-shadow:1px 1px 0 var(--ink)">' + nm(en) + '</div>' + livesHTML(m.lives[en]) + '</div></div>';
}
function matchIntro() {
  const m = S.match; S.screen = 'matchintro'; setView(null); setScene('fight'); sfx('go');
  const nm = p => (p.slot === m.you ? 'Du' : esc(p.name) + (p.bot ? ' (Bot)' : ''));
  show('<div class="col center" style="margin-top:8vh"><h2 class="jit pop" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">' + (m.ffa ? 'Spieler gefunden!' : 'Gegner gefunden!') + '</h2><div class="panel pop">' +
    (m.ffa ? m.players.map(p => '<p><b style="color:' + PLAYER_COL[p.team] + '">' + nm(p) + '</b></p>').join('') : m.n === 2 ? '<h3>' + nm(m.players[0]) + '</h3><div class="big" style="font-size:40px;margin:4px 0">gegen</div><h3 style="color:var(--red)">' + nm(m.players[1]) + '</h3>' :
      '<p><b style="color:' + TEAM_COL[0] + '">Team Blau:</b> ' + [0, 1].map(i => nm(m.players[i])).join(' und ') + '</p><p><b style="color:' + TEAM_COL[1] + '">Team Rot:</b> ' + [2, 3].map(i => nm(m.players[i])).join(' und ') + '</p><p class="small mute">Eure Leben werden im Team geteilt.</p>') +
    '<p class="mute mt">' + (m.ffa ? 'Jeder gegen jeden. Zwei Leben. In jeder Runde verlieren alle außer dem Besten ein Leben. Der Letzte gewinnt.' : 'Drei Leben. Wer keins mehr hat, verliert.') + '</p></div></div>');
}
let pickSel = null, countdownEnd = 0;
function startCountdown(secs, id) {
  countdownEnd = Date.now() + secs * 1000;
  every(() => { const e = $(id || '#cd'); if (e) e.textContent = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000)) + ' Sekunden'; }, 250);
}
function pickScreen(m) {
  const M = S.match; if (!M) return;
  M.round = m.round; M.lives = m.lives; S.screen = 'pick'; setView(null); pickSel = m.picked || null; setScene('fight');
  show('<div class="col">' + matchHeader() + '<h2 class="center jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Wähle deinen Ball</h2><p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Dein Gegner sieht ihn erst, wenn alle gewählt haben.</p><div id="cd" class="timer" style="color:#fff;text-shadow:2px 2px 0 var(--ink)"></div>' +
    m.hand.map(h => {
      const d = DEFS[h.type];
      return '<button class="card pickrow rbar slide" style="--rc:' + RARITY[d.rarity].color + '" data-act="pick" data-uid="' + h.uid + '">' + ball(h.type, 96, .66) +
        '<div class="txt"><b style="font:400 25px var(--f-display)">' + esc(d.name) + '</b>' + rarHTML(d.rarity) + (h.stars ? '<span>' + starsHTML(h.stars, 17) + '</span>' : '') + '<span class="small">' + gi('heart', 18) + ' ' + d.hp + '   ' + gi('sword', 18) + ' ' + d.dmg + '</span><span class="small mute">' + esc(d.desc.split('.')[0]) + '.</span></div></button>';
    }).join('') + '<div id="pickbtn">' + btn('Diesen Ball wählen', 'pickgo', 'disabled', 'pri') + '</div></div>');
  startCountdown(m.secs);
  if (pickSel) selectPick(pickSel, true);
}
function selectPick(uid, locked) {
  pickSel = uid;
  SCREEN.querySelectorAll('[data-act="pick"]').forEach(el => el.classList.toggle('sel', String(el.dataset.uid) === String(uid)));
  const b = $('#pickbtn'); if (b && !locked) b.innerHTML = btn('Diesen Ball wählen', 'pickgo', '', 'pri');
  if (locked) { const b2 = $('#pickbtn'); if (b2) b2.innerHTML = '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Gewählt. Warte auf die anderen ...</p>'; }
}
let dirDeg = 0, dirTouched = false, dirSent = false;
function arenaSize() { return Math.min(window.innerWidth - 36, 460, Math.max(240, window.innerHeight - 330)); }
function dirScreen(m) {
  const M = S.match; if (!M) return;
  S.screen = 'dir'; dirSent = false; dirTouched = false;
  const balls = m.balls.map(b => ({ slot: b.slot, type: b.type, team: M.players[b.slot].team, deg: 0 }));
  const sim = createSim({ seed: 1, balls, total: M.n, noFx: true });
  const my = sim.balls.find(b => b.slot === M.you), en = sim.balls.find(b => b.team !== my.team);
  dirDeg = Math.round((Math.atan2(en.y - my.y, en.x - my.x) * 180 / Math.PI + 360) % 360);
  const AS = arenaSize(), W = AS + 20, H = AS + 20;
  show('<div class="col">' + matchHeader() + '<h2 class="center jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Startrichtung</h2>' +
    '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Tippe in die Arena, um die Richtung deines Balls zu wählen. Dein Gegner wählt gleichzeitig.</p><div id="cd" class="timer" style="color:#fff;text-shadow:2px 2px 0 var(--ink)"></div>' +
    '<canvas id="dc" class="view"></canvas><div class="small center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">' + m.balls.map(b => { const p = M.players[b.slot]; return (b.slot === M.you ? 'Dein' : esc(p.name)) + ': <b>' + esc(ballName(b.type)) + '</b>'; }).join(' - ') + '</div>' +
    btn('Los!', 'dirgo', '', 'pri') + '</div>');
  startCountdown(m.secs);
  const cv = $('#dc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const k = AS / BOX, ox = 10, oy = 10;
  const setDeg = ev => {
    const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left - ox) / k, y = (ev.clientY - r.top - oy) / k;
    dirDeg = Math.round((Math.atan2(y - my.y, x - my.x) * 180 / Math.PI + 360) % 360); dirTouched = true;
  };
  let down = false;
  cv.onpointerdown = ev => { down = true; cv.setPointerCapture(ev.pointerId); setDeg(ev); sfx('tick'); };
  cv.onpointermove = ev => { if (down) setDeg(ev); };
  cv.onpointerup = () => { down = false; };
  const auto = setTimeout(() => { if (!dirSent && dirTouched) sendDir(); }, Math.max(500, m.secs * 1000 - 700));
  S.timers.push(auto);
  setView({
    stop() { clearTimeout(auto); },
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      sim.fx.length = 0;
      drawArena(ctx, ox, oy, AS, sim, tf, tm, dt, M.you, M.players, { noBars: true });
      const a = dirDeg * Math.PI / 180, x0 = ox + my.x * k, y0 = oy + my.y * k, L = 54 + Math.sin(tm * 5) * 4;
      const x1 = x0 + Math.cos(a) * (my.r * k + L), y1 = y0 + Math.sin(a) * (my.r * k + L), xs = x0 + Math.cos(a) * (my.r * k + 6), ys = y0 + Math.sin(a) * (my.r * k + 6);
      ctx.lineCap = ctx.lineJoin = 'round';
      for (const [w, col] of [[9, INK], [5, '#f4c942']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(x1, y1);
        ctx.moveTo(x1 - Math.cos(a - .5) * 16, y1 - Math.sin(a - .5) * 16); ctx.lineTo(x1, y1); ctx.lineTo(x1 - Math.cos(a + .5) * 16, y1 - Math.sin(a + .5) * 16); ctx.stroke();
      }
    }
  });
}
function sendDir() { if (dirSent) return; dirSent = true; wsSend({ t: 'dir', deg: dirDeg }); }

function hudHTML(M) {
  const order = M.players.slice().sort((a, b) => (a.team === M.players[M.you].team ? 0 : 1) - (b.team === M.players[M.you].team ? 0 : 1) || a.slot - b.slot);
  return '<div class="hud" style="grid-template-columns:1fr 1fr">' + order.map(p =>
    '<div class="hp ' + (p.team === M.players[M.you].team ? 'me' : 'foe') + '" data-slot="' + p.slot + '"' + (M.ffa ? ' style="' + (M.lives[p.team] <= 0 ? 'display:none;' : '') + 'border-color:' + PLAYER_COL[p.team] + '"' : '') + '><div class="nm">' + esc(p.slot === M.you ? 'Du' : p.name) + ' - <span class="bn"></span></div><div class="bar"><i></i></div></div>').join('') + '</div>';
}
function fightScreen(m) {
  const M = S.match; if (!M) return;
  S.screen = 'fight'; clearFx(); setScene('fight');
  M.round = m.round;
  const sim = createSim(m.cfg);
  sim.slotMax = {}; for (const b of sim.balls) sim.slotMax[b.slot] = (sim.slotMax[b.slot] || 0) + b.maxHp;
  const AS = arenaSize(), W = AS + 20, H = AS + 20, myTeam = M.players[M.you].team;
  show('<div class="col">' + matchHeader() + hudHTML(M) + '<div style="position:relative;width:' + W + 'px;margin:0 auto"><canvas id="fc" class="view"></canvas><div id="cdwrap"></div></div><div id="fres"></div>' +
    '<div id="fbtn" class="row gap6"></div></div>');
  const cv = $('#fc'); cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const hp = {}; SCREEN.querySelectorAll('.hp').forEach(el => { hp[el.dataset.slot] = { bar: el.querySelector('i'), bn: el.querySelector('.bn') }; });
  for (const b of sim.balls) if (hp[b.slot]) hp[b.slot].bn.textContent = DEFS[b.skin || b.type].name;
  let acc = 0, phase = 'count', t0 = 0, koT = 0, sentReady = false, cdN = 4, tPhase = 0, resShown = false;
  const cdw = $('#cdwrap');
  const NB = () => m.replay ? (M.idx + 1 < M.rec.rounds.length ? btn('Nächste Runde', 'replaynext', '', 'pri') : '') + btn(M.solo ? 'Weiter' : 'Zurück', 'replayback', '', M.solo ? 'pri' : '') : btn('Weiter', 'fightnext', '', 'pri');
  const finish = () => {
    resShown = true;
    const win = m.winner === myTeam, draw = m.winner < 0;
    M.lives = m.lives; const mh = $('#mh'); if (mh) mh.outerHTML = matchHeader();
    if (!M.ffa) { sfx(win ? 'win' : 'lose'); if (win) confetti(46); }
    if (M.ffa) {
      const L = m.losers || [], mine = L.includes(myTeam), out = M.lives[myTeam] <= 0, nm = M.players.filter(p => L.includes(p.team) && p.team !== myTeam).map(p => esc(p.name));
      sfx(mine ? 'lose' : 'win'); if (!mine) confetti(30);
      const head = !L.length ? 'Unentschieden!' : mine ? 'Du verlierst ein Leben!' : 'Du bleibst verschont!';
      const sub = !L.length ? 'Niemand verliert ein Leben.' : (mine ? (out ? 'Das war dein letztes Leben. ' : '') + (nm.length ? 'Auch ' + nm.join(', ') + ' verlieren eins.' : '') : nm.join(', ') + (nm.length > 1 ? ' verlieren' : ' verliert') + ' ein Leben.') + (m.over && !mine ? ' Das war der letzte Kampf.' : '');
      $('#fres').innerHTML = '<div class="panel center pop"><h2 class="jit" style="font-size:40px;color:' + (!L.length ? '#8a6a1a' : mine ? '#c93030' : '#2f8a3a') + '">' + head + '</h2><p class="small mute">' + sub + '</p></div>';
      $('#fbtn').innerHTML = '<div class="grow">' + NB() + '</div>';
      window.scrollTo(0, document.body.scrollHeight); return;
    }
    $('#fres').innerHTML = draw ? '<div class="panel center pop"><h2 class="jit" style="font-size:44px;color:#8a6a1a">Unentschieden!</h2><p class="small mute">Beide waren gleichzeitig besiegt. Niemand verliert ein Leben.</p></div>' :
      '<div class="panel center pop"><h2 class="jit" style="font-size:44px;color:' + (win ? '#2f8a3a' : '#c93030') + '">' + (win ? 'Runde gewonnen!' : 'Runde verloren!') + '</h2><p class="small mute">' +
      (m.over ? (win ? 'Das war der letzte Kampf.' : 'Das war dein letztes Leben.') : (win ? 'Der Gegner verliert ein Leben.' : 'Du verlierst ein Leben.')) + '</p></div>';
    $('#fbtn').innerHTML = '<div class="grow">' + NB() + '</div>';
    window.scrollTo(0, document.body.scrollHeight);
  };
  // "Weiter": Bereitmeldung senden und alle 2,5 s wiederholen, bis die nächste Runde kommt (bei kurzem Verbindungsabbruch ging die Meldung sonst verloren)
  S.fightNext = () => {
    if (sentReady) return; sentReady = true;
    const b = $('#fbtn'); if (b) b.innerHTML = '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Warte auf die anderen ...</p>';
    const send = () => { if (S.wsOK && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ t: 'ready' })); };
    send(); every(send, 2500);
  };
  S.fightSkip = () => {
    if (phase === 'ko' || phase === 'done') return; sim.noFx = true; let g2 = 6000;
    while (!sim.over && g2-- > 0 && sim.step < m.steps + 5) stepSim(sim);
    sim.fx.length = 0; clearFx(); phase = 'ko'; koT = 0.01; sim.winner = m.winner; sim.over = true;
    cdw.innerHTML = '';
  };
  let lastSec = -1;
  setView({
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      let sdt = Math.min(dt, .05);
      if (phase === 'count') {
        tPhase += sdt;
        const n = 3 - Math.floor(tPhase / .75);
        if (n !== cdN) { cdN = n; if (n > 0) { cdw.innerHTML = '<div id="cdnum">' + n + '</div>'; sfx('tick'); } else if (n === 0) { cdw.innerHTML = '<div id="cdnum" style="font-size:90px">Los!</div>'; sfx('go'); } }
        if (tPhase >= 3 * .75 + .45) { phase = 'run'; cdw.innerHTML = ''; }
      } else if (phase === 'run') {
        if (fxState.hitstop > 0) { fxState.hitstop -= sdt; sdt = 0; }
        else if (fxState.ko > 0) { fxState.ko -= sdt; sdt *= .3; }
        acc += sdt;
        let n = 0;
        while (acc >= DT && !sim.over && n++ < 8) { stepSim(sim); acc -= DT; }
        if (!sim.over && sim.step >= m.steps + 5) { sim.over = true; sim.winner = m.winner; }
        if (sim.over) { sim.winner = m.winner; phase = 'ko'; koT = 0; }
      } else if (phase === 'ko') {
        koT += dt; sdt = dt * .3;
        if (koT > 1.5 && !resShown) { phase = 'done'; finish(); }
      } else if (phase === 'done' && !sentReady && performance.now() / 1000 - tm > -1) {
        koT += dt; if (koT > 8 && !m.replay) S.fightNext();
      }
      // Slow-Motion beim Treffer des Endschlags: Effekte laufen langsam weiter
      for (const s2 of fxState.sound) sfx(s2[0], s2[1]);
      fxState.sound.length = 0;
      drawArena(ctx, 10, 10, AS, sim, tf, tm, phase === 'ko' || fxState.ko > 0 ? sdt || dt * .3 : dt, M.you, M.players);
      for (const b of sim.balls) {
        const h = hp[b.slot]; if (!h) continue;
      }
      for (const p of M.players) {
        const h = hp[p.slot]; if (!h) continue;
        let cur = 0, mx = 0;
        for (const b of sim.balls) if (b.slot === p.slot) { mx += b.maxHp; if (!b.dead) cur += Math.max(0, b.hp); }
        const base = mx || 1, pc = Math.max(0, Math.min(100, cur / base * 100));
        h.bar.style.width = pc.toFixed(1) + '%';
      }
    }
  });
}

function matchEndFfa(m) {
  S.match = null; S.screen = 'end'; setView(null); setScene('menu');
  if (m.me) setMe(m.me);
  const ord = ['1.', '2.', '3.', '4.'][m.place - 1];
  show('<div class="col center res"><h1 class="jit pop" style="color:' + (m.win ? '#fff' : '#ffd0c8') + ';text-shadow:3px 4px 0 var(--ink)">' + (m.win ? 'Sieg!' : ord + ' Platz') + '</h1>' +
    '<div class="hero ' + (m.win ? 'bounce' : '') + '">' + (m.win ? '<div class="rays"></div>' : '') + '<div style="position:relative">' + ball(topType(), 180, .62) + '</div></div>' +
    (m.win ? '' : '<div class="panel"><p>Du bist als ' + ord + ' von ' + m.n + ' Spielern ausgeschieden.</p></div>') +
    (m.friendly ? '<div class="panel"><p>Freundschaftsspiel - keine Belohnung.</p></div>' : '<div class="panel pop"><p>Belohnung</p><div class="big">' + coinHTML('+' + m.coins) + '</div>' + (m.tokens ? '<div class="big" style="font-size:38px;margin-top:4px">' + tokHTML('+' + m.tokens) + '</div>' : '') + '</div>') +
    btn('Nochmal kämpfen', 'queue' + m.n, '', 'pri') + btn('Zur Startseite', 'home') + '</div>');
  if (m.win) { confetti(60); sfx('win'); } else sfx('lose');
}
function matchEnd(m) {
  if (m.ffa) return matchEndFfa(m);
  S.match = null; S.screen = 'end'; setView(null); setScene('menu');
  if (m.me) setMe(m.me);
  show('<div class="col center res"><h1 class="jit pop" style="color:' + (m.win ? '#fff' : '#ffd0c8') + ';text-shadow:3px 4px 0 var(--ink)">' + (m.win ? 'Sieg!' : 'Niederlage') + '</h1>' +
    '<div class="hero ' + (m.win ? 'bounce' : '') + '">' + (m.win ? '<div class="rays"></div>' : '') + '<div style="position:relative">' + ball(topType(), 180, .62) + '</div></div>' +
    (m.friendly ? '<div class="panel"><p>Freundschaftsspiel - keine Belohnung.</p></div>' : '<div class="panel pop"><p>Belohnung</p><div class="big">' + coinHTML('+' + m.coins) + '</div>' + (m.tokens ? '<div class="big" style="font-size:38px;margin-top:4px">' + tokHTML('+' + m.tokens) + '</div>' : '') + '</div>') +
    btn('Nochmal kämpfen', 'queue1', '', 'pri') + btn('Zur Startseite', 'home') + '</div>');
  if (m.win) { confetti(60); sfx('win'); } else sfx('lose');
}

/* ================= Aktionen ================= */
const ACT = {
  reload() { location.reload(); },
  home() { closeOverlay(); home(); },
  closeov() { closeOverlay(); },
  async register() {
    const name = $('#nm').value.trim();
    const r = await api('/api/login', { name });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    connectWS(); home();
  },
  queue1() { if (S.match) return; wsSend({ t: 'queue', mode: 1 }); },
  queue3() { if (S.match) return; wsSend({ t: 'queue', mode: 3 }); },
  queue4() { if (S.match) return; wsSend({ t: 'queue', mode: 4 }); },
  multi() { multi(); },
  queue2() { if (S.match) return; wsSend({ t: 'queue', mode: 2 }); },
  unqueue() { wsSend({ t: 'unqueue' }); },
  friends() { friends(); },
  room1() { wsSend({ t: 'room_create', mode: 1 }); },
  room2() { wsSend({ t: 'room_create', mode: 2 }); },
  room3() { wsSend({ t: 'room_create', mode: 3 }); },
  room4() { wsSend({ t: 'room_create', mode: 4 }); },
  roomjoin() { const c = ($('#rc').value || '').trim(); if (c.length < 4) { toast('Gib den 4-stelligen Code ein.'); return; } wsSend({ t: 'room_join', code: c }); },
  roomslot(d) { wsSend({ t: 'room_slot', slot: +d.s }); },
  roomstart() { wsSend({ t: 'room_start' }); },
  roomleave() { wsSend({ t: 'room_leave' }); },
  handel() { handelScreen(); },
  limited() { limitedScreen(); },
  solo() { soloScreen(); },
  solopick(d) { soloPick(d.k); },
  solofight(d) { return soloFight(d.k, d.uid); },
  async bossreset() { const r = await api('/api/solo/boss', { reset: true }); if (r.err) { toast(errText(r.err)); return; } soloScreen(); },
  log() { S.logItems = null; logScreen('list'); },
  logtab(d) { logScreen(d.t); },
  logopen(d) { logDetail(Number(d.id)); },
  logback() { logScreen(); },
  replay(d) { const M = S.logRec && !S.guestRec ? S.logRec.rec : S.guestRec; replayRound(M, Number(d.i), S.guestRec ? () => showRounds(S.guestRec, 'Geteilter Kampf', 'logexit', false) : () => showRounds(S.logRec.rec, 'Kampf vom ' + new Date(S.logRec.rec.ts).toLocaleDateString('de-DE') + ' - ' + MODE_NAME(S.logRec.rec), 'logback', true)); },
  replaynext() { const M = S.match; if (M && M.replay) replayRound(M.rec, M.idx + 1, M.back); },
  replayback() { const M = S.match; S.match = null; clearFx(); if (M && M.back) M.back(); else home(); },
  async logshare(d) {
    const r = await api('/api/log/share', { id: Number(d.id) }); if (r.err) { toast(errText(r.err)); return; }
    const url = location.origin + '/#replay=' + r.token;
    try { if (navigator.share) { await navigator.share({ title: 'Ball gegen Ball', text: 'Schau dir meinen Kampf an!', url }); return; } } catch (e) { }
    try { await navigator.clipboard.writeText(url); toast('Link kopiert.'); } catch (e) { overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Link zum Teilen</h2><div class="panel"><p class="small" style="word-break:break-all">' + esc(url) + '</p></div>' + btn('Schließen', 'closeov') + '</div>'); }
  },
  logexit() { S.guestRec = null; history.replaceState(null, '', location.pathname); closeOverlay(); S.match = null; boot2(); },
  collection() { collection(); },
  cfilter(d) { S.col[d.k] = d.v; collection(); },
  cown() { S.col.own = !S.col.own; collection(); },
  detail(d) { detail(d.t); },
  async upgrade(d) {
    const t = (S.me.balls.find(b => b.uid === +d.uid) || {}).type;
    const r = await api('/api/upgrade', { uid: +d.uid });
    if (r.err) { toast(errText(r.err)); return; }
    sfx('rare'); confetti(18); toast('Verbessert auf ' + r.stars + ' Stern' + (r.stars > 1 ? 'e' : '') + '!');
    if (t) detail(t);
    if (S.screen === 'collection') { const g = $('#cgrid'); if (g) { g.innerHTML = colGrid(); decorate(g); } }
  },
  async mklist(d) {
    const price = parseInt(($('#pr' + d.uid) || {}).value, 10);
    const r = await api('/api/market/list', { uid: +d.uid, price });
    if (r.err) { toast(errText(r.err)); return; }
    toast('Ball steht jetzt auf dem Markt.'); closeOverlay(); collection();
  },
  upall() {
    const p = upAllPlan();
    overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Alles verbessern?</h2><div class="panel"><p>Es werden <b>' + p.steps + ' Sterne</b> vergeben und dafür <b>' + p.used + ' Duplikate</b> verbraucht. Von jeder Sorte bleibt mindestens ein Exemplar.</p></div>' + btn('Ja, verbessern', 'upallgo', '', 'green') + btn('Abbrechen', 'closeov') + '</div>');
  },
  async upallgo() {
    const r = await api('/api/upgradeall', {});
    if (r.err) { toast(errText(r.err)); return; }
    closeOverlay(); sfx('rare'); confetti(30); toast(r.steps + ' Sterne vergeben, ' + r.used + ' Duplikate verbraucht.');
    collection();
  },
  async mkcancel(d) {
    const r = await api('/api/market/cancel', { uid: +d.uid });
    if (r.err) { toast(errText(r.err)); return; }
    toast('Angebot zurückgezogen.'); closeOverlay(); if (d.back === 'market') market(); else collection();
  },
  box() { closeOverlay(); boxScreen(); },
  boxdetail(d) { closeOverlay(); boxDetail(d.id); },
  openbox(d) { return openBox(d.id); },
  market() { market(true); },
  mktab(d) { S.mk.tab = d.v; market(true); },
  mkrar(d) { S.mk.rarity = d.v; market(true); },
  mksort(d) { S.mk.sort = d.v; market(true); },
  mksearch() { S.mk.q = ($('#mkq').value || '').trim(); market(true); },
  mkprev() { S.mk.page--; market(); },
  mknext() { S.mk.page++; market(); },
  async mkbuy(d) {
    const r = await api('/api/market/buy', { uid: +d.uid });
    if (r.err) { toast(errText(r.err)); if (r.err === 'gone') market(); return; }
    sfx('coin'); toast(ballName(r.type) + ' gekauft!'); market();
  },
  trades() { S.tr.tab = 'in'; trades(); },
  ttab(d) { S.tr.tab = d.v; trades(); },
  async tfind() {
    const name = ($('#tname').value || '').trim(); S.tnew.name = name;
    const r = await api('/api/player', { name });
    if (r.err) { $('#err').textContent = errText(r.err); S.tnew.player = null; return; }
    if (r.self) { $('#err').textContent = errText('self'); return; }
    S.tnew.player = r.player; S.tnew.give = new Set(); S.tnew.want = new Set(); trades();
  },
  tgive(d) { const s = S.tnew.give, u = +d.uid; s.has(u) ? s.delete(u) : s.add(u); keepTradeInputs(); },
  twant(d) { const s = S.tnew.want, u = +d.uid; s.has(u) ? s.delete(u) : s.add(u); keepTradeInputs(); },
  async tsend() {
    const t = S.tnew;
    const r = await api('/api/trade/create', {
      to: t.player.name, give: [...t.give], want: [...t.want],
      coinsGive: parseInt($('#cgive').value, 10) || 0, coinsWant: parseInt($('#cwant').value, 10) || 0
    });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    toast('Angebot gesendet.'); S.tnew = { name: '', player: null, give: new Set(), want: new Set() }; S.tr.tab = 'out'; trades();
  },
  async tans(d) {
    const r = await api('/api/trade/answer', { id: +d.id, action: d.a });
    if (r.err) { toast(errText(r.err)); trades(); return; }
    toast(d.a === 'accept' ? 'Tausch abgeschlossen!' : 'Erledigt.'); trades();
  },
  async daily() {
    const r = await api('/api/daily');
    if (r.err) { toast(errText(r.err)); return; }
    sfx('coin'); confetti(24);
    toast('+' + r.gain + ' Münzen' + (r.tokens ? ' und +' + r.tokens + ' Marken' : '') + ' (Tag ' + r.streak + ' in Folge)'); home();
  },
  async testcoins() {
    const r = await api('/api/testcoins', { key: 'leif-test' });
    if (r.err) { toast(errText(r.err)); return; }
    sfx('coin'); toast('999999 Münzen und Marken'); home();
  },
  settings() {
    const m = getMode();
    overlay('<div class="col"><div class="row sb"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Einstellungen</h2><button class="btn sm" data-act="closeov">' + gi('cross', 24) + '</button></div>' +
      '<div class="panel"><p><b>Name:</b> ' + esc(S.me.name) + '</p>' + btn('Name ändern', 'rename') + '</div>' +
      '<div class="panel"><p><b>Ton:</b> ' + (m === 2 ? 'Ton und Musik an' : m === 1 ? 'Nur Effekte' : 'Stumm') + '</p>' + btn('Ton umschalten', 'sndcycle') + '</div>' +
      '<div class="panel"><p><b>Spielstand übertragen</b></p><p class="small mute">Nimm dein Konto auf ein anderes Gerät mit. Das alte Gerät wird danach abgemeldet.</p>' + btn('Auf anderes Gerät übertragen', 'xferout') + btn('Spielstand von anderem Gerät laden', 'xferin') + '</div>' +
      '<div class="panel"><p><b>Konto löschen</b></p><p class="small mute">Löscht dein Konto mit allen Bällen, Münzen und Siegen. Das kann nicht rückgängig gemacht werden.</p>' + btn('Konto löschen', 'delask', '', 'red') + '</div></div>');
  },
  async xferout() {
    const r = await api('/api/transfer/create', {});
    if (r.err) { toast(errText(r.err)); return; }
    overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Dein Übertragungscode</h2><div class="panel center"><div class="codebig jit" style="font-size:42px;letter-spacing:4px">' + esc(r.code) + '</div><p class="small mute">10 Minuten gültig, nur einmal benutzbar.</p></div>' +
      '<div class="panel"><p>Öffne das Spiel auf dem neuen Gerät und tippe auf "Ich habe schon einen Spielstand". Gib dort diesen Code ein. Danach ist dein Konto auf dem neuen Gerät, und dieses Gerät wird abgemeldet.</p></div>' + btn('Schließen', 'closeov') + '</div>');
  },
  xferin() {
    overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Spielstand laden</h2><div class="panel"><p>Erzeuge auf dem alten Gerät unter Einstellungen einen Übertragungscode und gib ihn hier ein.</p></div>' +
      '<div class="inp"><input id="xc" maxlength="12" placeholder="CODE" autocomplete="off" style="text-transform:uppercase;text-align:center;font:400 30px var(--f-display)"></div><div class="err" id="err" style="color:#ffd0c8"></div>' + btn('Laden', 'xfergo', '', 'pri') + btn('Abbrechen', 'closeov') + '</div>');
  },
  async xfergo() {
    const r = await api('/api/transfer/redeem', { code: $('#xc').value });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    closeOverlay(); toast('Spielstand übernommen.');
    if (S.ws) { try { S.ws.close(); } catch (e) { } }
    connectWS(); home();
  },
  sndcycle() { unlock(); const m = (getMode() + 2) % 3; setMode(m); sndIcon(); if (m) sfx('click'); ACT.settings(); },
  delask() {
    overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Konto wirklich löschen?</h2><div class="panel"><p>Alle Bälle, Münzen und Siege sind danach für immer weg. Tippe zur Bestätigung deinen Namen ein:</p><p class="mt"><b>' + esc(S.me.name) + '</b></p></div><div class="inp"><input id="dn" autocomplete="off" placeholder="Dein Name"></div><div class="err" id="err" style="color:#ffd0c8"></div>' + btn('Endgültig löschen', 'delgo', '', 'red') + btn('Abbrechen', 'closeov') + '</div>');
  },
  async delgo() {
    const r = await api('/api/delete', { name: $('#dn').value.trim() });
    if (r.err) { $('#err').textContent = r.err === 'confirm_name' ? 'Der Name stimmt nicht.' : errText(r.err); return; }
    S.kicked = true; try { if (S.ws) S.ws.close(); } catch (e) { }
    lset('bvb_token', ''); location.reload();
  },
  rename() {
    overlay('<div class="col"><h2 class="jit" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">Neuer Name</h2><div class="inp"><input id="nn" maxlength="16" value="' + esc(S.me.name) + '"></div><div class="err" id="err" style="color:#ffd0c8"></div>' + btn('Speichern', 'renamego', '', 'pri') + btn('Abbrechen', 'closeov') + '</div>');
  },
  async renamego() {
    const r = await api('/api/rename', { name: $('#nn').value.trim() });
    if (r.err) { $('#err').textContent = errText(r.err); return; }
    closeOverlay(); home();
  },
  pick(d) { selectPick(d.uid); },
  pickgo() { if (pickSel == null) return; wsSend({ t: 'pick', uid: +pickSel }); selectPick(pickSel, true); },
  dirgo() { sendDir(); const b = SCREEN.querySelector('[data-act="dirgo"]'); if (b) b.outerHTML = '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Gewählt. Warte auf die anderen ...</p>'; },
  skip() { if (S.fightSkip) S.fightSkip(); },
  fightnext() { if (S.fightNext) S.fightNext(); }
};
function keepTradeInputs() {
  const a = ($('#cgive') || {}).value, b = ($('#cwant') || {}).value, nm = ($('#tname') || {}).value;
  S.tnew.name = nm || S.tnew.name; S.trSkip = true;
  trades().then(() => { if ($('#cgive')) $('#cgive').value = a || ''; if ($('#cwant')) $('#cwant').value = b || ''; });
}
document.addEventListener('pointerdown', () => unlock(), { once: false, passive: true });
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) {
    // Solange eine Anfrage an den Server läuft (Kaufen, Öffnen, Verbessern ...), zählen weitere Klicks nicht: bei Lag wurde sonst doppelt bezahlt
    if (S.busy) return;
    sfx(t.dataset.act === 'home' || t.dataset.act === 'closeov' ? 'back' : 'click');
    try { if (navigator.vibrate) navigator.vibrate(7); } catch (e) { }   // kurzes Antippen-Gefühl auf Handys
    const r = fn(t.dataset, t, ev);
    if (r && typeof r.then === 'function') {
      S.busy = true; t.disabled = true;
      const done = () => { S.busy = false; t.disabled = false; };
      r.then(done, done);
    }
  }
});
$('#snd').addEventListener('click', () => { unlock(); const m = (getMode() + 2) % 3; setMode(m); sndIcon(); toast(m === 2 ? 'Ton und Musik an' : m === 1 ? 'Nur Effekte' : 'Stumm'); if (m) sfx('click'); });
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'nm') ACT.register();
});

boot();
