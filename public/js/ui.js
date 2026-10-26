// Oberfläche: Anmeldung, Startseite, Sammlung, Ballboxen, Markt, Handel, Freunde und Kampfablauf.
import { DEFS, BALL_IDS, RARITY, DT, BOX, MAX_STARS, STAR_BONUS, createSim, stepSim, ballsInBox } from './engine.js';
import { createBox, stepBox, BW } from './boxsim.js';
import { BOX_LIST, BOX_BY_ID, boxActive, UP_COST } from './boxes.js';
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
  daily_taken: 'Heute schon abgeholt.', no_coins: 'Nicht genug Münzen.', tutorial_box: 'Öffne zuerst deine Standard-Box.', no_tokens: 'Nicht genug Halloween-Marken.', box_over: 'Diese Box gibt es nicht mehr.',
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
const rarHTML = r => '<span class="rar" style="color:' + RARITY[r].color + '">' + RARITY[r].name + '</span>';
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
const SORT = ['gewoehnlich', 'selten', 'episch', 'legendaer'];
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
  return '<div class="row gap6">' + (eventLive() ? '<div class="pill" title="Halloween-Marken">' + tokHTML(S.me.tokens) + '</div>' : '') + '<div class="pill">' + coinHTML(S.me.coins) + '</div></div>';
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
    btn('Los geht\'s', 'register', '', 'pri big') + '<p class="small center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Dein Gerät merkt sich dein Konto. 3 bis 16 Zeichen.</p></div>');
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
        if (S.match && !m.inMatch) { S.match = null; toast('Der Kampf wurde beendet.'); home(); }
      } else toast('Server-Anmeldung fehlgeschlagen.');
      break;
    case 'kicked': S.kicked = true; show('<div class="col center"><h1>Ball gegen Ball</h1><div class="panel"><p>Dein Konto wurde auf einem anderen Gerät oder Tab geöffnet.</p></div>' + btn('Hier weiterspielen', 'reload') + '</div>'); break;
    case 'error': toast(errText(m.code)); break;
    case 'queued': if (S.screen !== 'queue') queueScreen(m); else queueUpdate(m); break;
    case 'unqueued': home(); break;
    case 'room': S.room = m; roomScreen(); break;
    case 'room_left': S.room = null; friends(); break;
    case 'match_start': S.match = { players: m.players, you: m.you, n: m.n, mode: m.mode, ffa: !!m.ffa, lives: m.lives, friendly: m.friendly, round: 0 }; if (m.resume) toast('Wieder verbunden.'); else matchIntro(); break;
    case 'pick_phase': pickScreen(m); break;
    case 'reveal': dirScreen(m); break;
    case 'fight': fightScreen(m); break;
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
  show('<div class="col" style="padding-top:2px"><div class="row sb" style="padding-right:50px"><div class="pill">' + esc(me.name) + '</div></div><div class="row" style="justify-content:flex-end;margin-top:-6px">' + wallet() + '</div>' +
    '<h1 class="jit">Ball gegen Ball</h1>' +
    '<div class="hero bounce">' + ball(topType(), 170, .62) + '</div>' +
    '<div class="center small" style="color:#fff;text-shadow:1px 2px 0 var(--ink)">' + me.wins + ' Siege - ' + me.losses + ' Niederlagen - ' + types + ' von ' + BALL_IDS.length + ' Bällen</div>' +
    (ev ? '<button class="panel boxcard event" style="padding:10px 14px" data-act="boxdetail" data-id="halloween">' + gi('token', 46) + '<div class="grow"><h3>Halloween-Box ist da!</h3><span class="small">' + timeLeft(me.eventEnd - now()) + ' - 6 neue Bälle</span></div>' + gi('arrow', 26).replace('<img', '<img style="transform:scaleX(-1)"') + '</button>' : '') +
    btn('<span class="fsw l">' + gi('sword', 58) + '</span><span class="ftx">Kampf!</span><span class="fsw r">' + gi('sword', 58) + '</span>', 'queue1', '', 'fight') + btn('Mit Freunden spielen', 'friends') + btn('Mehrspieler (3 oder 4)', 'multi') +
    '<div class="row gap6"><div class="grow">' + btn('Sammlung', 'collection') + '</div><div class="grow">' + btn('Ballboxen', 'box') + '</div></div>' +
    '<div class="row gap6"><div class="grow">' + btn('Markt', 'market') + '</div><div class="grow">' + btn('Tauschen', 'trades') + '</div></div>' +
    (me.dailyReady ? btn('Tagesbelohnung abholen' + (ev ? ' (+5 Marken)' : ''), 'daily', '', 'green') : '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Tagesbelohnung schon geholt. Morgen gibt es mehr.</p>') +
    (/[?&]test=1/.test(location.search) ? btn('TEST: unendlich Münzen und Marken', 'testcoins', '', 'red') : '') +
    btn(gi('gear', 26) + ' Einstellungen', 'settings') + '</div>');
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
    if (!free) continue;
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
  const sugg = { gewoehnlich: 40, selten: 100, episch: 250, legendaer: 700 }[d.rarity];
  let own = '';
  if (c) {
    const lvl = Math.max(...c.list.map(x => x.stars)), free = c.list.filter(x => !x.lock);
    let up = '';
    if (free.length) {
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
  show('<div class="col">' + backBar('Ballboxen') +
    '<div class="boxgrid">' + list.map(b => '<button class="boxtile" data-act="boxdetail" data-id="' + b.id + '"><div class="boxin">' + boxArt(b.id, 150) + '<div class="nm">' + esc(b.name) + '</div></div>' + (b.until ? '<span class="tag">Begrenzt</span>' : '') + '</button>').join('') + '</div></div>');
}
function boxDetail(id) {
  const b = BOX_BY_ID[id];
  if (!b || !boxActive(id, now())) { toast('Diese Box gibt es nicht mehr.'); return boxScreen(); }
  S.screen = 'boxdetail'; setView(null); S.curBox = id;
  const st = boxStats(id), c = typeCounts(), have = b.cur === 'tokens' ? S.me.tokens : S.me.coins, ok = have >= b.price;
  const byR = SORT.map(r => [r, st.ids.filter(t => DEFS[t].rarity === r).length]).filter(x => x[1]);
  show('<div class="col">' + backBar(b.name, 'box') +
    '<div class="hero bounce" style="margin-top:6px">' + boxArt(b.id, 170) + '</div>' +
    '<div class="panel"><h3>' + esc(b.name) + '</h3><p class="mt">' + esc(b.desc) + '</p><div class="row sb wrap mt"><span>Kosten: ' + priceHTML(b) + '</span><span>' + st.own + ' von ' + st.n + ' gesammelt</span></div><div class="progress thin"><i style="width:' + Math.round(st.own / st.n * 100) + '%;background:' + b.col + '"></i></div></div>' +
    (b.until ? '<div class="panel center" style="background:#ffd9a0">' + gi('token', 30) + ' <b>Nur kurze Zeit!</b> Die Box verschwindet am 1. November. ' + timeLeft(b.until - now()) + '.<div class="small mt">Halloween-Marken bekommst du für Kämpfe (Sieg 3, Niederlage 1) und die Tagesbelohnung (5). Übrige Marken verfallen. Die Bälle behältst du für immer.</div></div>' : '') +
    '<div class="panel"><h3>Das kann drin sein</h3><div class="grid3" style="margin-top:6px;grid-template-columns:repeat(4,1fr);gap:6px">' +
    st.ids.sort((a, z) => RARITY[DEFS[z].rarity].order - RARITY[DEFS[a].rarity].order).map(t => '<button data-act="detail" data-t="' + t + '" style="position:relative;text-align:center">' + ball(t, 66, .64, c[t] ? '' : 'data-dark="1"') + '<div class="small" style="font-size:13px;line-height:1;margin-top:-6px;color:' + RARITY[DEFS[t].rarity].color + '">' + (c[t] ? esc(DEFS[t].name.replace('ball', '')) : '???') + '</div></button>').join('') +
    '</div></div>' +
    '<div class="panel"><h3>Chancen</h3>' + byR.map(r => '<div class="row sb"><span>' + rarHTML(r[0]) + ' <span class="small mute">(' + r[1] + ' Bälle)</span></span><span>' + RARITY[r[0]].weight + ' %</span></div>').join('') + '</div>' +
    btn('Öffnen für ' + priceHTML(b), 'openbox', (ok ? '' : 'disabled') + ' data-id="' + id + '"', 'pri big') +
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
  const s = createBox(r.seed, 10); let acc = 0, fin = 0, shown = false, lastN = 0, flash = 0, skip = false;
  SCREEN.onpointerdown = () => { if (S.screen === 'boxplay') skip = true; };
  setView({
    frame(tm, dt, tf) {
      const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.scale(DPR, DPR);
      // Spannung: kurz vor der Öffnung läuft alles in Zeitlupe
      let near = false;
      for (const x of s.balls) if (!x.done && x.y > 300) near = true;
      const rate = s.order.length ? 1 : near ? .45 : 1;
      if (skip && !shown) { let g = 20000; while (!s.done && s.order.length < 3 && g-- > 0) stepBox(s); }
      acc += dt * 120 * rate;
      while (acc >= 1 && !s.done && s.order.length < 3) { stepBox(s); acc--; }
      if (s.order.length > lastN) { if (lastN === 0) { flash = 1; sfx('pop'); } lastN = s.order.length; }
      flash = Math.max(0, flash - dt * 2.5);
      if (s.order.length >= 3 || s.done) { if (!fin) fin = tm; }
      drawBox(ctx, W, s, r.cands, tm, tf, s.order.length ? s.order[0] : -1, b.col, b.id);
      if (flash > 0) { ctx.fillStyle = 'rgba(255,250,200,' + flash * .5 + ')'; ctx.fillRect(0, 0, W, H); }
      if (fin && (tm - fin > 1.4 || skip) && !shown) { shown = true; boxResult(r, s, before, b); }
    }
  });
}
function boxResult(r, s, before, b) {
  S.screen = 'boxres'; setView(null); SCREEN.onpointerdown = null;
  const d = DEFS[r.ball.type], isNew = !before.has(r.ball.type), rar = d.rarity;
  const near = s.order.slice(1, 3).map(i => r.cands[i]).filter(t => RARITY[DEFS[t].rarity].order > RARITY[rar].order);
  const have = b.cur === 'tokens' ? S.me.tokens : S.me.coins, ok = have >= b.price && boxActive(b.id, now());
  const big = rar === 'episch' || rar === 'legendaer';
  show('<div class="col res"><h1 class="jit pop" style="color:#fff;text-shadow:3px 4px 0 var(--ink)">' + esc(d.name) + '!</h1><div>' + rarHTML(rar).replace('rar"', 'rar" style="font-size:22px;background:var(--paper);padding:1px 10px;border:2px solid var(--ink);border-radius:8px;color:' + RARITY[rar].color + '"') + '</div>' +
    '<div class="hero sheet-ball" style="min-height:250px;align-items:center">' + (big ? '<div class="rays"></div>' : '') + '<div class="pop" style="position:relative">' + ball(r.ball.type, 240, .66) + '</div></div>' +
    (isNew ? '<div class="center"><span class="tag" style="font-size:24px;padding:2px 14px">Neu in deiner Sammlung!</span></div>' : '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Du hast ihn schon (Duplikat). Verkaufe oder tausche ihn.</p>') +
    '<div class="panel" style="text-align:left"><div class="row sb wrap"><span>' + gi('heart', 22) + ' <b>' + d.hp + '</b> Leben</span><span>' + gi('sword', 22) + ' Schaden: <b>' + d.dmg + '</b></span></div><p class="mt">' + esc(d.desc) + '</p></div>' +
    (near.length ? '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Knapp daneben: ' + near.map(t => '<b style="color:' + RARITY[DEFS[t].rarity].color + ';background:var(--paper);padding:0 6px;border-radius:6px">' + esc(ballName(t)) + '</b>').join(' und ') + ' lag auch vorn!</p>' : '') +
    (new Set(S.me.balls.map(x => x.type)).size < 3 ? btn('Weiter', 'home', '', 'pri big') : btn('Noch eine Box (' + priceHTML(b) + ')', 'openbox', (ok ? '' : 'disabled') + ' data-id="' + b.id + '"', 'pri') + btn('Zu den Boxen', 'box')) + '</div>');
  sfx(rar === 'legendaer' ? 'legend' : big ? 'rare' : 'coin');
  if (big) confetti(rar === 'legendaer' ? 70 : 40);
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
  show('<div class="col">' + backBar('Markt') + '<div class="tabs"><button class="tab' + (mk.tab === 'buy' ? ' on' : '') + '" data-act="mktab" data-v="buy">Kaufen</button><button class="tab' + (mk.tab === 'mine' ? ' on' : '') + '" data-act="mktab" data-v="mine">Meine Angebote</button></div>' + body + '<p class="small center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Beim Verkauf werden 5 % Gebühr abgezogen.</p></div>');
}

/* ================= Tauschen ================= */
async function trades() {
  S.screen = 'trades'; setView(null);
  const tab = S.tr.tab;
  let body = '';
  if (tab === 'new') {
    const t = S.tnew, myFree = S.me.balls.filter(b => !b.lock);
    const chip = (b, set, act) => '<button class="tab' + (set.has(b.uid) ? ' on' : '') + '" data-act="' + act + '" data-uid="' + b.uid + '">' + esc(ballName(b.type)) + (b.stars ? ' ' + b.stars + '*' : '') + '</button>';
    body = '<div class="row gap6"><div class="inp grow"><input id="tname" placeholder="Spielername" value="' + esc(t.name) + '"></div><button class="btn sm pri" data-act="tfind">Suchen</button></div>' +
      '<div class="err" id="err"></div>' +
      (t.player ? '<div class="panel"><h3>Du gibst</h3><div class="tabs mt">' + (myFree.map(b => chip(b, t.give, 'tgive')).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6 mt"><span>und</span><div class="inp" style="width:100px"><input id="cgive" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + gi('coin', 22) + '</div></div>' +
        '<div class="panel"><h3>Du willst von ' + esc(t.player.name) + '</h3><div class="tabs mt">' + (t.player.balls.map(b => chip(b, t.want, 'twant')).join('') || '<span class="mute small">Nichts frei</span>') + '</div>' +
        '<div class="row gap6 mt"><span>und</span><div class="inp" style="width:100px"><input id="cwant" type="number" inputmode="numeric" min="0" placeholder="0"></div>' + gi('coin', 22) + '</div></div>' +
        btn('Angebot senden', 'tsend', '', 'pri') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Suche einen Spieler über seinen Namen.</p>');
  } else {
    const r = await api('/api/trades');
    if (r.err) { toast(errText(r.err)); return; }
    const list = tab === 'in' ? r.incoming : tab === 'out' ? r.outgoing : r.history;
    const bl = a => a.length ? a.map(b => esc(b.type ? ballName(b.type) : '?') + (b.stars ? ' ' + b.stars + '*' : '')).join(', ') : '-';
    body = list.length ? list.map(t => {
      const other = t.mine ? t.to : t.from;
      let acts = '';
      if (tab === 'in') acts = '<div class="row gap6"><button class="btn sm green" data-act="tans" data-id="' + t.id + '" data-a="accept">Annehmen</button><button class="btn sm red" data-act="tans" data-id="' + t.id + '" data-a="decline">Ablehnen</button></div>';
      else if (tab === 'out') acts = '<button class="btn sm" data-act="tans" data-id="' + t.id + '" data-a="cancel">Zurückziehen</button>';
      const you = t.mine ? t.give : t.want, they = t.mine ? t.want : t.give, cy = t.mine ? t.coinsGive : t.coinsWant, ct = t.mine ? t.coinsWant : t.coinsGive;
      const ST = { accepted: 'angenommen', declined: 'abgelehnt', cancelled: 'zurückgezogen', expired: 'abgelaufen' };
      return '<div class="card col" style="gap:6px"><div class="row sb"><b>' + esc(other) + '</b>' + (tab === 'hist' ? '<span class="small">' + (ST[t.status] || t.status) + '</span>' : '') + '</div>' +
        '<p class="small">Du gibst: ' + bl(you) + (cy ? ' + ' + coinHTML(cy) : '') + '</p><p class="small">Du bekommst: ' + bl(they) + (ct ? ' + ' + coinHTML(ct) : '') + '</p>' + acts + '</div>';
    }).join('') : '<p class="center" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Nichts da.</p>';
  }
  const tabs = [['in', 'Eingehend'], ['out', 'Ausgehend'], ['new', 'Neu'], ['hist', 'Verlauf']];
  show('<div class="col">' + backBar('Tauschen') + '<div class="tabs">' + tabs.map(t => '<button class="tab' + (tab === t[0] ? ' on' : '') + '" data-act="ttab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' + body + '</div>');
}

/* ================= Mehrspieler ================= */
function multi() {
  S.screen = 'multi'; setView(null);
  show('<div class="col">' + backBar('Mehrspieler') +
    '<div class="panel"><p class="center">Jeder gegen jeden: Alle kämpfen gleichzeitig in einer Arena. Jeder hat zwei Leben. Wer in einer Runde zuerst besiegt wird, verliert ein Leben. Wer keins mehr hat, scheidet aus. Der Letzte gewinnt. Fehlende Spieler füllen Bots auf.</p></div>' +
    btn('Zu dritt kämpfen', 'queue3', '', 'pri') + btn('Zu viert kämpfen', 'queue4', '', 'pri') +
    '<p class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">Mit Freunden: Unter "Mit Freunden spielen" kannst du einen Raum für 3 oder 4 Spieler erstellen.</p></div>');
}

/* ================= Freunde ================= */
function friends() {
  S.screen = 'friends'; setView(null);
  show('<div class="col">' + backBar('Mit Freunden') +
    '<div class="panel"><p class="center">Erstelle einen Raum und gib deinen Freunden den Code. Leere Plätze füllen Bots auf. Es gibt keine Belohnung, aber auch keine Verluste.</p></div>' +
    btn('Raum erstellen: 1 gegen 1', 'room1', '', 'pri') + btn('Raum erstellen: 2 gegen 2', 'room2') + btn('Raum erstellen: zu dritt', 'room3') + btn('Raum erstellen: zu viert', 'room4') +
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
  const t0 = Date.now(), wait = (m.wait || 15) * 1000, mine = topType();
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
function queueUpdate(m) { const e = $('#qc'); if (e) e.textContent = m.count + ' Spieler in der Warteschlange'; }

/* ================= Kampf ================= */
function livesHTML(count, max) { let h = ''; for (let i = 0; i < (max || 3); i++) h += gi(i < count ? 'heart' : 'heart0', 26); return '<span class="lives">' + h + '</span>'; }
function matchHeader() {
  const m0 = S.match;
  if (m0.ffa) {
    const cell = p => { const l = m0.lives[p.team], out = l <= 0; return '<div style="text-align:center;opacity:' + (out ? .45 : 1) + '"><div class="small" style="color:' + PLAYER_COL[p.team] + ';font-weight:700;text-shadow:1px 1px 0 var(--ink);max-width:' + Math.floor(250 / m0.n) + 'px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.slot === m0.you ? 'Du' : esc(p.name)) + '</div>' + livesHTML(l, 2) + '</div>'; };
    return '<div id="mh"><div class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink);padding-right:52px">' + (m0.friendly ? 'Freundschaftsspiel' : 'Runde ' + m0.round) + '</div><div class="row sb gap6" style="padding-right:4px">' + m0.players.map(cell).join('') + '</div></div>';
  }
  const m = S.match, me = m.players[m.you], my = me.team, en = 1 - my;
  const nm = t => m.n === 2 ? esc(m.players.find(p => p.team === t).name) : (t === my ? 'Dein Team' : 'Gegner');
  return '<div class="row sb" id="mh" style="padding-right:52px"><div><div class="small" style="color:#cfe4ff;text-shadow:1px 1px 0 var(--ink)">' + (m.n === 2 ? 'Du' : 'Dein Team') + '</div>' + livesHTML(m.lives[my]) + '</div>' +
    '<div class="center small" style="color:#fff;text-shadow:1px 1px 0 var(--ink)">' + (m.friendly ? 'Freundschaftsspiel' : 'Runde ' + m.round) + '</div>' +
    '<div style="text-align:right"><div class="small" style="color:#ffd0c8;text-shadow:1px 1px 0 var(--ink)">' + nm(en) + '</div>' + livesHTML(m.lives[en]) + '</div></div>';
}
function matchIntro() {
  const m = S.match; S.screen = 'matchintro'; setView(null); setScene('fight'); sfx('go');
  const nm = p => (p.slot === m.you ? 'Du' : esc(p.name) + (p.bot ? ' (Bot)' : ''));
  show('<div class="col center" style="margin-top:8vh"><h2 class="jit pop" style="color:#fff;text-shadow:2px 3px 0 var(--ink)">' + (m.ffa ? 'Spieler gefunden!' : 'Gegner gefunden!') + '</h2><div class="panel pop">' +
    (m.ffa ? m.players.map(p => '<p><b style="color:' + PLAYER_COL[p.team] + '">' + nm(p) + '</b></p>').join('') : m.n === 2 ? '<h3>' + nm(m.players[0]) + '</h3><div class="big" style="font-size:40px;margin:4px 0">gegen</div><h3 style="color:var(--red)">' + nm(m.players[1]) + '</h3>' :
      '<p><b style="color:' + TEAM_COL[0] + '">Team Blau:</b> ' + [0, 1].map(i => nm(m.players[i])).join(' und ') + '</p><p><b style="color:' + TEAM_COL[1] + '">Team Rot:</b> ' + [2, 3].map(i => nm(m.players[i])).join(' und ') + '</p><p class="small mute">Eure Leben werden im Team geteilt.</p>') +
    '<p class="mute mt">' + (m.ffa ? 'Jeder gegen jeden. Zwei Leben. Wer zuerst besiegt wird, verliert ein Leben. Der Letzte gewinnt.' : 'Drei Leben. Wer keins mehr hat, verliert.') + '</p></div></div>');
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
  for (const b of sim.balls) if (hp[b.slot]) hp[b.slot].bn.textContent = DEFS[b.type].name;
  let acc = 0, phase = 'count', t0 = 0, koT = 0, sentReady = false, cdN = 4, tPhase = 0, resShown = false;
  const cdw = $('#cdwrap');
  const finish = () => {
    resShown = true;
    const win = m.winner === myTeam, draw = m.winner < 0;
    M.lives = m.lives; const mh = $('#mh'); if (mh) mh.outerHTML = matchHeader();
    if (!M.ffa) { sfx(win ? 'win' : 'lose'); if (win) confetti(46); }
    if (M.ffa) {
      const fp = m.first >= 0 ? M.players.find(p => p.team === m.first) : null, mine = m.first === myTeam, out = M.lives[myTeam] <= 0;
      sfx(mine ? 'lose' : 'win'); if (!mine && m.first >= 0) confetti(30);
      $('#fres').innerHTML = '<div class="panel center pop"><h2 class="jit" style="font-size:40px;color:' + (!fp ? '#8a6a1a' : mine ? '#c93030' : '#2f8a3a') + '">' + (!fp ? 'Unentschieden!' : mine ? 'Du verlierst ein Leben!' : esc(fp.name) + ' verliert ein Leben!') + '</h2><p class="small mute">' +
        (mine && out ? 'Das war dein letztes Leben.' : !fp ? 'Niemand verliert ein Leben.' : m.over ? 'Das war der letzte Kampf.' : '') + '</p></div>';
      $('#fbtn').innerHTML = '<div class="grow">' + btn('Weiter', 'fightnext', '', 'pri') + '</div>';
      window.scrollTo(0, document.body.scrollHeight); return;
    }
    $('#fres').innerHTML = draw ? '<div class="panel center pop"><h2 class="jit" style="font-size:44px;color:#8a6a1a">Unentschieden!</h2><p class="small mute">Beide waren gleichzeitig besiegt. Niemand verliert ein Leben.</p></div>' :
      '<div class="panel center pop"><h2 class="jit" style="font-size:44px;color:' + (win ? '#2f8a3a' : '#c93030') + '">' + (win ? 'Runde gewonnen!' : 'Runde verloren!') + '</h2><p class="small mute">' +
      (m.over ? (win ? 'Das war der letzte Kampf.' : 'Das war dein letztes Leben.') : (win ? 'Der Gegner verliert ein Leben.' : 'Du verlierst ein Leben.')) + '</p></div>';
    $('#fbtn').innerHTML = '<div class="grow">' + btn('Weiter', 'fightnext', '', 'pri') + '</div>';
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
        koT += dt; if (koT > 8) S.fightNext();
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
        const base = sim.slotMax[p.slot] || mx || 1, pc = Math.max(0, Math.min(100, cur / base * 100));
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
      '<div class="panel"><p><b>Konto löschen</b></p><p class="small mute">Löscht dein Konto mit allen Bällen, Münzen und Siegen. Das kann nicht rückgängig gemacht werden.</p>' + btn('Konto löschen', 'delask', '', 'red') + '</div></div>');
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
  S.tnew.name = nm || S.tnew.name;
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
